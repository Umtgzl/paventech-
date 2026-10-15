"use server";

import { refresh } from "next/cache";
import { runAction } from "@/server/actions";
import { assertModule, getTenantContext, hasModule, UserError } from "@/server/session";
import { MODULE_MAP } from "@/lib/modules";
import { audit, tenantTx } from "@/server/tenant";
import { db } from "@/server/db";
import { documents } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import type { DocumentInput } from "@/lib/documents/input";
import { DOC_TYPES, isDocTypeKey, type DocTypeKey } from "@/lib/documents/types";
import { todayIso } from "@/lib/format";
import { approveDocument, cancelDocument, convertDocument, deleteDraft, saveDraft } from "./service";

/** Belgenin türünü kullanıcının kendi şirketi içinde bulur ve modül yetkisini kontrol eder. */
async function contextForDocument(id: string) {
  const ctx = await getTenantContext();
  const [d] = await db
    .select({ type: documents.type })
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.tenantId, ctx.tenantId)));
  if (!d || !isDocTypeKey(d.type)) throw new UserError("Belge bulunamadı.");
  const type: DocTypeKey = d.type;
  if (!hasModule(ctx, DOC_TYPES[type].module)) {
    throw new UserError(`"${MODULE_MAP[DOC_TYPES[type].module].short}" modülü şirketinizde açık değil.`);
  }
  return { ctx, type };
}

/** Taslak kaydeder; `approve` true ise aynı transaction'da onaylar. */
export async function saveDocumentAction(input: DocumentInput, id: string | null, approve: boolean) {
  return runAction(async () => {
    if (!isDocTypeKey(input.type)) throw new UserError("Geçersiz belge türü.");
    const def = DOC_TYPES[input.type];
    const ctx = await assertModule(def.module);
    const result = await tenantTx(ctx, async (tx) => {
      const docId = await saveDraft(tx, ctx.tenantId, ctx.userId, input, id);
      let number: string | null = null;
      if (approve) number = (await approveDocument(tx, ctx.tenantId, ctx.userId, docId)).number;
      await audit(tx, ctx, {
        action: approve ? "onayla" : id ? "guncelle" : "olustur",
        entity: input.type,
        entityId: docId,
        summary: approve ? `${def.label} onaylandı: ${number}` : `${def.label} taslağı kaydedildi`,
      });
      return { id: docId, number };
    });
    refresh();
    return result;
  }, approve ? "Belge onaylandı." : "Taslak kaydedildi.");
}

export async function approveDocumentAction(id: string) {
  return runAction(async () => {
    const { ctx, type } = await contextForDocument(id);
    const { number } = await tenantTx(ctx, async (tx) => {
      const r = await approveDocument(tx, ctx.tenantId, ctx.userId, id);
      await audit(tx, ctx, { action: "onayla", entity: type, entityId: id, summary: `${DOC_TYPES[type].label} onaylandı: ${r.number}` });
      return r;
    });
    refresh();
    return { number };
  }, "Belge onaylandı; hareketler oluşturuldu.");
}

export async function cancelDocumentAction(id: string) {
  return runAction(async () => {
    const { ctx, type } = await contextForDocument(id);
    await tenantTx(ctx, async (tx) => {
      await cancelDocument(tx, ctx.tenantId, id);
      await audit(tx, ctx, { action: "iptal", entity: type, entityId: id, summary: `${DOC_TYPES[type].label} iptal edildi` });
    });
    refresh();
  }, "Belge iptal edildi; ters kayıtlar oluşturuldu.");
}

export async function deleteDocumentAction(id: string) {
  return runAction(async () => {
    const { ctx, type } = await contextForDocument(id);
    await tenantTx(ctx, async (tx) => {
      await deleteDraft(tx, ctx.tenantId, id);
      await audit(tx, ctx, { action: "sil", entity: type, entityId: id, summary: `${DOC_TYPES[type].label} taslağı silindi` });
    });
    refresh();
    return { slug: DOC_TYPES[type].slug };
  }, "Taslak silindi.");
}

export async function convertDocumentAction(id: string, target: string) {
  return runAction(async () => {
    if (!isDocTypeKey(target)) throw new UserError("Geçersiz hedef belge türü.");
    const { ctx, type } = await contextForDocument(id);
    await assertModule(DOC_TYPES[target].module);
    const newId = await tenantTx(ctx, async (tx) => {
      const nid = await convertDocument(tx, ctx.tenantId, ctx.userId, id, target, todayIso());
      await audit(tx, ctx, {
        action: "donustur",
        entity: target,
        entityId: nid,
        summary: `${DOC_TYPES[type].label} → ${DOC_TYPES[target].label}`,
      });
      return nid;
    });
    refresh();
    return { id: newId };
  }, `${isDocTypeKey(target) ? DOC_TYPES[target].label : "Belge"} taslağı oluşturuldu.`);
}
