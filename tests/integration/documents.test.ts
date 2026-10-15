import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import type { DB } from "@/server/db/client";
import { automationRules, cashAccounts, documents, notification, partnerMovements, stockMovements, warehouses } from "@/server/db/schema";
import { createTenant } from "@/server/domain/tenants";
import { createEntity } from "@/server/entities/service";
import { cleanEntityValues } from "@/lib/entities/validation";
import { ENTITIES } from "@/lib/entities/registry";
import { approveDocument, cancelDocument, convertDocument, deleteDraft, saveDraft } from "@/server/documents/service";
import { cashBalances, partnerBalance, partnerStatement, stockStatus } from "@/server/ledger/queries";
import { averageCost } from "@/server/ledger/stock";
import { UserError } from "@/server/domain/errors";
import { freshTestDb } from "../helpers/db";

let db: DB;
let close: () => Promise<void>;
let t: string;
let musteri: string;
let tedarikci: string;
let yatak: string;
let sunger: string;
let depo1: string;
let depo2: string;
let kasa: string;
const TODAY = "2026-10-15";

async function entity(key: keyof typeof ENTITIES, raw: Record<string, unknown>) {
  const r = cleanEntityValues(ENTITIES[key], raw);
  if (!r.ok) throw new Error(JSON.stringify(r.fieldErrors));
  return createEntity(db, t, key, r.values);
}

async function tx<T>(fn: (x: DB) => Promise<T>): Promise<T> {
  return db.transaction(async (x) => fn(x as unknown as DB));
}

beforeAll(async () => {
  ({ db, close } = await freshTestDb());
  t = await createTenant(db, { name: "Test Mobilya", slug: "test-mobilya", plan: "kurumsal" });
  musteri = await entity("cari", { name: "Yıldız Mobilya", kind: "musteri", paymentTermDays: "30" });
  tedarikci = await entity("cari", { name: "Anadolu Sünger", kind: "tedarikci" });
  yatak = await entity("urun", { name: "Ortopedik Yatak 160x200", kind: "mamul", unit: "ADET", vatRate: "10", salePrice: "8500", criticalLevel: "3" });
  sunger = await entity("urun", { name: "Sünger 30 DNS", kind: "hammadde", unit: "M3", vatRate: "20" });
  const [w] = await db.select().from(warehouses).where(and(eq(warehouses.tenantId, t), eq(warehouses.isDefault, true)));
  depo1 = w.id;
  depo2 = await entity("depo", { name: "Showroom" });
  const [k] = await db.select().from(cashAccounts).where(eq(cashAccounts.tenantId, t));
  kasa = k.id;
});

afterAll(async () => {
  await close();
});

describe("alış faturası", () => {
  it("stoğa giriş yapar, maliyeti iskontolu net fiyattan alır, tedarikçiyi alacaklandırır", async () => {
    const id = await tx((x) =>
      saveDraft(x, t, null, {
        type: "alis_fatura",
        date: "2026-10-01",
        partnerId: tedarikci,
        warehouseId: depo1,
        lines: [{ productId: yatak, quantity: "10", unitPrice: "5000", discountRate: "10", vatRate: "10" }],
      }),
    );
    const { number } = await tx((x) => approveDocument(x, t, null, id));
    expect(number).toBe("AFT2026000000001");

    const status = await stockStatus(db, t);
    const y = status.find((s) => s.id === yatak)!;
    expect(y.quantity).toBe("10.0000");
    expect((await averageCost(db, t, yatak)).toFixed(2)).toBe("4500.00");

    const b = await partnerBalance(db, t, tedarikci, TODAY);
    // 10 × 5000 = 50.000, %10 iskonto = 45.000, %10 KDV = 4.500 → 49.500 alacak
    expect(b.credit).toBe("49500.00");
    expect(b.balance).toBe("-49500.00");
  });

  it("ikinci alışta ağırlıklı ortalama maliyeti günceller", async () => {
    const id = await tx((x) =>
      saveDraft(x, t, null, {
        type: "alis_fatura",
        date: "2026-10-02",
        partnerId: tedarikci,
        lines: [{ productId: yatak, quantity: "10", unitPrice: "5500", vatRate: "10" }],
      }),
    );
    await tx((x) => approveDocument(x, t, null, id));
    // (10×4500 + 10×5500) / 20 = 5000
    expect((await averageCost(db, t, yatak)).toFixed(2)).toBe("5000.00");
  });
});

describe("satış akışı: teklif → sipariş → irsaliye → fatura", () => {
  let teklif: string;
  let siparis: string;
  let irsaliye: string;
  let fatura: string;

  it("teklif ve sipariş stoğa ve cariye dokunmaz", async () => {
    teklif = await tx((x) =>
      saveDraft(x, t, null, {
        type: "satis_teklif",
        date: "2026-10-05",
        partnerId: musteri,
        lines: [{ productId: yatak, quantity: "4", unitPrice: "8500", vatRate: "10" }],
      }),
    );
    await tx((x) => approveDocument(x, t, null, teklif));
    siparis = await tx((x) => convertDocument(x, t, null, teklif, "satis_siparis", "2026-10-06"));
    await tx((x) => approveDocument(x, t, null, siparis));

    const y = (await stockStatus(db, t)).find((s) => s.id === yatak)!;
    expect(y.quantity).toBe("20.0000");
    expect((await partnerBalance(db, t, musteri, TODAY)).balance).toBe("0.00");
  });

  it("irsaliye stoğu ortalama maliyetle düşer", async () => {
    irsaliye = await tx((x) => convertDocument(x, t, null, siparis, "satis_irsaliye", "2026-10-07"));
    await tx((x) => approveDocument(x, t, null, irsaliye));
    const y = (await stockStatus(db, t)).find((s) => s.id === yatak)!;
    expect(y.quantity).toBe("16.0000");
    const out = await db
      .select()
      .from(stockMovements)
      .where(and(eq(stockMovements.tenantId, t), eq(stockMovements.documentId, irsaliye)));
    expect(out[0].unitCost).toBe("5000.0000");
  });

  it("irsaliyeden kesilen fatura stoğu ikinci kez düşmez, müşteriyi borçlandırır ve vadeyi cariden alır", async () => {
    fatura = await tx((x) => convertDocument(x, t, null, irsaliye, "satis_fatura", "2026-10-07"));
    const { number } = await tx((x) => approveDocument(x, t, null, fatura));
    expect(number).toBe("SFT2026000000001");

    const y = (await stockStatus(db, t)).find((s) => s.id === yatak)!;
    expect(y.quantity).toBe("16.0000");

    // 4 × 8500 = 34.000 + %10 KDV = 37.400
    const b = await partnerBalance(db, t, musteri, TODAY);
    expect(b.debit).toBe("37400.00");
    const [m] = await db.select().from(partnerMovements).where(eq(partnerMovements.documentId, fatura));
    expect(m.dueDate).toBe("2026-11-06"); // 30 gün vade
  });

  it("onaylı belge değiştirilemez ve silinemez", async () => {
    await expect(
      tx((x) =>
        saveDraft(
          x,
          t,
          null,
          { type: "satis_fatura", date: "2026-10-07", partnerId: musteri, lines: [{ productId: yatak, quantity: "1", unitPrice: "1" }] },
          fatura,
        ),
      ),
    ).rejects.toBeInstanceOf(UserError);
    await expect(tx((x) => deleteDraft(x, t, fatura))).rejects.toBeInstanceOf(UserError);
  });

  it("tahsilat cariyi alacaklandırır, kasaya girer; ekstre yürüyen bakiyeyi verir", async () => {
    const id = await tx((x) =>
      saveDraft(x, t, null, { type: "tahsilat", date: "2026-10-10", partnerId: musteri, cashAccountId: kasa, amount: "20.000,00", lines: [] }),
    );
    await tx((x) => approveDocument(x, t, null, id));
    expect((await partnerBalance(db, t, musteri, TODAY)).balance).toBe("17400.00");
    const k = (await cashBalances(db, t)).find((a) => a.id === kasa)!;
    expect(k.balance).toBe("20000.00");
    const st = await partnerStatement(db, t, musteri);
    expect(st.map((s) => s.balance)).toEqual(["37400.00", "17400.00"]);
  });

  it("vadesi geçen tutarı FIFO ile hesaplar", async () => {
    // Vade 06.11.2026; 07.11.2026'da kalan 17.400 vadesi geçmiş olur
    expect((await partnerBalance(db, t, musteri, "2026-10-15")).overdue).toBe("0.00");
    expect((await partnerBalance(db, t, musteri, "2026-11-07")).overdue).toBe("17400.00");
  });

  it("iptal ters kayıt atar: stok ve cari eski haline döner, numara korunur", async () => {
    await tx((x) => cancelDocument(x, t, irsaliye));
    await tx((x) => cancelDocument(x, t, fatura));
    const y = (await stockStatus(db, t)).find((s) => s.id === yatak)!;
    expect(y.quantity).toBe("20.0000");
    expect((await partnerBalance(db, t, musteri, TODAY)).balance).toBe("-20000.00");
    const [doc] = await db.select().from(documents).where(eq(documents.id, fatura));
    expect(doc.status).toBe("iptal");
    expect(doc.number).toBe("SFT2026000000001");
    // Hiçbir hareket silinmedi: orijinal + ters kayıt
    const moves = await db.select().from(partnerMovements).where(eq(partnerMovements.documentId, fatura));
    expect(moves).toHaveLength(2);
  });
});

describe("numara serisi", () => {
  it("silinen taslak numara harcamaz; seri boşluksuz ilerler", async () => {
    const d1 = await tx((x) =>
      saveDraft(x, t, null, { type: "satis_fatura", date: "2026-10-12", partnerId: musteri, lines: [{ productId: sunger, quantity: "1", unitPrice: "100" }] }),
    );
    await tx((x) => deleteDraft(x, t, d1));
    const d2 = await tx((x) =>
      saveDraft(x, t, null, { type: "satis_fatura", date: "2026-10-12", partnerId: musteri, lines: [{ productId: sunger, quantity: "1", unitPrice: "100" }] }),
    );
    const { number } = await tx((x) => approveDocument(x, t, null, d2));
    expect(number).toBe("SFT2026000000002");
  });
});

describe("depo transferi", () => {
  it("toplam stok değişmez, depolar arasında taşınır", async () => {
    const id = await tx((x) =>
      saveDraft(x, t, null, {
        type: "depo_transfer",
        date: "2026-10-13",
        warehouseId: depo1,
        targetWarehouseId: depo2,
        lines: [{ productId: yatak, quantity: "5", unitPrice: "0" }],
      }),
    );
    await tx((x) => approveDocument(x, t, null, id));
    expect((await stockStatus(db, t)).find((s) => s.id === yatak)!.quantity).toBe("20.0000");
    expect((await stockStatus(db, t, { warehouseId: depo2 })).find((s) => s.id === yatak)!.quantity).toBe("5.0000");
  });

  it("aynı depoya transfer reddedilir", async () => {
    await expect(
      tx((x) =>
        saveDraft(x, t, null, {
          type: "depo_transfer",
          date: "2026-10-13",
          warehouseId: depo1,
          targetWarehouseId: depo1,
          lines: [{ productId: yatak, quantity: "1", unitPrice: "0" }],
        }),
      ),
    ).rejects.toThrow(/Lütfen işaretli alanları düzeltin/);
  });
});

describe("doğrulama", () => {
  it("cari ve satır hatalarını alan bazında döndürür", async () => {
    try {
      await tx((x) =>
        saveDraft(x, t, null, { type: "satis_fatura", date: "2026-10-13", lines: [{ productId: yatak, quantity: "0", unitPrice: "-5" }] }),
      );
      throw new Error("hata bekleniyordu");
    } catch (e) {
      expect(e).toBeInstanceOf(UserError);
      const fe = (e as UserError).fieldErrors!;
      expect(fe.partnerId).toBeDefined();
      expect(fe["lines.0.quantity"]).toBeDefined();
      expect(fe["lines.0.unitPrice"]).toBeDefined();
    }
  });
});

describe("otomasyon: kritik stok", () => {
  it("kural açıksa kritik seviyenin altına düşen ürün için bildirim oluşturur", async () => {
    await db.insert(automationRules).values({ tenantId: t, template: "kritik_stok", name: "Kritik stok", trigger: "x", action: "y" });
    const id = await tx((x) =>
      saveDraft(x, t, null, {
        type: "satis_fatura",
        date: "2026-10-14",
        partnerId: musteri,
        warehouseId: depo1,
        lines: [{ productId: yatak, quantity: "13", unitPrice: "8500", vatRate: "10" }],
      }),
    );
    await tx((x) => approveDocument(x, t, null, id));
    // Toplam 20 - 13 = 7 > 3: bildirim yok
    expect(await db.select().from(notification).where(eq(notification.tenantId, t))).toHaveLength(0);
    const id2 = await tx((x) =>
      saveDraft(x, t, null, {
        type: "satis_fatura",
        date: "2026-10-14",
        partnerId: musteri,
        warehouseId: depo2,
        lines: [{ productId: yatak, quantity: "5", unitPrice: "8500", vatRate: "10" }],
      }),
    );
    await tx((x) => approveDocument(x, t, null, id2));
    const n = await db.select().from(notification).where(eq(notification.tenantId, t));
    expect(n).toHaveLength(1);
    expect(n[0].title).toContain("Ortopedik Yatak");
  });
});

describe("kasa ve virman", () => {
  let kasa2: string;
  let banka: string;
  const balance = async (id: string) => (await cashBalances(db, t)).find((a) => a.id === id)!.balance;
  const approved = async (input: Parameters<typeof saveDraft>[3]) => {
    const id = await tx((x) => saveDraft(x, t, null, input));
    await tx((x) => approveDocument(x, t, null, id));
    return id;
  };

  beforeAll(async () => {
    kasa2 = await entity("kasa-hesap", { name: "Şube Kasası", kind: "kasa" });
    banka = await entity("kasa-hesap", { name: "Ticari Hesap", kind: "banka" });
  });

  it("kasa eksiye düşemez; banka hesabı (KMH) düşebilir", async () => {
    const id = await tx((x) =>
      saveDraft(x, t, null, { type: "tediye", date: "2026-10-12", partnerId: tedarikci, cashAccountId: kasa2, amount: "100", lines: [] }),
    );
    await expect(tx((x) => approveDocument(x, t, null, id))).rejects.toThrow(/eksiye düşemez/);
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    expect(doc.status).toBe("taslak");
    expect(doc.number).toBeNull();

    await approved({ type: "tediye", date: "2026-10-12", partnerId: tedarikci, cashAccountId: banka, amount: "1.000", lines: [] });
    expect(await balance(banka)).toBe("-1000.00");
  });

  it("virman parayı hesaplar arasında taşır; kasadaki para harcandıysa virman iptal edilemez", async () => {
    const virman = await approved({ type: "virman", date: "2026-10-13", cashAccountId: banka, targetCashAccountId: kasa2, amount: "5000", lines: [] });
    const [doc] = await db.select().from(documents).where(eq(documents.id, virman));
    expect(doc.number).toBe("VRM2026000000001");
    expect(await balance(banka)).toBe("-6000.00");
    expect(await balance(kasa2)).toBe("5000.00");

    const odeme = await approved({ type: "tediye", date: "2026-10-14", partnerId: tedarikci, cashAccountId: kasa2, amount: "3000", lines: [] });
    expect(await balance(kasa2)).toBe("2000.00");
    await expect(tx((x) => cancelDocument(x, t, virman))).rejects.toThrow(/yetersiz/);

    await tx((x) => cancelDocument(x, t, odeme));
    await tx((x) => cancelDocument(x, t, virman));
    expect(await balance(kasa2)).toBe("0.00");
    expect(await balance(banka)).toBe("-1000.00");
  });

  it("aynı hesaba virman reddedilir", async () => {
    try {
      await tx((x) => saveDraft(x, t, null, { type: "virman", date: "2026-10-13", cashAccountId: banka, targetCashAccountId: banka, amount: "10", lines: [] }));
      throw new Error("hata bekleniyordu");
    } catch (e) {
      expect(e).toBeInstanceOf(UserError);
      expect((e as UserError).fieldErrors!.targetCashAccountId).toBeDefined();
    }
  });
});
