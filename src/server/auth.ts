import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, organization } from "better-auth/plugins";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { CODESPACES_HOST_PATTERN, demoMode, runningInCodespaces } from "@/lib/codespaces";

/**
 * Kimlik doğrulama.
 * - organization eklentisi: her şirket bir "organization", kullanıcılar "member".
 * - admin eklentisi: user.role = "admin" olan kullanıcı Paventech süper yöneticisidir.
 * - Dışarıdan kayıt kapalı: kullanıcıları Super Admin veya şirket yöneticisi açar.
 */
/**
 * Girişin kabul edileceği ek adresler. Uygulama bir proxy arkasından başka bir
 * adresle açılıyorsa (ör. GitHub Codespaces: https://<ad>-3000.app.github.dev)
 * BETTER_AUTH_URL yanlış kalsa bile giriş "Invalid origin" ile reddedilmesin.
 * TRUSTED_ORIGINS: virgülle ayrılmış adresler veya kalıplar (https://*.ornek.com).
 */
const staticTrustedOrigins = [
  ...(process.env.TRUSTED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  ...(runningInCodespaces() || demoMode() ? [`https://${CODESPACES_HOST_PATTERN}`] : []),
];

/**
 * Demo ortamında (kurgusal veri) girişin geldiği adres her zaman kabul edilir: Codespaces
 * gibi tünellerde tarayıcının adresi önceden bilinemiyor, tünel başlıkları değiştirebiliyor.
 * Canlı ortamda (NEXT_PUBLIC_DEMO=0) yalnızca BETTER_AUTH_URL ve listedeki adresler geçer.
 */
function trustedOrigins(request?: Request): string[] {
  if (!demoMode() || !request) return staticTrustedOrigins;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const fromRequest = origin && origin !== "null" ? origin : referer ? new URL(referer).origin : null;
  return fromRequest ? [...staticTrustedOrigins, fromRequest] : staticTrustedOrigins;
}

export const auth = betterAuth({
  appName: "Paventech ERP",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  plugins: [
    organization({ allowUserToCreateOrganization: false }),
    admin(),
    // Server Action içinden giriş/çıkışta çerezleri ayarlar; listenin sonunda olmalı.
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
