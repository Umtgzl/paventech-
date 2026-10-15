"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { organization, tenantProfile } from "@/server/db/schema";
import { runAction } from "@/server/actions";
import { zodFieldErrors } from "@/server/domain/errors";
import { getTenantContext, UserError } from "@/server/session";
import { audit, tenantTx } from "@/server/tenant";
import { canManageCompany } from "@/lib/roles";

const optional = z.string().trim().max(300).optional();

const companySchema = z.object({
  name: z.string().trim().min(2, "Şirket adı en az 2 karakter olmalı").max(120),
  legalName: optional,
  taxOffice: optional,
  taxNumber: z
    .string()
    .trim()
    .regex(/^(\d{10}|\d{11})?$/, "Vergi no 10, TC kimlik no 11 haneli olmalı")
    .optional(),
  address: optional,
  city: optional,
  phone: optional,
  email: z.union([z.literal(""), z.email("Geçerli bir e-posta girin")]).optional(),
});

export type CompanyInput = z.input<typeof companySchema>;

/** Şirket sahibi/yöneticisi kendi şirket bilgilerini günceller (belge çıktılarında görünür). */
export async function updateCompanyAction(input: CompanyInput) {
  return runAction(async () => {
    const ctx = await getTenantContext();
    if (!canManageCompany(ctx.role, ctx.isSuperAdmin)) {
      throw new UserError("Şirket bilgilerini yalnızca şirket sahibi veya yöneticisi değiştirebilir.");
    }
    const parsed = companySchema.safeParse(input);
    if (!parsed.success) throw new UserError("Formda hatalar var.", zodFieldErrors(parsed.error));
    const { name, ...rest } = parsed.data;
    const profile = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v ? v : null]));
    await tenantTx(ctx, async (tx) => {
      await tx.update(organization).set({ name }).where(eq(organization.id, ctx.tenantId));
      await tx.update(tenantProfile).set(profile).where(eq(tenantProfile.tenantId, ctx.tenantId));
      await audit(tx, ctx, { action: "guncelle", entity: "sirket", entityId: ctx.tenantId, summary: "Şirket bilgileri güncellendi" });
    });
    refresh();
  }, "Şirket bilgileri kaydedildi.");
}
