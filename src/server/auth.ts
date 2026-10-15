import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, organization } from "better-auth/plugins";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";

/**
 * Kimlik doğrulama.
 * - organization eklentisi: her şirket bir "organization", kullanıcılar "member".
 * - admin eklentisi: user.role = "admin" olan kullanıcı Paventech süper yöneticisidir.
 * - Dışarıdan kayıt kapalı: kullanıcıları Super Admin veya şirket yöneticisi açar.
 */
export const auth = betterAuth({
  appName: "Paventech ERP",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
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
