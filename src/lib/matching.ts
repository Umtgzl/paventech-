// Tedarikçinin fatura satırındaki ürün adını bizim stok kartlarımızla eşleştirir.
// Prototipte açıklanabilir bir benzerlik algoritması kullanılır (kelime + harf
// üçlüsü benzerliği, birim ve ölçü uyumu). Canlı sürümde düşük güvenli satırlar
// dil modeline danışılacak; kullanıcının onayladığı eşleşmeler her durumda öğrenilir.
import { normalizeTr } from "./utils";

const SYNONYMS: Record<string, string> = {
  metre: "m",
  mt: "m",
  mtr: "m",
  adet: "ad",
  ad: "ad",
  kilogram: "kg",
  kilo: "kg",
  bonnel: "bonel",
  naylonu: "naylon",
  sungeri: "sunger",
  kumasi: "kumas",
  memory: "visco",
  foam: "sunger",
};

const STOP = new Set(["ve", "ile", "icin", "tek", "cift", "kisilik", "beyaz", "siyah", "ltd", "san", "tic"]);

/** Metni karşılaştırılabilir kelimelere ayırır: Türkçe karakter sadeleştirme, eşanlamlı ve ölçü normalizasyonu. */
export function tokenize(text: string): string[] {
  return normalizeTr(text)
    .replace(/(\d+)\s*[x×*]\s*(\d+)/g, (_, a: string, b: string) => ` ${Number(a)}x${Number(b)} `)
    .replace(/[^a-z0-9x.,]+/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[.,]+|[.,]+$/g, ""))
    .map((t) => (/^\d+$/.test(t) ? String(Number(t)) : t))
    .map((t) => SYNONYMS[t] ?? t)
    .filter((t) => t.length > 0 && !STOP.has(t));
}

function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

function dice<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return (2 * inter) / (a.size + b.size);
}

/** 0-1 arası benzerlik. Kelimelerin yanında harf üçlüleri, yazım farklarını (bonnel/bonel) yakalar. */
export function similarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  const tokenScore = dice(new Set(ta), new Set(tb));
  const triScore = dice(trigrams(ta.join(" ")), trigrams(tb.join(" ")));
  // Ölçü (160x200) iki tarafta da varsa ve farklıysa güçlü ceza: yanlış ebat eşleşmesin
  const dimA = ta.filter((t) => /^\d+x\d+$/.test(t));
  const dimB = tb.filter((t) => /^\d+x\d+$/.test(t));
  const dimPenalty = dimA.length && dimB.length && !dimA.some((d) => dimB.includes(d)) ? 0.35 : 0;
  return Math.max(0, Math.min(1, 0.55 * tokenScore + 0.45 * triScore - dimPenalty));
}

export interface MatchCandidate {
  id: string;
  name: string;
  code: string;
  unit: string;
}

export interface MatchResult {
  productId: string | null;
  score: number;
  source: "ogrenildi" | "benzerlik" | "yok";
  alternatives: { id: string; name: string; score: number }[];
}

function normUnit(u: string) {
  const t = SYNONYMS[normalizeTr(u)] ?? normalizeTr(u);
  return t === "mt" ? "m" : t;
}

const MIN_ALTERNATIVE_SCORE = 0.15;

export function matchLine(
  description: string,
  unit: string,
  candidates: MatchCandidate[],
  learned?: string | null,
): MatchResult {
  const scored = candidates
    .map((c) => {
      let s = Math.max(similarity(description, c.name), similarity(description, `${c.code} ${c.name}`) - 0.05);
      if (normUnit(unit) === normUnit(c.unit)) s = Math.min(1, s + 0.06);
      return { id: c.id, name: c.name, score: Number(s.toFixed(3)) };
    })
    .sort((a, b) => b.score - a.score);
  // Anlamsız adaylar (neredeyse hiç benzemeyen) öneri olarak gösterilmez
  const alternatives = scored.filter((x) => x.score >= MIN_ALTERNATIVE_SCORE).slice(0, 3);

  if (learned && candidates.some((c) => c.id === learned)) {
    return { productId: learned, score: 1, source: "ogrenildi", alternatives };
  }
  const best = scored[0];
  if (!best || best.score < 0.3) return { productId: null, score: best?.score ?? 0, source: "yok", alternatives };
  return { productId: best.id, score: best.score, source: "benzerlik", alternatives };
}
