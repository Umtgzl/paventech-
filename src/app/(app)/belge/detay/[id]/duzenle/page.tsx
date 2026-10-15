import { notFound, redirect } from "next/navigation";
import { DocumentForm } from "@/components/documents/document-form";
import { PageHeader } from "@/components/page/page-header";
import { suspensePage } from "@/components/page/suspense-page";
import { DOC_TYPES, isDocTypeKey } from "@/lib/documents/types";
import { todayIso } from "@/lib/format";
import { MODULE_MAP } from "@/lib/modules";
import { db } from "@/server/db";
import { loadDocumentFormData } from "@/server/documents/form-data";
import { getDocument } from "@/server/documents/queries";
import { getTenantContext, hasModule } from "@/server/session";

export default suspensePage(async function EditDocumentPage(props: PageProps<"/belge/detay/[id]/duzenle">) {
  const { id } = await props.params;
  const ctx = await getTenantContext();
  const d = await getDocument(db, ctx.tenantId, id);
  if (!d || !isDocTypeKey(d.doc.type)) notFound();
  const def = DOC_TYPES[d.doc.type];
  if (!hasModule(ctx, def.module)) notFound();
  if (d.doc.status !== "taslak") redirect(`/belge/detay/${id}`);
  const today = todayIso();
  const data = await loadDocumentFormData(ctx.tenantId, def, today);
  const doc = d.doc;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: MODULE_MAP[def.module].short },
          { label: def.plural, href: `/belge/${def.slug}` },
          { label: "Taslak", href: `/belge/detay/${id}` },
          { label: "Düzenle" },
        ]}
        title={`${def.label} (taslak)`}
        description={d.source ? "Kaynak belgeden aktarıldı; kontrol edip onaylayın." : "Taslak belge düzenleniyor."}
      />
      <DocumentForm
        def={def}
        data={data}
        today={today}
        documentId={id}
        initial={{
          type: def.key,
          date: doc.date,
          dueDate: doc.dueDate,
          partnerId: doc.partnerId,
          warehouseId: doc.warehouseId,
          targetWarehouseId: doc.targetWarehouseId,
          cashAccountId: doc.cashAccountId,
          targetCashAccountId: doc.targetCashAccountId,
          notes: doc.notes,
          sourceDocumentId: doc.sourceDocumentId,
          amount: def.lines === "yok" ? doc.grandTotal : null,
          lines:
            def.lines === "yok"
              ? []
              : d.lines.map((l) => ({
                  productId: l.productId,
                  description: l.description,
                  quantity: l.quantity,
                  unit: l.unit,
                  unitPrice: l.unitPrice,
                  discountRate: l.discountRate,
                  vatRate: l.vatRate,
                })),
        }}
      />
    </>
  );
});
