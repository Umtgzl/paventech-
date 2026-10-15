"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { member, organization, session as sessionTable, tenantProfile } from "@/server/db/schema";
import { runAction } from "@/server/actions";
import { getSession, UserError } from "@/server/session";
import { addUserToTenant, createTenant, setTenantModules } from "@/server/domain/tenants";
import { dependentModules, isModuleKey, MODULE_MAP, PLANS, requiredModules, type ModuleKey } from "@/lib/modules";
import { normalizeTr } from "@/lib/utils";

async function requireAdmin() {
  const s = await getSession();
  if (!s || s.user.role !== "admin") throw new UserError("Bu işlem için Super Admin yetkisi gerekir.");
  return s;
}

const planKey = z.enum(["baslangic", "profesyonel", "kurumsal"]);

const newTenantSchema = z.object({
  name: z.string().trim().min(2, "Şirket adı en az 2 karakter olmalı"),
  plan: planKey,
  sector: z.string().trim().default("genel"),
  taxNumber: z.string().trim().optional(),
  city: z.string().trim().optional(),
  ownerName: z.string().trim().min(2, "Yetkili adı gerekli"),
  ownerEmail: z.email("Geçerli bir e-posta girin"),
  ownerPassword: z.string().min(8, "Şifre en az 8 karakter olmalı"),
});

export async function createTenantAction(input: z.input<typeof newTenantSchema>) {
  return runAction(async () => {
    const s = await requireAdmin();
    const parsed = newTenantSchema.safeParse(input);
    if (!parsed.success) {
      throw new UserError("Formda hatalar var.", fieldErrors(parsed.error));
    }
    const v = parsed.data;
    const baseSlug = normalizeTr(v.name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "sirket";
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    const tenantId = await db.transaction(async (tx) => {
      const id = await createTenant(tx, {
        name: v.name,
        slug,
        plan: v.plan,
        sector: v.sector,
        taxNumber: v.taxNumber,
        city: v.city,
      });
      await addUserToTenant(tx, id, {
        name: v.ownerName,
        email: v.ownerEmail,
        password: v.ownerPassword,
        role: "owner",
      });
      // Super Admin de destek için üye olur ("müşterinin gözünden gör")
      await addUserToTenant(tx, id, { name: s.user.name, email: s.user.email, password: "", role: "owner" });
      return id;
    });
    refresh();
    return { tenantId };
  }, "Şirket oluşturuldu.");
}

/** Tek bir modülü açar/kapatır. Açarken bağımlılıkları açar, kapatırken bağlı modülleri de kapatır. */
export async function toggleModuleAction(tenantId: string, moduleKey: string, enabled: boolean) {
  return runAction(async () => {
    const s = await requireAdmin();
    if (!isModuleKey(moduleKey)) throw new UserError("Bilinmeyen modül.");
    const result = await db.transaction(async (tx) => {
      const current = new Set(
        (await tx.query.tenantModule.findMany({ where: (t, { eq: e }) => e(t.tenantId, tenantId) }))
          .filter((r) => r.enabled)
          .map((r) => r.moduleKey as ModuleKey),
      );
      const changed: string[] = [];
      if (enabled) {
        for (const dep of requiredModules(moduleKey)) {
          if (!current.has(dep)) changed.push(MODULE_MAP[dep].short);
          current.add(dep);
        }
        current.add(moduleKey);
      } else {
        for (const d of dependentModules(moduleKey, current)) {
          current.delete(d);
          changed.push(MODULE_MAP[d].short);
        }
        current.delete(moduleKey);
      }
      await setTenantModules(tx, tenantId, [...current], s.user.id);
      return changed;
    });
    refresh();
    return { alsoChanged: result };
  });
}

export async function applyPlanAction(tenantId: string, plan: string) {
  return runAction(async () => {
    const s = await requireAdmin();
    const p = planKey.parse(plan);
    await db.transaction(async (tx) => {
      await setTenantModules(tx, tenantId, [...PLANS[p].modules], s.user.id);
      await tx.update(tenantProfile).set({ plan: p }).where(eq(tenantProfile.tenantId, tenantId));
    });
    refresh();
  }, "Paket uygulandı.");
}

const profileSchema = z.object({
  name: z.string().trim().min(2),
  legalName: z.string().trim().optional(),
  taxOffice: z.string().trim().optional(),
  taxNumber: z.string().trim().optional(),
  city: z.string().trim().optional(),
  sector: z.string().trim().min(1),
  userLimit: z.coerce.number().int().min(1).max(10000),
  aiMonthlyCredits: z.coerce.number().int().min(0).max(1_000_000),
  showLockedModules: z.boolean(),
  isActive: z.boolean(),
});

export async function updateTenantProfileAction(tenantId: string, input: z.input<typeof profileSchema>) {
  return runAction(async () => {
    await requireAdmin();
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) throw new UserError("Formda hatalar var.", fieldErrors(parsed.error));
    const { name, ...rest } = parsed.data;
    await db.transaction(async (tx) => {
      await tx.update(organization).set({ name }).where(eq(organization.id, tenantId));
      await tx.update(tenantProfile).set(rest).where(eq(tenantProfile.tenantId, tenantId));
    });
    refresh();
  }, "Şirket bilgileri kaydedildi.");
}

const newUserSchema = z.object({
  name: z.string().trim().min(2, "Ad soyad gerekli"),
  email: z.email("Geçerli bir e-posta girin"),
  password: z.string().min(8, "Şifre en az 8 karakter olmalı"),
  role: z.enum(["owner", "admin", "member"]),
});

export async function addTenantUserAction(tenantId: string, input: z.input<typeof newUserSchema>) {
  return runAction(async () => {
    await requireAdmin();
    const parsed = newUserSchema.safeParse(input);
    if (!parsed.success) throw new UserError("Formda hatalar var.", fieldErrors(parsed.error));
    await db.transaction(async (tx) => {
      const profile = await tx.query.tenantProfile.findFirst({ where: eq(tenantProfile.tenantId, tenantId) });
      const members = await tx.query.member.findMany({ where: eq(member.organizationId, tenantId) });
      if (profile && members.length >= profile.userLimit) {
        throw new UserError(`Kullanıcı limiti dolu (${profile.userLimit}). Önce limiti artırın.`);
      }
      await addUserToTenant(tx, tenantId, parsed.data);
    });
    refresh();
  }, "Kullanıcı eklendi.");
}

/** Super Admin şirkete girer: gerekirse üye yapılır ve aktif şirket olarak seçilir. */
export async function enterTenantAction(tenantId: string) {
  return runAction(async () => {
    const s = await requireAdmin();
    await db.transaction(async (tx) => {
      const m = await tx.query.member.findFirst({
        where: and(eq(member.userId, s.user.id), eq(member.organizationId, tenantId)),
      });
      if (!m) {
        await tx.insert(member).values({
          id: crypto.randomUUID(),
          organizationId: tenantId,
          userId: s.user.id,
          role: "owner",
          createdAt: new Date(),
        });
      }
      await tx.update(sessionTable).set({ activeOrganizationId: tenantId }).where(eq(sessionTable.id, s.session.id));
    });
  });
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
