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
  for ((i=0; i<HEALTH_ATTEMPTS; i++)); do
    if body=$(curl --fail --silent --show-error --max-time 3 "$HEALTH_URL") &&
      node -e 'try { const x=JSON.parse(process.argv[1]); process.exit(x.ok === true && x.db === "ok" ? 0 : 1); } catch { process.exit(1); }' "$body"; then
      return 0
    fi
    sleep "$HEALTH_INTERVAL"
  done
  return 1
}

restart() {
  (cd "$BE" && pm2 restart "$PM2_APP" --update-env)
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
    restart || failed=1
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
(cd "$STAGE/backend-v2" && npm ci --omit=dev)
[[ -s "$STAGE/web/dist/index.html" && -d "$STAGE/backend-v2/node_modules" ]]
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
health
pm2 save
printf '%s\n' "$PREVIOUS" > "$STATE_ROOT/previous.sha.tmp"
mv "$STATE_ROOT/previous.sha.tmp" "$STATE_ROOT/previous.sha"
printf '%s\n' "$TARGET" > "$STATE_ROOT/current.sha.tmp"
mv "$STATE_ROOT/current.sha.tmp" "$STATE_ROOT/current.sha"
CHANGED=0
echo "Release healthy: $TARGET; recovery snapshot: $BACKUP"
