import "dotenv/config";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { createDb, type DB } from "@/server/db/client";

/**
 * Entegrasyon testleri için temiz bir veritabanı: şemayı siler, göçleri uygular.
 * TEST_DATABASE_URL kullanılır; geliştirme veritabanına dokunulmaz.
 */
export async function freshTestDb(): Promise<{ db: DB; close: () => Promise<void> }> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL tanımlı değil (.env)");
  if (url === process.env.DATABASE_URL) throw new Error("Test veritabanı geliştirme veritabanıyla aynı olamaz");
  const pool = new Pool({ connectionString: url, max: 4 });
  const db = createDb(pool);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  await migrate(db, { migrationsFolder: "./drizzle" });
  return { db, close: () => pool.end() };
}
