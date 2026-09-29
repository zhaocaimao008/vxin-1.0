#!/usr/bin/env bash
# Build in isolation. Restore source, lockfile, dependencies AND Web on any publish failure.
set -Eeuo pipefail
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_DIR=${REPO_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}
WEB_ROOT=${WEB_ROOT:-/var/www/vxin-web/app}
STATE_ROOT=${STATE_ROOT:-/var/lib/vxin-releases}
PM2_APP=${PM2_APP:-vxin-backend}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:3002/health}
HEALTH_ATTEMPTS=${HEALTH_ATTEMPTS:-20}
HEALTH_INTERVAL=${HEALTH_INTERVAL:-2}
TARGET=$(git -C "$REPO_DIR" rev-parse --verify "${1:?Usage: release.sh COMMIT}^{commit}")
PREVIOUS=$(git -C "$REPO_DIR" rev-parse HEAD)
BE="$REPO_DIR/backend-v2"

if [[ ${ALLOW_NON_FAST_FORWARD:-0} != 1 ]] && ! git -C "$REPO_DIR" merge-base --is-ancestor "$PREVIOUS" "$TARGET"; then
  echo 'Production has commits absent from the release. Integrate them before publishing.' >&2; exit 1
fi
[[ -z $(git -C "$REPO_DIR" status --porcelain --untracked-files=no) ]] || {
  echo 'Tracked production files have local changes; refusing to overwrite them.' >&2; exit 1;
}
[[ -d "$BE/node_modules" && -f "$WEB_ROOT/index.html" ]] || {
  echo 'This upgrade script requires an existing backend and Web installation.' >&2; exit 1;
}
mkdir -p "$STATE_ROOT"
exec 9>"$STATE_ROOT/deploy.lock"
flock -n 9 || { echo 'Another release is running.' >&2; exit 1; }
STAGE=$(mktemp -d "$STATE_ROOT/stage.XXXXXXXX")
BACKUP="$STATE_ROOT/$(date -u +%Y%m%dT%H%M%S)-${PREVIOUS:0:12}-$$"
CHANGED=0

health() {
  local body
  local expected=${1:-}
  for ((i=0; i<HEALTH_ATTEMPTS; i++)); do
    if body=$(curl --fail --silent --show-error --max-time 3 "$HEALTH_URL") &&
      node -e 'try { const x=JSON.parse(process.argv[1]); process.exit(x.ok === true && x.db === "ok" && (!process.argv[2] || x.revision === process.argv[2]) ? 0 : 1); } catch { process.exit(1); }' "$body" "$expected"; then
      return 0
    fi
    sleep "$HEALTH_INTERVAL"
  done
  return 1
}

restart() {
  local revision=${1:-$TARGET}
  # --update-env replaces the process environment with this shell's. The CI
  # runner has no NODE_ENV, so without it every release left production running
  # in development mode (metrics exposed, production-only startup checks off).
  (cd "$BE" && NODE_ENV=production RELEASE_SHA="$revision" pm2 restart "$PM2_APP" --update-env)
}

production_mode() {
  # Development mode serves /api/metrics; production returns 404.
  local base=${HEALTH_URL%/health}
  [[ $(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 3 "$base/api/metrics") == 404 ]]
}

finish() {
  local code=$?
  trap - EXIT INT TERM
  if ((code != 0 && CHANGED == 1)); then
    echo "Release failed; restoring $PREVIOUS (source, dependencies, Web)." >&2
    set +e
    local failed=0
    git -C "$REPO_DIR" reset --hard "$PREVIOUS" || failed=1
    rm -rf "$BE/node_modules"
    cp -a "$BACKUP/node_modules" "$BE/node_modules" || failed=1
    rsync -a --checksum --delete "$BACKUP/web/" "$WEB_ROOT/" || failed=1
    restart "$PREVIOUS" || failed=1
    health || failed=1
    if ((failed)); then
      echo "ROLLBACK FAILED. Recovery files retained at $BACKUP" >&2
    else
      echo "Rollback health passed: $PREVIOUS" >&2
    fi
  fi
  rm -rf "$STAGE"
  exit "$code"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

git -C "$REPO_DIR" archive "$TARGET" | tar -x -C "$STAGE"
(cd "$STAGE/web" && npm ci --legacy-peer-deps && npm run build)
printf '{"commit":"%s"}\n' "$TARGET" > "$STAGE/web/dist/release.json"
(cd "$STAGE/backend-v2" && npm ci --omit=dev)
[[ -s "$STAGE/web/dist/index.html" && -d "$STAGE/backend-v2/node_modules" ]]
# Before touching live paths: the new code must load its config in production
# mode with the live .env (production requires ADMIN_USERNAME/PASSWORD and
# ADMIN_JWT_SECRET). Otherwise the restart and the rollback would both fail.
(cd "$BE" && NODE_ENV=production node -e 'require(process.argv[1])' "$STAGE/backend-v2/src/config") || {
  echo 'Production configuration check failed; nothing was changed.' >&2; exit 1;
}
# Copy before touching live paths. Keep snapshots for explicit recovery; do not prune implicitly.
mkdir -p "$BACKUP"
printf '%s\n' "$PREVIOUS" > "$BACKUP/revision"
cp -a "$BE/node_modules" "$BACKUP/node_modules"
cp -a "$WEB_ROOT" "$BACKUP/web"
CHANGED=1
git -C "$REPO_DIR" reset --hard "$TARGET"
rm -rf "$BE/node_modules"
mv "$STAGE/backend-v2/node_modules" "$BE/node_modules"
if [[ ${CONFIGURE_WEB_PUSH:-0} == 1 ]]; then
  node "$REPO_DIR/deploy/configure-web-push.cjs" "$BE/.env"
fi
rsync -a --checksum --delete "$STAGE/web/dist/" "$WEB_ROOT/"
restart
health "$TARGET"
production_mode || { echo 'Backend is not running with NODE_ENV=production.' >&2; exit 1; }
pm2 save
printf '%s\n' "$PREVIOUS" > "$STATE_ROOT/previous.sha.tmp"
mv "$STATE_ROOT/previous.sha.tmp" "$STATE_ROOT/previous.sha"
printf '%s\n' "$TARGET" > "$STATE_ROOT/current.sha.tmp"
mv "$STATE_ROOT/current.sha.tmp" "$STATE_ROOT/current.sha"
CHANGED=0
echo "Release healthy: $TARGET; recovery snapshot: $BACKUP"
