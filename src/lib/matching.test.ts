import { describe, expect, it } from "vitest";
import { matchLine, similarity, tokenize } from "./matching";

const catalog = [
  { id: "sunger", name: "Sünger 30 DNS", code: "HM-SUN-30", unit: "M3" },
  { id: "visco", name: "Visco Sünger", code: "HM-SUN-VIS", unit: "M3" },
  { id: "yay160", name: "Bonel Yay Ünitesi 160x200", code: "HM-YAY-160", unit: "ADET" },
  { id: "yay090", name: "Bonel Yay Ünitesi 90x190", code: "HM-YAY-090", unit: "ADET" },
  { id: "kumas", name: "Jakarlı Örme Kumaş", code: "HM-KUM-JAK", unit: "MT" },
  { id: "fermuar", name: "Fermuar 3 m", code: "HM-FRM-3M", unit: "ADET" },
  { id: "naylon", name: "Ambalaj Naylonu", code: "HM-NAY", unit: "KG" },
  { id: "yatak", name: "Ortopedik Yatak 160x200", code: "YT-ORT-160", unit: "ADET" },
];

describe("tokenize", () => {
  it("Türkçe karakterleri, ölçüleri ve eşanlamlıları normalize eder", () => {
    expect(tokenize("BONNEL YAY 090X190 TEK")).toEqual(["bonel", "yay", "90x190"]);
    expect(tokenize("Spiral fermuar 3 METRE")).toEqual(["spiral", "fermuar", "3", "m"]);
  });
});

describe("eşleştirme", () => {
  const cases: [string, string, string][] = [
    ["30 DNS SÜNGER BLOK (M3)", "M3", "sunger"],
    ["VİSCO MEMORY FOAM 50 DNS", "M3", "visco"],
    ["BONNEL YAY 160X200 ÇİFT KİŞİLİK", "ADET", "yay160"],
    ["BONNEL YAY 090X190 TEK", "ADET", "yay090"],
    ["STREÇ / AMBALAJ NAYLON 50MY", "KG", "naylon"],
    ["SPİRAL FERMUAR 3 METRE BEYAZ", "ADET", "fermuar"],
  ];
  for (const [desc, unit, expected] of cases) {
    it(`"${desc}" → ${expected}`, () => {
      expect(matchLine(desc, unit, catalog).productId).toBe(expected);
    });
  }

  it("ebat farklıysa eşleştirmez (160x200 ≠ 90x190)", () => {
    expect(similarity("Bonel yay 160x200", "Bonel Yay Ünitesi 90x190")).toBeLessThan(
      similarity("Bonel yay 160x200", "Bonel Yay Ünitesi 160x200"),
    );
  });

  it("öğrenilmiş eşleşme her zaman kazanır", () => {
    const r = matchLine("ÖZEL KODLU ÜRÜN XK-77", "ADET", catalog, "kumas");
    expect(r).toMatchObject({ productId: "kumas", source: "ogrenildi", score: 1 });
  });

  it("ilgisiz satırda öneri yapmaz", () => {
    expect(matchLine("Nakliye hizmet bedeli", "ADET", catalog).productId).toBeNull();
  });
});
