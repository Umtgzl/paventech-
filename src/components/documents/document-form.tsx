"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Field } from "@/components/page/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { calcLine, calcTotals } from "@/lib/documents/calc";
import type { DocumentInput, DocumentLineInput } from "@/lib/documents/input";
import type { DocTypeDef } from "@/lib/documents/types";
import { VAT_RATES } from "@/lib/entities/registry";
import { addDaysIso, formatMoney, formatQty } from "@/lib/format";
import { dec, parseDecimalInput } from "@/lib/money";
import { cn } from "@/lib/utils";
import { saveDocumentAction } from "@/server/documents/actions";
import type { DocumentFormData } from "@/server/documents/form-data";

interface LineState {
  key: string;
  productId: string | null;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountRate: string;
  vatRate: string;
}

let lineSeq = 0;
const newKey = () => `l${++lineSeq}`;

/** "1250.5000" -> "1250,5" (form girdisi) */
function toInput(v: string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  return dec(v).toString().replace(".", ",");
}

function emptyLine(def: DocTypeDef): LineState {
  return {
    key: newKey(),
    productId: null,
    description: "",
    quantity: def.lines === "serbest" ? "1" : "",
    unit: "ADET",
    unitPrice: "",
    discountRate: "",
    vatRate: def.lines === "serbest" ? "20" : "",
  };
}

const num = (s: string) => parseDecimalInput(s) ?? "0";

export interface DocumentFormProps {
  def: DocTypeDef;
  data: DocumentFormData;
  today: string;
  initial?: DocumentInput | null;
  documentId?: string | null;
}

export function DocumentForm({ def, data, today, initial, documentId }: DocumentFormProps) {
  const router = useRouter();
  const { pending, run, fieldErrors } = useAction();
  const [approveMode, setApproveMode] = useState(false);
  const isPurchase = def.partnerRole === "tedarikci";
  const defaultWarehouse = data.warehouses.find((w) => w.isDefault)?.value ?? data.warehouses[0]?.value ?? "";

  const [date, setDate] = useState(initial?.date ?? today);
  const [dueDate, setDueDate] = useState(() => {
    if (initial?.dueDate) return initial.dueDate;
    if (!def.hasDueDate) return "";
    const p = data.partners.find((x) => x.value === initial?.partnerId);
    return addDaysIso(initial?.date ?? today, p?.termDays ?? 0);
  });
  const [dueTouched, setDueTouched] = useState(!!initial?.dueDate);
  const [partnerId, setPartnerId] = useState<string | null>(initial?.partnerId ?? null);
  const [warehouseId, setWarehouseId] = useState(initial?.warehouseId ?? defaultWarehouse);
  const [targetWarehouseId, setTargetWarehouseId] = useState(initial?.targetWarehouseId ?? "");
  const [cashAccountId, setCashAccountId] = useState(initial?.cashAccountId ?? data.cashAccounts[0]?.value ?? "");
  const [targetCashAccountId, setTargetCashAccountId] = useState(initial?.targetCashAccountId ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [amount, setAmount] = useState(toInput(initial?.amount));
  const [lines, setLines] = useState<LineState[]>(() => {
    const fromInitial = (initial?.lines ?? []).map((l) => ({
      key: newKey(),
      productId: l.productId ?? null,
      description: l.description ?? "",
      quantity: toInput(l.quantity),
      unit: l.unit ?? "ADET",
      unitPrice: toInput(l.unitPrice),
      discountRate: dec(l.discountRate ?? "0").isZero() ? "" : toInput(l.discountRate),
      vatRate: toInput(l.vatRate),
    }));
    return fromInitial.length ? fromInitial : [emptyLine(def), emptyLine(def), emptyLine(def)];
  });
  const tableRef = useRef<HTMLDivElement>(null);

  const productMap = useMemo(() => new Map(data.products.map((p) => [p.value, p])), [data.products]);
  const partner = data.partners.find((p) => p.value === partnerId);

  // Vade: elle değiştirilmediyse tarih + carinin vade günü
  function recomputeDue(nextDate: string, nextPartner: string | null) {
    if (!def.hasDueDate || dueTouched) return;
    const p = data.partners.find((x) => x.value === nextPartner);
    setDueDate(addDaysIso(nextDate, p?.termDays ?? 0));
  }

  function updateLine(key: string, patch: Partial<LineState>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function selectProduct(key: string, productId: string | null) {
    const p = productId ? productMap.get(productId) : undefined;
    updateLine(key, {
      productId,
      unit: p?.unit ?? "ADET",
      unitPrice: def.priced && p ? toInput(isPurchase ? p.purchasePrice : p.salePrice) : "",
      vatRate: def.priced && p ? toInput(p.vatRate) : "",
      quantity: lines.find((l) => l.key === key)?.quantity || (p ? "1" : ""),
    });
  }

  function addLine(focus = true) {
    const l = emptyLine(def);
    setLines((ls) => [...ls, l]);
    if (focus) {
      requestAnimationFrame(() => {
        const el = tableRef.current?.querySelector<HTMLElement>(`[data-line="${l.key}"] [data-first]`);
        el?.focus();
      });
    }
  }

  function onLineKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (index === lines.length - 1) addLine();
    else {
      const next = lines[index + 1];
      tableRef.current?.querySelector<HTMLElement>(`[data-line="${next.key}"] [data-first]`)?.focus();
    }
  }

  const computed = lines.map((l) =>
    calcLine({ quantity: num(l.quantity), unitPrice: num(l.unitPrice), discountRate: num(l.discountRate), vatRate: num(l.vatRate) }),
  );
  const totals =
    def.lines === "yok"
      ? calcTotals([{ quantity: "1", unitPrice: num(amount) }])
      : calcTotals(
          lines.map((l) => ({ quantity: num(l.quantity), unitPrice: num(l.unitPrice), discountRate: num(l.discountRate), vatRate: num(l.vatRate) })),
        );

  function submit(approve: boolean) {
    setApproveMode(approve);
    const payload: DocumentInput = {
      type: def.key,
      date,
      dueDate: def.hasDueDate ? dueDate || null : null,
      partnerId,
      warehouseId: def.lines === "urun" ? warehouseId || null : null,
      targetWarehouseId: def.transfer ? targetWarehouseId || null : null,
      cashAccountId: def.cash !== 0 ? cashAccountId || null : null,
      targetCashAccountId: def.cashTransfer ? targetCashAccountId || null : null,
      notes,
      sourceDocumentId: initial?.sourceDocumentId ?? null,
      amount: def.lines === "yok" ? amount : null,
      lines:
        def.lines === "yok"
          ? []
          : lines.map(
              (l): DocumentLineInput => ({
                productId: l.productId,
                description: l.description,
                quantity: l.quantity,
                unit: l.unit,
                unitPrice: l.unitPrice,
                discountRate: l.discountRate,
                vatRate: l.vatRate,
              }),
            ),
    };
    run(() => saveDocumentAction(payload, documentId ?? null, approve), {
      onSuccess: (d) => router.push(`/belge/detay/${d.id}`),
    });
  }

  const lineErrors = Object.entries(fieldErrors).filter(([k]) => k.startsWith("lines"));
  const showStock = def.stock < 0 || def.transfer;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(true);
      }}
      className="flex flex-col gap-4 pb-20"
    >
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {def.partner !== "yok" && (
            <Field
              label={def.partnerRole === "tedarikci" ? "Tedarikçi" : def.partnerRole === "musteri" ? "Müşteri" : "Cari"}
              htmlFor="partnerId"
              required={def.partner === "zorunlu"}
              error={fieldErrors.partnerId}
              className="sm:col-span-2"
              help={
                partner?.balance !== undefined
                  ? `Cari bakiye: ${formatMoney(partner.balance)} ${dec(partner.balance).gt(0) ? "(borçlu)" : dec(partner.balance).lt(0) ? "(alacaklı)" : ""}`
                  : partner?.hint
              }
            >
              <Combobox
                id="partnerId"
                value={partnerId}
                onChange={(v) => {
                  setPartnerId(v);
                  recomputeDue(date, v);
                }}
                options={data.partners}
                placeholder="Cari seçin..."
                invalid={!!fieldErrors.partnerId}
                emptyText="Cari bulunamadı. Önce cari kartı açın."
              />
            </Field>
          )}
          <Field label="Tarih" htmlFor="date" required error={fieldErrors.date}>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                recomputeDue(e.target.value, partnerId);
              }}
            />
          </Field>
          {def.hasDueDate && (
            <Field label="Vade tarihi" htmlFor="dueDate" error={fieldErrors.dueDate} help={dueTouched ? undefined : "Carinin vade gününe göre"}>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setDueTouched(true);
                }}
              />
            </Field>
          )}
          {def.lines === "urun" && (
            <Field label={def.transfer ? "Çıkış deposu" : "Depo"} htmlFor="warehouseId" required error={fieldErrors.warehouseId}>
              <NativeSelect id="warehouseId" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                {data.warehouses.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          {def.transfer && (
            <Field label="Giriş deposu" htmlFor="targetWarehouseId" required error={fieldErrors.targetWarehouseId}>
              <NativeSelect id="targetWarehouseId" value={targetWarehouseId} onChange={(e) => setTargetWarehouseId(e.target.value)}>
                <option value="">Seçin...</option>
                {data.warehouses
                  .filter((w) => w.value !== warehouseId)
                  .map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
          )}
          {def.cash !== 0 && (
            <Field
              label={def.cashTransfer ? "Çıkış hesabı" : "Kasa / banka hesabı"}
              htmlFor="cashAccountId"
              required
              error={fieldErrors.cashAccountId}
            >
              <NativeSelect id="cashAccountId" value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)}>
                {data.cashAccounts.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label} ({c.hint})
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          {def.cashTransfer && (
            <Field label="Giriş hesabı" htmlFor="targetCashAccountId" required error={fieldErrors.targetCashAccountId}>
              <NativeSelect id="targetCashAccountId" value={targetCashAccountId} onChange={(e) => setTargetCashAccountId(e.target.value)}>
                <option value="">Seçin...</option>
                {data.cashAccounts
                  .filter((c) => c.value !== cashAccountId)
                  .map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label} ({c.hint})
                    </option>
                  ))}
              </NativeSelect>
            </Field>
          )}
          {def.lines === "yok" && (
            <Field label="Tutar" htmlFor="amount" required error={fieldErrors.amount}>
              <Input
                id="amount"
                inputMode="decimal"
                className="text-right text-base font-semibold tabular-nums"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
          )}
        </CardContent>
      </Card>

      {def.lines !== "yok" && (
        <Card className="overflow-hidden py-0">
          {lineErrors.length > 0 && (
            <div className="border-b bg-destructive/5 px-4 py-2 text-sm text-destructive">
              {lineErrors.map(([k, v]) => (
                <p key={k}>{v}</p>
              ))}
            </div>
          )}
          <div ref={tableRef} className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="w-8 px-2 py-2 text-left font-medium">#</th>
                  <th className="px-2 py-2 text-left font-medium">{def.lines === "urun" ? "Ürün" : "Açıklama"}</th>
                  <th className="w-24 px-2 py-2 text-right font-medium">Miktar</th>
                  {def.lines === "urun" && <th className="w-16 px-2 py-2 text-left font-medium">Birim</th>}
                  {def.priced && (
                    <>
                      <th className="w-32 px-2 py-2 text-right font-medium">Birim fiyat</th>
                      <th className="w-20 px-2 py-2 text-right font-medium">İsk. %</th>
                      <th className="w-24 px-2 py-2 text-right font-medium">KDV</th>
                      <th className="w-32 px-2 py-2 text-right font-medium">Tutar</th>
                    </>
                  )}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const p = l.productId ? productMap.get(l.productId) : undefined;
                  const err = (f: string) => !!fieldErrors[`lines.${i}.${f}`];
                  const stockShort = showStock && p?.stock !== null && p?.stock !== undefined && dec(num(l.quantity)).gt(dec(p.stock));
                  return (
                    <tr key={l.key} data-line={l.key} className="border-b last:border-0">
                      <td className="px-2 py-1.5 text-xs text-muted-foreground">{i + 1}</td>
                      <td className="px-2 py-1.5">
                        {def.lines === "urun" ? (
                          <div className="flex flex-col gap-0.5">
                            <ProductPicker
                              value={l.productId}
                              options={data.products}
                              invalid={err("productId")}
                              onChange={(v) => selectProduct(l.key, v)}
                            />
                            {p && showStock && p.stock !== null && (
                              <span className={cn("text-[11px] text-muted-foreground", stockShort && "font-medium text-destructive")}>
                                Stok: {formatQty(p.stock)} {p.unit}
                                {stockShort && " · yetersiz"}
                              </span>
                            )}
                          </div>
                        ) : (
                          <Input
                            data-first
                            value={l.description}
                            placeholder="Örn. Kargo bedeli, yakıt, kırtasiye..."
                            aria-invalid={err("description")}
                            onChange={(e) => updateLine(l.key, { description: e.target.value })}
                            onKeyDown={(e) => onLineKeyDown(e, i)}
                          />
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          inputMode="decimal"
                          className="text-right tabular-nums"
                          value={l.quantity}
                          aria-invalid={err("quantity")}
                          onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
                          onKeyDown={(e) => onLineKeyDown(e, i)}
                        />
                      </td>
                      {def.lines === "urun" && <td className="px-2 py-1.5 text-xs text-muted-foreground">{l.unit}</td>}
                      {def.priced && (
                        <>
                          <td className="px-2 py-1.5">
                            <Input
                              inputMode="decimal"
                              className="text-right tabular-nums"
                              placeholder="0,00"
                              value={l.unitPrice}
                              aria-invalid={err("unitPrice")}
                              onChange={(e) => updateLine(l.key, { unitPrice: e.target.value })}
                              onKeyDown={(e) => onLineKeyDown(e, i)}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              inputMode="decimal"
                              className="text-right tabular-nums"
                              placeholder="0"
                              value={l.discountRate}
                              aria-invalid={err("discountRate")}
                              onChange={(e) => updateLine(l.key, { discountRate: e.target.value })}
                              onKeyDown={(e) => onLineKeyDown(e, i)}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <NativeSelect
                              value={l.vatRate ? String(Number(num(l.vatRate))) : ""}
                              aria-invalid={err("vatRate")}
                              onChange={(e) => updateLine(l.key, { vatRate: e.target.value })}
                            >
                              <option value="">—</option>
                              {VAT_RATES.map((v) => (
                                <option key={v.value} value={v.value}>
                                  {v.label}
                                </option>
                              ))}
                            </NativeSelect>
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            <div>{formatMoney(computed[i].net)}</div>
                            {!computed[i].vat.isZero() && (
                              <div className="text-[11px] text-muted-foreground">+KDV {formatMoney(computed[i].vat)}</div>
                            )}
                          </td>
                        </>
                      )}
                      <td className="px-1 py-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Satırı sil"
                          onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [emptyLine(def)]))}
                        >
                          <Trash2 className="text-muted-foreground" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t bg-muted/20 px-3 py-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => addLine()}>
              <Plus /> Satır ekle
            </Button>
            <span className="text-xs text-muted-foreground">İpucu: son satırda Enter&apos;a basınca yeni satır açılır.</span>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_340px]">
        <Card>
          <CardContent>
            <Field label="Açıklama / not" htmlFor="notes">
              <Textarea id="notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </CardContent>
        </Card>
        {def.priced && (
          <Card>
            <CardContent className="flex flex-col gap-1.5 text-sm">
              {def.lines !== "yok" && (
                <>
                  <Row label="Ara toplam" value={formatMoney(totals.subtotal)} />
                  {!totals.discountTotal.isZero() && <Row label="İskonto" value={`-${formatMoney(totals.discountTotal)}`} />}
                  {totals.vatBreakdown
                    .filter((v) => !v.vat.isZero())
                    .map((v) => (
                      <Row key={v.rate} label={`KDV %${Number(v.rate)} (matrah ${formatMoney(v.base)})`} value={formatMoney(v.vat)} muted />
                    ))}
                </>
              )}
              <div className="mt-1 flex items-center justify-between border-t pt-2 text-base font-semibold">
                <span>Genel toplam</span>
                <span className="tabular-nums">{formatMoney(totals.grandTotal)}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 backdrop-blur lg:left-64">
        <div className="flex items-center gap-2 px-4 py-3 lg:px-8">
          <Button type="button" variant="ghost" asChild>
            <Link href={documentId ? `/belge/detay/${documentId}` : `/belge/${def.slug}`}>Vazgeç</Link>
          </Button>
          <div className="flex-1" />
          <Button type="button" variant="outline" disabled={pending} onClick={() => submit(false)}>
            {pending && !approveMode ? <Loader2 className="animate-spin" /> : <Save />}
            Taslak<span className="hidden sm:inline"> kaydet</span>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && approveMode ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            <span className="hidden sm:inline">Kaydet ve onayla</span>
            <span className="sm:hidden">Onayla</span>
          </Button>
        </div>
      </div>
    </form>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3", muted && "text-muted-foreground")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function ProductPicker({
  value,
  options,
  onChange,
  invalid,
}: {
  value: string | null;
  options: DocumentFormData["products"];
  onChange: (v: string | null) => void;
  invalid?: boolean;
}) {
  return (
    <Combobox
      value={value}
      onChange={onChange}
      options={options.map((o) => ({ value: o.value, label: o.label, hint: o.hint }))}
      placeholder="Ürün ara..."
      invalid={invalid}
      emptyText="Ürün bulunamadı."
      triggerProps={{ "data-first": true }}
    />
  );
}
