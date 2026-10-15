import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import {
  member,
  organization,
  session as sessionTable,
  tenantModule,
  tenantProfile,
} from "@/server/db/schema";
import { isModuleKey, MODULE_MAP, type ModuleKey } from "@/lib/modules";
import { UserError } from "@/server/domain/errors";

export { UserError };

/**
 * Veri Erişim Katmanı (DAL): oturum ve şirket bağlamı yalnızca buradan okunur.
 * Her sayfa ve her Server Action yetkiyi kendisi yeniden doğrular; menüde
 * bir şeyi gizlemek yetki kontrolü yerine geçmez.
 */

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export interface TenantContext {
  userId: string;
  userName: string;
  userEmail: string;
  isSuperAdmin: boolean;
  /** Şirket içindeki rol: owner | admin | member */
  role: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  enabledModules: ModuleKey[];
  showLockedModules: boolean;
  plan: string;
}

export async function requireUser() {
  const s = await getSession();
  if (!s) redirect("/giris");
  return s;
}

export async function requireSuperAdmin() {
  const s = await requireUser();
  if (s.user.role !== "admin") redirect("/panel");
  return s;
}

export const getTenantContext = cache(async (): Promise<TenantContext> => {
  const s = await requireUser();
  const isSuperAdmin = s.user.role === "admin";

  let tenantId = s.session.activeOrganizationId ?? null;
  let membership = tenantId
    ? await db.query.member.findFirst({
        where: and(eq(member.userId, s.user.id), eq(member.organizationId, tenantId)),
      })
    : undefined;

  if (!membership) {
    membership = await db.query.member.findFirst({
      where: eq(member.userId, s.user.id),
      orderBy: asc(member.createdAt),
    });
    if (!membership) {
      if (isSuperAdmin) redirect("/super-admin");
      redirect("/giris?hata=sirket");
    }
    tenantId = membership.organizationId;
    await db
      .update(sessionTable)
      .set({ activeOrganizationId: tenantId })
      .where(eq(sessionTable.id, s.session.id));
  }

  const [org, profile, modules] = await Promise.all([
    db.query.organization.findFirst({ where: eq(organization.id, membership.organizationId) }),
    db.query.tenantProfile.findFirst({ where: eq(tenantProfile.tenantId, membership.organizationId) }),
    db
      .select({ key: tenantModule.moduleKey })
      .from(tenantModule)
      .where(and(eq(tenantModule.tenantId, membership.organizationId), eq(tenantModule.enabled, true))),
  ]);

  if (!org) redirect("/giris?hata=sirket");
  if (profile && !profile.isActive && !isSuperAdmin) redirect("/giris?hata=pasif");

  return {
    userId: s.user.id,
    userName: s.user.name,
    userEmail: s.user.email,
    isSuperAdmin,
    role: membership.role,
    tenantId: org.id,
    tenantName: org.name,
    tenantSlug: org.slug,
    enabledModules: modules.map((m) => m.key).filter(isModuleKey),
    showLockedModules: profile?.showLockedModules ?? true,
    plan: profile?.plan ?? "baslangic",
  };
});

export function hasModule(ctx: TenantContext, key: ModuleKey) {
  return ctx.enabledModules.includes(key);
}

/** Sayfa düzeyinde modül kontrolü: kapalıysa modül tanıtım/kilit sayfasına gönderir. */
export async function requireModule(key: ModuleKey): Promise<TenantContext> {
  const ctx = await getTenantContext();
  if (!hasModule(ctx, key)) redirect(`/modul/${key}`);
  return ctx;
}

/** Server Action düzeyinde modül kontrolü: kapalıysa hata fırlatır. */
export async function assertModule(key: ModuleKey): Promise<TenantContext> {
  const ctx = await getTenantContext();
  if (!hasModule(ctx, key)) {
    throw new UserError(`"${MODULE_MAP[key].short}" modülü şirketinizde açık değil.`);
  }
  return ctx;
}
