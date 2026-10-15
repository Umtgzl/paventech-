// Belge formunun istemci ile sunucu arasında taşıdığı veri.
import type { DocTypeKey } from "./types";

export interface DocumentLineInput {
  productId?: string | null;
  description?: string | null;
  quantity: string;
  unit?: string | null;
  unitPrice: string;
  discountRate?: string | null;
  vatRate?: string | null;
}

export interface DocumentInput {
  type: DocTypeKey;
  date: string;
  dueDate?: string | null;
  partnerId?: string | null;
  warehouseId?: string | null;
  targetWarehouseId?: string | null;
  cashAccountId?: string | null;
  targetCashAccountId?: string | null;
  currency?: string;
  notes?: string | null;
  sourceDocumentId?: string | null;
  /** Satırsız belgelerde (tahsilat/ödeme) tutar */
  amount?: string | null;
  lines: DocumentLineInput[];
}
