// Gelen e-faturalar: satırları stok kartlarıyla eşleştirme ve alış faturası taslağına çevirme.
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { einvoiceInbox, partners, products, supplierProductMap } from "@/server/db/schema";
import { matchLine, similarity, type MatchResult } from "@/lib/matching";
import { UserError } from "@/server/domain/errors";
import { saveDraft } from "@/server/documents/service";

export async function listInbox(exec: Executor, tenantId: string) {
  return exec
    .select()
    .from(einvoiceInbox)
    .where(eq(einvoiceInbox.tenantId, tenantId))
    .orderBy(asc(einvoiceInbox.status), desc(einvoiceInbox.date));
}

async function catalog(exec: Executor, tenantId: string) {
  return exec
    .select({ id: products.id, name: products.name, code: products.code, unit: products.unit, kind: products.kind })
    .from(products)
    .where(and(eq(products.tenantId, tenantId), eq(products.isActive, true), ne(products.kind, "hizmet")))
    .orderBy(asc(products.name));
}

/** Faturayı, tedarikçi eşleşmesini ve satır bazında ürün önerilerini getirir. */
export async function getInboxWithMatches(exec: Executor, tenantId: string, id: string) {
  const [item] = await exec
    .select()
    .from(einvoiceInbox)
    .where(and(eq(einvoiceInbox.tenantId, tenantId), eq(einvoiceInbox.id, id)));
  if (!item) return null;

  const [byVkn] = await exec
    .select({ id: partners.id, name: partners.name })
    .from(partners)
    .where(and(eq(partners.tenantId, tenantId), eq(partners.taxNumber, item.supplierTaxNumber)));
  let supplier: { id: string; name: string; via: "vkn" | "isim" } | null = byVkn ? { ...byVkn, via: "vkn" } : null;
  if (!supplier) {
    const all = await exec
      .select({ id: partners.id, name: partners.name })
      .from(partners)
      .where(and(eq(partners.tenantId, tenantId), inArray(partners.kind, ["tedarikci", "her_ikisi"])));
    const best = all.map((p) => ({ ...p, s: similarity(item.supplierName, p.name) })).sort((a, b) => b.s - a.s)[0];
    if (best && best.s > 0.5) supplier = { id: best.id, name: best.name, via: "isim" };
  }

  const catalogItems = await catalog(exec, tenantId);
  const learnedRows = await exec
    .select({ name: supplierProductMap.supplierItemName, productId: supplierProductMap.productId })
    .from(supplierProductMap)
    .where(and(eq(supplierProductMap.tenantId, tenantId), eq(supplierProductMap.supplierTaxNumber, item.supplierTaxNumber)));
  const learned = new Map(learnedRows.map((r) => [r.name, r.productId]));

  // Kendi ürettiğimiz mamuller tedarikçiden alınmaz: otomatik eşleşmede aday olmazlar
  // (elle seçilebilir; elle seçilip öğrenilen eşleşme yine gelir).
  const matches: MatchResult[] = item.lines.map((l) => {
    const learnedId = learned.get(l.description);
    const candidates = catalogItems.filter((p) => p.kind !== "mamul" || p.id === learnedId);
    return matchLine(l.description, l.unit, candidates, learnedId);
  });
  return { item, supplier, matches, products: catalogItems };
}

/**
 * Onaylanan eşleşmelerle alış faturası taslağı oluşturur; eşleşmeleri öğrenir
 * (aynı tedarikçinin aynı satırı bir dahaki sefere otomatik gelir).
 */
export async function createPurchaseFromInbox(
  exec: Executor,
  tenantId: string,
  userId: string,
  id: string,
  input: { supplierId: string; productIds: (string | null)[] },
): Promise<string> {
  const [item] = await exec
    .select()
    .from(einvoiceInbox)
    .where(and(eq(einvoiceInbox.tenantId, tenantId), eq(einvoiceInbox.id, id)))
    .for("update");
  if (!item) throw new UserError("e-Fatura bulunamadı.");
  if (item.status !== "yeni") throw new UserError("Bu e-fatura zaten işlendi.");
  if (input.productIds.length !== item.lines.length || input.productIds.some((p) => !p)) {
    throw new UserError("Her satır için bir stok kartı seçin.");
  }

  const docId = await saveDraft(exec, tenantId, userId, {
    type: "alis_fatura",
    date: item.date,
    partnerId: input.supplierId,
    notes: `Gelen e-Fatura ${item.number} (ETTN ${item.ettn})`,
    lines: item.lines.map((l, i) => ({
      productId: input.productIds[i],
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      vatRate: l.vatRate,
    })),
  });

  for (const [i, l] of item.lines.entries()) {
    await exec
      .delete(supplierProductMap)
      .where(
        and(
          eq(supplierProductMap.tenantId, tenantId),
          eq(supplierProductMap.supplierTaxNumber, item.supplierTaxNumber),
          eq(supplierProductMap.supplierItemName, l.description),
        ),
      );
    await exec.insert(supplierProductMap).values({
      tenantId,
      supplierTaxNumber: item.supplierTaxNumber,
      supplierItemName: l.description,
      productId: input.productIds[i]!,
    });
  }

  await exec.update(einvoiceInbox).set({ status: "islendi", createdDocumentId: docId }).where(eq(einvoiceInbox.id, id));
  return docId;
}

export async function rejectInbox(exec: Executor, tenantId: string, id: string) {
  const [item] = await exec
    .select({ status: einvoiceInbox.status })
    .from(einvoiceInbox)
    .where(and(eq(einvoiceInbox.tenantId, tenantId), eq(einvoiceInbox.id, id)));
  if (!item) throw new UserError("e-Fatura bulunamadı.");
  if (item.status !== "yeni") throw new UserError("Bu e-fatura zaten işlendi.");
  await exec.update(einvoiceInbox).set({ status: "reddedildi" }).where(eq(einvoiceInbox.id, id));
}
