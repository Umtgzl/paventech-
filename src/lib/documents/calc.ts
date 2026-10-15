// Belge satırı ve toplam hesapları. Hem tarayıcıda (anlık gösterim) hem
// sunucuda (kayıt sırasında yeniden hesap) aynı fonksiyonlar kullanılır;
// sunucu istemciden gelen toplamlara asla güvenmez.
//
// Yuvarlama satır bazındadır: brüt, iskonto ve KDV her satırda 2 ondalığa
// yuvarlanır; belge toplamları satır toplamlarıdır. e-Fatura (UBL-TR)
// toplamlarının kuruşu kuruşuna tutması için bu tutarlılık gerekir.
import { dec, round2, type NumericInput, type Decimal } from "@/lib/money";

export interface LineInput {
  quantity: NumericInput;
  unitPrice: NumericInput;
  discountRate?: NumericInput;
  vatRate?: NumericInput;
}

export interface LineAmounts {
  gross: Decimal;
  discount: Decimal;
  net: Decimal;
  vat: Decimal;
  total: Decimal;
}

export function calcLine(line: LineInput): LineAmounts {
  const gross = round2(dec(line.quantity).mul(dec(line.unitPrice)));
  const discount = round2(gross.mul(dec(line.discountRate)).div(100));
  const net = gross.minus(discount);
  const vat = round2(net.mul(dec(line.vatRate)).div(100));
  return { gross, discount, net, vat, total: net.plus(vat) };
}

export interface DocTotals {
  subtotal: Decimal;
  discountTotal: Decimal;
  netTotal: Decimal;
  vatTotal: Decimal;
  grandTotal: Decimal;
  /** KDV oranına göre matrah ve vergi dökümü (faturada gösterilir) */
  vatBreakdown: { rate: string; base: Decimal; vat: Decimal }[];
}

export function calcTotals(lines: LineInput[]): DocTotals {
  const zero = dec(0);
  let subtotal = zero;
  let discountTotal = zero;
  let vatTotal = zero;
  const breakdown = new Map<string, { base: Decimal; vat: Decimal }>();

  for (const line of lines) {
    const a = calcLine(line);
    subtotal = subtotal.plus(a.gross);
    discountTotal = discountTotal.plus(a.discount);
    vatTotal = vatTotal.plus(a.vat);
    const rateKey = dec(line.vatRate).toFixed(2);
    const prev = breakdown.get(rateKey) ?? { base: zero, vat: zero };
    breakdown.set(rateKey, { base: prev.base.plus(a.net), vat: prev.vat.plus(a.vat) });
  }

  const netTotal = subtotal.minus(discountTotal);
  return {
    subtotal,
    discountTotal,
    netTotal,
    vatTotal,
    grandTotal: netTotal.plus(vatTotal),
    vatBreakdown: [...breakdown.entries()]
      .map(([rate, v]) => ({ rate, ...v }))
      .sort((a, b) => Number(b.rate) - Number(a.rate)),
  };
}
