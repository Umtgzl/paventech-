// Belge motoru: taslak kaydı, onay (hareket üretimi), iptal (ters kayıt),
// dönüştürme ve taslak silme. Tüm fonksiyonlar çağıranın transaction'ı içinde
// çalışır; bir adım hata verirse hiçbir şey yazılmaz.
// "server-only" içermez: seed betiği de aynı kuralları kullanarak belge keser.
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import {
  cashAccounts,
  cashMovements,
  documentLines,
  documents,
  numberSeries,
  partnerMovements,
  partners,
  products,
  stockMovements,
  warehouses,
} from "@/server/db/schema";
import { calcLine, calcTotals } from "@/lib/documents/calc";
import type { DocumentInput } from "@/lib/documents/input";
import { DOC_TYPES, formatDocNumber, isDocTypeKey, stockAlreadyMovedBySource, type DocTypeKey } from "@/lib/documents/types";
import { addDaysIso, formatMoney } from "@/lib/format";
import { dec, parseDecimalInput, toMoneyString, toQtyString, type Decimal } from "@/lib/money";
import { UserError } from "@/server/domain/errors";
import { onStockChanged } from "@/server/domain/automation";
import { averageCost } from "@/server/ledger/stock";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

interface CleanLine {
  productId: string | null;
  description: string | null;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountRate: string;
  vatRate: string;
}

/** Formdan gelen belgeyi doğrular ve normalize eder. */
async function validateInput(exec: Executor, tenantId: string, input: DocumentInput) {
  if (!isDocTypeKey(input.type)) throw new UserError("Geçersiz belge türü.");
  const def = DOC_TYPES[input.type];
  const fe: Record<string, string> = {};

  if (!DATE.test(input.date ?? "")) fe.date = "Geçerli bir tarih girin.";
  if (input.dueDate && !DATE.test(input.dueDate)) fe.dueDate = "Geçerli bir vade tarihi girin.";

  let partnerId: string | null = input.partnerId || null;
  if (def.partner === "yok") partnerId = null;
  if (def.partner === "zorunlu" && !partnerId) fe.partnerId = "Cari seçin.";
  if (partnerId) {
    const [p] = await exec
      .select({ id: partners.id })
      .from(partners)
      .where(and(eq(partners.tenantId, tenantId), eq(partners.id, partnerId)));
    if (!p) fe.partnerId = "Cari bulunamadı.";
  }

  let warehouseId: string | null = input.warehouseId || null;
  let targetWarehouseId: string | null = input.targetWarehouseId || null;
  if (def.lines === "urun") {
    if (!warehouseId) {
      const [w] = await exec
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(and(eq(warehouses.tenantId, tenantId), eq(warehouses.isDefault, true)));
      warehouseId = w?.id ?? null;
    }
    if (!warehouseId) fe.warehouseId = "Depo seçin.";
    const ids = [warehouseId, targetWarehouseId].filter((x): x is string => !!x);
    if (ids.length) {
      const found = await exec
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(and(eq(warehouses.tenantId, tenantId), inArray(warehouses.id, ids)));
      if (found.length !== new Set(ids).size) fe.warehouseId = "Depo bulunamadı.";
    }
  } else {
    warehouseId = null;
  }
  if (def.transfer) {
    if (!targetWarehouseId) fe.targetWarehouseId = "Hedef depoyu seçin.";
    else if (targetWarehouseId === warehouseId) fe.targetWarehouseId = "Hedef depo kaynak depodan farklı olmalı.";
  } else {
    targetWarehouseId = null;
  }

  let cashAccountId: string | null = input.cashAccountId || null;
  const targetCashAccountId: string | null = def.cashTransfer ? input.targetCashAccountId || null : null;
  if (def.cash !== 0) {
    if (!cashAccountId) fe.cashAccountId = def.cashTransfer ? "Paranın çıkacağı hesabı seçin." : "Kasa / banka hesabı seçin.";
    if (def.cashTransfer) {
      if (!targetCashAccountId) fe.targetCashAccountId = "Paranın gireceği hesabı seçin.";
      else if (targetCashAccountId === cashAccountId) fe.targetCashAccountId = "Hedef hesap, çıkış hesabından farklı olmalı.";
    }
    const ids = [cashAccountId, targetCashAccountId].filter((x): x is string => !!x);
    if (ids.length) {
      const found = new Set(
        (
          await exec
            .select({ id: cashAccounts.id })
            .from(cashAccounts)
            .where(and(eq(cashAccounts.tenantId, tenantId), inArray(cashAccounts.id, ids)))
        ).map((a) => a.id),
      );
      if (cashAccountId && !found.has(cashAccountId)) fe.cashAccountId = "Hesap bulunamadı.";
      if (targetCashAccountId && !found.has(targetCashAccountId)) fe.targetCashAccountId = "Hesap bulunamadı.";
    }
  } else {
    cashAccountId = null;
  }

  const lines: CleanLine[] = [];
  if (def.lines === "yok") {
    const amount = parseDecimalInput(input.amount ?? "");
    if (!amount || dec(amount).lte(0)) fe.amount = "Tutar sıfırdan büyük olmalı.";
    else
      lines.push({
        productId: null,
        description: def.label,
        quantity: "1",
        unit: "ADET",
        unitPrice: amount,
        discountRate: "0",
        vatRate: "0",
      });
  } else {
    const productIds = input.lines.map((l) => l.productId).filter((x): x is string => !!x);
    const productRows = productIds.length
      ? await exec
          .select({ id: products.id, unit: products.unit })
          .from(products)
          .where(and(eq(products.tenantId, tenantId), inArray(products.id, productIds)))
      : [];
    const productUnits = new Map(productRows.map((p) => [p.id, p.unit]));

    input.lines.forEach((l, i) => {
      const empty = !l.productId && !l.description?.trim() && !l.quantity && !l.unitPrice;
      if (empty) return;
      const n = i + 1;
      if (def.lines === "urun") {
        if (!l.productId) fe[`lines.${i}.productId`] = `${n}. satırda ürün seçin.`;
        else if (!productUnits.has(l.productId)) fe[`lines.${i}.productId`] = `${n}. satırdaki ürün bulunamadı.`;
      } else if (!l.description?.trim()) {
        fe[`lines.${i}.description`] = `${n}. satıra açıklama yazın.`;
      }
      const qty = parseDecimalInput(l.quantity || (def.lines === "serbest" ? "1" : ""));
      if (!qty || dec(qty).lte(0)) fe[`lines.${i}.quantity`] = `${n}. satırda miktar sıfırdan büyük olmalı.`;
      const price = def.priced ? parseDecimalInput(l.unitPrice || "0") : "0";
      if (price === null || dec(price).lt(0)) fe[`lines.${i}.unitPrice`] = `${n}. satırda fiyat geçersiz.`;
      const disc = parseDecimalInput(l.discountRate || "0");
      if (disc === null || dec(disc).lt(0) || dec(disc).gt(100)) fe[`lines.${i}.discountRate`] = `${n}. satırda iskonto 0-100 olmalı.`;
      const vat = parseDecimalInput(l.vatRate || "0");
      if (vat === null || dec(vat).lt(0) || dec(vat).gt(100)) fe[`lines.${i}.vatRate`] = `${n}. satırda KDV oranı geçersiz.`;
      lines.push({
        productId: l.productId || null,
        description: l.description?.trim() || null,
        quantity: qty ?? "0",
        unit: (l.productId && productUnits.get(l.productId)) || l.unit || "ADET",
        unitPrice: def.priced ? (price ?? "0") : "0",
        discountRate: def.priced ? (disc ?? "0") : "0",
        vatRate: def.priced ? (vat ?? "0") : "0",
      });
    });
    if (lines.length === 0 && Object.keys(fe).length === 0) fe.lines = "En az bir satır girin.";
  }

  if (Object.keys(fe).length > 0) throw new UserError("Lütfen işaretli alanları düzeltin.", fe);
  return { def, partnerId, warehouseId, targetWarehouseId, cashAccountId, targetCashAccountId, lines };
}

/** Taslak belgeyi oluşturur veya günceller; toplamlar sunucuda yeniden hesaplanır. */
export async function saveDraft(
  exec: Executor,
  tenantId: string,
  userId: string | null,
  input: DocumentInput,
  id?: string | null,
): Promise<string> {
  const v = await validateInput(exec, tenantId, input);
  const totals = calcTotals(v.lines);

  const header = {
    type: input.type,
    date: input.date,
    dueDate: v.def.hasDueDate ? input.dueDate || null : null,
    partnerId: v.partnerId,
    warehouseId: v.warehouseId,
    targetWarehouseId: v.targetWarehouseId,
    cashAccountId: v.cashAccountId,
    targetCashAccountId: v.targetCashAccountId,
    currency: input.currency || "TRY",
    notes: input.notes?.trim() || null,
    subtotal: toMoneyString(totals.subtotal),
    discountTotal: toMoneyString(totals.discountTotal),
    vatTotal: toMoneyString(totals.vatTotal),
    grandTotal: toMoneyString(totals.grandTotal),
  };

  let docId: string;
  if (id) {
    const [existing] = await exec
      .select({ status: documents.status, type: documents.type })
      .from(documents)
      .where(and(eq(documents.tenantId, tenantId), eq(documents.id, id)))
      .for("update");
    if (!existing) throw new UserError("Belge bulunamadı.");
    if (existing.status !== "taslak") throw new UserError("Onaylanmış belge değiştirilemez. Gerekirse iptal edip yenisini kesin.");
    if (existing.type !== input.type) throw new UserError("Belge türü değiştirilemez.");
    await exec.update(documents).set(header).where(eq(documents.id, id));
    await exec.delete(documentLines).where(eq(documentLines.documentId, id));
    docId = id;
  } else {
    const [row] = await exec
      .insert(documents)
      .values({ ...header, tenantId, createdBy: userId, sourceDocumentId: input.sourceDocumentId || null })
      .returning({ id: documents.id });
    docId = row.id;
  }

  if (v.lines.length) {
    await exec.insert(documentLines).values(
      v.lines.map((l, i) => {
        const a = calcLine(l);
        return {
          tenantId,
          documentId: docId,
          lineNo: i + 1,
          productId: l.productId,
          description: l.description,
          quantity: toQtyString(l.quantity),
          unit: l.unit,
          unitPrice: toQtyString(l.unitPrice),
          discountRate: l.discountRate,
          vatRate: l.vatRate,
          grossAmount: toMoneyString(a.gross),
          discountAmount: toMoneyString(a.discount),
          netAmount: toMoneyString(a.net),
          vatAmount: toMoneyString(a.vat),
          totalAmount: toMoneyString(a.total),
        };
      }),
    );
  }
  return docId;
}

/** Seriden sıradaki numarayı alır. Satır kilidi sayesinde eşzamanlı onaylarda bile boşluksuz ve tekildir. */
async function nextDocNumber(exec: Executor, tenantId: string, type: DocTypeKey, year: number): Promise<string> {
  const [row] = await exec
    .insert(numberSeries)
    .values({ tenantId, series: `belge:${type}`, year, nextValue: 2 })
    .onConflictDoUpdate({
      target: [numberSeries.tenantId, numberSeries.series, numberSeries.year],
      set: { nextValue: sql`${numberSeries.nextValue} + 1` },
    })
    .returning({ next: numberSeries.nextValue });
  return formatDocNumber(DOC_TYPES[type].prefix, year, row.next - 1);
}

/**
 * Kasa hesabı eksiye düşemez (fiziki para). Banka ve POS hesapları kontrol
 * edilmez: KMH / bloke gibi durumlarda eksi bakiye gerçekten olabilir.
 */
async function assertCashAvailable(exec: Executor, tenantId: string, cashAccountId: string, amount: Decimal) {
  // Hesap satırı kilitlenir: aynı kasadan eşzamanlı iki çıkış birbirini görmeden geçemez
  const [acc] = await exec
    .select({ name: cashAccounts.name, kind: cashAccounts.kind })
    .from(cashAccounts)
    .where(and(eq(cashAccounts.tenantId, tenantId), eq(cashAccounts.id, cashAccountId)))
    .for("update");
  if (!acc || acc.kind !== "kasa") return;
  const [row] = await exec
    .select({ balance: sql<string>`coalesce(sum(${cashMovements.amount}), 0)` })
    .from(cashMovements)
    .where(and(eq(cashMovements.tenantId, tenantId), eq(cashMovements.cashAccountId, cashAccountId)));
  const balance = dec(row?.balance);
  if (balance.lt(amount)) {
    throw new UserError(
      `${acc.name} bakiyesi yetersiz: kasada ${formatMoney(balance)} var, bu işlem için ${formatMoney(amount)} gerekiyor. Kasa eksiye düşemez.`,
    );
  }
}

async function lockDocument(exec: Executor, tenantId: string, id: string) {
  const [doc] = await exec
    .select()
    .from(documents)
    .where(and(eq(documents.tenantId, tenantId), eq(documents.id, id)))
    .for("update");
  if (!doc) throw new UserError("Belge bulunamadı.");
  if (!isDocTypeKey(doc.type)) throw new UserError("Bilinmeyen belge türü.");
  return { ...doc, type: doc.type as DocTypeKey };
}

/**
 * Belgeyi onaylar: numara alır ve stok / cari / kasa hareketlerini üretir.
 * Onaydan sonra belge değiştirilemez.
 */
export async function approveDocument(exec: Executor, tenantId: string, userId: string | null, id: string) {
  const doc = await lockDocument(exec, tenantId, id);
  if (doc.status !== "taslak") throw new UserError("Yalnızca taslak belgeler onaylanabilir.");
  const def = DOC_TYPES[doc.type];
  const lines = await exec
    .select()
    .from(documentLines)
    .where(eq(documentLines.documentId, id))
    .orderBy(asc(documentLines.lineNo));
  if (lines.length === 0) throw new UserError("Satırı olmayan belge onaylanamaz.");
  if (def.partner === "zorunlu" && !doc.partnerId) throw new UserError("Cari seçilmemiş.");
  if (def.cash !== 0 && !doc.cashAccountId) throw new UserError("Kasa / banka hesabı seçilmemiş.");
  if (def.cashTransfer && !doc.targetCashAccountId) throw new UserError("Paranın gireceği hesap seçilmemiş.");
  if (def.cash < 0 && doc.cashAccountId) await assertCashAvailable(exec, tenantId, doc.cashAccountId, dec(doc.grandTotal));

  const year = Number(doc.date.slice(0, 4));
  const number = await nextDocNumber(exec, tenantId, doc.type, year);
  const desc = `${def.label} ${number}`;

  // --- Stok ---
  let sourceType: DocTypeKey | null = null;
  if (doc.sourceDocumentId) {
    const [src] = await exec.select({ type: documents.type }).from(documents).where(eq(documents.id, doc.sourceDocumentId));
    sourceType = src && isDocTypeKey(src.type) ? src.type : null;
  }
  const touched: string[] = [];
  const stockLines = lines.filter((l) => l.productId);
  if (def.lines === "urun" && stockLines.length && !stockAlreadyMovedBySource(doc.type, sourceType)) {
    const tracked = new Set(
      (
        await exec
          .select({ id: products.id })
          .from(products)
          .where(
            and(
              eq(products.tenantId, tenantId),
              inArray(products.id, stockLines.map((l) => l.productId!)),
              eq(products.trackStock, true),
            ),
          )
      ).map((p) => p.id),
    );
    for (const l of stockLines) {
      const productId = l.productId!;
      if (!tracked.has(productId)) continue;
      const qty = dec(l.quantity);
      if (def.transfer) {
        const cost = await averageCost(exec, tenantId, productId);
        await exec.insert(stockMovements).values([
          {
            tenantId,
            productId,
            warehouseId: doc.warehouseId!,
            documentId: id,
            documentLineId: l.id,
            date: doc.date,
            quantity: toQtyString(qty.neg()),
            unitCost: toQtyString(cost),
            kind: "transfer",
          },
          {
            tenantId,
            productId,
            warehouseId: doc.targetWarehouseId!,
            documentId: id,
            documentLineId: l.id,
            date: doc.date,
            quantity: toQtyString(qty),
            unitCost: toQtyString(cost),
            kind: "transfer",
          },
        ]);
      } else if (def.stock !== 0) {
        // Tedarikçiden giriş: maliyet = iskontolu net / miktar. Diğerleri: ortalama maliyet.
        const costFromLine = def.stock > 0 && def.partnerRole === "tedarikci";
        const cost = costFromLine ? dec(l.netAmount).div(qty) : await averageCost(exec, tenantId, productId);
        await exec.insert(stockMovements).values({
          tenantId,
          productId,
          warehouseId: doc.warehouseId!,
          documentId: id,
          documentLineId: l.id,
          date: doc.date,
          quantity: toQtyString(def.stock > 0 ? qty : qty.neg()),
          unitCost: toQtyString(cost),
          kind: def.stock > 0 ? "giris" : "cikis",
        });
      }
      touched.push(productId);
    }
  }

  // --- Cari ---
  if (def.partnerEffect && doc.partnerId) {
    let dueDate = doc.dueDate;
    if (!dueDate && def.hasDueDate) {
      const [p] = await exec.select({ term: partners.paymentTermDays }).from(partners).where(eq(partners.id, doc.partnerId));
      dueDate = addDaysIso(doc.date, p?.term ?? 0);
    }
    await exec.insert(partnerMovements).values({
      tenantId,
      partnerId: doc.partnerId,
      documentId: id,
      date: doc.date,
      dueDate: dueDate ?? doc.date,
      debit: def.partnerEffect === "borc" ? doc.grandTotal : "0",
      credit: def.partnerEffect === "alacak" ? doc.grandTotal : "0",
      description: desc,
    });
  }

  // --- Kasa / banka ---
  if (def.cash !== 0 && doc.cashAccountId) {
    const amount = dec(doc.grandTotal);
    const text = doc.notes ? `${desc} · ${doc.notes}` : desc;
    const base = { tenantId, documentId: id, partnerId: doc.partnerId, date: doc.date, description: text };
    await exec.insert(cashMovements).values([
      { ...base, cashAccountId: doc.cashAccountId, amount: toMoneyString(def.cash > 0 ? amount : amount.neg()) },
      // Virman: aynı tutar hedef hesaba girer
      ...(def.cashTransfer && doc.targetCashAccountId ? [{ ...base, cashAccountId: doc.targetCashAccountId, amount: toMoneyString(amount) }] : []),
    ]);
  }

  await exec
    .update(documents)
    .set({ status: "onayli", number, approvedAt: new Date(), approvedBy: userId })
    .where(eq(documents.id, id));

  await onStockChanged(exec, tenantId, touched);
  return { number };
}

/**
 * Onaylı belgeyi iptal eder: ürettiği her hareket için ters kayıt atılır,
 * belge numarası korunur. Hiçbir hareket silinmez.
 */
export async function cancelDocument(exec: Executor, tenantId: string, id: string) {
  const doc = await lockDocument(exec, tenantId, id);
  if (doc.status !== "onayli") throw new UserError("Yalnızca onaylı belgeler iptal edilebilir.");

  // Transaction içinde tek bağlantı var; sorgular sırayla çalışmalı (paralel değil).
  const stock = await exec.select().from(stockMovements).where(and(eq(stockMovements.tenantId, tenantId), eq(stockMovements.documentId, id)));
  const cari = await exec.select().from(partnerMovements).where(and(eq(partnerMovements.tenantId, tenantId), eq(partnerMovements.documentId, id)));
  const cash = await exec.select().from(cashMovements).where(and(eq(cashMovements.tenantId, tenantId), eq(cashMovements.documentId, id)));
  // Ters kayıt belgenin kendi tarihiyle atılır; dönem raporları iptalle birlikte sıfırlanır.
  const date = doc.date;
  const def = DOC_TYPES[doc.type];
  const desc = `İptal: ${def.label} ${doc.number}`;

  if (stock.length) {
    await exec.insert(stockMovements).values(
      stock.map((m) => ({
        tenantId,
        productId: m.productId,
        warehouseId: m.warehouseId,
        documentId: id,
        documentLineId: m.documentLineId,
        date,
        quantity: toQtyString(dec(m.quantity).neg()),
        unitCost: m.unitCost,
        kind: "iptal",
      })),
    );
  }
  if (cari.length) {
    await exec.insert(partnerMovements).values(
      cari.map((m) => ({
        tenantId,
        partnerId: m.partnerId,
        documentId: id,
        date,
        dueDate: m.dueDate ?? date,
        debit: m.credit,
        credit: m.debit,
        description: desc,
      })),
    );
  }
  // Kasaya giren parayı geri almak (ör. tahsilat iptali) kasayı eksiye düşürmemeli
  for (const m of cash) {
    if (dec(m.amount).gt(0)) await assertCashAvailable(exec, tenantId, m.cashAccountId, dec(m.amount));
  }
  if (cash.length) {
    await exec.insert(cashMovements).values(
      cash.map((m) => ({
        tenantId,
        cashAccountId: m.cashAccountId,
        documentId: id,
        partnerId: m.partnerId,
        date,
        amount: toMoneyString(dec(m.amount).neg()),
        description: desc,
      })),
    );
  }
  await exec.update(documents).set({ status: "iptal", cancelledAt: new Date() }).where(eq(documents.id, id));
  await onStockChanged(exec, tenantId, [...new Set(stock.map((m) => m.productId))]);
}

/** Taslak belgeyi siler (onaylı belge silinemez, iptal edilir). */
export async function deleteDraft(exec: Executor, tenantId: string, id: string) {
  const doc = await lockDocument(exec, tenantId, id);
  if (doc.status !== "taslak") throw new UserError("Onaylı belge silinemez; iptal edebilirsiniz.");
  await exec.delete(documents).where(eq(documents.id, id));
}

/** Belgeden yeni bir taslak türetir (teklif → sipariş → irsaliye → fatura). */
export async function convertDocument(
  exec: Executor,
  tenantId: string,
  userId: string | null,
  id: string,
  target: DocTypeKey,
  today: string,
): Promise<string> {
  const doc = await lockDocument(exec, tenantId, id);
  const def = DOC_TYPES[doc.type];
  if (!def.convertsTo.includes(target)) throw new UserError("Bu belge seçilen türe dönüştürülemez.");
  if (doc.status !== "onayli") throw new UserError("Önce belgeyi onaylayın; dönüştürme onaylı belgeden yapılır.");
  const lines = await exec
    .select()
    .from(documentLines)
    .where(eq(documentLines.documentId, id))
    .orderBy(asc(documentLines.lineNo));
  const tdef = DOC_TYPES[target];
  let dueDate: string | null = null;
  if (tdef.hasDueDate && doc.partnerId) {
    const [p] = await exec.select({ term: partners.paymentTermDays }).from(partners).where(eq(partners.id, doc.partnerId));
    dueDate = addDaysIso(today, p?.term ?? 0);
  }
  return saveDraft(exec, tenantId, userId, {
    type: target,
    date: today,
    dueDate,
    partnerId: doc.partnerId,
    warehouseId: doc.warehouseId,
    currency: doc.currency,
    notes: doc.notes,
    sourceDocumentId: id,
    lines: lines.map((l) => ({
      productId: l.productId,
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      discountRate: l.discountRate,
      vatRate: l.vatRate,
    })),
  });
}
