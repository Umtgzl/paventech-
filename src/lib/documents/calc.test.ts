import { describe, expect, it } from "vitest";
import { calcLine, calcTotals } from "./calc";
import { formatDocNumber, stockAlreadyMovedBySource } from "./types";

describe("calcLine", () => {
  it("brüt, iskonto, KDV ve toplamı satır bazında hesaplar", () => {
    const a = calcLine({ quantity: "3", unitPrice: "1250.50", discountRate: "10", vatRate: "20" });
    expect(a.gross.toFixed(2)).toBe("3751.50");
    expect(a.discount.toFixed(2)).toBe("375.15");
    expect(a.net.toFixed(2)).toBe("3376.35");
    expect(a.vat.toFixed(2)).toBe("675.27");
    expect(a.total.toFixed(2)).toBe("4051.62");
  });

  it("JavaScript ondalık hatasına düşmez (0.1 + 0.2)", () => {
    const a = calcLine({ quantity: "1", unitPrice: "0.1" });
    const b = calcLine({ quantity: "1", unitPrice: "0.2" });
    expect(a.total.plus(b.total).toFixed(2)).toBe("0.30");
  });

  it("yarım kuruşu yukarı yuvarlar", () => {
    // 0,125 TL KDV -> 0,13
    const a = calcLine({ quantity: "1", unitPrice: "1.25", vatRate: "10" });
    expect(a.vat.toFixed(2)).toBe("0.13");
  });

  it("boş değerleri sıfır kabul eder", () => {
    const a = calcLine({ quantity: "", unitPrice: null });
    expect(a.total.toFixed(2)).toBe("0.00");
  });
});

describe("calcTotals", () => {
  it("belge toplamı satır toplamlarına eşittir ve KDV dökümü oran bazındadır", () => {
    const t = calcTotals([
      { quantity: "2", unitPrice: "100", vatRate: "20" },
      { quantity: "1", unitPrice: "50", discountRate: "10", vatRate: "10" },
      { quantity: "4", unitPrice: "12.5", vatRate: "20" },
    ]);
    expect(t.subtotal.toFixed(2)).toBe("300.00");
    expect(t.discountTotal.toFixed(2)).toBe("5.00");
    expect(t.netTotal.toFixed(2)).toBe("295.00");
    expect(t.vatTotal.toFixed(2)).toBe("54.50");
    expect(t.grandTotal.toFixed(2)).toBe("349.50");
    expect(t.vatBreakdown.map((v) => [v.rate, v.base.toFixed(2), v.vat.toFixed(2)])).toEqual([
      ["20.00", "250.00", "50.00"],
      ["10.00", "45.00", "4.50"],
    ]);
  });
});

describe("belge numarası", () => {
  it("GİB biçiminde 16 karakter üretir", () => {
    const n = formatDocNumber("SFT", 2026, 42);
    expect(n).toBe("SFT2026000000042");
    expect(n).toHaveLength(16);
  });
});

describe("irsaliyeden fatura", () => {
  it("irsaliyeden gelen fatura stoğu tekrar düşmez", () => {
    expect(stockAlreadyMovedBySource("satis_fatura", "satis_irsaliye")).toBe(true);
    expect(stockAlreadyMovedBySource("alis_fatura", "alis_irsaliye")).toBe(true);
  });
  it("siparişten gelen fatura stoğu düşer", () => {
    expect(stockAlreadyMovedBySource("satis_fatura", "satis_siparis")).toBe(false);
    expect(stockAlreadyMovedBySource("satis_fatura", null)).toBe(false);
  });
});
