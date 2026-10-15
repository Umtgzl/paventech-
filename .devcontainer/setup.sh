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

echo "==> Veritabanı bekleniyor"
for i in $(seq 1 60); do
  if node -e "const {Client}=require('pg');const c=new Client({connectionString:'postgres://paventech:paventech@localhost:5432/paventech_dev'});c.connect().then(()=>c.end()).then(()=>process.exit(0),()=>process.exit(1))"; then
    break
  fi
  [ "$i" = 60 ] && { echo "Veritabanına bağlanılamadı"; exit 1; }
  sleep 2
done

echo "==> Tablolar kuruluyor, demo veri yükleniyor"
pnpm db:reset

echo "==> Uygulama derleniyor (1-3 dk)"
pnpm build

echo "==> Hazır. Uygulama birazdan 3000 portunda açılacak (PORTS sekmesi)."
