#!/usr/bin/env bash
# Build the site and publish dist/ to the web root on the server.
#
#   bun run deploy                 build, upload, verify, purge the Cloudflare cache
#   bun run deploy --dry-run       build and list what would change; the server is not touched
#   bun run deploy --rollback      put back the release that was live before the last deploy
#
#   --skip-build    upload the existing dist/ instead of building
#   --allow-dirty   deploy even if the working tree has uncommitted changes
#
# Server and Cloudflare settings are read from .deploy.env (git-ignored, because the
# repository is public and must not reveal the origin address). See .deploy.env.example.
set -euo pipefail
cd "$(dirname "$0")/.."

DRY_RUN=0 ROLLBACK=0 SKIP_BUILD=0 ALLOW_DIRTY=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --rollback) ROLLBACK=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --allow-dirty) ALLOW_DIRTY=1 ;;
    -h | --help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
    *) echo "unknown option: $arg (see --help)" >&2; exit 2 ;;
  esac
done

if [ -f .deploy.env ]; then
  # shellcheck source=/dev/null
  . ./.deploy.env
fi
: "${DEPLOY_HOST:?set DEPLOY_HOST in .deploy.env (see .deploy.env.example)}"
SITE_HOST="${SITE_HOST:-residream.com}"
WEB_ROOT="${WEB_ROOT:-/var/www/residream-blog}"
STAGE_DIR="${STAGE_DIR:-residream-blog-dist}" # relative to the remote user's home

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[33mwarning:\033[0m %s\n' "$*" >&2; }
die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
remote() { ssh -o BatchMode=yes -o ConnectTimeout=10 "$DEPLOY_HOST" "$@"; }

# Checks run on the server against nginx directly, bypassing Cloudflare.
verify() {
  local sample="" d
  for d in dist/blog/*/; do
    case "$(basename "$d")" in [0-9]*) ;; *) sample="/blog/$(basename "$d")"; break ;; esac
  done
  remote bash -s <<EOF
set -e
code() { curl -s -o /dev/null -w '%{http_code}' --resolve '$SITE_HOST:443:127.0.0.1' "https://$SITE_HOST\$1"; }
fail=0
check() { got=\$(code "\$1"); printf '  %-40s %s\n' "\$1" "\$got"; [ "\$got" = "\$2" ] || fail=1; }
check / 200
check '$sample' 200
check /this-page-does-not-exist 404
check /index.php/archive/ 301
[ -f '$WEB_ROOT/.release' ] && printf '  live release: %s\n' "\$(cat '$WEB_ROOT/.release')"
exit \$fail
EOF
}

purge_cache() {
  local token="${CF_API_TOKEN:-}" resp
  if [ -z "$token" ] && command -v security >/dev/null 2>&1; then
    token="$(security find-generic-password -s "${CF_KEYCHAIN_SERVICE:-residream-cf-purge}" -w 2>/dev/null || true)"
  fi
  if [ -z "$token" ] || [ -z "${CF_ZONE_ID:-}" ]; then
    echo "  Cloudflare purge is not configured; purge the cache by hand:"
    echo "  Cloudflare dashboard → $SITE_HOST → Caching → Configuration → Purge Everything"
    return 0
  fi
  resp="$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
    -H "Authorization: Bearer $token" -H 'Content-Type: application/json' \
    --data '{"purge_everything":true}' || true)"
  case "$resp" in
    *'"success":true'*) echo "  Cloudflare cache purged" ;;
    *) warn "the release is live, but the Cloudflare purge failed: $resp"; return 1 ;;
  esac
}

step "Checking SSH access to $DEPLOY_HOST"
remote true 2>/dev/null || die "cannot log in to $DEPLOY_HOST.
  If the key was unloaded by a reboot, run:  ssh-add --apple-use-keychain ~/.ssh/id_ed25519"
echo "  ok"

if [ "$ROLLBACK" = 1 ]; then
  step "Restoring the previous release"
  remote "sudo test -f '$WEB_ROOT.prev/index.html'" || die "no previous release at $WEB_ROOT.prev"
  remote "sudo cat '$WEB_ROOT.prev/.release' 2>/dev/null || echo '(unknown release)'" | sed 's/^/  restoring: /'
  remote "sudo rsync -a --delete '$WEB_ROOT.prev/' '$WEB_ROOT/'"
  step "Verifying"
  verify || die "checks failed after the rollback"
  step "Purging the Cloudflare cache"
  purge_cache || exit 1
  exit 0
fi

if [ "$ALLOW_DIRTY" = 0 ] && [ -n "$(git status --porcelain)" ]; then
  die "the working tree has uncommitted changes; commit them first or pass --allow-dirty"
fi
RELEASE="$(git log -1 --format='%h %s')"
if [ -n "$(git status --porcelain)" ]; then RELEASE="$RELEASE (+ uncommitted changes)"; fi

if [ "$SKIP_BUILD" = 0 ]; then
  step "Building ${RELEASE%% *}"
  bun run build
fi

step "Checking dist/"
[ -f dist/index.html ] || die "dist/index.html is missing"
[ -f dist/404.html ] || die "dist/404.html is missing"
grep -q 'counterscale-script' dist/index.html || die "the analytics script is missing from dist/index.html (not a production build?)"
echo "  $(find dist -name '*.html' | wc -l | tr -d ' ') pages, $(find dist -type f | wc -l | tr -d ' ') files, $(du -sh dist | cut -f1)"

if [ "$DRY_RUN" = 1 ]; then
  step "Changes compared with the live site (dry run, nothing is written)"
  changes="$(rsync -azcn --delete --exclude=/.release --itemize-changes dist/ "$DEPLOY_HOST:$WEB_ROOT/" | grep -v '/$' | grep -v '^\.' || true)"
  if [ -z "$changes" ]; then echo "  no changes"; else
    printf '%s\n' "$changes" | sed -n '1,40s/^/  /p'
    echo "  ($(printf '%s\n' "$changes" | wc -l | tr -d ' ') changed files)"
  fi
  exit 0
fi

step "Uploading to $DEPLOY_HOST:~/$STAGE_DIR"
rsync -azc --delete dist/ "$DEPLOY_HOST:$STAGE_DIR/"

step "Publishing to $WEB_ROOT (the current release is kept in $WEB_ROOT.prev)"
remote bash -s <<EOF
set -e
sudo mkdir -p '$WEB_ROOT' '$WEB_ROOT.prev'
sudo rsync -a --delete '$WEB_ROOT/' '$WEB_ROOT.prev/'
sudo rsync -a --delete ~/'$STAGE_DIR'/ '$WEB_ROOT/'
sudo chown -R root:root '$WEB_ROOT'
sudo find '$WEB_ROOT' -type d -exec chmod 755 {} +
sudo find '$WEB_ROOT' -type f -exec chmod 644 {} +
EOF
printf '%s · %s\n' "$RELEASE" "$(date '+%Y-%m-%d %H:%M')" | remote "sudo tee '$WEB_ROOT/.release' >/dev/null"

step "Verifying"
verify || die "checks failed; to put the previous release back run:  bun run deploy --rollback"

step "Purging the Cloudflare cache"
status=0
purge_cache || status=1
echo
echo "Deployed: $RELEASE"
exit "$status"
