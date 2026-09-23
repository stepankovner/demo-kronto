#!/usr/bin/env bash
# Выкладка лендинга на сервер через rsync.
# Запуск из корня проекта: ./deploy/deploy.sh
set -euo pipefail

# ── параметры: заполните перед первым запуском ──
SERVER_USER="[пользователь]"          # например, deploy
SERVER_HOST="[сервер]"                # IP или домен сервера
SERVER_PATH="/var/www/kronto/"        # куда выкладывать (со слешем на конце)
SSH_PORT="22"

cd "$(dirname "$0")/.."

if [[ "$SERVER_USER" == \[* || "$SERVER_HOST" == \[* ]]; then
  echo "Заполните SERVER_USER и SERVER_HOST в deploy/deploy.sh" >&2
  exit 1
fi

echo "→ Выкладываю на ${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}"
rsync -avz --delete \
  -e "ssh -p ${SSH_PORT}" \
  --exclude deploy \
  --exclude '*.md' \
  --exclude '.git' \
  --exclude '.DS_Store' \
  ./ "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}"

echo "✓ Готово. Проверьте сайт в браузере."
