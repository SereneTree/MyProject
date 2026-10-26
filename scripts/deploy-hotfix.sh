#!/usr/bin/env bash
# 线上接口 404 热修：更新后端代码并重启 pm2 进程
# 用法：bash scripts/deploy-hotfix.sh
# 说明：会以交互方式提示输入服务器密码；脚本只做 git pull + pm2 restart，不覆盖本地数据

set -euo pipefail

HOST="${DEPLOY_HOST:-root@39.96.44.9}"
PROJ="${DEPLOY_PROJ:-/var/www/html/MyProject}"

echo ">>> 目标：$HOST:$PROJ"
echo ">>> 即将执行：git pull → 校验数据文件 → pm2 restart → curl 自检"
echo

ssh -t "$HOST" "PROJ='$PROJ' bash -s" <<'REMOTE'
set -euo pipefail

cd "$PROJ" || { echo "!! 项目目录不存在：$PROJ"; exit 1; }
echo "== 当前提交 =="
git log --oneline -1

echo
echo "== 拉取远端 =="
git pull --ff-only

echo
echo "== 校验小红书数据文件 =="
if [ -f server/data/xhs-articles.json ]; then
  echo "OK  $(ls -lh server/data/xhs-articles.json | awk '{print $5}')  server/data/xhs-articles.json"
else
  echo "!! 缺少 server/data/xhs-articles.json（接口会返回空数组）"
fi

echo
echo "== 确认 index.mjs 已含该路由 =="
grep -n "api/xhs-articles" server/index.mjs || echo "!! 路由仍然缺失"

echo
echo "== 重启 pm2 进程 =="
pm2 restart my-api --update-env
sleep 2
pm2 list --no-color | head -8

echo
echo "== 本机自检 3001 =="
curl -s -o /dev/null -w "127.0.0.1:3001/api/xhs-articles -> %{http_code}\n" http://127.0.0.1:3001/api/xhs-articles
curl -s http://127.0.0.1:3001/api/xhs-articles | head -c 120
echo
REMOTE

echo
echo ">>> 远端完成，从本地再验一次："
curl -s -o /dev/null -w "http://39.96.44.9/api/xhs-articles -> %{http_code}\n" --max-time 10 http://39.96.44.9/api/xhs-articles
