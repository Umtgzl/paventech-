#!/usr/bin/env bash
# Codespace ilk oluşturulduğunda bir kez çalışır: bağımlılıklar, .env, demo veri, derleme.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> pnpm hazırlanıyor"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# pnpm sürümü package.json'daki packageManager alanından gelir (corepack)
if [ "$(id -u)" = 0 ]; then corepack enable; else sudo env "PATH=$PATH" corepack enable; fi
pnpm install --frozen-lockfile

echo "==> .env hazırlanıyor"
if [ ! -f .env ]; then
  cp .env.example .env
  secret=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))")
  sed -i "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=${secret}|" .env
fi
# Codespaces'te uygulama https://<codespace-adı>-3000.<alan-adı> adresinden açılır;
# giriş çerezleri ve Server Action'lar bu adresi bilmeli.
if [ -n "${CODESPACE_NAME:-}" ] && [ -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]; then
  url="https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
  sed -i "s|^BETTER_AUTH_URL=.*|BETTER_AUTH_URL=${url}|" .env
  echo "    Uygulama adresi: ${url}"
fi

echo "==> PostgreSQL kuruluyor"
if [ ! -d /etc/postgresql ]; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql > /dev/null
fi
sudo service postgresql start
psql_admin() { sudo -u postgres psql -v ON_ERROR_STOP=1 -tAc "$1"; }
[ "$(psql_admin "SELECT 1 FROM pg_roles WHERE rolname='paventech'")" = 1 ] \
  || psql_admin "CREATE ROLE paventech LOGIN PASSWORD 'paventech' CREATEDB"
for db in paventech_dev paventech_test; do
  [ "$(psql_admin "SELECT 1 FROM pg_database WHERE datname='$db'")" = 1 ] \
    || psql_admin "CREATE DATABASE $db OWNER paventech"
done

echo "==> Tablolar kuruluyor, demo veri yükleniyor"
pnpm db:reset

echo "==> Uygulama derleniyor (1-3 dk)"
pnpm build

echo "==> Hazır. Uygulama birazdan 3000 portunda açılacak (PORTS sekmesi)."
