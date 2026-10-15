// Demo veri. Tüm şirketler, kişiler ve rakamlar kurgusaldır.
// Belgeler gerçek belge motorundan geçer (taslak → onay); bakiyeler ve stoklar
// hareketlerden oluşur, yani demo verisi de canlı sistemle aynı kurallara uyar.
// Tarihler çalıştırıldığı güne göre geriye doğru üretilir.
import { and, eq, sql } from "drizzle-orm";
import type { DB, Tx } from "@/server/db/client";
import {
  automationRules,
  cashAccounts,
  cashMovements,
  documents,
  einvoiceInbox,
  productionOrders,
  tenantProfile,
  warehouses,
} from "@/server/db/schema";
import { addUserToTenant, createTenant } from "@/server/domain/tenants";
import { AUTOMATION_TEMPLATES, onStockChanged } from "@/server/domain/automation";
import { createEntity } from "@/server/entities/service";
import { approveDocument, cancelDocument, convertDocument, saveDraft } from "@/server/documents/service";
import { completeProductionOrder, saveBomLines } from "@/server/production/service";
import { cleanEntityValues } from "@/lib/entities/validation";
import { ENTITIES } from "@/lib/entities/registry";
import type { EntityKey } from "@/lib/entities/types";
import { calcTotals } from "@/lib/documents/calc";
import type { DocumentInput } from "@/lib/documents/input";
import { addDaysIso, todayIso } from "@/lib/format";
import { dec, round2, toMoneyString } from "@/lib/money";
import { normalizeTr } from "@/lib/utils";

export const DEMO_PASSWORD = "demo1234";

// ---------- yardımcılar ----------

/** Tekrarlanabilir rastgele sayı üreteci (aynı seed = aynı demo). */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Ctx {
  rand: () => number;
  constructor(
    public tx: Tx,
    public tenantId: string,
    public userId: string,
    seed: number,
  ) {
    this.rand = mulberry32(seed);
  }
  int(a: number, b: number) {
    return a + Math.floor(this.rand() * (b - a + 1));
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.rand() * arr.length)];
  }
  chance(p: number) {
    return this.rand() < p;
  }
  /** Fiyatı ±oran içinde oynatır, 2 ondalığa yuvarlar */
  jitter(price: number, pct = 0.05) {
    return round2(price * (1 + (this.rand() * 2 - 1) * pct)).toFixed(2);
  }
  async card(key: EntityKey, raw: Record<string, unknown>) {
    const r = cleanEntityValues(ENTITIES[key], raw);
    if (!r.ok) throw new Error(`${key}: ${JSON.stringify(r.fieldErrors)}`);
    return createEntity(this.tx, this.tenantId, key, r.values);
  }
  async doc(input: DocumentInput, approve = true) {
    const id = await saveDraft(this.tx, this.tenantId, this.userId, input);
    if (approve) await approveDocument(this.tx, this.tenantId, this.userId, id);
    return id;
  }
}

async function cashBalance(c: Ctx, cashAccountId: string) {
  const [row] = await c.tx
    .select({ total: sql<string>`coalesce(sum(${cashMovements.amount}), 0)` })
    .from(cashMovements)
    .where(and(eq(cashMovements.tenantId, c.tenantId), eq(cashMovements.cashAccountId, cashAccountId)));
  return dec(row?.total);
}

/** "2026-05-01" + 1 ay -> "2026-06-01" (ayın ilk günü için) */
function addMonthsIso(isoDate: string, months: number) {
  const [y, m] = isoDate.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

// ---------- ana giriş ----------

export async function seedDemo(db: DB) {
  console.log("Demo veri yükleniyor...");
  const today = todayIso();

  await db.transaction(async (tx) => {
    const adminId = await addUserToTenant(tx, null, {
      name: "Paventech Yönetici",
      email: "admin@paventech.local",
      password: DEMO_PASSWORD,
      platformAdmin: true,
    });

    const mobilya = await createTenant(tx, {
      name: "Demo Mobilya ve Yatak",
      slug: "demo-mobilya",
      plan: "kurumsal",
      sector: "mobilya",
      legalName: "Demo Mobilya ve Yatak Sanayi Ticaret Ltd. Şti.",
      taxOffice: "Erciyes",
      taxNumber: "1234567890",
      city: "Kayseri",
    });
    await tx
      .update(tenantProfile)
      .set({ address: "Organize Sanayi Bölgesi 12. Cadde No: 8 Melikgazi", phone: "0352 000 00 00", email: "info@demo-mobilya.local" })
      .where(eq(tenantProfile.tenantId, mobilya));

    const gida = await createTenant(tx, {
      name: "Demo Gıda Toptan",
      slug: "demo-gida",
      plan: "baslangic",
      sector: "gida",
      legalName: "Demo Gıda Toptan Ticaret A.Ş.",
      taxOffice: "Çankaya",
      taxNumber: "9876543210",
      city: "Ankara",
    });

    const demoId = await addUserToTenant(tx, mobilya, {
      name: "Demo Kullanıcı",
      email: "demo@paventech.local",
      password: DEMO_PASSWORD,
      role: "owner",
    });
    await addUserToTenant(tx, gida, { name: "Demo Kullanıcı", email: "demo@paventech.local", password: DEMO_PASSWORD, role: "owner" });
    await addUserToTenant(tx, mobilya, { name: "Ayşe Kaya", email: "muhasebe@paventech.local", password: DEMO_PASSWORD, role: "member" });
    await addUserToTenant(tx, mobilya, { name: "", email: "admin@paventech.local", password: "", role: "owner" });
    await addUserToTenant(tx, gida, { name: "", email: "admin@paventech.local", password: "", role: "owner" });
    void adminId;

    await seedMobilya(new Ctx(tx, mobilya, demoId, 20261015), today);
    await seedGida(new Ctx(tx, gida, demoId, 777), today);
  });

  console.log("  Super Admin: admin@paventech.local");
  console.log("  Demo kullanıcı: demo@paventech.local (iki şirkete erişir)");
  console.log(`  Şifre: ${DEMO_PASSWORD}`);
}

// ---------- Demo Mobilya ve Yatak ----------

async function seedMobilya(c: Ctx, today: string) {
  const WEEKS = 25;
  const start = addDaysIso(today, -7 * WEEKS);

  // Depolar ve kasa/banka
  const [merkez] = await c.tx
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(and(eq(warehouses.tenantId, c.tenantId), eq(warehouses.isDefault, true)));
  await c.tx.update(warehouses).set({ name: "Merkez Depo (Fabrika)" }).where(eq(warehouses.id, merkez.id));
  const showroom = await c.card("depo", { name: "Showroom", address: "Kocasinan Bulvarı No: 41, Kayseri" });
  await c.card("depo", { name: "Hammadde Deposu", address: "OSB 12. Cadde, arka bina" });

  const [kasa] = await c.tx.select({ id: cashAccounts.id }).from(cashAccounts).where(eq(cashAccounts.tenantId, c.tenantId));
  const banka = await c.card("kasa-hesap", {
    name: "Ticari Hesap",
    kind: "banka",
    bankName: "Örnek Bank",
    iban: "TR00 0000 0000 0000 0000 0000 01",
  });
  const pos = await c.card("kasa-hesap", { name: "POS Hesabı", kind: "pos", bankName: "Örnek Bank" });
  await c.tx.insert(cashMovements).values([
    { tenantId: c.tenantId, cashAccountId: banka, date: start, amount: "1250000.00", description: "Açılış bakiyesi" },
    { tenantId: c.tenantId, cashAccountId: kasa.id, date: start, amount: "60000.00", description: "Açılış bakiyesi" },
  ]);

  // Cariler
  const customers = [
    { name: "Yıldız Mobilya Dekorasyon", city: "Kayseri", term: 30, contact: "Hasan Yıldız", phone: "0352 111 22 33", tax: "1111111111", pay: 0.9 },
    { name: "Kuzey Ev Tekstili", city: "Ankara", term: 45, contact: "Selin Kuzey", phone: "0312 222 33 44", tax: "2222222222", pay: 0.85 },
    { name: "Mavi Uyku Mağazaları", city: "İstanbul", term: 60, contact: "Kerem Mavi", phone: "0212 333 44 55", tax: "3333333333", pay: 0.8 },
    { name: "Akdeniz Ev Dünyası", city: "Antalya", term: 30, contact: "Deniz Akın", phone: "0242 444 55 66", tax: "4444444444", pay: 0.45 },
    { name: "Ege Mobilya Pazarı", city: "İzmir", term: 45, contact: "Oya Ege", phone: "0232 555 66 77", tax: "5555555555", pay: 0.85 },
    { name: "Başkent Yatak Merkezi", city: "Ankara", term: 30, contact: "Murat Başkan", phone: "0312 666 77 88", tax: "6666666666", pay: 0.95 },
    { name: "Karadeniz Mobilya", city: "Trabzon", term: 60, contact: "Cem Karadağ", phone: "0462 777 88 99", tax: "7777777777", pay: 0.75 },
    { name: "Toros Dekorasyon", city: "Mersin", term: 30, contact: "Gül Toros", phone: "0324 888 99 00", tax: "8888888888", pay: 0.9 },
  ];
  const cust: { id: string; pay: number; weight: number }[] = [];
  for (const [i, m] of customers.entries()) {
    const id = await c.card("cari", {
      name: m.name,
      kind: "musteri",
      city: m.city,
      paymentTermDays: String(m.term),
      contactName: m.contact,
      phone: m.phone,
      taxNumber: m.tax,
      taxOffice: m.city,
      email: `satinalma@${normalizeTr(m.name.split(" ")[0]).replace(/[^a-z]/g, "")}.local`,
      address: `${m.city} merkez`,
    });
    cust.push({ id, pay: m.pay, weight: [5, 4, 4, 3, 3, 3, 2, 2][i] });
  }
  // Vergi numaraları gelen e-faturalardaki (einvoice_inbox) satıcı VKN'leriyle eşleşir
  const supplier = async (name: string, city: string, term: number, contact: string, vkn: string) =>
    c.card("cari", { name, kind: "tedarikci", city, paymentTermDays: String(term), contactName: contact, taxNumber: vkn });
  const supSunger = await supplier("Anadolu Sünger Sanayi", "Kayseri", 30, "Ali Sünger", "1000000001");
  const supYay = await supplier("Kayseri Yay ve Tel", "Kayseri", 30, "Veli Tel", "1000000002");
  const supKumas = await supplier("Bursa Örme Kumaş", "Bursa", 45, "Nur Kumaş", "1000000003");
  const supAmbalaj = await supplier("Ambalaj Plastik Ltd.", "Konya", 30, "Kemal Ambalaj", "1000000004");
  const supMdf = await supplier("İnegöl Ahşap Baza", "Bursa", 45, "Tuncay Ahşap", "1000000005");
  const supYastik = await supplier("Elyaf Yastık Üretim", "Denizli", 30, "Sevgi Elyaf", "1000000006");
  await c.card("cari", { name: "Mega Lojistik Taşımacılık", kind: "her_ikisi", city: "Kayseri", paymentTermDays: "15" });

  // Ürünler
  // Barkodlar 2xx önekli (mağaza içi kullanım aralığı): gerçek bir ürünle çakışmaz
  const P = async (code: string, name: string, kind: string, unit: string, vat: string, sale: string, buy: string, critical = "0", category = "", barcode = "") =>
    c.card("urun", { code, name, kind, unit, vatRate: vat, salePrice: sale, purchasePrice: buy, criticalLevel: critical, category, barcode });
  const ort160 = await P("YT-ORT-160", "Ortopedik Yatak 160x200", "mamul", "ADET", "10", "6900", "0", "4", "Yatak", "2001000000012");
  const ort090 = await P("YT-ORT-090", "Ortopedik Yatak 90x190", "mamul", "ADET", "10", "3900", "0", "4", "Yatak", "2001000000029");
  const vis160 = await P("YT-VIS-160", "Visco Yatak 160x200", "mamul", "ADET", "10", "11500", "0", "2", "Yatak", "2001000000036");
  const baza160 = await P("BZ-SND-160", "Sandıklı Baza 160x200", "mamul", "ADET", "10", "6800", "0", "3", "Baza", "2001000000043");
  const yastik = await P("YS-VIS-01", "Visco Yastık", "ticari", "ADET", "10", "450", "180", "25", "Aksesuar", "2001000000050");
  const baslik = await P("BS-KAP-160", "Kapitone Başlık 160", "ticari", "ADET", "10", "3200", "1400", "2", "Baza", "2001000000067");
  const sunger = await P("HM-SUN-30", "Sünger 30 DNS", "hammadde", "M3", "20", "0", "2400", "6", "Sünger");
  const visco = await P("HM-SUN-VIS", "Visco Sünger", "hammadde", "M3", "20", "0", "6800", "1", "Sünger");
  const yay160 = await P("HM-YAY-160", "Bonel Yay Ünitesi 160x200", "hammadde", "ADET", "20", "0", "1150", "8", "Yay");
  const yay090 = await P("HM-YAY-090", "Bonel Yay Ünitesi 90x190", "hammadde", "ADET", "20", "0", "650", "6", "Yay");
  const kumas = await P("HM-KUM-JAK", "Jakarlı Örme Kumaş", "hammadde", "MT", "20", "0", "145", "250", "Kumaş");
  const fermuar = await P("HM-FRM-3M", "Fermuar 3 m", "hammadde", "ADET", "20", "0", "18", "20", "Aksesuar");
  const naylon = await P("HM-NAY", "Ambalaj Naylonu", "hammadde", "KG", "20", "0", "85", "10", "Ambalaj");
  const bazaGovde = await P("YM-BAZ-160", "Baza Gövdesi 160x200 (MDF set)", "yarimamul", "ADET", "20", "0", "1900", "3", "Baza");
  const amortisor = await P("HM-AMR", "Baza Amortisörü", "hammadde", "ADET", "20", "0", "250", "6", "Baza");
  await c.card("urun", { code: "HZ-MONTAJ", name: "Montaj Hizmeti", kind: "hizmet", unit: "ADET", vatRate: "20", salePrice: "500", trackStock: false });
  await c.card("urun", { code: "HZ-NAKLIYE", name: "Nakliye Bedeli", kind: "hizmet", unit: "ADET", vatRate: "20", salePrice: "750", trackStock: false });

  // Reçeteler (1 adet için)
  const recipes = [
    {
      product: ort160,
      name: "Ortopedik Yatak 160x200",
      lines: [
        { productId: sunger, quantity: "0.35", wasteRate: "5" },
        { productId: yay160, quantity: "1" },
        { productId: kumas, quantity: "6", wasteRate: "8" },
        { productId: fermuar, quantity: "1" },
        { productId: naylon, quantity: "0.8" },
      ],
      weekly: [10, 14],
    },
    {
      product: ort090,
      name: "Ortopedik Yatak 90x190",
      lines: [
        { productId: sunger, quantity: "0.2", wasteRate: "5" },
        { productId: yay090, quantity: "1" },
        { productId: kumas, quantity: "3.5", wasteRate: "8" },
        { productId: fermuar, quantity: "1" },
        { productId: naylon, quantity: "0.5" },
      ],
      weekly: [8, 12],
    },
    {
      product: vis160,
      name: "Visco Yatak 160x200",
      lines: [
        { productId: visco, quantity: "0.15", wasteRate: "6" },
        { productId: sunger, quantity: "0.25", wasteRate: "5" },
        { productId: kumas, quantity: "6", wasteRate: "8" },
        { productId: fermuar, quantity: "1" },
        { productId: naylon, quantity: "0.8" },
      ],
      weekly: [3, 5],
    },
    {
      product: baza160,
      name: "Sandıklı Baza 160x200",
      lines: [
        { productId: bazaGovde, quantity: "1" },
        { productId: kumas, quantity: "5", wasteRate: "10" },
        { productId: amortisor, quantity: "2" },
        { productId: naylon, quantity: "1" },
      ],
      weekly: [5, 8],
    },
  ];
  const bomIds = new Map<string, string>();
  for (const r of recipes) {
    const bom = await c.card("recete", { name: r.name, productId: r.product, outputQuantity: "1" });
    await saveBomLines(c.tx, c.tenantId, bom, r.lines);
    bomIds.set(r.product, bom);
  }

  // Kritik stok kuralı (Plus otomasyon) açık
  for (const t of AUTOMATION_TEMPLATES) {
    await c.tx.insert(automationRules).values({
      tenantId: c.tenantId,
      template: t.template,
      name: t.name,
      trigger: t.trigger,
      action: t.action,
      // Seed sırasında kapalı; sonda açılıp yalnızca son duruma göre bildirim üretilir
      enabled: false,
    });
  }

  // Tedarik: hangi malzeme hangi tedarikçiden, baz fiyat
  const sourcing: Record<string, { supplier: string; price: number; vat: string }> = {
    [sunger]: { supplier: supSunger, price: 2400, vat: "20" },
    [visco]: { supplier: supSunger, price: 6800, vat: "20" },
    [yay160]: { supplier: supYay, price: 1150, vat: "20" },
    [yay090]: { supplier: supYay, price: 650, vat: "20" },
    [kumas]: { supplier: supKumas, price: 145, vat: "20" },
    [fermuar]: { supplier: supAmbalaj, price: 18, vat: "20" },
    [naylon]: { supplier: supAmbalaj, price: 85, vat: "20" },
    [bazaGovde]: { supplier: supMdf, price: 1900, vat: "20" },
    [amortisor]: { supplier: supMdf, price: 250, vat: "20" },
    [yastik]: { supplier: supYastik, price: 180, vat: "10" },
    [baslik]: { supplier: supMdf, price: 1400, vat: "10" },
  };
  const priceDrift = new Map<string, number>(Object.entries(sourcing).map(([k, v]) => [k, v.price]));

  const purchaseInvoices: { id: string; date: string; supplier: string; total: string }[] = [];
  const salesInvoices: { id: string; date: string; partner: string; total: string; pay: number }[] = [];
  const stockOnHand = new Map<string, number>();
  const salePrices: Record<string, number> = { [ort160]: 6900, [ort090]: 3900, [vis160]: 11500, [baza160]: 6800, [yastik]: 450, [baslik]: 3200 };

  for (let w = 0; w < WEEKS; w++) {
    const monday = addDaysIso(start, w * 7);
    const isLastWeek = w === WEEKS - 1;

    // 1) Bu haftanın üretim planı
    const plan = recipes.map((r) => ({ r, qty: c.int(r.weekly[0], r.weekly[1]) }));

    // 2) Planın malzeme ihtiyacı kadar (+%15) alım; tedarikçi başına tek fatura
    const need = new Map<string, number>();
    for (const { r, qty } of plan) {
      for (const l of r.lines) {
        const q = Number(l.quantity) * qty * (1 + Number(l.wasteRate ?? 0) / 100);
        need.set(l.productId, (need.get(l.productId) ?? 0) + q);
      }
    }
    // Ticari mallar (yastık, başlık) iki haftada bir
    if (w % 2 === 0) {
      need.set(yastik, 60);
      need.set(baslik, 8);
    }
    const bySupplier = new Map<string, { productId: string; quantity: string; unitPrice: string; vatRate: string }[]>();
    for (const [productId, q] of need) {
      // Son hafta kumaş alınmasın: kritik stok uyarısı demoda görünsün
      if (isLastWeek && productId === kumas) continue;
      const have = stockOnHand.get(productId) ?? 0;
      const buy = Math.max(0, q * 1.45 - have);
      if (buy <= 0) continue;
      const src = sourcing[productId];
      const drifted = (priceDrift.get(productId) ?? src.price) * (1 + (c.rand() - 0.45) * 0.04);
      priceDrift.set(productId, drifted);
      const decimalUnit = productId === sunger || productId === visco || productId === naylon;
      const quantity = decimalUnit ? buy.toFixed(2) : String(Math.ceil(buy));
      const list = bySupplier.get(src.supplier) ?? [];
      list.push({ productId, quantity, unitPrice: drifted.toFixed(2), vatRate: src.vat });
      bySupplier.set(src.supplier, list);
      stockOnHand.set(productId, have + Number(quantity));
    }
    for (const [sup, lines] of bySupplier) {
      const date = addDaysIso(monday, c.int(0, 1));
      const id = await c.doc({ type: "alis_fatura", date, partnerId: sup, warehouseId: merkez.id, lines });
      const [d] = await c.tx.select({ total: documents.grandTotal }).from(documents).where(eq(documents.id, id));
      purchaseInvoices.push({ id, date, supplier: sup, total: d.total });
    }

    // 3) Üretim (çarşamba): iş emri aç, tamamla
    const prodDate = addDaysIso(monday, 2);
    for (const { r, qty } of plan) {
      const order = await c.card("is-emri", {
        bomId: bomIds.get(r.product),
        quantity: String(qty),
        plannedDate: prodDate,
        warehouseId: merkez.id,
        status: "planlandi",
      });
      if (!isLastWeek) {
        await completeProductionOrder(c.tx, c.tenantId, order, prodDate);
        for (const l of r.lines) {
          const used = Number(l.quantity) * qty * (1 + Number(l.wasteRate ?? 0) / 100);
          stockOnHand.set(l.productId, (stockOnHand.get(l.productId) ?? 0) - used);
        }
        stockOnHand.set(r.product, (stockOnHand.get(r.product) ?? 0) + qty);
      } else if (r.product === ort160 || r.product === baza160) {
        // Son hafta: bazıları üretimde, bazıları planlı kalsın (pano görünümü için)
        await c.tx.update(productionOrders).set({ status: "uretimde" }).where(eq(productionOrders.id, order));
      }
    }

    // 4) Satışlar (perşembe-cumartesi): stoktaki mamullerin %85-95'i bayilere
    const sellable = [ort160, ort090, vis160, baza160, yastik, baslik];
    const invoiceCount = c.int(3, 5);
    for (let i = 0; i < invoiceCount; i++) {
      const customer = weightedPick(c, cust);
      const date = addDaysIso(monday, c.int(3, 5));
      if (date > today) continue;
      const lines = [];
      for (const p of sellable) {
        const have = stockOnHand.get(p) ?? 0;
        if (have < 1 || !c.chance(p === yastik ? 0.6 : 0.55)) continue;
        const share = Math.max(1, Math.floor((have * c.int(70, 85)) / 100 / invoiceCount));
        const qty = Math.min(share * (p === yastik ? 3 : 1), Math.floor(have));
        if (qty < 1) continue;
        stockOnHand.set(p, have - qty);
        lines.push({
          productId: p,
          quantity: String(qty),
          unitPrice: c.jitter(salePrices[p], 0.03),
          discountRate: c.chance(0.35) ? String(c.pick([3, 5, 7.5, 10])) : "0",
          vatRate: "10",
        });
      }
      if (lines.length === 0) continue;
      let invoiceId: string;
      if (c.chance(0.4)) {
        // Sipariş → irsaliye → fatura akışı
        const order = await c.doc({ type: "satis_siparis", date: addDaysIso(date, -2), partnerId: customer.id, warehouseId: merkez.id, lines });
        const irs = await convertDocument(c.tx, c.tenantId, c.userId, order, "satis_irsaliye", date);
        await approveDocument(c.tx, c.tenantId, c.userId, irs);
        invoiceId = await convertDocument(c.tx, c.tenantId, c.userId, irs, "satis_fatura", date);
        await approveDocument(c.tx, c.tenantId, c.userId, invoiceId);
      } else {
        invoiceId = await c.doc({ type: "satis_fatura", date, partnerId: customer.id, warehouseId: merkez.id, lines });
      }
      const [d] = await c.tx.select({ total: documents.grandTotal }).from(documents).where(eq(documents.id, invoiceId));
      salesInvoices.push({ id: invoiceId, date, partner: customer.id, total: d.total, pay: customer.pay });
    }

    // 5) Ayda bir showroom'a transfer
    if (w % 4 === 1) {
      const lines = [ort160, vis160, baza160]
        .filter((p) => (stockOnHand.get(p) ?? 0) >= 3)
        .map((p) => ({ productId: p, quantity: "2", unitPrice: "0" }));
      if (lines.length) await c.doc({ type: "depo_transfer", date: addDaysIso(monday, 4), warehouseId: merkez.id, targetWarehouseId: showroom, lines });
    }

    // 6) Aylık masraflar (ayın ilk haftası)
    if (w % 4 === 0) {
      const d = addDaysIso(monday, 1);
      await c.doc({
        type: "masraf",
        date: d,
        cashAccountId: banka,
        notes: "Aylık sabit giderler",
        lines: [
          { description: "Fabrika kirası", quantity: "1", unitPrice: "45000", vatRate: "20" },
          { description: "Elektrik faturası", quantity: "1", unitPrice: c.jitter(9500, 0.2), vatRate: "20" },
          { description: "Doğalgaz faturası", quantity: "1", unitPrice: c.jitter(5500, 0.35), vatRate: "20" },
        ],
      });
      // Kasa eksiye düşemez: nakit azaldıysa önce bankadan çekilir
      if ((await cashBalance(c, kasa.id)).lt(40000)) {
        await c.doc({ type: "virman", date: addDaysIso(d, 2), cashAccountId: banka, targetCashAccountId: kasa.id, amount: "40000", notes: "Bankadan nakit çekim", lines: [] });
      }
      await c.doc({
        type: "masraf",
        date: addDaysIso(d, 2),
        cashAccountId: kasa.id,
        notes: "Personel ve araç giderleri",
        lines: [
          { description: "Personel yemek", quantity: "1", unitPrice: c.jitter(14000, 0.1), vatRate: "10" },
          { description: "Akaryakıt", quantity: "1", unitPrice: c.jitter(7500, 0.15), vatRate: "20" },
          { description: "Kargo ve nakliye", quantity: "1", unitPrice: c.jitter(4200, 0.3), vatRate: "20" },
        ],
      });
    }
  }

  // 7) Tahsilatlar: eski faturalar büyük ölçüde ödenmiş, yeniler açık
  for (const inv of salesInvoices) {
    const age = daysBetween(inv.date, today);
    const p = age > 60 ? inv.pay : age > 30 ? inv.pay * 0.6 : age > 10 ? inv.pay * 0.25 : 0.05;
    if (!c.chance(p)) continue;
    const payDate = addDaysIso(inv.date, c.int(12, Math.max(14, Math.min(age, 55))));
    if (payDate > today) continue;
    const partial = c.chance(0.15);
    const amount = partial ? round2(dec(inv.total).mul(0.5)) : dec(inv.total);
    const r = c.rand();
    const [account, how] = r < 0.06 ? [kasa.id, "Elden nakit"] : r < 0.2 ? [pos, "Kredi kartı (POS)"] : [banka, "Havale / EFT"];
    await c.doc({
      type: "tahsilat",
      date: payDate,
      partnerId: inv.partner,
      cashAccountId: account,
      amount: toMoneyString(amount),
      notes: partial ? `Kısmi ödeme · ${how}` : how,
      lines: [],
    });
  }

  // 8) Tedarikçi ödemeleri: 30 günden eskiler ödenmiş
  for (const inv of purchaseInvoices) {
    const age = daysBetween(inv.date, today);
    if (age < 28 || !c.chance(0.92)) continue;
    const payDate = addDaysIso(inv.date, c.int(25, Math.min(age, 40)));
    if (payDate > today) continue;
    await c.doc({ type: "tediye", date: payDate, partnerId: inv.supplier, cashAccountId: banka, amount: inv.total, notes: "Havale / EFT", lines: [] });
  }

  // 8b) POS'ta biriken tahsilatlar her ay sonunda bankaya aktarılır (blokesi çözülen tutar)
  const posByMonth = await c.tx
    .select({ month: sql<string>`to_char(${cashMovements.date}, 'YYYY-MM')`, total: sql<string>`sum(${cashMovements.amount})` })
    .from(cashMovements)
    .where(and(eq(cashMovements.tenantId, c.tenantId), eq(cashMovements.cashAccountId, pos)))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  for (const m of posByMonth) {
    const monthEnd = addDaysIso(addMonthsIso(`${m.month}-01`, 1), -1);
    if (monthEnd >= today || dec(m.total).lte(0)) continue;
    await c.doc({ type: "virman", date: monthEnd, cashAccountId: pos, targetCashAccountId: banka, amount: m.total, notes: "POS blokesi çözüldü", lines: [] });
  }

  // 9) Açık teklif ve siparişler, bir taslak, bir iptal
  const lastWeek = addDaysIso(today, -3);
  for (const cu of cust.slice(0, 4)) {
    await c.doc(
      {
        type: "satis_teklif",
        date: addDaysIso(today, -c.int(1, 9)),
        partnerId: cu.id,
        notes: "Sezon kampanyası teklifi",
        lines: [
          { productId: ort160, quantity: String(c.int(10, 30)), unitPrice: "6600", vatRate: "10" },
          { productId: baza160, quantity: String(c.int(5, 15)), unitPrice: "6500", vatRate: "10" },
        ],
      },
      c.chance(0.6),
    );
  }
  for (const cu of cust.slice(2, 6)) {
    await c.doc({
      type: "satis_siparis",
      date: addDaysIso(today, -c.int(0, 6)),
      partnerId: cu.id,
      warehouseId: merkez.id,
      notes: "Teslim: önümüzdeki hafta",
      lines: [
        ...[c.pick([ort160, vis160, ort090])].map((p) => ({ productId: p, quantity: String(c.int(4, 12)), unitPrice: String(salePrices[p]), vatRate: "10" })),
        { productId: yastik, quantity: String(c.int(10, 30)), unitPrice: "450", vatRate: "10" },
      ],
    });
  }
  await c.doc(
    {
      type: "satis_fatura",
      date: today,
      partnerId: cust[0].id,
      warehouseId: merkez.id,
      notes: "Onay bekliyor",
      lines: [{ productId: ort090, quantity: "6", unitPrice: "3900", vatRate: "10" }],
    },
    false,
  );
  const wrong = await c.doc({
    type: "satis_fatura",
    date: lastWeek,
    partnerId: cust[1].id,
    warehouseId: merkez.id,
    notes: "Hatalı fiyatla kesildi, iptal edildi",
    lines: [{ productId: ort160, quantity: "1", unitPrice: "690", vatRate: "10" }],
  });
  await cancelDocument(c.tx, c.tenantId, wrong);
  await c.doc({
    type: "alis_siparis",
    date: addDaysIso(today, -2),
    partnerId: supKumas,
    warehouseId: merkez.id,
    notes: "Acil: kumaş stoğu kritik",
    lines: [{ productId: kumas, quantity: "1200", unitPrice: "148", vatRate: "20" }],
  });

  // e-Fatura durumları: onaylı satış faturalarının çoğu gönderilmiş
  for (const inv of salesInvoices) {
    const age = daysBetween(inv.date, today);
    await c.tx
      .update(documents)
      .set({ eStatus: age > 2 ? "kabul" : age > 0 ? "gonderildi" : null })
      .where(and(eq(documents.id, inv.id), eq(documents.status, "onayli")));
  }

  // Gelen e-faturalar (AI eşleştirme demosu): tedarikçi kendi ürün adlarını kullanıyor.
  // Genel toplam satırlardan hesaplanır; böylece ekrandaki tutarlılık kontrolü geçer.
  const inbox = [
    {
      tenantId: c.tenantId,
      ettn: "6f1c2d3e-0001-4a5b-9c8d-000000000001",
      number: "ANS2026000004812",
      date: addDaysIso(today, -1),
      supplierName: "Anadolu Sünger Sanayi",
      supplierTaxNumber: "1000000001",
      lines: [
        { description: "30 DNS SÜNGER BLOK (M3)", quantity: "12", unit: "M3", unitPrice: "2450", vatRate: "20" },
        { description: "VİSCO MEMORY FOAM 50 DNS", quantity: "1", unit: "M3", unitPrice: "6360", vatRate: "20" },
      ],
    },
    {
      tenantId: c.tenantId,
      ettn: "6f1c2d3e-0002-4a5b-9c8d-000000000002",
      number: "KYT2026000001377",
      date: today,
      supplierName: "Kayseri Yay ve Tel",
      supplierTaxNumber: "1000000002",
      lines: [
        { description: "BONNEL YAY 160X200 ÇİFT KİŞİLİK", quantity: "20", unit: "ADET", unitPrice: "1180", vatRate: "20" },
        { description: "BONNEL YAY 090X190 TEK", quantity: "18", unit: "ADET", unitPrice: "665", vatRate: "20" },
      ],
    },
    {
      tenantId: c.tenantId,
      ettn: "6f1c2d3e-0003-4a5b-9c8d-000000000003",
      number: "AMB2026000000655",
      date: today,
      supplierName: "Ambalaj Plastik Ltd.",
      supplierTaxNumber: "1000000004",
      lines: [
        { description: "STREÇ / AMBALAJ NAYLON 50MY", quantity: "60", unit: "KG", unitPrice: "88", vatRate: "20" },
        { description: "SPİRAL FERMUAR 3 METRE BEYAZ", quantity: "200", unit: "ADET", unitPrice: "17.7", vatRate: "20" },
      ],
    },
  ];
  await c.tx.insert(einvoiceInbox).values(inbox.map((e) => ({ ...e, grandTotal: toMoneyString(calcTotals(e.lines).grandTotal) })));

  await seedOtherModules(c, today, { ort160, kumas, sunger, yatakCust: cust.map((x) => x.id), supSunger });

  await c.tx
    .update(automationRules)
    .set({ enabled: true })
    .where(and(eq(automationRules.tenantId, c.tenantId), eq(automationRules.template, "kritik_stok")));
  await onStockChanged(c.tx, c.tenantId, [ort160, ort090, vis160, baza160, yastik, baslik, sunger, visco, yay160, yay090, kumas, fermuar, naylon, bazaGovde, amortisor]);
}

async function seedOtherModules(
  c: Ctx,
  today: string,
  ref: { ort160: string; kumas: string; sunger: string; yatakCust: string[]; supSunger: string },
) {
  // CRM
  const opps = [
    ["Ege bölgesi yeni bayi anlaşması", null, "Ege Konfor Mobilya", "teklif", 850000, 60],
    ["Otel yatak yenileme projesi (120 oda)", null, "Kapadokya Butik Otel", "pazarlik", 1380000, 45],
    ["Yurt yatakları ihalesi", null, "Özel Erciyes Yurtları", "gorusme", 620000, 30],
    ["Mavi Uyku sezon siparişi", ref.yatakCust[2], null, "kazanildi", 410000, 100],
    ["Karadeniz Mobilya visco ürün tanıtımı", ref.yatakCust[6], null, "yeni", 180000, 20],
    ["Online mağaza toptan anlaşması", null, "UykuShop E-Ticaret", "teklif", 540000, 50],
    ["Hastane refakatçi yatakları", null, "Şehir Hastanesi Satın Alma", "kaybedildi", 300000, 0],
    ["Başkent Yatak showroom yenileme", ref.yatakCust[5], null, "gorusme", 95000, 40],
  ] as const;
  for (const [title, partnerId, lead, stage, amount, prob] of opps) {
    await c.card("firsat", {
      title,
      partnerId: partnerId ?? "",
      leadCompany: lead ?? "",
      stage,
      amount: String(amount),
      probability: String(prob),
      expectedClose: addDaysIso(today, c.int(-20, 60)),
      owner: c.pick(["Mehmet Demir", "Emre Öztürk"]),
      contactName: c.pick(["Satın alma müdürü", "Genel müdür", "İşletme sahibi"]),
    });
  }

  // İK
  const staff = [
    ["Ayşe Kaya", "Muhasebe", "Muhasebe Uzmanı"],
    ["Mehmet Demir", "Satış", "Satış Müdürü"],
    ["Emre Öztürk", "Satış", "Bölge Satış Temsilcisi"],
    ["Elif Şahin", "Satın Alma", "Satın Alma Uzmanı"],
    ["Burak Yılmaz", "Üretim", "Üretim Şefi"],
    ["Zeynep Arslan", "Depo", "Depo Sorumlusu"],
    ["Ahmet Çelik", "Üretim", "Dikiş Operatörü"],
    ["Fatma Koç", "Üretim", "Kapitone Operatörü"],
    ["Mustafa Aydın", "Lojistik", "Şoför"],
  ];
  const emp: string[] = [];
  for (const [fullName, department, title] of staff) {
    emp.push(
      await c.card("personel", {
        fullName,
        department,
        title,
        startDate: addDaysIso(today, -c.int(120, 2400)),
        phone: `0532 ${c.int(100, 999)} ${c.int(10, 99)} ${c.int(10, 99)}`,
        status: fullName === "Fatma Koç" ? "izinde" : "aktif",
      }),
    );
  }
  for (const [i, kind, status, from, len] of [
    [7, "yillik", "onaylandi", -2, 5],
    [1, "yillik", "talep", 12, 3],
    [6, "rapor", "onaylandi", -20, 2],
    [3, "mazeret", "onaylandi", -35, 1],
    [5, "yillik", "talep", 25, 7],
  ] as const) {
    const s = addDaysIso(today, from);
    await c.card("izin", { employeeId: emp[i], kind, status, startDate: s, endDate: addDaysIso(s, len - 1), days: String(len) });
  }
  for (const [i, item, serial] of [
    [0, "Dizüstü bilgisayar", "NB-2291"],
    [1, "Şirket telefonu", "TEL-0042"],
    [1, "Şirket aracı (34 XX 000)", "ARC-01"],
    [8, "Kamyonet anahtarı", "ARC-02"],
    [5, "El terminali (barkod)", "BT-117"],
  ] as const) {
    await c.card("zimmet", { employeeId: emp[i], itemName: item, serialNo: serial, givenDate: addDaysIso(today, -c.int(30, 500)) });
  }

  // Proje & görev
  const p1 = await c.card("proje", {
    name: "Showroom yenileme",
    status: "devam",
    startDate: addDaysIso(today, -20),
    endDate: addDaysIso(today, 25),
    budget: "350000",
  });
  const p2 = await c.card("proje", {
    name: "Ege bayi ağı açılışı",
    status: "planlandi",
    startDate: addDaysIso(today, 10),
    endDate: addDaysIso(today, 90),
    budget: "500000",
  });
  for (const [title, project, assignee, due, priority, status] of [
    ["Showroom zemin ve aydınlatma", p1, "Burak Yılmaz", 5, "yuksek", "devam"],
    ["Yeni sezon katalog fotoğrafları", p1, "Mehmet Demir", 9, "normal", "yapilacak"],
    ["Teşhir ürünlerinin transferi", p1, "Zeynep Arslan", 3, "normal", "kontrol"],
    ["Bayi sözleşme taslağı", p2, "Mehmet Demir", 15, "yuksek", "yapilacak"],
    ["İzmir lojistik firması teklifleri", p2, "Elif Şahin", 20, "normal", "yapilacak"],
    ["Fuar katılım başvurusu", p2, "Emre Öztürk", 2, "acil", "devam"],
    ["Kumaş tedarikçisiyle yıllık fiyat görüşmesi", null, "Elif Şahin", -1, "yuksek", "devam"],
    ["Ekim ayı mutabakatları", null, "Ayşe Kaya", 6, "normal", "yapilacak"],
    ["Forklift periyodik bakımı", null, "Burak Yılmaz", -5, "normal", "tamamlandi"],
  ] as const) {
    await c.card("gorev", { title, projectId: project ?? "", assignee, dueDate: addDaysIso(today, due), priority, status });
  }

  // Kalite
  for (let i = 0; i < 8; i++) {
    const giris = i < 5;
    await c.card("kalite-kontrol", {
      date: addDaysIso(today, -i * 6 - c.int(0, 3)),
      stage: giris ? "giris" : "son",
      productId: giris ? c.pick([ref.kumas, ref.sunger]) : ref.ort160,
      partnerId: giris ? ref.supSunger : "",
      lotNo: `LOT-${2026}${String(c.int(100, 999))}`,
      sampleQuantity: String(c.int(1, 5)),
      result: i === 2 ? "sartli" : i === 6 ? "ret" : "kabul",
      inspector: "Burak Yılmaz",
      notes: i === 2 ? "Yoğunluk alt sınırda, bir sonraki partide tekrar ölçülecek." : i === 6 ? "Kenar dikişinde kayma; ürün yeniden işleme alındı." : "",
    });
  }

  // Demirbaş & bakım
  const assets: string[] = [];
  for (const [name, category, location, status] of [
    ["Kapitone makinesi", "Üretim makinesi", "Üretim hattı 1", "calisiyor"],
    ["Sünger kesim makinesi", "Üretim makinesi", "Kesimhane", "calisiyor"],
    ["Endüstriyel dikiş makinesi (1)", "Üretim makinesi", "Dikimhane", "calisiyor"],
    ["Endüstriyel dikiş makinesi (2)", "Üretim makinesi", "Dikimhane", "arizali"],
    ["Forklift 2,5 ton", "Taşıma", "Depo", "calisiyor"],
  ] as const) {
    assets.push(
      await c.card("demirbas", {
        name,
        category,
        location,
        status,
        serialNo: `SN-${c.int(10000, 99999)}`,
        purchaseDate: addDaysIso(today, -c.int(300, 2000)),
      }),
    );
  }
  for (const [a, kind, ago, next, cost, status, notes] of [
    [0, "periyodik", 40, 50, 4500, "yapildi", "Yağlama, iğne değişimi"],
    [1, "periyodik", 25, 65, 3800, "yapildi", "Bıçak bileme"],
    [3, "ariza", 2, null, 0, "planlandi", "Motor sesi; servis çağrıldı"],
    [4, "periyodik", 5, 85, 6200, "yapildi", "Hidrolik yağ değişimi"],
    [2, "kalibrasyon", -10, null, 1500, "planlandi", "Dikiş gerginliği kalibrasyonu"],
    [0, "ariza", 95, null, 12500, "yapildi", "Kart arızası, parça değişti"],
  ] as const) {
    await c.card("bakim-kaydi", {
      assetId: assets[a],
      kind,
      date: addDaysIso(today, -ago),
      nextDate: next ? addDaysIso(today, next) : "",
      cost: String(cost),
      performedBy: kind === "ariza" ? "Yetkili servis" : "Burak Yılmaz",
      status,
      notes,
    });
  }
}

// ---------- Demo Gıda Toptan (Başlangıç paketi) ----------

async function seedGida(c: Ctx, today: string) {
  const [merkez] = await c.tx
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(and(eq(warehouses.tenantId, c.tenantId), eq(warehouses.isDefault, true)));
  const [kasa] = await c.tx.select({ id: cashAccounts.id }).from(cashAccounts).where(eq(cashAccounts.tenantId, c.tenantId));
  await c.tx.insert(cashMovements).values({ tenantId: c.tenantId, cashAccountId: kasa.id, date: addDaysIso(today, -60), amount: "150000.00", description: "Açılış bakiyesi" });

  const customers = [];
  for (const [name, city] of [
    ["Bereket Market Zinciri", "Ankara"],
    ["Komşu Bakkal", "Ankara"],
    ["Lezzet Lokantası", "Ankara"],
    ["Anıt Otel Mutfak", "Ankara"],
  ]) {
    customers.push(await c.card("cari", { name, city, kind: "musteri", paymentTermDays: "15" }));
  }
  const sup = await c.card("cari", { name: "Orta Anadolu Un Değirmeni", city: "Konya", kind: "tedarikci", paymentTermDays: "30" });
  const sup2 = await c.card("cari", { name: "Akdeniz Bakliyat", city: "Mersin", kind: "tedarikci", paymentTermDays: "30" });
  const products: { id: string; buy: number; sell: number; supplier: string }[] = [];
  for (const [name, unit, buy, sell, s] of [
    ["Un 50 kg", "ADET", 780, 920, sup],
    ["Toz şeker 50 kg", "ADET", 1650, 1890, sup2],
    ["Ayçiçek yağı 18 lt", "ADET", 1150, 1340, sup2],
    ["Pirinç baldo 5 kg", "ADET", 310, 375, sup2],
    ["Kırmızı mercimek 5 kg", "ADET", 240, 295, sup2],
    ["Makarna 5 kg", "ADET", 165, 205, sup],
  ] as const) {
    products.push({ id: await c.card("urun", { name, unit, kind: "ticari", vatRate: "1", salePrice: String(sell), purchasePrice: String(buy), criticalLevel: "10" }), buy, sell, supplier: s });
  }
  for (let w = 0; w < 8; w++) {
    const monday = addDaysIso(today, -7 * (8 - w));
    for (const s of [sup, sup2]) {
      await c.doc({
        type: "alis_fatura",
        date: monday,
        partnerId: s,
        warehouseId: merkez.id,
        lines: products.filter((p) => p.supplier === s).map((p) => ({ productId: p.id, quantity: String(c.int(30, 60)), unitPrice: String(p.buy), vatRate: "1" })),
      });
    }
    for (let i = 0; i < 3; i++) {
      const date = addDaysIso(monday, c.int(1, 5));
      if (date > today) continue;
      const partner = c.pick(customers);
      const chosen = products.filter(() => c.chance(0.5));
      const inv = await c.doc({
        type: "satis_fatura",
        date,
        partnerId: partner,
        warehouseId: merkez.id,
        lines: (chosen.length ? chosen : products.slice(0, 1)).map((p) => ({
          productId: p.id,
          quantity: String(c.int(5, 18)),
          unitPrice: String(p.sell),
          vatRate: "1",
        })),
      });
      if (daysBetween(date, today) > 14 && c.chance(0.8)) {
        const [d] = await c.tx.select({ total: documents.grandTotal }).from(documents).where(eq(documents.id, inv));
        await c.doc({ type: "tahsilat", date: addDaysIso(date, 10), partnerId: partner, cashAccountId: kasa.id, amount: d.total, lines: [] });
      }
    }
  }
}

// ---------- küçük yardımcılar ----------

function weightedPick<T extends { weight: number }>(c: Ctx, items: T[]): T {
  const total = items.reduce((a, i) => a + i.weight, 0);
  let r = c.rand() * total;
  for (const i of items) {
    r -= i.weight;
    if (r <= 0) return i;
  }
  return items[items.length - 1];
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}
