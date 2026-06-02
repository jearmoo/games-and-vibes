#!/usr/bin/env python3
"""Deploy executor for the games monorepo.

Usage: python3 deploy.py <commit-sha>

Checks out the given commit and rebuilds Docker containers, but only
if the commit is newer than what is currently deployed.  Invoked by
listener.py as a subprocess — updates to this file take effect on the
next deploy without restarting the listener service.

Exit codes: 0 = success or skipped, non-zero = failure.
"""

import logging
import os
import subprocess
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_DIR = SCRIPT_DIR.parent.parent
LOG_FILE = SCRIPT_DIR / 'deploy.log'
IMAGES = ['adversarial-taboo', 'charades', 'odes-for-cave-men', 'castlefall', 'two-rooms-and-a-boom', 'games-landing']
DEPLOY_TIMEOUT = 280  # seconds

# --- Logging (shared log file with listener) ---

logger = logging.getLogger('deploy.exec')
logger.setLevel(logging.INFO)

formatter = logging.Formatter('[%(asctime)s] %(message)s', datefmt='%Y-%m-%dT%H:%M:%S%z')

file_handler = RotatingFileHandler(LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3)
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)


# --- Helpers ---

def run_cmd(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    """Run a command, log and print its output, return the result."""
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
            print(f'  {line}', flush=True)
    return result


def is_ancestor(older: str, newer: str) -> bool | None:
    """Return True if *older* is an ancestor of *newer*, or None on error."""
    result = run_cmd(['git', 'merge-base', '--is-ancestor', older, newer])
    if result.returncode == 128:
        logger.warning('is_ancestor: unknown commit(s) — older=%s newer=%s', older, newer)
        return None
    return result.returncode == 0


def get_deployed_sha() -> str | None:
    """Return the commit SHA baked into the first running container, or None."""
    for img in IMAGES:
        result = run_cmd([
            'docker', 'inspect', '--format',
            '{{index .Config.Labels "org.opencontainers.image.revision"}}',
            img,
        ])
        if result.returncode != 0:
            continue
        sha = result.stdout.strip()
        if not sha or sha == '<no value>':
            continue
        # Sanity check: a valid SHA is 40 hex characters
        if len(sha) == 40 and all(c in '0123456789abcdef' for c in sha):
            return sha
        logger.warning('Unexpected docker inspect output for %s: %s', img, sha[:80])
    return None


def log_and_print(msg: str) -> None:
    logger.info(msg)
    print(msg, flush=True)


# --- Main ---

def deploy(target_sha: str) -> int:
    """Deploy exactly *target_sha* if it is newer than what is running.

    Returns exit code (0 = success/skip, non-zero = failure).
    """
    log_and_print(f'Target commit: {target_sha}')

    deployed = get_deployed_sha()
    if deployed:
        log_and_print(f'Currently deployed: {deployed}')
        if target_sha == deployed:
            log_and_print('Already deployed. Skipping.')
            return 0
        ancestor = is_ancestor(target_sha, deployed)
        if ancestor is None:
            log_and_print('Cannot verify commit ancestry (unknown commits). Proceeding with deploy.')
        elif ancestor:
            log_and_print(
                f'Target {target_sha[:12]} is older than deployed {deployed[:12]}. Skipping.'
            )
            return 0
    else:
        log_and_print('No deployed commit found (first deploy or labels missing).')

    log_and_print(f'Checking out {target_sha}...')
    result = run_cmd(['git', 'checkout', target_sha])
    if result.returncode != 0:
        log_and_print(f'git checkout failed (exit {result.returncode})')
        return result.returncode

    log_and_print('Rebuilding all services...')
    env = {**os.environ, 'GIT_COMMIT': target_sha}
    result = run_cmd(['docker', 'compose', 'up', '--build', '-d'], env=env, timeout=DEPLOY_TIMEOUT)

    if result.returncode != 0:
        log_and_print(f'docker compose failed (exit {result.returncode})')
    else:
        log_and_print('Deploy complete.')

    return result.returncode


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(f'Usage: {sys.argv[0]} <commit-sha>', file=sys.stderr)
        sys.exit(2)
    sys.exit(deploy(sys.argv[1]))
