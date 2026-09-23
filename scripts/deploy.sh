#!/usr/bin/env bash
# Markdown 导入、构建和发布；使用说明见 scripts/README.md。
set -euo pipefail

usage() {
  cat <<'HELP'
用法：bun run deploy [文章.md] [选项]
  --dry-run      预览导入；不传文章时预览与线上的差异
  --import-only  只导入并提交文章
  --slug=名字    指定文章目录名
  --rollback     回滚线上版本
  --skip-build   使用现有 dist/
  --allow-dirty  允许未提交的改动
  --yes          跳过确认
详细说明：scripts/README.md
HELP
}

POST="" SLUG="" DRY_RUN=0 ROLLBACK=0 SKIP_BUILD=0 ALLOW_DIRTY=0 IMPORT_ONLY=0 YES=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --rollback) ROLLBACK=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --allow-dirty) ALLOW_DIRTY=1 ;;
    --import-only) IMPORT_ONLY=1 ;;
    --yes) YES=1 ;;
    --slug=*) SLUG="${arg#--slug=}" ;;
    -h | --help) usage; exit 0 ;;
    -*) echo "未知参数：${arg}（见 --help）" >&2; exit 2 ;;
    *) [ -z "$POST" ] || { echo "一次只能导入一篇 md" >&2; exit 2; }; POST="$arg" ;;
  esac
done
if [ -n "$POST" ]; then
  case "$POST" in /*) ;; *) [ -f "$POST" ] || POST="${INIT_CWD:-$PWD}/$POST" ;; esac
  [ -f "$POST" ] || { echo "找不到文件：$POST" >&2; exit 1; }
  POST="$(cd "$(dirname "$POST")" && pwd)/$(basename "$POST")"
  [ "$ROLLBACK$SKIP_BUILD" = 00 ] || { echo "导入 md 时不能同时用 --rollback 或 --skip-build" >&2; exit 2; }
fi
if [ "$IMPORT_ONLY" = 1 ] && { [ -z "$POST" ] || [ "$DRY_RUN" = 1 ]; }; then
  echo "--import-only 需要一篇 md，且不能与 --dry-run 同时使用" >&2; exit 2
fi
if [ "$ROLLBACK" = 1 ] && [ "$DRY_RUN$SKIP_BUILD" != 00 ]; then
  echo "--rollback 不能与 --dry-run 或 --skip-build 同时使用" >&2; exit 2
fi
if [ -n "$SLUG" ] && [ -z "$POST" ]; then echo "--slug 需要一篇 md" >&2; exit 2; fi
cd "$(dirname "$0")/.."

if [ -f .deploy.env ]; then
  # shellcheck source=/dev/null
  . ./.deploy.env
fi
SITE_HOST="${SITE_HOST:-residream.com}"
WEB_ROOT="${WEB_ROOT:-/var/www/residream-blog}"
STAGE_DIR="${STAGE_DIR:-residream-blog-dist}" # 相对远端用户主目录
IMAGE_DIRS="${IMAGE_DIRS:-}"
BLOG_DIR=src/content/blog

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[33m注意：\033[0m%s\n' "$*" >&2; }
die() { printf '\033[31m错误：\033[0m%s\n' "$*" >&2; exit 1; }
remote() { ssh -n -o BatchMode=yes -o ConnectTimeout=10 "$DEPLOY_HOST" "$@"; }
remote_in() { ssh -o BatchMode=yes -o ConnectTimeout=10 "$DEPLOY_HOST" "$@"; }

ask() {
  local reply=""
  printf '%s' "$1" >&2
  if { : </dev/tty; } 2>/dev/null; then
    IFS= read -r reply </dev/tty || true
  else
    IFS= read -r reply || true
    printf '%s\n' "$reply" >&2
  fi
  printf '%s' "$reply"
}
confirm() {
  [ "$YES" = 0 ] || return 0
  case "$(ask "$1 [y/N] ")" in y | Y | yes | YES) return 0 ;; *) return 1 ;; esac
}

# 先生成临时副本，确认后复用同一份内容。
prepare_post() {
  step "检查 Markdown、图片和主题色"
  IMPORT_STAGE="$(mktemp -d "${TMPDIR:-/tmp}/residream-import.XXXXXX")"
  trap 'rm -rf -- "$IMPORT_STAGE"' EXIT
  IMAGE_DIRS="$IMAGE_DIRS" bun scripts/import-post.mjs prepare "$POST" "$IMPORT_STAGE" "--slug=$SLUG"
  SLUG="$(bun -e 'console.log((await Bun.file(process.argv[1]).json()).slug)' "$IMPORT_STAGE/plan.json")"
}

import_post() {
  local dest="$BLOG_DIR/$SLUG" public_dest="public/images/posts/$SLUG" verb=publish
  local paths=("$dest")
  [ ! -f "$dest/index.md" ] || verb=update
  confirm "  导入这些内容并提交到本地仓库？" || { echo "  已取消，仓库没有改动"; exit 0; }
  bun scripts/import-post.mjs apply "$IMPORT_STAGE"
  [ ! -d "$public_dest" ] || paths+=("$public_dest")
  git add -A -- "${paths[@]}"
  if git diff --cached --quiet -- "${paths[@]}"; then
    echo "  文章内容没有变化，跳过提交"
  else
    git commit -q -m "content: $verb $SLUG" -- "${paths[@]}"
    echo "  已提交：$(git log -1 --format='%h %s')"
  fi
}

# 直接检查源站，绕过 Cloudflare。
verify() {
  local sample="" d
  for d in dist/blog/*/; do
    case "$(basename "$d")" in [0-9]*) ;; *) sample="/blog/$(basename "$d")"; break ;; esac
  done
  remote_in bash -s <<EOF
set -e
code() { curl -s -o /dev/null -w '%{http_code}' --resolve '$SITE_HOST:443:127.0.0.1' "https://$SITE_HOST\$1"; }
fail=0
check() { got=\$(code "\$1"); printf '  %-40s %s\n' "\$1" "\$got"; [ "\$got" = "\$2" ] || fail=1; }
check / 200
check '$sample' 200
check /this-page-does-not-exist 404
check /index.php/archive/ 301
[ -f '$WEB_ROOT/.release' ] && printf '  线上版本：%s\n' "\$(cat '$WEB_ROOT/.release')"
exit \$fail
EOF
}

purge_cache() {
  local token="${CF_API_TOKEN:-}" resp
  if [ -z "$token" ] && command -v security >/dev/null 2>&1; then
    token="$(security find-generic-password -s "${CF_KEYCHAIN_SERVICE:-residream-cf-purge}" -w 2>/dev/null || true)"
  fi
  if [ -z "$token" ] || [ -z "${CF_ZONE_ID:-}" ]; then
    echo "  没有配置 Cloudflare 令牌，请手动清缓存："
    echo "  Cloudflare 后台 → $SITE_HOST → 缓存 → 配置 → 清除所有内容"
    return 0
  fi
  resp="$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
    -H "Authorization: Bearer $token" -H 'Content-Type: application/json' \
    --data '{"purge_everything":true}' || true)"
  case "$resp" in
    *'"success":true'*) echo "  已清除 Cloudflare 缓存" ;;
    *) warn "新版本已上线，但清 Cloudflare 缓存失败：$resp"; return 1 ;;
  esac
}

# rsync 差异转成「操作<TAB>路径」，用于发布前预览。
live_changes() {
  rsync -azcn --delete --exclude=/.release --itemize-changes dist/ "$DEPLOY_HOST:$WEB_ROOT/" | awk '
    /\/$/ { next }
    /^\*deleting/ { sub(/^\*deleting +/, ""); print "-\t" $0; next }
    /^[<>ch]f\+\+/ { sub(/^[^ ]+ /, ""); print "+\t" $0; next }
    /^[<>ch]f/ { sub(/^[^ ]+ /, ""); print "~\t" $0; next }'
}
print_changes() {
  if [ -z "$1" ]; then echo "  没有改动"; return; fi
  printf '%s\n' "$1" | sort | awk -F'\t' '
    NR <= 30 { printf "    %s %s\n", $1, $2 }
    { c[$1]++ }
    END {
      if (NR > 30) printf "    …（其余 %d 个略）\n", NR - 30
      printf "  共 %d 个文件：新增 %d，修改 %d，删除 %d\n", NR, c["+"], c["~"], c["-"]
    }'
}

if [ -n "$POST" ]; then
  command -v bun >/dev/null 2>&1 || die "需要先安装 Bun 并运行 bun install"
  prepare_post
  if [ "$DRY_RUN" = 1 ]; then
    echo "  （仅本地预览：源文件、仓库和服务器均未改动）"
    exit 0
  fi
fi

# 导入会提交当前文章；其他改动必须显式允许。
if [ "$ALLOW_DIRTY" = 0 ] && [ "$ROLLBACK" = 0 ]; then
  dirty_paths=(.)
  if [ -n "$POST" ]; then
    dirty_paths+=(":(exclude)$BLOG_DIR/$SLUG" ":(exclude)public/images/posts/$SLUG")
  fi
  [ -z "$(git status --porcelain -- "${dirty_paths[@]}")" ] || die "工作区有其他未提交的改动，请先提交，或加 --allow-dirty"
fi

if [ "$IMPORT_ONLY" = 0 ]; then
  : "${DEPLOY_HOST:?在 .deploy.env 里设置 DEPLOY_HOST（见 .deploy.env.example）}"
  step "检查 SSH：$DEPLOY_HOST"
  remote true 2>/dev/null || die "无法登录 ${DEPLOY_HOST}。
  如果是重启后密钥没加载，运行：ssh-add --apple-use-keychain ~/.ssh/id_ed25519"
  echo "  正常"
fi

if [ "$ROLLBACK" = 1 ]; then
  step "回滚"
  remote "sudo test -f '$WEB_ROOT.prev/index.html'" || die "没有可回滚的版本（$WEB_ROOT.prev 不存在）"
  echo "  上一个版本：$(remote "sudo cat '$WEB_ROOT.prev/.release' 2>/dev/null || echo 未记录版本")"
  confirm "  把线上恢复成这个版本？" || { echo "  已取消，线上没有改动"; exit 0; }
  remote "sudo rsync -a --delete '$WEB_ROOT.prev/' '$WEB_ROOT/'"
  step "自检"
  verify || die "回滚后自检没有通过"
  step "清 Cloudflare 缓存"
  purge_cache || exit 1
  exit 0
fi

if [ -n "$POST" ]; then import_post; fi
if [ "$IMPORT_ONLY" = 1 ]; then
  echo "  已完成本地导入；运行 bun run deploy 可构建并发布"
  exit 0
fi
RELEASE="$(git log -1 --format='%h %s')"
if [ -n "$(git status --porcelain)" ]; then RELEASE="${RELEASE}（含未提交改动）"; fi

if [ "$SKIP_BUILD" = 0 ]; then
  step "构建 ${RELEASE%% *}"
  bun run build
fi

step "检查构建产物"
[ -f dist/index.html ] || die "dist/index.html 不存在"
[ -f dist/404.html ] || die "dist/404.html 不存在"
grep -q 'counterscale-script' dist/index.html || die "dist/index.html 里没有统计脚本（不是生产构建？）"
echo "  $(find dist -name '*.html' | wc -l | tr -d ' ') 个页面，$(find dist -type f | wc -l | tr -d ' ') 个文件，$(du -sh dist | cut -f1 | tr -d ' ')"

step "与线上相比的改动"
changes="$(live_changes)" || die "无法与线上比对（SSH 或 rsync 出错）"
print_changes "$changes"
if [ "$DRY_RUN" = 1 ]; then echo "  （只是预览，服务器没有改动）"; exit 0; fi
if [ -z "$changes" ]; then echo "  线上已经是这个版本，不需要发布"; exit 0; fi
confirm "  确认发布到线上？" || { echo "  已取消，线上没有改动。之后要发布时运行：bun run deploy"; exit 0; }

step "上传到 $DEPLOY_HOST:~/$STAGE_DIR"
rsync -azc --delete dist/ "$DEPLOY_HOST:$STAGE_DIR/"

step "发布到 ${WEB_ROOT}（当前线上版本备份到 ${WEB_ROOT}.prev）"
remote_in bash -s <<EOF
set -e
sudo mkdir -p '$WEB_ROOT' '$WEB_ROOT.prev'
sudo rsync -a --delete '$WEB_ROOT/' '$WEB_ROOT.prev/'
sudo rsync -a --delete ~/'$STAGE_DIR'/ '$WEB_ROOT/'
sudo chown -R root:root '$WEB_ROOT'
sudo find '$WEB_ROOT' -type d -exec chmod 755 {} +
sudo find '$WEB_ROOT' -type f -exec chmod 644 {} +
EOF
printf '%s · %s\n' "$RELEASE" "$(date '+%Y-%m-%d %H:%M')" | remote_in "sudo tee '$WEB_ROOT/.release' >/dev/null"

step "自检"
verify || die "自检没有通过；要恢复上一个版本，运行：bun run deploy --rollback"

step "清 Cloudflare 缓存"
status=0
purge_cache || status=1
echo
echo "已发布：$RELEASE"
ahead="$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)"
[ "$ahead" = 0 ] || echo "本地有 $ahead 个提交还没推送，记得：git push origin main"
exit "$status"
