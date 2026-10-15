import "server-only";
import { db, type Tx } from "@/server/db";
import { auditLog } from "@/server/db/schema";
import type { TenantContext } from "@/server/session";

/**
 * Şirket kapsamlı işlemler tek bir veritabanı transaction'ı içinde çalışır.
 * Bir adım hata verirse (ör. stok hareketi yazılamazsa) belge de kaydedilmez.
 *
 * Yol haritası: pilot öncesi PostgreSQL Row Level Security açılacak; o zaman
 * burada `set_config('app.tenant_id', ...)` çağrılacak ve her sorgu ikinci bir
 * emniyet kemeriyle şirkete kilitlenecek (bkz. docs/KARARLAR.md).
 */
export async function tenantTx<T>(ctx: TenantContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  void ctx;
  return db.transaction(async (tx) => fn(tx));
}

export async function audit(
  tx: Tx,
  ctx: TenantContext,
  entry: { action: string; entity: string; entityId?: string; summary: string; data?: Record<string, unknown> },
) {
  await tx.insert(auditLog).values({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    summary: entry.summary,
    data: entry.data,
  });
}
