// Kendi bilgisayarında ilk kurulum (Windows, macOS, Linux).
// PostgreSQL bilgilerini sorar, .env'i hazırlar, veritabanını oluşturur, tabloları kurar
// ve demo veriyi yükler. Kullanım: pnpm kurulum   (sonra: pnpm demo)
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";

async function main() {
  // Satır satır okuma: hem elle yazınca hem de girdi borudan gelince çalışır
  const rl = createInterface({ input: process.stdin, terminal: false });
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (question: string) => {
    process.stdout.write(question);
    const next = await lines.next();
    return next.done ? "" : String(next.value).trim();
  };
  console.log("Paventech ERP kurulumu\n");
  const user = (await ask("PostgreSQL kullanıcı adı [postgres]: ")) || "postgres";
  const password = await ask("PostgreSQL şifresi (PostgreSQL'i kurarken belirlediğiniz): ");
  const port = (await ask("PostgreSQL portu [5432]: ")) || "5432";
  rl.close();

  let env = readFileSync(existsSync(".env") ? ".env" : ".env.example", "utf8");
  const set = (key: string, value: string) => {
    const line = `${key}=${value}`;
    env = new RegExp(`^${key}=.*$`, "m").test(env) ? env.replace(new RegExp(`^${key}=.*$`, "m"), line) : `${env.trimEnd()}\n${line}\n`;
  };
  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  set("DATABASE_URL", `postgres://${auth}@localhost:${port}/paventech_dev`);
  set("TEST_DATABASE_URL", `postgres://${auth}@localhost:${port}/paventech_test`);
  set("BETTER_AUTH_URL", "http://localhost:3000");
  if (!/^BETTER_AUTH_SECRET=.{32,}$/m.test(env)) set("BETTER_AUTH_SECRET", randomBytes(32).toString("base64url"));
  writeFileSync(".env", env);
  console.log("\n.env hazır. Veritabanı kuruluyor...\n");

  const result = spawnSync("pnpm", ["db:reset"], { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    console.error("\nVeritabanı kurulamadı. PostgreSQL çalışıyor mu, şifre doğru mu? Kontrol edip `pnpm kurulum`u tekrar çalıştırın.");
    process.exit(1);
  }
  console.log("\nKurulum tamam. Uygulamayı başlatmak için:  pnpm demo\nSonra tarayıcıda: http://localhost:3000");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
