#!/usr/bin/env python3
"""Deploy webhook listener and executor for the games monorepo.

Listens for POST requests on port 9877, pulls latest code, and rebuilds
Docker containers if the git commit has changed. All output (including
docker compose) is captured in a rotating log file.
"""

import json
import logging
import os
import subprocess
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from logging.handlers import RotatingFileHandler
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_DIR = SCRIPT_DIR.parent.parent
LOG_FILE = SCRIPT_DIR / 'deploy.log'
PORT = 9877
IMAGES = ['games-adtaboo', 'games-landing']
DEPLOY_TIMEOUT = 280  # seconds (buffer under CI's 300s timeout)

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


# --- Deploy logic ---

deploy_lock = threading.Lock()


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


def run_deploy() -> tuple[int, str]:
    """Pull latest code and rebuild containers if needed.

    Returns (exit_code, combined_output).
    """
    output_lines: list[str] = []

    def log_and_collect(msg: str) -> None:
        logger.info(msg)
        output_lines.append(msg)

    # Pull latest
    log_and_collect('Pulling latest from origin main...')
    result = run_cmd(['git', 'pull', '--ff-only', 'origin', 'main'])
    if result.stdout:
        output_lines.append(result.stdout.strip())
    if result.returncode != 0:
        log_and_collect(f'git pull failed (exit {result.returncode})')
        return result.returncode, '\n'.join(output_lines)

    # Get current commit
    result = run_cmd(['git', 'rev-parse', 'HEAD'])
    commit = result.stdout.strip()
    log_and_collect(f'Current commit: {commit}')

    # Check if all images are already at the current commit
    needs_build = False
    for img in IMAGES:
        result = run_cmd([
            'docker', 'inspect', '--format',
            '{{index .Config.Labels "org.opencontainers.image.revision"}}',
            img,
        ])
        built = result.stdout.strip()
        if built != commit:
            log_and_collect(f'{img}: built={built or "(none)"}, need={commit}')
            needs_build = True
            break
        else:
            log_and_collect(f'{img}: already at {commit}')

    if not needs_build:
        log_and_collect(f'All containers already at {commit}. Skipping rebuild.')
        return 0, '\n'.join(output_lines)

    # Rebuild
    log_and_collect(f'Rebuilding for commit {commit}...')
    env = {**os.environ, 'GIT_COMMIT': commit}
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
        if not deploy_lock.acquire(blocking=False):
            self._respond(409, {'code': -1, 'output': 'Deploy already in progress'})
            return
        try:
            code, output = run_deploy()
            status = 200 if code == 0 else 500
            self._respond(status, {'code': code, 'output': output})
        except subprocess.TimeoutExpired:
            logger.error('Deploy timed out after %ds', DEPLOY_TIMEOUT)
            self._respond(500, {'code': -1, 'output': f'Deploy timed out after {DEPLOY_TIMEOUT}s'})
        except Exception as e:
            logger.exception('Deploy failed with exception')
            self._respond(500, {'code': -1, 'output': str(e)})
        finally:
            deploy_lock.release()

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
