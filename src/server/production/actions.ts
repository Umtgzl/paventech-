"use server";

import { refresh } from "next/cache";
import { runAction } from "@/server/actions";
import { assertModule } from "@/server/session";
import { audit, tenantTx } from "@/server/tenant";
import { todayIso } from "@/lib/format";
import { completeProductionOrder, saveBomLines, startProductionOrder, type BomLineInput } from "./service";

export async function saveBomLinesAction(bomId: string, lines: BomLineInput[]) {
  return runAction(async () => {
    const ctx = await assertModule("uretim");
    await tenantTx(ctx, async (tx) => {
      await saveBomLines(tx, ctx.tenantId, bomId, lines);
      await audit(tx, ctx, { action: "guncelle", entity: "recete", entityId: bomId, summary: "Reçete satırları güncellendi" });
    });
    refresh();
  }, "Reçete kaydedildi.");
}

export async function startProductionAction(orderId: string) {
  return runAction(async () => {
    const ctx = await assertModule("uretim");
    await tenantTx(ctx, async (tx) => {
      await startProductionOrder(tx, ctx.tenantId, orderId);
      await audit(tx, ctx, { action: "durum", entity: "is-emri", entityId: orderId, summary: "İş emri üretime alındı" });
    });
    refresh();
  }, "İş emri üretime alındı.");
}

export async function completeProductionAction(orderId: string) {
  return runAction(async () => {
    const ctx = await assertModule("uretim");
    const r = await tenantTx(ctx, async (tx) => {
      const res = await completeProductionOrder(tx, ctx.tenantId, orderId, todayIso());
      await audit(tx, ctx, {
        action: "tamamla",
        entity: "is-emri",
        entityId: orderId,
        summary: `Üretim tamamlandı, birim maliyet ${res.unitCost}`,
      });
      return res;
    });
    refresh();
    return r;
  }, "Üretim tamamlandı: hammaddeler düşüldü, mamul stoğa girdi.");
}
