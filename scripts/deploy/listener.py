#!/usr/bin/env python3
"""Thin HTTP listener for deploy webhooks.

Listens on port 9877 for POST requests with a ``ref`` (git SHA).
Delegates actual deploy work to ``deploy.py`` via subprocess so that
updates to deploy logic take effect without restarting this service.

Queue semantics: if a deploy is already running, the latest incoming
SHA replaces any previously queued SHA.  After each deploy cycle the
queue is drained, converging to the latest requested commit.
"""

import json
import logging
import subprocess
import sys
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from logging.handlers import RotatingFileHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_DIR = SCRIPT_DIR.parent.parent
DEPLOY_SCRIPT = SCRIPT_DIR / 'deploy.py'
LOG_FILE = SCRIPT_DIR / 'deploy.log'
PORT = 9877
MAX_DEPLOY_CYCLES = 5
DEPLOY_TIMEOUT = 960  # seconds; must exceed deploy.py's Docker rebuild timeout
RESPONSE_TIMEOUT = 60  # max seconds before responding to HTTP request

# --- Logging ---

logger = logging.getLogger('deploy')
logger.setLevel(logging.INFO)

formatter = logging.Formatter('[%(asctime)s] %(message)s', datefmt='%Y-%m-%dT%H:%M:%S%z')

file_handler = RotatingFileHandler(LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3)
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

stream_handler = logging.StreamHandler()
stream_handler.setFormatter(formatter)
logger.addHandler(stream_handler)

# --- Queue state ---

_deploy_active = threading.Lock()
_pending_sha: str | None = None
_active_sha: str | None = None
_pending_lock = threading.Lock()


def get_active_sha() -> str | None:
    """Return the currently deploying SHA (thread-safe)."""
    with _pending_lock:
        return _active_sha


def set_active_sha(sha: str | None) -> None:
    """Set the currently deploying SHA (thread-safe)."""
    global _active_sha
    with _pending_lock:
        _active_sha = sha


def set_pending(sha: str) -> None:
    """Queue *sha* as the next deploy target, replacing any previous."""
    global _pending_sha
    with _pending_lock:
        if _active_sha and sha == _active_sha:
            logger.info('Skipping queue of %s — same as active deploy', sha[:12])
            return
        _pending_sha = sha


def take_pending() -> str | None:
    """Atomically take and clear the pending SHA."""
    global _pending_sha
    with _pending_lock:
        sha = _pending_sha
        _pending_sha = None
        return sha


# --- Deploy invocation ---

def run_deploy(sha: str, output_lines: list[str]) -> int:
    """Invoke deploy.py as a subprocess, streaming output into *output_lines*.

    Returns the exit code.
    """
    logger.info('Invoking deploy.py for %s', sha[:12])
    try:
        proc = subprocess.Popen(
            [sys.executable, '-u', str(DEPLOY_SCRIPT), sha],
            cwd=REPO_DIR,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        for line in proc.stdout:
            stripped = line.rstrip('\n')
            output_lines.append(stripped)
            logger.info('  %s', stripped)
        proc.wait(timeout=DEPLOY_TIMEOUT)
        return proc.returncode
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()
        msg = f'deploy.py timed out after {DEPLOY_TIMEOUT}s'
        logger.error(msg)
        output_lines.append(msg)
        return -1


# --- Deploy loop (runs in background thread) ---

class DeployResult:
    """Holds the result of a deploy loop, shared between thread and handler."""
    def __init__(self):
        self.code: int = 0
        self.output_lines: list[str] = []
        self.done = threading.Event()

    def snapshot(self) -> str:
        return '\n'.join(self.output_lines)


def _deploy_loop(sha: str, result: DeployResult) -> None:
    """Run deploy cycles, storing output in *result*. Releases _deploy_active when done."""
    try:
        current_sha = sha
        for cycle in range(1, MAX_DEPLOY_CYCLES + 1):
            logger.info('Deploy cycle %d starting for %s', cycle, current_sha)
            set_active_sha(current_sha)
            result.output_lines.append(f'--- cycle {cycle} ({current_sha[:12]}) ---')
            result.code = run_deploy(current_sha, result.output_lines)

            if result.code != 0:
                logger.error('Deploy cycle %d failed (exit %d); stopping', cycle, result.code)
                return

            next_sha = take_pending()
            if next_sha is None or next_sha == current_sha:
                return

            logger.info('Pending %s queued; running another cycle', next_sha[:12])
            current_sha = next_sha

        logger.warning('Hit max deploy cycles (%d); stopping', MAX_DEPLOY_CYCLES)
    except Exception as e:
        logger.exception('Deploy failed with exception')
        result.code = -1
        result.output_lines.append(str(e))
    finally:
        set_active_sha(None)
        _deploy_active.release()
        result.done.set()


# --- HTTP server ---

class DeployHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        ref_list = params.get('ref', [])
        target_sha = ref_list[0] if ref_list else None

        if not target_sha:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 0:
                try:
                    body = json.loads(self.rfile.read(content_length))
                    target_sha = body.get('ref')
                except (json.JSONDecodeError, Exception):
                    pass

        if not target_sha:
            self._respond(400, {'code': -1, 'output': 'Missing ref in query string or POST body'})
            return

        logger.info('Received deploy request for %s', target_sha)

        # Fetch latest so deploy.py has all commits for ancestry checks
        fetch = subprocess.run(
            ['git', 'fetch', 'origin', 'main'],
            cwd=REPO_DIR, capture_output=True, text=True,
        )
        if fetch.returncode != 0:
            logger.warning('git fetch failed (exit %d): %s', fetch.returncode, fetch.stderr.strip())

        if not _deploy_active.acquire(blocking=False):
            set_pending(target_sha)
            active = get_active_sha()
            msg = f'Deploy of {active[:12]} in progress; queued {target_sha[:12]}' if active else f'Deploy in progress; queued {target_sha[:12]}'
            logger.info(msg)
            self._respond(202, {'code': 0, 'output': msg})
            return

        # Set active SHA before starting thread to avoid race with concurrent requests
        set_active_sha(target_sha)

        # Start deploy in background thread
        result = DeployResult()
        thread = threading.Thread(target=_deploy_loop, args=(target_sha, result), daemon=True)
        thread.start()

        # Wait up to RESPONSE_TIMEOUT for completion
        result.done.wait(timeout=RESPONSE_TIMEOUT)

        if result.done.is_set():
            # Deploy finished within timeout — return full result
            status = 200 if result.code == 0 else 500
            self._respond(status, {'code': result.code, 'output': result.snapshot()})
        else:
            # Still running — return partial output and let it continue
            logger.info('Responding 202 after %ds; deploy continues in background', RESPONSE_TIMEOUT)
            self._respond(202, {'code': 0, 'output': result.snapshot()})

    def _respond(self, status: int, body: dict) -> None:
        payload = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format, *args):
        logger.info('HTTP %s', format % args)


if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', PORT), DeployHandler)
    logger.info('Deploy listener started on http://0.0.0.0:%d', PORT)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info('Shutting down')
        server.server_close()
