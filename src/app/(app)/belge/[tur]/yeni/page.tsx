import { notFound } from "next/navigation";
import { DocumentForm } from "@/components/documents/document-form";
import { PageHeader } from "@/components/page/page-header";
import { suspensePage } from "@/components/page/suspense-page";
import { docTypeBySlug } from "@/lib/documents/types";
import { todayIso } from "@/lib/format";
import { MODULE_MAP } from "@/lib/modules";
import { loadDocumentFormData } from "@/server/documents/form-data";
import { requireModule } from "@/server/session";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default suspensePage(async function NewDocumentPage(props: PageProps<"/belge/[tur]/yeni">) {
  const { tur } = await props.params;
  const def = docTypeBySlug(tur);
  if (!def) notFound();
  const ctx = await requireModule(def.module);
  const sp = await props.searchParams;
  const today = todayIso();
  const data = await loadDocumentFormData(ctx.tenantId, def, today);
  const cari = one(sp.cari);
  const partnerId = cari && data.partners.some((p) => p.value === cari) ? cari : null;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: MODULE_MAP[def.module].short },
          { label: def.plural, href: `/belge/${def.slug}` },
          { label: "Yeni" },
        ]}
        title={`Yeni ${def.label.toLocaleLowerCase("tr-TR")}`}
        description="Numara onay anında verilir. Taslak kaydedip daha sonra onaylayabilirsiniz."
      />
      <DocumentForm
        def={def}
        data={data}
        today={today}
        initial={partnerId ? { type: def.key, date: today, partnerId, lines: [] } : null}
      />
    </>
  );
});
