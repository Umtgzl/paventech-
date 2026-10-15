import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { suspensePage } from "@/components/page/suspense-page";
import { calcTotals } from "@/lib/documents/calc";
import { DOC_TYPES, isDocTypeKey } from "@/lib/documents/types";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { amountToTurkishWords } from "@/lib/number-to-words";
import { db } from "@/server/db";
import { tenantProfile } from "@/server/db/schema";
import { getDocument } from "@/server/documents/queries";
import { getTenantContext, hasModule } from "@/server/session";
import { PrintButton } from "./print-button";

/** A4 yazdırma görünümü. Tarayıcının "PDF olarak kaydet" seçeneğiyle PDF alınır. */
export default suspensePage(async function PrintDocumentPage(props: PageProps<"/yazdir/belge/[id]">) {
  const { id } = await props.params;
  const ctx = await getTenantContext();
  const d = await getDocument(db, ctx.tenantId, id);
  if (!d || !isDocTypeKey(d.doc.type)) notFound();
  const def = DOC_TYPES[d.doc.type];
  if (!hasModule(ctx, def.module)) notFound();
  const profile = await db.query.tenantProfile.findFirst({ where: eq(tenantProfile.tenantId, ctx.tenantId) });
  const doc = d.doc;
  const totals = calcTotals(d.lines);

  return (
    <>
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] justify-end gap-2 px-4">
        <PrintButton />
      </div>
      <article className="relative mx-auto min-h-[297mm] max-w-[210mm] bg-white p-[14mm] text-[12px] text-black shadow-sm print:shadow-none">
        {doc.status !== "onayli" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="-rotate-30 text-[90px] font-bold tracking-widest text-red-500/15">
              {doc.status === "iptal" ? "İPTAL" : "TASLAK"}
            </span>
          </div>
        )}
        <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-4">
          <div>
            <h1 className="text-base font-bold">{profile?.legalName ?? ctx.tenantName}</h1>
            {profile?.address && <p>{profile.address}</p>}
            {profile?.city && <p>{profile.city}</p>}
            {(profile?.taxOffice || profile?.taxNumber) && (
              <p>
                {profile?.taxOffice && `${profile.taxOffice} V.D. `}
                {profile?.taxNumber && `VKN: ${profile.taxNumber}`}
              </p>
            )}
            {profile?.phone && <p>Tel: {profile.phone}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold tracking-wide uppercase">{def.label}</h2>
            <table className="mt-2 ml-auto text-left">
              <tbody>
                <tr>
                  <td className="pr-3 text-gray-600">Belge No</td>
                  <td className="font-mono font-semibold">{doc.number ?? "—"}</td>
                </tr>
                <tr>
                  <td className="pr-3 text-gray-600">Tarih</td>
                  <td>{formatDate(doc.date)}</td>
                </tr>
                {def.hasDueDate && doc.dueDate && (
                  <tr>
                    <td className="pr-3 text-gray-600">Vade</td>
                    <td>{formatDate(doc.dueDate)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </header>

        {d.partnerName && (
          <section className="mt-4 w-1/2 rounded border border-gray-300 p-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase">Sayın</p>
            <p className="font-semibold">{d.partnerName}</p>
            {d.partnerAddress && <p>{d.partnerAddress}</p>}
            {d.partnerCity && <p>{d.partnerCity}</p>}
            {(d.partnerTaxOffice || d.partnerTaxNumber) && (
              <p>
                {d.partnerTaxOffice && `${d.partnerTaxOffice} V.D. `}
                {d.partnerTaxNumber && `VKN/TCKN: ${d.partnerTaxNumber}`}
              </p>
            )}
          </section>
        )}

        {def.lines !== "yok" ? (
          <table className="mt-5 w-full border-collapse">
            <thead>
              <tr className="border-y border-black text-left text-[11px]">
                <th className="py-1.5 pr-2">#</th>
                <th className="py-1.5 pr-2">{def.lines === "urun" ? "Mal / Hizmet" : "Açıklama"}</th>
                <th className="py-1.5 pr-2 text-right">Miktar</th>
                {def.priced && (
                  <>
                    <th className="py-1.5 pr-2 text-right">Birim Fiyat</th>
                    <th className="py-1.5 pr-2 text-right">İsk.</th>
                    <th className="py-1.5 pr-2 text-right">KDV</th>
                    <th className="py-1.5 text-right">Tutar</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {d.lines.map((l) => (
                <tr key={l.id} className="border-b border-gray-200 align-top">
                  <td className="py-1.5 pr-2">{l.lineNo}</td>
                  <td className="py-1.5 pr-2">
                    {l.productName ?? l.description}
                    {l.productCode && <span className="ml-1 text-gray-500">({l.productCode})</span>}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">
                    {formatQty(l.quantity)} {l.unit}
                  </td>
                  {def.priced && (
                    <>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{formatMoney(l.unitPrice)}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{Number(l.discountRate) ? `%${formatQty(l.discountRate)}` : ""}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">%{formatQty(l.vatRate)}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatMoney(l.netAmount)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-6 text-sm">
            {def.label} tutarı: <strong>{formatMoney(doc.grandTotal)}</strong>
            {d.cashAccountName && <> · Hesap: {d.cashAccountName}</>}
          </p>
        )}

        {def.priced && (
          <section className="mt-4 flex justify-between gap-6">
            <p className="max-w-[55%] self-end text-[11px] italic">Yalnız: {amountToTurkishWords(doc.grandTotal)}</p>
            <table className="min-w-[45%]">
              <tbody className="tabular-nums">
                {def.lines !== "yok" && (
                  <>
                    <tr>
                      <td className="py-0.5 pr-4 text-gray-600">Mal/Hizmet Toplamı</td>
                      <td className="text-right">{formatMoney(totals.subtotal)}</td>
                    </tr>
                    {!totals.discountTotal.isZero() && (
                      <tr>
                        <td className="py-0.5 pr-4 text-gray-600">Toplam İskonto</td>
                        <td className="text-right">-{formatMoney(totals.discountTotal)}</td>
                      </tr>
                    )}
                    {totals.vatBreakdown
                      .filter((v) => !v.vat.isZero())
                      .map((v) => (
                        <tr key={v.rate}>
                          <td className="py-0.5 pr-4 text-gray-600">Hesaplanan KDV (%{Number(v.rate)})</td>
                          <td className="text-right">{formatMoney(v.vat)}</td>
                        </tr>
                      ))}
                  </>
                )}
                <tr className="border-t-2 border-black font-bold">
                  <td className="py-1 pr-4">Ödenecek Tutar</td>
                  <td className="text-right">{formatMoney(doc.grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {doc.notes && (
          <section className="mt-6">
            <p className="text-[10px] font-semibold text-gray-500 uppercase">Açıklama</p>
            <p className="whitespace-pre-wrap">{doc.notes}</p>
          </section>
        )}

        <footer className="mt-16 grid grid-cols-2 gap-10 text-center text-[11px]">
          <div className="border-t border-gray-400 pt-1">Teslim eden</div>
          <div className="border-t border-gray-400 pt-1">Teslim alan</div>
        </footer>
        <p className="absolute right-[14mm] bottom-[8mm] left-[14mm] text-center text-[9px] text-gray-400">
          Paventech ERP ile oluşturuldu · Bu çıktı bilgi amaçlıdır; e-Fatura/e-Arşiv geçerli belge yerine geçmez.
        </p>
      </article>
    </>
  );
});
