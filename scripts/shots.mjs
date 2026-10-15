// Geliştirme yardımcısı: giriş yapar, verilen sayfaların ekran görüntüsünü alır
// ve tarayıcı konsolundaki hataları raporlar.
// Kullanım: node scripts/shots.mjs <çıktı-klasörü> /panel /cari /stok/urunler ...
import { chromium } from "playwright";
import fs from "node:fs";

const [, , out, ...paths] = process.argv;
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.SHOT_EMAIL ?? "demo@paventech.local";
const exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
const problems = [];
page.on("pageerror", (e) => problems.push(`[${page.url()}] pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") problems.push(`[${page.url()}] console: ${m.text().split("\n")[0]}`);
});

await page.goto(BASE + "/giris");
await page.waitForLoadState("networkidle");
await page.fill("#email", EMAIL);
await page.fill("#password", "demo1234");
await page.click("button[type=submit]");
await page.waitForURL("**/panel", { timeout: 20000 });

let i = 0;
for (const p of paths) {
  i++;
  const [path, action] = p.split("|");
  await page.goto(BASE + path);
  await page.waitForLoadState("networkidle");
  if (action) {
    for (const step of action.split(";")) {
      const [kind, ...rest] = step.split(":");
      const arg = rest.join(":");
      if (kind === "click") await page.click(arg);
      if (kind === "wait") await page.waitForTimeout(Number(arg));
      if (kind === "fill") {
        const [sel, val] = arg.split("=");
        await page.fill(sel, val);
      }
    }
    await page.waitForLoadState("networkidle");
  }
  const name = `${String(i).padStart(2, "0")}-${path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root"}.png`;
  await page.screenshot({ path: `${out}/${name}`, caret: "initial", fullPage: false });
  console.log("ok", path, "->", name);
}

console.log(problems.length ? "SORUNLAR:\n" + problems.join("\n") : "Konsol hatası yok.");
await browser.close();
