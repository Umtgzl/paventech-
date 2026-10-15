// Şirket (kiracı) açma ve modül yönetimi. "server-only" içermez; seed betiği de kullanır.
import { and, eq, inArray } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import type { Executor } from "@/server/db/client";
import {
  account,
  cashAccounts,
  member,
  organization,
  tenantModule,
  tenantProfile,
  user,
  warehouses,
} from "@/server/db/schema";
import { MODULES, PLANS, requiredModules, type ModuleKey, type PlanKey } from "@/lib/modules";

export interface NewTenantInput {
  name: string;
  slug: string;
  plan: PlanKey;
  sector?: string;
  legalName?: string;
  taxOffice?: string;
  taxNumber?: string;
  city?: string;
  userLimit?: number;
  aiMonthlyCredits?: number;
}

export async function createTenant(tx: Executor, input: NewTenantInput) {
  const id = crypto.randomUUID();
  await tx.insert(organization).values({
    id,
    name: input.name,
    slug: input.slug,
    createdAt: new Date(),
  });
  await tx.insert(tenantProfile).values({
    tenantId: id,
    legalName: input.legalName ?? input.name,
    taxOffice: input.taxOffice,
    taxNumber: input.taxNumber,
    city: input.city,
    sector: input.sector ?? "genel",
    plan: input.plan,
    userLimit: input.userLimit ?? (input.plan === "baslangic" ? 5 : input.plan === "profesyonel" ? 15 : 50),
    aiMonthlyCredits: input.aiMonthlyCredits ?? (input.plan === "kurumsal" ? 1000 : 0),
  });
  await setTenantModules(tx, id, [...PLANS[input.plan].modules], null);
  // Her şirket bir depo ve bir kasa ile başlar; ilk gün belge kesilebilsin.
  await tx.insert(warehouses).values({ tenantId: id, code: "D01", name: "Merkez Depo", isDefault: true });
  await tx.insert(cashAccounts).values({ tenantId: id, code: "K01", name: "Merkez Kasa", kind: "kasa" });
  return id;
}

/** Açık modül kümesini ayarlar; bağımlı modülleri otomatik açar. */
export async function setTenantModules(
  tx: Executor,
  tenantId: string,
  modules: ModuleKey[],
  updatedBy: string | null,
) {
  const final = new Set<ModuleKey>();
  for (const m of modules) {
    final.add(m);
    for (const dep of requiredModules(m)) final.add(dep);
  }
  for (const m of MODULES) {
    await tx
      .insert(tenantModule)
      .values({ tenantId, moduleKey: m.key, enabled: final.has(m.key), updatedBy })
      .onConflictDoUpdate({
        target: [tenantModule.tenantId, tenantModule.moduleKey],
        set: { enabled: final.has(m.key), updatedBy, updatedAt: new Date() },
      });
  }
  return [...final];
}

export async function getEnabledModules(tx: Executor, tenantId: string): Promise<ModuleKey[]> {
  const rows = await tx
    .select({ key: tenantModule.moduleKey })
    .from(tenantModule)
    .where(and(eq(tenantModule.tenantId, tenantId), eq(tenantModule.enabled, true)));
  return rows.map((r) => r.key as ModuleKey);
}

export interface NewUserInput {
  name: string;
  email: string;
  password: string;
  role?: "owner" | "admin" | "member";
  platformAdmin?: boolean;
}

/**
 * Kullanıcıyı (yoksa) oluşturur ve şirkete üye yapar. Şifre Better Auth'un
 * kendi algoritmasıyla (scrypt) hashlenir, böylece normal giriş akışı çalışır.
 */
export async function addUserToTenant(tx: Executor, tenantId: string | null, input: NewUserInput) {
  const email = input.email.trim().toLowerCase();
  let existing = await tx.query.user.findFirst({ where: eq(user.email, email) });
  if (!existing) {
    const userId = crypto.randomUUID();
    const now = new Date();
    await tx.insert(user).values({
      id: userId,
      name: input.name,
      email,
      emailVerified: true,
      role: input.platformAdmin ? "admin" : "user",
      createdAt: now,
      updatedAt: now,
    });
    await tx.insert(account).values({
      id: crypto.randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: await hashPassword(input.password),
      createdAt: now,
      updatedAt: now,
    });
    existing = await tx.query.user.findFirst({ where: eq(user.id, userId) });
  }
  if (!existing) throw new Error("Kullanıcı oluşturulamadı");
  if (tenantId) {
    const already = await tx.query.member.findFirst({
      where: and(eq(member.userId, existing.id), eq(member.organizationId, tenantId)),
    });
    if (!already) {
      await tx.insert(member).values({
        id: crypto.randomUUID(),
        organizationId: tenantId,
        userId: existing.id,
        role: input.role ?? "member",
        createdAt: new Date(),
      });
    }
  }
  return existing.id;
}

export async function countMembers(tx: Executor, tenantIds: string[]) {
  if (tenantIds.length === 0) return new Map<string, number>();
  const rows = await tx
    .select({ org: member.organizationId })
    .from(member)
    .where(inArray(member.organizationId, tenantIds));
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.org, (map.get(r.org) ?? 0) + 1);
  return map;
}
