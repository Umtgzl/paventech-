import { describe, expect, it } from "vitest";
import { parseDecimalInput, toMoneyString, toQtyString } from "./money";
import { formatDate, formatMoney, formatQty, addDaysIso } from "./format";

describe("parseDecimalInput", () => {
  it("Türkçe yazımı anlar", () => {
    expect(parseDecimalInput("1.234,56")).toBe("1234.56");
    expect(parseDecimalInput("12,5")).toBe("12.5");
    expect(parseDecimalInput("₺1.000,00")).toBe("1000.00");
    expect(parseDecimalInput("250 TL")).toBe("250");
  });
  it("noktalı yazımı anlar", () => {
    expect(parseDecimalInput("1234.56")).toBe("1234.56");
    expect(parseDecimalInput("-3")).toBe("-3");
  });
  it("geçersiz girdide null döner", () => {
    expect(parseDecimalInput("abc")).toBeNull();
    expect(parseDecimalInput("")).toBeNull();
    expect(parseDecimalInput("1,2,3")).toBeNull();
  });
});

describe("veritabanı biçimleri", () => {
  it("parayı 2, miktarı 4 ondalığa yuvarlar", () => {
    expect(toMoneyString("10.005")).toBe("10.01");
    expect(toQtyString("1.23456")).toBe("1.2346");
  });
});

describe("Türkçe biçimlendirme", () => {
  it("para ve tarih", () => {
    expect(formatMoney("1234.5")).toBe("₺1.234,50");
    expect(formatDate("2026-10-15")).toBe("15.10.2026");
    expect(formatQty("12.5000")).toBe("12,5");
    expect(addDaysIso("2026-12-30", 3)).toBe("2027-01-02");
  });
});
