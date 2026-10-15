import type { NextConfig } from "next";

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
};

export default nextConfig;
