import { describe, expect, it } from "vitest";
import { ENTITIES } from "./registry";
import { cleanEntityValues } from "./validation";

describe("cleanEntityValues", () => {
  it("cari kartını temizler, boş kodu otomatik koda bırakır", () => {
    const r = cleanEntityValues(ENTITIES.cari, {
      code: "",
      name: "  Yıldız Mobilya  ",
      kind: "musteri",
      paymentTermDays: "30",
      email: "Info@Yildiz.Test",
      isActive: "on",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.code).toBeNull();
    expect(r.values.name).toBe("Yıldız Mobilya");
    expect(r.values.paymentTermDays).toBe(30);
    expect(r.values.email).toBe("info@yildiz.test");
    expect(r.values.isActive).toBe(true);
    expect(r.values.city).toBeNull();
  });

  it("zorunlu alanları ve geçersiz değerleri alan bazında raporlar", () => {
    const r = cleanEntityValues(ENTITIES.urun, { name: "", kind: "bilinmeyen", salePrice: "abc" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.fieldErrors.name).toContain("zorunludur");
    expect(r.fieldErrors.kind).toContain("geçersiz");
    expect(r.fieldErrors.salePrice).toContain("sayı");
  });

  it("Türkçe sayı yazımını kabul eder", () => {
    const r = cleanEntityValues(ENTITIES.urun, { name: "Yastık", salePrice: "1.250,50", criticalLevel: "" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.salePrice).toBe("1250.50");
    expect(r.values.criticalLevel).toBe("0");
    expect(r.values.unit).toBe("ADET");
    // Gönderilmeyen evet/hayır alanı tanımdaki varsayılanı alır
    expect(r.values.trackStock).toBe(true);
    expect(r.values.isActive).toBe(true);
  });

  it("açıkça gönderilen hayır değerini korur", () => {
    const r = cleanEntityValues(ENTITIES.urun, { name: "Montaj hizmeti", trackStock: false });
    expect(r.ok && r.values.trackStock).toBe(false);
  });

  it("ilişki alanında UUID bekler", () => {
    const r = cleanEntityValues(ENTITIES.recete, { name: "Ortopedik", productId: "123" });
    expect(r.ok).toBe(false);
  });
});
