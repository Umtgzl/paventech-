import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DB } from "@/server/db/client";
import { createTenant } from "@/server/domain/tenants";
import { createEntity } from "@/server/entities/service";
import { cleanEntityValues } from "@/lib/entities/validation";
import { ENTITIES } from "@/lib/entities/registry";
import { approveDocument, saveDraft } from "@/server/documents/service";
import { bomCost, completeProductionOrder, materialRequirements, saveBomLines } from "@/server/production/service";
import { stockStatus } from "@/server/ledger/queries";
import { averageCost } from "@/server/ledger/stock";
import { UserError } from "@/server/domain/errors";
import { freshTestDb } from "../helpers/db";

let db: DB;
let close: () => Promise<void>;
let t: string;
let yatak: string;
let sunger: string;
let yay: string;
let kumas: string;
let bom: string;

async function entity(key: keyof typeof ENTITIES, raw: Record<string, unknown>) {
  const r = cleanEntityValues(ENTITIES[key], raw);
  if (!r.ok) throw new Error(JSON.stringify(r.fieldErrors));
  return createEntity(db, t, key, r.values);
}
const tx = <T,>(fn: (x: DB) => Promise<T>) => db.transaction(async (x) => fn(x as unknown as DB));

beforeAll(async () => {
  ({ db, close } = await freshTestDb());
  t = await createTenant(db, { name: "Üretim AŞ", slug: "uretim", plan: "kurumsal" });
  const ted = await entity("cari", { name: "Tedarikçi", kind: "tedarikci" });
  yatak = await entity("urun", { name: "Ortopedik Yatak 160x200", kind: "mamul" });
  sunger = await entity("urun", { name: "Sünger", kind: "hammadde", unit: "M3" });
  yay = await entity("urun", { name: "Yay ünitesi", kind: "hammadde" });
  kumas = await entity("urun", { name: "Kumaş", kind: "hammadde", unit: "MT" });
  const id = await tx((x) =>
    saveDraft(x, t, null, {
      type: "alis_fatura",
      date: "2026-10-01",
      partnerId: ted,
      lines: [
        { productId: sunger, quantity: "10", unitPrice: "2000", vatRate: "20" },
        { productId: yay, quantity: "20", unitPrice: "1000", vatRate: "20" },
        { productId: kumas, quantity: "100", unitPrice: "100", vatRate: "20" },
      ],
    }),
  );
  await tx((x) => approveDocument(x, t, null, id));
  bom = await entity("recete", { name: "Ortopedik 160x200", productId: yatak, outputQuantity: "1" });
});

afterAll(async () => close());

describe("üretim", () => {
  it("reçete maliyetini fire dahil hesaplar", async () => {
    await tx((x) =>
      saveBomLines(x, t, bom, [
        { productId: sunger, quantity: "0,5", wasteRate: "10" },
        { productId: yay, quantity: "1" },
        { productId: kumas, quantity: "6" },
      ]),
    );
    const c = await bomCost(db, t, bom);
    // 0,5×1,1×2000 = 1100 + 1000 + 600 = 2700
    expect(c!.unitCost.toFixed(2)).toBe("2700.00");
  });

  it("mamul kendi reçetesine giremez", async () => {
    await expect(tx((x) => saveBomLines(x, t, bom, [{ productId: yatak, quantity: "1" }]))).rejects.toBeInstanceOf(UserError);
  });

  it("iş emri tamamlanınca hammadde düşer, mamul reçete maliyetiyle girer", async () => {
    const order = await entity("is-emri", { bomId: bom, quantity: "4", status: "planlandi" });
    const req = await materialRequirements(db, t, order);
    expect(req.lines.find((l) => l.productId === sunger)?.required).toBe("2.2000");
    const r = await tx((x) => completeProductionOrder(x, t, order, "2026-10-05"));
    expect(r.unitCost).toBe("2700.0000");

    const s = await stockStatus(db, t);
    expect(s.find((x) => x.id === yatak)?.quantity).toBe("4.0000");
    expect(s.find((x) => x.id === sunger)?.quantity).toBe("7.8000");
    expect(s.find((x) => x.id === yay)?.quantity).toBe("16.0000");
    expect(s.find((x) => x.id === kumas)?.quantity).toBe("76.0000");
    expect((await averageCost(db, t, yatak)).toFixed(2)).toBe("2700.00");

    await expect(tx((x) => completeProductionOrder(x, t, order, "2026-10-05"))).rejects.toBeInstanceOf(UserError);
  });
});
