"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/server/db";
import { documents } from "@/server/db/schema";
import { runAction } from "@/server/actions";
import { assertModule, UserError } from "@/server/session";
import { audit, tenantTx } from "@/server/tenant";
import { DOC_TYPES, isDocTypeKey } from "@/lib/documents/types";

/**
 * e-Belge gönderimi (prototip: simülasyon). Gerçek sürümde UBL-TR XML üretilip
 * özel entegratörün API'sine gönderilecek; durum entegratörden sorgulanacak.
 */
export async function sendEDocumentAction(id: string) {
  return runAction(async () => {
    const ctx = await assertModule("edonusum");
    await tenantTx(ctx, async (tx) => {
      const [doc] = await tx
        .select()
        .from(documents)
        .where(and(eq(documents.tenantId, ctx.tenantId), eq(documents.id, id)))
        .for("update");
      if (!doc || !isDocTypeKey(doc.type) || !DOC_TYPES[doc.type].eDocument) throw new UserError("Belge bulunamadı.");
      if (doc.status !== "onayli") throw new UserError("Yalnızca onaylı belgeler gönderilebilir.");
      if (doc.eStatus && doc.eStatus !== "ret") throw new UserError("Belge zaten gönderildi.");
      await tx.update(documents).set({ eStatus: "gonderildi" }).where(eq(documents.id, id));
      await audit(tx, ctx, { action: "e-gonder", entity: doc.type, entityId: id, summary: `${doc.number} entegratöre gönderildi (demo)` });
    });
    refresh();
  }, "Belge entegratöre gönderildi (demo).");
}

export async function refreshEDocumentStatusAction(id: string) {
  return runAction(async () => {
    const ctx = await assertModule("edonusum");
    await tenantTx(ctx, async (tx) => {
      const [doc] = await tx
        .select({ eStatus: documents.eStatus, number: documents.number, type: documents.type })
        .from(documents)
        .where(and(eq(documents.tenantId, ctx.tenantId), eq(documents.id, id)));
      if (!doc) throw new UserError("Belge bulunamadı.");
      if (doc.eStatus !== "gonderildi") return;
      await tx.update(documents).set({ eStatus: "kabul" }).where(eq(documents.id, id));
      await audit(tx, ctx, { action: "e-durum", entity: doc.type, entityId: id, summary: `${doc.number}: alıcı kabul etti (demo)` });
    });
    refresh();
  }, "Durum güncellendi.");
}
