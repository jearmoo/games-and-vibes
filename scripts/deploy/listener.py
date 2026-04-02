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
DEPLOY_TIMEOUT = 300  # seconds

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

def run_deploy(sha: str) -> tuple[int, str]:
    """Invoke deploy.py as a subprocess. Returns (exit_code, output)."""
    logger.info('Invoking deploy.py for %s', sha[:12])
    try:
        result = subprocess.run(
            [sys.executable, str(DEPLOY_SCRIPT), sha],
            cwd=REPO_DIR,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=DEPLOY_TIMEOUT,
        )
        output = result.stdout.strip()
        if output:
            for line in output.splitlines():
                logger.info('  %s', line)
        return result.returncode, output
    except subprocess.TimeoutExpired:
        msg = f'deploy.py timed out after {DEPLOY_TIMEOUT}s'
        logger.error(msg)
        return -1, msg


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
        subprocess.run(
            ['git', 'fetch', 'origin', 'main'],
            cwd=REPO_DIR, capture_output=True,
        )

        if not _deploy_active.acquire(blocking=False):
            set_pending(target_sha)
            logger.info('Deploy in progress; queued %s', target_sha)
            self._respond(202, {'code': 0, 'output': f'Deploy in progress; queued {target_sha}'})
            return

        global _active_sha
        try:
            code, output = self._deploy_loop(target_sha)
            self._respond(200 if code == 0 else 500, {'code': code, 'output': output})
        except Exception as e:
            logger.exception('Deploy failed with exception')
            self._respond(500, {'code': -1, 'output': str(e)})
        finally:
            _active_sha = None
            _deploy_active.release()

    def _deploy_loop(self, sha: str) -> tuple[int, str]:
        global _active_sha
        all_output: list[str] = []
        current_sha = sha

        for cycle in range(1, MAX_DEPLOY_CYCLES + 1):
            logger.info('Deploy cycle %d starting for %s', cycle, current_sha)
            _active_sha = current_sha
            code, output = run_deploy(current_sha)
            all_output.append(f'--- cycle {cycle} ({current_sha[:12]}) ---')
            all_output.append(output)

            if code != 0:
                logger.error('Deploy cycle %d failed (exit %d); stopping', cycle, code)
                return code, '\n'.join(all_output)

            next_sha = take_pending()
            if next_sha is None or next_sha == current_sha:
                return code, '\n'.join(all_output)

            logger.info('Pending %s queued; running another cycle', next_sha[:12])
            current_sha = next_sha

        logger.warning('Hit max deploy cycles (%d); stopping', MAX_DEPLOY_CYCLES)
        return code, '\n'.join(all_output)

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
