"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/server/db";
import { automationRules, partners } from "@/server/db/schema";
import { runAction } from "@/server/actions";
import { assertModule, UserError } from "@/server/session";
import { audit, tenantTx } from "@/server/tenant";
import { AUTOMATION_TEMPLATES } from "@/server/domain/automation";
import { saveDraft } from "@/server/documents/service";
import { todayIso } from "@/lib/format";
import { answerQuestion, METRICS } from "./assistant";
import { createPurchaseFromInbox, rejectInbox } from "./inbox";

export async function processInboxAction(id: string, supplierId: string, productIds: (string | null)[]) {
  return runAction(async () => {
    const ctx = await assertModule("edonusum");
    await assertModule("satinalma");
    if (!supplierId) throw new UserError("Tedarikçi cari kartını seçin.");
    const docId = await tenantTx(ctx, async (tx) => {
      const [p] = await tx.select({ id: partners.id }).from(partners).where(and(eq(partners.tenantId, ctx.tenantId), eq(partners.id, supplierId)));
      if (!p) throw new UserError("Tedarikçi bulunamadı.");
      const d = await createPurchaseFromInbox(tx, ctx.tenantId, ctx.userId, id, { supplierId, productIds });
      await audit(tx, ctx, { action: "e-fatura-isle", entity: "alis_fatura", entityId: d, summary: "Gelen e-faturadan alış faturası taslağı oluşturuldu" });
      return d;
    });
    refresh();
    return { documentId: docId };
  }, "Alış faturası taslağı hazır; eşleşmeler öğrenildi.");
}

export async function rejectInboxAction(id: string) {
  return runAction(async () => {
    const ctx = await assertModule("edonusum");
    await tenantTx(ctx, async (tx) => {
      await rejectInbox(tx, ctx.tenantId, id);
      await audit(tx, ctx, { action: "e-fatura-reddet", entity: "einvoice", entityId: id, summary: "Gelen e-fatura reddedildi" });
    });
    refresh();
  }, "e-Fatura reddedildi.");
}

export async function askAssistantAction(question: string) {
  return runAction(async () => {
    const ctx = await assertModule("ai");
    const q = question.trim();
    if (q.length < 3) throw new UserError("Bir soru yazın.");
    if (q.length > 300) throw new UserError("Soru çok uzun.");
    const answer = await answerQuestion(db, ctx.tenantId, q, todayIso());
    return { answer, suggestions: METRICS.map((m) => m.label) };
  });
}

/** Şablon bazında kural aç/kapat; şirkette kural satırı yoksa ilk seferde oluşturulur. */
export async function toggleAutomationAction(template: string, enabled: boolean) {
  return runAction(async () => {
    const ctx = await assertModule("otomasyon");
    const tpl = AUTOMATION_TEMPLATES.find((t) => t.template === template);
    if (!tpl) throw new UserError("Kural şablonu bulunamadı.");
    if (enabled && !tpl.live) throw new UserError("Bu kural şablonu prototipte henüz çalışmıyor.");
    await tenantTx(ctx, async (tx) => {
      const [rule] = await tx
        .insert(automationRules)
        .values({ tenantId: ctx.tenantId, template: tpl.template, name: tpl.name, trigger: tpl.trigger, action: tpl.action, enabled })
        .onConflictDoUpdate({ target: [automationRules.tenantId, automationRules.template], set: { enabled, updatedAt: new Date() } })
        .returning({ id: automationRules.id });
      await audit(tx, ctx, { action: "otomasyon", entity: "kural", entityId: rule.id, summary: `${tpl.name} ${enabled ? "açıldı" : "kapatıldı"}` });
    });
    refresh();
  }, enabled ? "Kural açıldı." : "Kural kapatıldı.");
}

/** B2B portal önizlemesinden sipariş: ana sistemde satış siparişi taslağı oluşur. */
export async function createPortalOrderAction(partnerId: string, lines: { productId: string; quantity: string; unitPrice: string; vatRate: string }[]) {
  return runAction(async () => {
    const ctx = await assertModule("b2b");
    await assertModule("satis");
    const filled = lines.filter((l) => l.quantity && Number(l.quantity.replace(",", ".")) > 0);
    if (filled.length === 0) throw new UserError("En az bir ürün için miktar girin.");
    const id = await tenantTx(ctx, async (tx) => {
      const d = await saveDraft(tx, ctx.tenantId, ctx.userId, {
        type: "satis_siparis",
        date: todayIso(),
        partnerId,
        notes: "B2B bayi portalından gelen sipariş",
        lines: filled,
      });
      await audit(tx, ctx, { action: "b2b-siparis", entity: "satis_siparis", entityId: d, summary: "B2B portal siparişi" });
      return d;
    });
    refresh();
    return { id };
  }, "Sipariş alındı; ana sistemde taslak satış siparişi oluştu.");
}
