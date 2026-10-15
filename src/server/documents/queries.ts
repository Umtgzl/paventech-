// Belge listeleme ve detay sorguları.
import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Executor } from "@/server/db/client";
import { cashAccounts, documentLines, documents, partners, products, user, warehouses } from "@/server/db/schema";
import type { DocTypeKey } from "@/lib/documents/types";

export interface DocumentListRow {
  id: string;
  number: string | null;
  status: string;
  date: string;
  dueDate: string | null;
  partnerId: string | null;
  partnerName: string | null;
  grandTotal: string;
  vatTotal: string;
  eStatus: string | null;
  notes: string | null;
}

export async function listDocuments(
  exec: Executor,
  tenantId: string,
  type: DocTypeKey,
  opts: { q?: string; status?: string; page?: number; pageSize?: number; partnerId?: string } = {},
) {
  const conds: SQL[] = [eq(documents.tenantId, tenantId), eq(documents.type, type)];
  if (opts.status) conds.push(eq(documents.status, opts.status));
  if (opts.partnerId) conds.push(eq(documents.partnerId, opts.partnerId));
  if (opts.q?.trim()) {
    const like = `%${opts.q.trim()}%`;
    conds.push(or(ilike(documents.number, like), ilike(partners.name, like), ilike(documents.notes, like))!);
  }
  const where = and(...conds);
  const pageSize = opts.pageSize ?? 25;
  const page = Math.max(1, opts.page ?? 1);

  const [rows, totals] = await Promise.all([
    exec
      .select({
        id: documents.id,
        number: documents.number,
        status: documents.status,
        date: documents.date,
        dueDate: documents.dueDate,
        partnerId: documents.partnerId,
        partnerName: partners.name,
        grandTotal: documents.grandTotal,
        vatTotal: documents.vatTotal,
        eStatus: documents.eStatus,
        notes: documents.notes,
      })
      .from(documents)
      .leftJoin(partners, eq(partners.id, documents.partnerId))
      .where(where)
      .orderBy(desc(documents.date), sql`${documents.number} desc nulls first`, desc(documents.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    exec
      .select({ n: count(), sum: sql<string>`coalesce(sum(case when ${documents.status} = 'onayli' then ${documents.grandTotal} else 0 end), 0)` })
      .from(documents)
      .leftJoin(partners, eq(partners.id, documents.partnerId))
      .where(where),
  ]);
  return { rows: rows as DocumentListRow[], total: Number(totals[0]?.n ?? 0), approvedSum: totals[0]?.sum ?? "0", page, pageSize };
}

const targetWarehouse = alias(warehouses, "target_warehouse");
const targetCash = alias(cashAccounts, "target_cash");
const approver = alias(user, "approver");

export async function getDocument(exec: Executor, tenantId: string, id: string) {
  const [doc] = await exec
    .select({
      doc: documents,
      partnerName: partners.name,
      partnerCode: partners.code,
      partnerTaxOffice: partners.taxOffice,
      partnerTaxNumber: partners.taxNumber,
      partnerAddress: partners.address,
      partnerCity: partners.city,
      warehouseName: warehouses.name,
      targetWarehouseName: targetWarehouse.name,
      cashAccountName: cashAccounts.name,
      targetCashAccountName: targetCash.name,
      approverName: approver.name,
    })
    .from(documents)
    .leftJoin(partners, eq(partners.id, documents.partnerId))
    .leftJoin(warehouses, eq(warehouses.id, documents.warehouseId))
    .leftJoin(targetWarehouse, eq(targetWarehouse.id, documents.targetWarehouseId))
    .leftJoin(cashAccounts, eq(cashAccounts.id, documents.cashAccountId))
    .leftJoin(targetCash, eq(targetCash.id, documents.targetCashAccountId))
    .leftJoin(approver, eq(approver.id, documents.approvedBy))
    .where(and(eq(documents.tenantId, tenantId), eq(documents.id, id)));
  if (!doc) return null;

  const lines = await exec
    .select({
      line: documentLines,
      productCode: products.code,
      productName: products.name,
    })
    .from(documentLines)
    .leftJoin(products, eq(products.id, documentLines.productId))
    .where(eq(documentLines.documentId, id))
    .orderBy(asc(documentLines.lineNo));

  const [source, derived] = await Promise.all([
    doc.doc.sourceDocumentId
      ? exec
          .select({ id: documents.id, type: documents.type, number: documents.number, status: documents.status })
          .from(documents)
          .where(eq(documents.id, doc.doc.sourceDocumentId))
      : Promise.resolve([]),
    exec
      .select({ id: documents.id, type: documents.type, number: documents.number, status: documents.status })
      .from(documents)
      .where(and(eq(documents.tenantId, tenantId), eq(documents.sourceDocumentId, id)))
      .orderBy(asc(documents.createdAt)),
  ]);

  return {
    ...doc,
    lines: lines.map((l) => ({ ...l.line, productCode: l.productCode, productName: l.productName })),
    source: source[0] ?? null,
    derived,
  };
}

export type DocumentDetail = NonNullable<Awaited<ReturnType<typeof getDocument>>>;
