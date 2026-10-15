// AI Asistan (prototip): Türkçe soruyu tanımlı bir rapora (metriğe) eşler ve
// gerçek veriden cevap üretir. Canlı sürümde soruyu dil modeli yorumlayacak;
// ama model yine yalnızca bu tanımlı metrikleri çağırabilecek (ham SQL yazmaz).
// Böylece hem cevap doğru olur hem de şirket verisi izolasyonu korunur.
import { and, eq, gte, sql } from "drizzle-orm";
import type { Executor } from "@/server/db/client";
import { documentLines, documents, partners, products } from "@/server/db/schema";
import { addDaysIso, formatMoney, formatQty } from "@/lib/format";
import { dec, sumDec } from "@/lib/money";
import { normalizeTr } from "@/lib/utils";
import { cashBalances, partnerBalances, stockStatus } from "@/server/ledger/queries";

export interface AssistantAnswer {
  metric: string;
  title: string;
  summary: string;
  columns: string[];
  rows: string[][];
}

interface Metric {
  key: string;
  label: string;
  keywords: string[];
  run: (exec: Executor, tenantId: string, today: string, q: string) => Promise<AssistantAnswer>;
}

function period(q: string, today: string): { from: string; label: string } {
  if (q.includes("bu hafta")) return { from: addDaysIso(today, -6), label: "son 7 gün" };
  if (q.includes("bu yil") || q.includes("yillik")) return { from: `${today.slice(0, 4)}-01-01`, label: "bu yıl" };
  if (q.includes("90") || q.includes("3 ay") || q.includes("uc ay")) return { from: addDaysIso(today, -90), label: "son 90 gün" };
  if (q.includes("bu ay")) return { from: `${today.slice(0, 7)}-01`, label: "bu ay" };
  return { from: addDaysIso(today, -30), label: "son 30 gün" };
}

function topN(q: string, fallback = 5) {
  const m = q.match(/\b(\d{1,2})\b/);
  const n = m ? Number(m[1]) : fallback;
  return n > 0 && n <= 20 ? n : fallback;
}

export const METRICS: Metric[] = [
  {
    key: "en_cok_satan",
    label: "En çok satan ürünler",
    keywords: ["en cok sat", "en fazla sat", "cok satan", "populer urun", "en iyi urun"],
    async run(exec, tenantId, today, q) {
      const p = period(q, today);
      const n = topN(q);
      const rows = await exec
        .select({
          name: products.name,
          unit: products.unit,
          qty: sql<string>`sum(${documentLines.quantity})`,
          revenue: sql<string>`sum(${documentLines.netAmount})`,
        })
        .from(documentLines)
        .innerJoin(documents, eq(documents.id, documentLines.documentId))
        .innerJoin(products, eq(products.id, documentLines.productId))
        .where(and(eq(documents.tenantId, tenantId), eq(documents.type, "satis_fatura"), eq(documents.status, "onayli"), gte(documents.date, p.from)))
        .groupBy(products.name, products.unit)
        .orderBy(sql`sum(${documentLines.netAmount}) desc`)
        .limit(n);
      return {
        metric: this.key,
        title: `En çok satan ${rows.length} ürün (${p.label})`,
        summary: rows[0] ? `Lider ürün ${rows[0].name}: ${formatMoney(rows[0].revenue)} ciro (KDV hariç).` : "Bu dönemde satış yok.",
        columns: ["Ürün", "Miktar", "Ciro (KDV hariç)"],
        rows: rows.map((r) => [r.name, `${formatQty(r.qty)} ${r.unit}`, formatMoney(r.revenue)]),
      };
    },
  },
  {
    key: "en_iyi_musteri",
    label: "En çok alım yapan müşteriler",
    keywords: ["en iyi musteri", "en cok alan", "en buyuk musteri", "musteri sirala", "kar getiren", "en cok ciro"],
    async run(exec, tenantId, today, q) {
      const p = period(q, today);
      const n = topN(q);
      const rows = await exec
        .select({ name: partners.name, total: sql<string>`sum(${documents.grandTotal})`, count: sql<number>`count(*)::int` })
        .from(documents)
        .innerJoin(partners, eq(partners.id, documents.partnerId))
        .where(and(eq(documents.tenantId, tenantId), eq(documents.type, "satis_fatura"), eq(documents.status, "onayli"), gte(documents.date, p.from)))
        .groupBy(partners.name)
        .orderBy(sql`sum(${documents.grandTotal}) desc`)
        .limit(n);
      return {
        metric: this.key,
        title: `En çok alım yapan ${rows.length} müşteri (${p.label})`,
        summary: rows[0] ? `${rows[0].name} ${rows[0].count} faturayla ${formatMoney(rows[0].total)} alım yaptı.` : "Bu dönemde satış yok.",
        columns: ["Müşteri", "Fatura", "Tutar (KDV dahil)"],
        rows: rows.map((r) => [r.name, String(r.count), formatMoney(r.total)]),
      };
    },
  },
  {
    key: "vadesi_gecen",
    label: "Vadesi geçen alacaklar",
    keywords: ["vade", "geciken", "gecikmis", "odemeyen", "borclu", "tahsil edilmemis", "alacak"],
    async run(exec, tenantId, today) {
      const list = (await partnerBalances(exec, tenantId, today)).filter((b) => dec(b.overdue).gt(0)).sort((a, b) => dec(b.overdue).cmp(dec(a.overdue)));
      const total = sumDec(list.map((b) => b.overdue));
      return {
        metric: this.key,
        title: "Vadesi geçen alacaklar",
        summary: list.length ? `${list.length} müşteride toplam ${formatMoney(total)} vadesi geçmiş alacak var.` : "Vadesi geçmiş alacak yok.",
        columns: ["Müşteri", "Toplam bakiye", "Vadesi geçen"],
        rows: list.map((b) => [b.name, formatMoney(b.balance), formatMoney(b.overdue)]),
      };
    },
  },
  {
    key: "kritik_stok",
    label: "Kritik stoktaki ürünler",
    keywords: ["kritik", "azalan", "biten", "bitmek", "stok az", "stogu az", "eksik stok", "siparis vermem"],
    async run(exec, tenantId) {
      const list = await stockStatus(exec, tenantId, { onlyCritical: true });
      return {
        metric: this.key,
        title: "Kritik seviyedeki ürünler",
        summary: list.length ? `${list.length} ürün kritik seviyenin altında; satın alma planlanmalı.` : "Kritik seviyede ürün yok.",
        columns: ["Ürün", "Mevcut", "Kritik seviye"],
        rows: list.map((s) => [s.name, `${formatQty(s.quantity)} ${s.unit}`, `${formatQty(s.criticalLevel)} ${s.unit}`]),
      };
    },
  },
  {
    key: "ciro",
    label: "Satış özeti",
    keywords: ["ciro", "satis", "sattik", "kazanc", "hasilat"],
    async run(exec, tenantId, today, q) {
      const p = period(q, today);
      const [r] = await exec
        .select({ total: sql<string>`coalesce(sum(${documents.grandTotal}), 0)`, vat: sql<string>`coalesce(sum(${documents.vatTotal}), 0)`, count: sql<number>`count(*)::int` })
        .from(documents)
        .where(and(eq(documents.tenantId, tenantId), eq(documents.type, "satis_fatura"), eq(documents.status, "onayli"), gte(documents.date, p.from)));
      return {
        metric: this.key,
        title: `Satış özeti (${p.label})`,
        summary: `${r.count} faturayla ${formatMoney(r.total)} satış yapıldı (KDV hariç ${formatMoney(dec(r.total).minus(dec(r.vat)).toFixed(2))}).`,
        columns: ["Gösterge", "Değer"],
        rows: [
          ["Fatura sayısı", String(r.count)],
          ["Toplam (KDV dahil)", formatMoney(r.total)],
          ["KDV", formatMoney(r.vat)],
          ["Ortalama fatura", formatMoney(r.count ? dec(r.total).div(r.count).toFixed(2) : "0")],
        ],
      };
    },
  },
  {
    key: "nakit",
    label: "Kasa ve banka bakiyeleri",
    keywords: ["kasa", "banka", "nakit", "para ne kadar", "hesaplarda"],
    async run(exec, tenantId) {
      const list = await cashBalances(exec, tenantId);
      return {
        metric: this.key,
        title: "Kasa ve banka bakiyeleri",
        summary: `Toplam nakit varlık ${formatMoney(sumDec(list.map((a) => a.balance)))}.`,
        columns: ["Hesap", "Tür", "Bakiye"],
        rows: list.map((a) => [a.name, a.kind, formatMoney(a.balance)]),
      };
    },
  },
  {
    key: "borclarimiz",
    label: "Tedarikçilere borçlarımız",
    keywords: ["borcumuz", "borclarimiz", "tedarikci", "odeme yapmam", "odememiz"],
    async run(exec, tenantId, today) {
      const list = (await partnerBalances(exec, tenantId, today)).filter((b) => dec(b.balance).lt(0));
      return {
        metric: this.key,
        title: "Tedarikçilere borçlarımız",
        summary: list.length ? `${list.length} tedarikçiye toplam ${formatMoney(sumDec(list.map((b) => b.balance)).abs())} borcumuz var.` : "Açık tedarikçi borcu yok.",
        columns: ["Tedarikçi", "Borcumuz"],
        rows: list.map((b) => [b.name, formatMoney(dec(b.balance).abs().toFixed(2))]),
      };
    },
  },
];

/** Soruyu en uygun tanımlı metriğe eşler. Eşleşme yoksa null. */
export function detectMetric(question: string): Metric | null {
  const q = normalizeTr(question);
  let best: { m: Metric; score: number } | null = null;
  for (const m of METRICS) {
    const score = m.keywords.reduce((acc, k) => (q.includes(k) ? acc + k.length : acc), 0);
    if (score > 0 && (!best || score > best.score)) best = { m, score };
  }
  return best?.m ?? null;
}

export async function answerQuestion(exec: Executor, tenantId: string, question: string, today: string): Promise<AssistantAnswer | null> {
  const metric = detectMetric(question);
  if (!metric) return null;
  return metric.run(exec, tenantId, today, normalizeTr(question));
}

