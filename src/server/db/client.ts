// Veritabanı istemcisi. "server-only" içermez; böylece seed/migrate betikleri
// (tsx ile düz Node'da çalışan) de aynı istemciyi kullanabilir.
// Uygulama kodu bunun yerine "@/server/db" modülünü kullanmalı.
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __pvPool?: Pool };

export function createPool(connectionString = process.env.DATABASE_URL) {
  return new Pool({ connectionString, max: 10 });
}

export const pool = globalForDb.__pvPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.__pvPool = pool;

export const db = drizzle(pool, { schema, casing: "snake_case" });

export function createDb(p: Pool) {
  return drizzle(p, { schema, casing: "snake_case" });
}

export type DB = typeof db;
/** Transaction içindeki bağlantı tipi */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
/** Hem db hem tx kabul eden fonksiyonlar için */
export type Executor = DB | Tx;
