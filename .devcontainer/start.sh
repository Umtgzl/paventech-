#!/usr/bin/env bash
# Codespace'e her bağlanıldığında uygulamayı bir terminalde çalıştırır (postAttachCommand).
# Terminal açık kaldıkça uygulama çalışır. Durdurmak için o terminalde Ctrl+C.
cd "$(dirname "$0")/.."

# Zaten çalışıyorsa (ör. ikinci bir sekmeden bağlanıldıysa) dokunma
if curl -s -o /dev/null --max-time 2 http://localhost:3000/giris; then
  echo "Paventech ERP zaten çalışıyor: Bağlantı Noktaları (PORTS) sekmesinde 3000."
  exit 0
fi
# İlk kurulum yarıda kaldıysa derlemeyi tamamla
[ -f .next/BUILD_ID ] || pnpm build

echo "Paventech ERP başlıyor: Bağlantı Noktaları (PORTS) sekmesinde 3000 portunu açın."
exec pnpm start
