import type { NextConfig } from "next";

// Uygulama bir proxy / tünel arkasında başka bir adresten açılıyorsa (ör. GitHub Codespaces:
// https://<codespace>-3000.app.github.dev), sunucu kendini localhost:3000 sanar. O adresten
// gelen Server Action ve geliştirme isteklerine izin verilmezse Next.js bunları reddeder.
// Adres .env'deki BETTER_AUTH_URL'den okunur (Next, .env'i bu dosyadan önce yükler).
const publicUrl = process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL) : null;
const proxied = publicUrl && !["localhost", "127.0.0.1"].includes(publicUrl.hostname) ? publicUrl : null;

const nextConfig: NextConfig = {
  // Next.js 16 varsayılanları: sayfalar statik bir kabukla açılır, veriye bağlı
  // kısımlar <Suspense> içinde akar. Bkz. docs/KARARLAR.md
  cacheComponents: true,
  partialPrefetching: true,
  // pg sürücüsü Node tarafında kalsın, paketlenmesin.
  serverExternalPackages: ["pg"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  ...(proxied && {
    allowedDevOrigins: [proxied.hostname],
    experimental: { serverActions: { allowedOrigins: [proxied.host] } },
  }),
};

export default nextConfig;
