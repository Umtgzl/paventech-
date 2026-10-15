import { describe, expect, it } from "vitest";
import { detectMetric } from "@/server/plus/assistant";

describe("asistan soru eşleme", () => {
  it.each([
    ["Bu ay en çok satan 5 ürün hangisi?", "en_cok_satan"],
    ["Vadesi geçen alacaklar kimlerde?", "vadesi_gecen"],
    ["Stoğu azalan ürünler var mı?", "kritik_stok"],
    ["Geçen 30 günde ciromuz ne kadar?", "ciro"],
    ["Kasada ve bankada ne kadar paramız var?", "nakit"],
    ["En iyi müşterilerimiz kimler?", "en_iyi_musteri"],
    ["Tedarikçilere ne kadar borcumuz var?", "borclarimiz"],
  ])("%s → %s", (q, key) => {
    expect(detectMetric(q)?.key).toBe(key);
  });

  it("anlamadığı soruda tahmin yürütmez", () => {
    expect(detectMetric("Yarın hava nasıl olacak?")).toBeNull();
  });
});
