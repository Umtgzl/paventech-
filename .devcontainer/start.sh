#!/usr/bin/env bash
# Codespace her başladığında uygulamayı arka planda çalıştırır. Çıktı: /tmp/paventech.log
# Elle durdurup başlatmak için: pkill -f "next start" ; bash .devcontainer/start.sh
cd "$(dirname "$0")/.."

# Zaten çalışıyorsa dokunma
if curl -s -o /dev/null --max-time 2 http://localhost:3000/giris; then
  exit 0
fi
# İlk kurulum henüz bitmediyse (setup.sh derlemeyi yapacak) bekleme
[ -f .env ] || exit 0
[ -f .next/BUILD_ID ] || pnpm build >> /tmp/paventech.log 2>&1

setsid nohup pnpm start > /tmp/paventech.log 2>&1 < /dev/null &
echo "Paventech ERP başlatıldı: 3000 portu (log: /tmp/paventech.log)"
