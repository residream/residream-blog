#!/usr/bin/env bash
# 把服务器上的每日、每周备份同步到本机，并校验最新一份；密码归档只留在服务器上。
set -euo pipefail

cd "$(dirname "$0")/.."
if [ -f .deploy.env ]; then
  # shellcheck source=/dev/null
  . ./.deploy.env
fi
: "${DEPLOY_HOST:?在 .deploy.env 里设置 DEPLOY_HOST（见 .deploy.env.example）}"
: "${BACKUP_DIR:?在 .deploy.env 里设置 BACKUP_DIR（见 .deploy.env.example）}"
REMOTE_BACKUP_DIR="${REMOTE_BACKUP_DIR:-/var/backups/residream}"

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\033[31m错误：\033[0m%s\n' "$*" >&2; exit 1; }

ssh -n -o BatchMode=yes -o ConnectTimeout=10 "$DEPLOY_HOST" true 2>/dev/null || die "无法登录 ${DEPLOY_HOST}。
  如果是重启后密钥没加载，运行：ssh-add --apple-use-keychain ~/.ssh/id_ed25519"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
for kind in daily weekly; do
  step "同步 ${kind} 备份"
  # 服务器上的备份只有 root 可读；本机已有的旧备份不会被删除。
  rsync -rlpt --exclude='.*' --rsync-path='sudo -n rsync' \
    -e 'ssh -o BatchMode=yes -o ConnectTimeout=10' \
    "$DEPLOY_HOST:$REMOTE_BACKUP_DIR/$kind/" "$BACKUP_DIR/$kind/"
  latest="$(ls -1d "$BACKUP_DIR/$kind"/20* 2>/dev/null | tail -1 || true)"
  [ -n "$latest" ] || die "服务器上还没有 ${kind} 备份"
  (cd "$latest" && shasum -a 256 -c --quiet SHA256SUMS) || die "$(basename "$latest") 校验失败"
  echo "  最新一份 $(basename "$latest") 校验通过；本机共 $(ls -1d "$BACKUP_DIR/$kind"/20* | wc -l | tr -d ' ') 份"
done

echo
echo "已同步到 ${BACKUP_DIR}（$(du -sh "$BACKUP_DIR" | cut -f1 | tr -d ' ')）"
