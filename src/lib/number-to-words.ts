// Tutarı Türkçe yazıya çevirir (faturalarda "Yalnız ... TL ... Kr" satırı).
const ONES = ["", "Bir", "İki", "Üç", "Dört", "Beş", "Altı", "Yedi", "Sekiz", "Dokuz"];
const TENS = ["", "On", "Yirmi", "Otuz", "Kırk", "Elli", "Altmış", "Yetmiş", "Seksen", "Doksan"];
const SCALES = ["", "Bin", "Milyon", "Milyar", "Trilyon"];

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  return `${h === 0 ? "" : h === 1 ? "Yüz" : `${ONES[h]}Yüz`}${TENS[t]}${ONES[o]}`;
}

export function integerToTurkishWords(n: number): string {
  if (n === 0) return "Sıfır";
  const parts: string[] = [];
  let scale = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk > 0) {
      // "Bir Bin" denmez, "Bin" denir
      const words = scale === 1 && chunk === 1 ? "" : threeDigits(chunk);
      parts.unshift(`${words}${SCALES[scale]}`);
    }
    n = Math.floor(n / 1000);
    scale++;
  }
  return parts.join("");
}

/** "1234.50" -> "BinİkiYüzOtuzDört TL Elli Kr" */
export function amountToTurkishWords(amount: string): string {
  const [intPart, fracPart = "0"] = Number(amount).toFixed(2).split(".");
  const lira = integerToTurkishWords(Number(intPart));
  const kurus = Number(fracPart);
  return kurus > 0 ? `${lira} TL ${integerToTurkishWords(kurus)} Kr` : `${lira} TL`;
}
