// Ortak tablo/form motorunun veri katmanı. Her sorgu şirkete (tenantId) kilitlidir.
// "server-only" içermez: seed betiği de aynı fonksiyonlarla kayıt açar.
import { and, asc, count, eq, getTableColumns, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Executor } from "@/server/db/client";
import { numberSeries } from "@/server/db/schema";
import { ENTITIES } from "@/lib/entities/registry";
import type { EntityDef, EntityKey, EntityRow } from "@/lib/entities/types";
import type { CleanValues } from "@/lib/entities/validation";
import { ENTITY_TABLES } from "./tables";

type AnyExec = Executor;
type Row = Record<string, unknown>;

function columns(key: EntityKey): Record<string, PgColumn> {
  return getTableColumns(ENTITY_TABLES[key]) as unknown as Record<string, PgColumn>;
}

/** Drizzle'ın sorgu kurucusu tablo tipine göre tiplenir; burada tablolar dinamik. */
function q(exec: AnyExec) {
  return exec as unknown as {
    select: (fields?: Record<string, unknown>) => {
      from: (t: PgTable) => {
        where: (w: SQL | undefined) => {
          orderBy: (...o: SQL[]) => { limit: (n: number) => { offset: (n: number) => Promise<Row[]> } & Promise<Row[]> } & Promise<Row[]>;
          limit: (n: number) => Promise<Row[]>;
        } & Promise<Row[]>;
      };
    };
    insert: (t: PgTable) => { values: (v: Row) => { returning: (f: Record<string, unknown>) => Promise<Row[]> } };
    update: (t: PgTable) => { set: (v: Row) => { where: (w: SQL | undefined) => Promise<unknown> } };
    delete: (t: PgTable) => { where: (w: SQL | undefined) => Promise<unknown> };
  };
}

export interface ListOptions {
  q?: string;
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  filter?: Record<string, string | undefined>;
}

export interface ListResult {
  rows: EntityRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: string;
  dir: "asc" | "desc";
}

export async function listEntity(exec: AnyExec, tenantId: string, key: EntityKey, opts: ListOptions = {}): Promise<ListResult> {
  const def = ENTITIES[key];
  const table = ENTITY_TABLES[key];
  const c = columns(key);

  const conds: SQL[] = [eq(c.tenantId, tenantId)];
  const term = opts.q?.trim();
  if (term) {
    const like = `%${term}%`;
    const ors = def.searchFields.filter((f) => c[f]).map((f) => ilike(c[f], like));
    if (ors.length) conds.push(or(...ors)!);
  }
  for (const [k, v] of Object.entries(opts.filter ?? {})) {
    const field = def.fields.find((f) => f.name === k);
    if (v && c[k] && field && (field.type === "select" || field.type === "relation" || field.type === "boolean")) {
      conds.push(eq(c[k], field.type === "boolean" ? v === "true" : v));
    }
  }
  const where = and(...conds);

  const sortField = opts.sort && c[opts.sort] && def.fields.some((f) => f.name === opts.sort) ? opts.sort : def.defaultSort.field;
  const dir = opts.sort ? (opts.dir ?? "asc") : def.defaultSort.dir;
  const order = dir === "desc" ? sql`${c[sortField]} desc nulls last` : sql`${c[sortField]} asc nulls last`;
  const pageSize = Math.min(Math.max(opts.pageSize ?? 25, 1), 5000);
  const page = Math.max(1, opts.page ?? 1);

  const [rows, totals] = await Promise.all([
    q(exec)
      .select()
      .from(table)
      .where(where)
      .orderBy(order, asc(c.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    q(exec).select({ n: count() }).from(table).where(where),
  ]);

  return {
    rows: await toEntityRows(exec, tenantId, def, rows),
    total: Number(totals[0]?.n ?? 0),
    page,
    pageSize,
    sort: sortField,
    dir,
  };
}

export async function getEntity(exec: AnyExec, tenantId: string, key: EntityKey, id: string): Promise<EntityRow | null> {
  const c = columns(key);
  const rows = await q(exec)
    .select()
    .from(ENTITY_TABLES[key])
    .where(and(eq(c.tenantId, tenantId), eq(c.id, id)))
    .limit(1);
  if (!rows[0]) return null;
  return (await toEntityRows(exec, tenantId, ENTITIES[key], rows))[0];
}

/** Satırı tarayıcıya gidecek sade biçime çevirir; ilişki alanlarına etiket ekler. */
async function toEntityRows(exec: AnyExec, tenantId: string, def: EntityDef, rows: Row[]): Promise<EntityRow[]> {
  const out: EntityRow[] = rows.map((r) => {
    const row: EntityRow = { id: String(r.id) };
    for (const f of def.fields) {
      const v = r[f.name];
      row[f.name] = v instanceof Date ? v.toISOString() : (v as string | number | boolean | null) ?? null;
    }
    return row;
  });

  for (const f of def.fields) {
    if (f.type !== "relation" || !f.relation) continue;
    const ids = [...new Set(out.map((r) => r[f.name]).filter((v): v is string => typeof v === "string"))];
    if (ids.length === 0) continue;
    const labels = await relationLabels(exec, tenantId, f.relation.entity, ids);
    for (const r of out) {
      const id = r[f.name];
      r[`${f.name}__label`] = typeof id === "string" ? (labels.get(id) ?? null) : null;
    }
  }
  return out;
}

export async function relationLabels(exec: AnyExec, tenantId: string, key: EntityKey, ids: string[]) {
  const def = ENTITIES[key];
  const c = columns(key);
  const rows = await q(exec)
    .select({ id: c.id, title: c[def.titleField], code: c.code })
    .from(ENTITY_TABLES[key])
    .where(and(eq(c.tenantId, tenantId), inArray(c.id, ids)));
  return new Map(rows.map((r) => [String(r.id), labelOf(def, r)]));
}

function labelOf(def: EntityDef, r: Row) {
  const title = String(r.title ?? "");
  // Kodu başlıktan farklıysa yanına yaz (ör. "U00012 · Ortopedik Yatak")
  return r.code && def.titleField !== "code" && (def.key === "urun" || def.key === "cari") ? `${title} (${r.code})` : title;
}

export interface RelationOption {
  value: string;
  label: string;
}

/** Formdaki ilişki alanları için seçenekler (ör. reçete formunda mamul listesi). */
export async function relationOptions(exec: AnyExec, tenantId: string, key: EntityKey) {
  const def = ENTITIES[key];
  const result: Record<string, RelationOption[]> = {};
  for (const f of def.fields) {
    if (f.type !== "relation" || !f.relation) continue;
    result[f.name] = await optionsFor(exec, tenantId, f.relation.entity, f.relation.filter);
  }
  return result;
}

export async function optionsFor(
  exec: AnyExec,
  tenantId: string,
  key: EntityKey,
  filter?: { field: string; values: string[] },
): Promise<RelationOption[]> {
  const def = ENTITIES[key];
  const c = columns(key);
  const conds: SQL[] = [eq(c.tenantId, tenantId)];
  if (c.isActive) conds.push(eq(c.isActive, true));
  if (filter && c[filter.field]) conds.push(inArray(c[filter.field], filter.values));
  const rows = await q(exec)
    .select({ id: c.id, title: c[def.titleField], code: c.code })
    .from(ENTITY_TABLES[key])
    .where(and(...conds))
    .orderBy(asc(c[def.titleField]))
    .limit(1000);
  return rows.map((r) => ({ value: String(r.id), label: labelOf(def, r) }));
}

/** Otomatik kod: ön ek + sıra no. Elle girilmiş kodlarla çakışırsa sıradakine geçer. */
export async function nextCode(exec: AnyExec, tenantId: string, key: EntityKey): Promise<string> {
  const def = ENTITIES[key];
  if (!def.code) throw new Error(`${key} için kod tanımı yok`);
  const c = columns(key);
  for (let attempt = 0; attempt < 50; attempt++) {
    const [row] = await exec
      .insert(numberSeries)
      .values({ tenantId, series: `kod:${key}`, year: 0, nextValue: 2 })
      .onConflictDoUpdate({
        target: [numberSeries.tenantId, numberSeries.series, numberSeries.year],
        set: { nextValue: sql`${numberSeries.nextValue} + 1` },
      })
      .returning({ next: numberSeries.nextValue });
    const code = `${def.code.prefix}${String(row.next - 1).padStart(def.code.digits ?? 5, "0")}`;
    const exists = await q(exec)
      .select({ id: c.id })
      .from(ENTITY_TABLES[key])
      .where(and(eq(c.tenantId, tenantId), eq(c[def.code.field], code)))
      .limit(1);
    if (exists.length === 0) return code;
  }
  throw new Error("Otomatik kod üretilemedi");
}

export async function createEntity(exec: AnyExec, tenantId: string, key: EntityKey, values: CleanValues): Promise<string> {
  const def = ENTITIES[key];
  const data: Row = { ...values, tenantId };
  if (def.code && !data[def.code.field]) data[def.code.field] = await nextCode(exec, tenantId, key);
  const c = columns(key);
  const [row] = await q(exec).insert(ENTITY_TABLES[key]).values(data).returning({ id: c.id });
  return String(row.id);
}

export async function updateEntity(exec: AnyExec, tenantId: string, key: EntityKey, id: string, values: CleanValues) {
  const def = ENTITIES[key];
  const data: Row = { ...values };
  if (def.code && !data[def.code.field]) delete data[def.code.field];
  const c = columns(key);
  if (c.updatedAt) data.updatedAt = new Date();
  await q(exec)
    .update(ENTITY_TABLES[key])
    .set(data)
    .where(and(eq(c.tenantId, tenantId), eq(c.id, id)));
}

export async function deleteEntity(exec: AnyExec, tenantId: string, key: EntityKey, id: string) {
  const c = columns(key);
  await q(exec)
    .delete(ENTITY_TABLES[key])
    .where(and(eq(c.tenantId, tenantId), eq(c.id, id)));
}

/** Bu şirkette varsayılan depo tek olmalı. */
export async function ensureSingleDefaultWarehouse(exec: AnyExec, tenantId: string, keepId: string) {
  const c = columns("depo");
  await q(exec)
    .update(ENTITY_TABLES.depo)
    .set({ isDefault: false })
    .where(and(eq(c.tenantId, tenantId), sql`${c.id} <> ${keepId}`));
}

