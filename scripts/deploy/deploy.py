#!/usr/bin/env python3
"""Deploy webhook listener and executor for the games monorepo.

Listens for POST requests on port 9877. Each request must include a
``ref`` query parameter with the git commit SHA that CI validated.
The script checks out that exact commit and rebuilds Docker containers,
but only if the commit is newer than what is currently deployed.

Concurrent requests are queued (not rejected): if a deploy is already
running, incoming SHAs are compared by ancestry and only the newest is
kept.  After each deploy cycle the queue is drained so the server always
converges to the latest validated commit.
"""

import logging
import json
import os
import subprocess
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from logging.handlers import RotatingFileHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_DIR = SCRIPT_DIR.parent.parent
LOG_FILE = SCRIPT_DIR / 'deploy.log'
PORT = 9877
IMAGES = ['games-adtaboo', 'games-landing']
DEPLOY_TIMEOUT = 280  # seconds (buffer under CI's 300s timeout)
MAX_DEPLOY_CYCLES = 5  # safety valve for the deploy loop

# --- Logging setup ---

logger = logging.getLogger('deploy')
logger.setLevel(logging.INFO)

formatter = logging.Formatter('[%(asctime)s] %(message)s', datefmt='%Y-%m-%dT%H:%M:%S%z')

file_handler = RotatingFileHandler(LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3)
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

stream_handler = logging.StreamHandler()
stream_handler.setFormatter(formatter)
logger.addHandler(stream_handler)


# --- Concurrency state ---

_deploy_active = threading.Lock()
_pending_sha: str | None = None
_pending_lock = threading.Lock()


# --- Helpers ---

def run_cmd(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    """Run a command, log its output, and return the result."""
    result = subprocess.run(
        cmd,
        cwd=kwargs.pop('cwd', REPO_DIR),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        **kwargs,
    )
    if result.stdout:
        for line in result.stdout.strip().splitlines():
            logger.info('  %s', line)
    return result


def is_ancestor(older: str, newer: str) -> bool:
    """Return True if *older* is an ancestor of *newer* in git history."""
    result = run_cmd(['git', 'merge-base', '--is-ancestor', older, newer])
    return result.returncode == 0


def get_deployed_sha() -> str | None:
    """Return the commit SHA baked into the first running container, or None."""
    for img in IMAGES:
        result = run_cmd([
            'docker', 'inspect', '--format',
            '{{index .Config.Labels "org.opencontainers.image.revision"}}',
            img,
        ])
        sha = result.stdout.strip()
        if sha and sha != '<no value>':
            return sha
    return None


def set_pending_sha(sha: str) -> None:
    """Store *sha* as the next deploy target, keeping only the newest."""
    global _pending_sha
    with _pending_lock:
        if _pending_sha is None or is_ancestor(_pending_sha, sha):
            _pending_sha = sha
        # else: existing pending SHA is already newer, keep it


def take_pending_sha() -> str | None:
    """Atomically take and clear the pending SHA."""
    global _pending_sha
    with _pending_lock:
        sha = _pending_sha
        _pending_sha = None
        return sha


# --- Deploy logic ---

def run_deploy(target_sha: str) -> tuple[int, str]:
    """Deploy exactly *target_sha* if it is newer than what is running.

    Returns (exit_code, combined_output).
    """
    output_lines: list[str] = []

    def log_and_collect(msg: str) -> None:
        logger.info(msg)
        output_lines.append(msg)

    log_and_collect(f'Target commit: {target_sha}')

    # Check against currently deployed commit
    deployed = get_deployed_sha()
    if deployed:
        log_and_collect(f'Currently deployed: {deployed}')
        if target_sha == deployed:
            log_and_collect('Already deployed. Skipping.')
            return 0, '\n'.join(output_lines)
        if is_ancestor(target_sha, deployed):
            log_and_collect(
                f'Target {target_sha[:12]} is older than deployed {deployed[:12]}. Skipping.'
            )
            return 0, '\n'.join(output_lines)
    else:
        log_and_collect('No deployed commit found (first deploy or labels missing).')

    # Checkout the exact commit
    log_and_collect(f'Checking out {target_sha}...')
    result = run_cmd(['git', 'checkout', target_sha])
    if result.stdout:
        output_lines.append(result.stdout.strip())
    if result.returncode != 0:
        log_and_collect(f'git checkout failed (exit {result.returncode})')
        return result.returncode, '\n'.join(output_lines)

    # Rebuild
    log_and_collect(f'Rebuilding for commit {target_sha}...')
    env = {**os.environ, 'GIT_COMMIT': target_sha}
    result = run_cmd(
        ['docker', 'compose', 'up', '--build', '-d'],
        env=env,
        timeout=DEPLOY_TIMEOUT,
    )
    if result.stdout:
        output_lines.append(result.stdout.strip())

    if result.returncode != 0:
        log_and_collect(f'docker compose failed (exit {result.returncode})')
    else:
        log_and_collect('Deploy complete.')

    return result.returncode, '\n'.join(output_lines)


# --- HTTP server ---

class DeployHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Extract ref from query string (?ref=<sha>)
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        ref_list = params.get('ref', [])
        target_sha = ref_list[0] if ref_list else None

        if not target_sha:
            self._respond(400, {'code': -1, 'output': 'Missing required query parameter: ref'})
            return

        # Fetch latest so we have all commits for ancestry checks
        logger.info('Received deploy request for %s', target_sha)
        run_cmd(['git', 'fetch', 'origin', 'main'])

        if not _deploy_active.acquire(blocking=False):
            # Deploy already running -- queue this SHA
            set_pending_sha(target_sha)
            logger.info('Deploy in progress; queued %s', target_sha)
            self._respond(202, {'code': 0, 'output': f'Deploy in progress; queued {target_sha}'})
            return

        try:
            code, output = self._deploy_loop(target_sha)
            status = 200 if code == 0 else 500
            self._respond(status, {'code': code, 'output': output})
        except subprocess.TimeoutExpired:
            logger.error('Deploy timed out after %ds', DEPLOY_TIMEOUT)
            self._respond(500, {'code': -1, 'output': f'Deploy timed out after {DEPLOY_TIMEOUT}s'})
        except Exception as e:
            logger.exception('Deploy failed with exception')
            self._respond(500, {'code': -1, 'output': str(e)})
        finally:
            _deploy_active.release()

    def _deploy_loop(self, sha: str) -> tuple[int, str]:
        """Run deploy, then drain the queue if newer SHAs arrived."""
        all_output: list[str] = []
        current_sha = sha

        for cycle in range(1, MAX_DEPLOY_CYCLES + 1):
            logger.info('Deploy cycle %d starting for %s', cycle, current_sha)
            code, output = run_deploy(current_sha)
            all_output.append(f'--- cycle {cycle} ({current_sha[:12]}) ---')
            all_output.append(output)

            if code != 0:
                logger.error('Deploy cycle %d failed (exit %d); stopping', cycle, code)
                return code, '\n'.join(all_output)

            next_sha = take_pending_sha()
            if next_sha is None:
                return code, '\n'.join(all_output)

            # Only loop if the pending SHA is actually newer
            if is_ancestor(next_sha, current_sha) or next_sha == current_sha:
                logger.info('Pending %s is not newer than %s; done', next_sha[:12], current_sha[:12])
                return code, '\n'.join(all_output)

            logger.info('Pending %s is newer; running another cycle', next_sha[:12])
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
