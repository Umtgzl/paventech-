#!/usr/bin/env bash
# Codespace'e her bağlanıldığında uygulamayı bir terminalde çalıştırır (postAttachCommand).
# Terminal açık kaldıkça uygulama çalışır. Durdurmak için o terminalde Ctrl+C.
cd "$(dirname "$0")/.."

# Codespaces adresi: ortam değişkeninden, yoksa Codespaces'in paylaşılan .env dosyasından
shared=/workspaces/.codespaces/shared/.env
name="${CODESPACE_NAME:-}"
domain="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}"
if [ -f "$shared" ]; then
  [ -n "$name" ] || name=$(grep -m1 '^CODESPACE_NAME=' "$shared" | cut -d= -f2- | tr -d '"')
  [ -n "$domain" ] || domain=$(grep -m1 '^GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN=' "$shared" | cut -d= -f2- | tr -d '"')
fi

# Giriş ve Server Action'lar uygulamanın açıldığı adresi bilmeli (yoksa "Invalid origin")
if [ -n "$name" ] && [ -n "$domain" ] && [ -f .env ]; then
  url="https://${name}-3000.${domain}"
  if ! grep -qx "BETTER_AUTH_URL=${url}" .env; then
    echo "Uygulama adresi ayarlanıyor: ${url}"
    sed -i "s|^BETTER_AUTH_URL=.*|BETTER_AUTH_URL=${url}|" .env
    pkill -f next-server 2>/dev/null && sleep 2
    rm -f .next/BUILD_ID   # adres derlemeye girdiği için yeniden derlenecek
  fi
fi

# Zaten çalışıyorsa (ör. ikinci bir sekmeden bağlanıldıysa) dokunma
if curl -s -o /dev/null --max-time 2 http://localhost:3000/giris; then
  echo "Paventech ERP zaten çalışıyor: Bağlantı Noktaları (PORTS) sekmesinde 3000."
  exit 0
fi
if [ ! -f .next/BUILD_ID ]; then
  echo "Uygulama derleniyor (1-3 dk)..."
  pnpm build
fi

echo "Paventech ERP başlıyor: Bağlantı Noktaları (PORTS) sekmesinde 3000 portunu açın."
exec pnpm start
