import { Client } from "pg";

/** Veritabanı yoksa oluşturur (yerel kurulumda elle "create database" gerekmesin). */
export async function ensureDatabase(url: string) {
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
