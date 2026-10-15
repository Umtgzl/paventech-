"use server";

import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/server/db";
import { documents, member, notification, partners, products, session as sessionTable } from "@/server/db/schema";
import { getSession, getTenantContext, UserError } from "@/server/session";
import { runAction } from "@/server/actions";
import { DOC_TYPES, isDocTypeKey } from "@/lib/documents/types";

/** Kullanıcının üye olduğu başka bir şirkete geçer. */
export async function switchTenantAction(tenantId: string) {
  return runAction(async () => {
    const s = await getSession();
    if (!s) throw new UserError("Oturum bulunamadı.");
    const m = await db.query.member.findFirst({
      where: and(eq(member.userId, s.user.id), eq(member.organizationId, tenantId)),
    });
    if (!m) throw new UserError("Bu şirkete erişiminiz yok.");
    await db.update(sessionTable).set({ activeOrganizationId: tenantId }).where(eq(sessionTable.id, s.session.id));
    refresh();
  });
}

export interface SearchHit {
  kind: "cari" | "urun" | "belge";
  title: string;
  subtitle: string;
  href: string;
}

/** ⌘K komut paletindeki genel arama: cari, ürün ve belge numarası. */
export async function globalSearchAction(query: string): Promise<SearchHit[]> {
  const ctx = await getTenantContext();
  const q = query.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;

  const [cari, urun, belge] = await Promise.all([
    db
      .select({ id: partners.id, code: partners.code, name: partners.name, city: partners.city })
      .from(partners)
      .where(and(eq(partners.tenantId, ctx.tenantId), or(ilike(partners.name, like), ilike(partners.code, like))))
      .limit(5),
    db
      .select({ id: products.id, code: products.code, name: products.name, unit: products.unit })
      .from(products)
      .where(
        and(
          eq(products.tenantId, ctx.tenantId),
          or(ilike(products.name, like), ilike(products.code, like), ilike(products.barcode, like)),
        ),
      )
      .limit(5),
    db
      .select({ id: documents.id, number: documents.number, type: documents.type, date: documents.date })
      .from(documents)
      .where(and(eq(documents.tenantId, ctx.tenantId), ilike(documents.number, like)))
      .orderBy(desc(documents.date))
      .limit(5),
  ]);

  return [
    ...cari.map((c) => ({
      kind: "cari" as const,
      title: c.name,
      subtitle: [c.code, c.city].filter(Boolean).join(" · "),
      href: `/cari/${c.id}`,
    })),
    ...urun.map((p) => ({
      kind: "urun" as const,
      title: p.name,
      subtitle: `${p.code} · ${p.unit}`,
      href: `/stok/urunler/${p.id}`,
    })),
    ...belge.map((d) => ({
      kind: "belge" as const,
      title: d.number ?? "Taslak",
      subtitle: isDocTypeKey(d.type) ? DOC_TYPES[d.type].label : d.type,
      href: `/belge/detay/${d.id}`,
    })),
  ];
}

export async function markNotificationsReadAction() {
  return runAction(async () => {
    const ctx = await getTenantContext();
    await db
      .update(notification)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notification.tenantId, ctx.tenantId),
          isNull(notification.readAt),
          or(isNull(notification.userId), eq(notification.userId, ctx.userId)),
        ),
      );
    refresh();
  });
}
