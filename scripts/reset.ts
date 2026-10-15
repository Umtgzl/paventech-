// Veritabanını sıfırlar: tüm tabloları siler, göçleri uygular, demo veriyi yükler.
// UYARI: Yalnızca geliştirme/demo ortamında kullanın.
import "dotenv/config";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../src/server/db/client";
import { seedDemo } from "../src/server/seed/demo";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
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
