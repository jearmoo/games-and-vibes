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
IMAGES = ['adversarial-taboo', 'charades', 'odes-for-cave-men', 'games-landing']
DEPLOY_TIMEOUT = 280  # seconds

# Path prefixes → docker compose service names for selective rebuilds
SERVICE_PATHS = {
    'adtaboo': {'games/adtaboo/', 'packages/server-core/', 'packages/client-core/', 'packages/word-providers/', 'packages/test-utils/'},
    'charades': {'games/charades/', 'packages/word-providers/', 'packages/client-core/'},
    'odes-for-cave-men': {'games/odes-for-cave-men/', 'packages/server-core/', 'packages/client-core/', 'packages/test-utils/'},
    'landing': {'apps/landing/', 'packages/client-core/'},
}
# Changes to these files trigger a full rebuild of all services
GLOBAL_PATHS = {'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package.json', 'tsconfig.base.json', 'docker-compose.yml'}

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


def is_ancestor(older: str, newer: str) -> bool:
    """Return True if *older* is an ancestor of *newer* in git history."""
    result = run_cmd(['git', 'merge-base', '--is-ancestor', older, newer])
    if result.returncode == 128:
        logger.warning('is_ancestor: unknown commit(s) — older=%s newer=%s', older, newer)
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


def changed_services(old_sha: str, new_sha: str) -> list[str] | None:
    """Return service names that need rebuilding based on changed files.

    Returns None to rebuild all (fallback), [] if no services affected.
    """
    result = run_cmd(['git', 'diff', '--name-only', old_sha, new_sha])
    if result.returncode != 0:
        return None
    files = [f for f in result.stdout.strip().splitlines() if f]
    if not files:
        return []

    if any(f in GLOBAL_PATHS for f in files):
        return None

    services = set()
    for f in files:
        for svc, prefixes in SERVICE_PATHS.items():
            if any(f.startswith(p) for p in prefixes):
                services.add(svc)

    return sorted(services)


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
        if is_ancestor(target_sha, deployed):
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

    services = changed_services(deployed, target_sha) if deployed else None

    if services is not None and len(services) == 0:
        log_and_print('No Docker-relevant files changed. Skipping build.')
        return 0

    env = {**os.environ, 'GIT_COMMIT': target_sha}
    cmd = ['docker', 'compose', 'up', '--build', '-d']

    if services is not None:
        log_and_print(f'Selective rebuild: {", ".join(services)}')
        cmd.extend(services)
    else:
        log_and_print('Rebuilding all services...')

    result = run_cmd(cmd, env=env, timeout=DEPLOY_TIMEOUT)

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
