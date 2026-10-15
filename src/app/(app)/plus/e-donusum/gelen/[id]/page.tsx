import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { suspensePage } from "@/components/page/suspense-page";
import { InboxMatcher } from "@/components/plus/inbox-matcher";
import { PlusHeader } from "@/components/plus/plus-header";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatMoney } from "@/lib/format";
import { db } from "@/server/db";
import { partners } from "@/server/db/schema";
import { getInboxWithMatches } from "@/server/plus/inbox";
import { requireModule } from "@/server/session";

export default suspensePage(async function InboxDetailPage(props: PageProps<"/plus/e-donusum/gelen/[id]">) {
  const { id } = await props.params;
  const ctx = await requireModule("edonusum");
  const data = await getInboxWithMatches(db, ctx.tenantId, id);
  if (!data) notFound();
  const suppliers = await db
    .select({ id: partners.id, name: partners.name })
    .from(partners)
    .where(and(eq(partners.tenantId, ctx.tenantId), inArray(partners.kind, ["tedarikci", "her_ikisi"])))
    .orderBy(asc(partners.name));
  const { item } = data;

  return (
    <>
      <PlusHeader
        module="e-Dönüşüm"
        title={`e-Fatura ${item.number}`}
        description={`${item.supplierName} · ${formatDate(item.date)} · ${formatMoney(item.grandTotal)}`}
        note="Eşleştirme açıklanabilir bir benzerlik algoritmasıyla yapılır (kelime, yazım ve ölçü uyumu). Onayladığınız eşleşmeler öğrenilir; canlıda düşük güvenli satırlar dil modeline danışılacak."
      />
      {item.status !== "yeni" ? (
        <Card>
          <CardContent className="text-sm">
            {item.status === "islendi" && item.createdDocumentId ? (
              <>
                Bu e-fatura alışa aktarıldı.{" "}
                <Link href={`/belge/detay/${item.createdDocumentId}`} className="text-primary hover:underline">
                  Oluşan alış faturasını aç
                </Link>
              </>
            ) : (
              "Bu e-fatura reddedildi."
            )}
          </CardContent>
        </Card>
      ) : (
        <InboxMatcher
          id={item.id}
          ettn={item.ettn}
          grandTotal={item.grandTotal}
          supplier={data.supplier}
          suppliers={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          lines={item.lines}
          matches={data.matches}
          products={data.products.map((p) => ({ value: p.id, label: p.name, hint: `${p.code} · ${p.unit}` }))}
        />
      )}
    </>
  );
});
