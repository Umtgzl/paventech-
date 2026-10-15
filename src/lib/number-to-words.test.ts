import { describe, expect, it } from "vitest";
import { amountToTurkishWords, integerToTurkishWords } from "./number-to-words";

describe("yazıyla tutar", () => {
  it("sayıları Türkçe yazar", () => {
    expect(integerToTurkishWords(1000)).toBe("Bin");
    expect(integerToTurkishWords(1234)).toBe("BinİkiYüzOtuzDört");
    expect(integerToTurkishWords(37400)).toBe("OtuzYediBinDörtYüz");
    expect(integerToTurkishWords(1_000_001)).toBe("BirMilyonBir");
  });
  it("kuruşlu tutar", () => {
    expect(amountToTurkishWords("37400.00")).toBe("OtuzYediBinDörtYüz TL");
    expect(amountToTurkishWords("4051.62")).toBe("DörtBinElliBir TL Altmışİki Kr");
  });
});
