// Boş bir veritabanına demo veriyi yükler (göçler uygulanmış olmalı).
import "dotenv/config";
import { db, pool } from "../src/server/db/client";
import { seedDemo } from "../src/server/seed/demo";

seedDemo(db)
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
