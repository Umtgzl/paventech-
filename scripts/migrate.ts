import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../src/server/db/client";

async function main() {
  console.log("Göçler uygulanıyor...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Tamam.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
