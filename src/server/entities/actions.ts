"use server";

import { refresh } from "next/cache";
import { runAction } from "@/server/actions";
import { assertModule, UserError } from "@/server/session";
import { audit, tenantTx } from "@/server/tenant";
import { ENTITIES, isEntityKey } from "@/lib/entities/registry";
import { cleanEntityValues, cleanField } from "@/lib/entities/validation";
import {
  createEntity,
  deleteEntity,
  ensureSingleDefaultWarehouse,
  getEntity,
  updateEntity,
} from "./service";

function resolve(key: string) {
  if (!isEntityKey(key)) throw new UserError("Bilinmeyen kayıt türü.");
  return ENTITIES[key];
}

/** Kayıt oluşturur (id null) veya günceller. Doğrulama sunucuda yeniden yapılır. */
export async function saveEntityAction(key: string, id: string | null, raw: Record<string, unknown>) {
  return runAction(async () => {
    const def = resolve(key);
    const ctx = await assertModule(def.module);
    const cleaned = cleanEntityValues(def, raw);
    if (!cleaned.ok) throw new UserError("Lütfen işaretli alanları düzeltin.", cleaned.fieldErrors);

    const savedId = await tenantTx(ctx, async (tx) => {
      let rid: string;
      if (id) {
        const existing = await getEntity(tx, ctx.tenantId, def.key, id);
        if (!existing) throw new UserError("Kayıt bulunamadı.");
        await updateEntity(tx, ctx.tenantId, def.key, id, cleaned.values);
        rid = id;
      } else {
        rid = await createEntity(tx, ctx.tenantId, def.key, cleaned.values);
      }
      if (def.key === "depo" && cleaned.values.isDefault) {
        await ensureSingleDefaultWarehouse(tx, ctx.tenantId, rid);
      }
      await audit(tx, ctx, {
        action: id ? "guncelle" : "olustur",
        entity: def.key,
        entityId: rid,
        summary: `${def.label}: ${String(cleaned.values[def.titleField] ?? "")}`,
      });
      return rid;
    });
    refresh();
    return { id: savedId };
  }, id ? "Kaydedildi." : "Kayıt oluşturuldu.");
}

export async function deleteEntityAction(key: string, id: string) {
  return runAction(async () => {
    const def = resolve(key);
    const ctx = await assertModule(def.module);
    await tenantTx(ctx, async (tx) => {
      const existing = await getEntity(tx, ctx.tenantId, def.key, id);
      if (!existing) throw new UserError("Kayıt bulunamadı.");
      await deleteEntity(tx, ctx.tenantId, def.key, id);
      await audit(tx, ctx, {
        action: "sil",
        entity: def.key,
        entityId: id,
        summary: `${def.label} silindi: ${String(existing[def.titleField] ?? "")}`,
      });
    });
    refresh();
  }, "Kayıt silindi.");
}

/** Pano (kanban) görünümünde kartı başka kolona taşır: yalnızca pano alanı değişir. */
export async function moveBoardCardAction(key: string, id: string, value: string) {
  return runAction(async () => {
    const def = resolve(key);
    if (!def.board) throw new UserError("Bu kayıt türünde pano yok.");
    const field = def.fields.find((f) => f.name === def.board!.field)!;
    const r = cleanField(field, value);
    if ("error" in r) throw new UserError(r.error);
    const ctx = await assertModule(def.module);
    await tenantTx(ctx, async (tx) => {
      const existing = await getEntity(tx, ctx.tenantId, def.key, id);
      if (!existing) throw new UserError("Kayıt bulunamadı.");
      await updateEntity(tx, ctx.tenantId, def.key, id, { [field.name]: r.value });
      const label = field.options?.find((o) => o.value === value)?.label ?? value;
      await audit(tx, ctx, {
        action: "durum",
        entity: def.key,
        entityId: id,
        summary: `${def.label} "${String(existing[def.titleField] ?? "")}" → ${label}`,
      });
    });
    refresh();
  });
}
