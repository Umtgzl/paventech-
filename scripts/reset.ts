// Veritabanını sıfırlar: tüm tabloları siler, göçleri uygular, demo veriyi yükler.
// UYARI: Yalnızca geliştirme/demo ortamında kullanın.
import "dotenv/config";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { db, pool } from "../src/server/db/client";
import { seedDemo } from "../src/server/seed/demo";

/** Veritabanı yoksa oluşturur (yerel kurulumda elle "create database" gerekmesin). */
async function ensureDatabase(url: string) {
  const target = new URL(url);
  const name = decodeURIComponent(target.pathname.slice(1));
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new Client({ connectionString: admin.toString() });
  try {
    await client.connect();
    const found = await client.query("select 1 from pg_database where datname = $1", [name]);
    if (found.rowCount === 0) {
      await client.query(`create database "${name.replaceAll('"', '""')}"`);
      console.log(`Veritabanı oluşturuldu: ${name}`);
    }
  } catch {
    // Yönetim veritabanına bağlanılamadıysa veritabanının zaten var olduğu varsayılır
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  await ensureDatabase(url);
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_RESET) {
    throw new Error("Üretim ortamında sıfırlama engellendi (ALLOW_RESET=1 ile zorlayabilirsiniz).");
  }
  console.log(`Sıfırlanıyor: ${url.replace(/:[^:@/]+@/, ":***@")}`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await seedDemo(db);
  await pool.end();
  console.log("Hazır.");
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
