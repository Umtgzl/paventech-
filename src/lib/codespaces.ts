import { existsSync } from "node:fs";

/**
 * Uygulama GitHub Codespaces içinde mi çalışıyor?
 * Ortam değişkenleri Codespaces'te her süreçte bulunmuyor (ör. otomatik başlatılan
 * sunucuda CODESPACES yok), bu yüzden diskteki Codespaces klasörüne de bakılır.
 * Yalnızca sunucuda ve next.config'te kullanılır.
 */
export function runningInCodespaces(): boolean {
  if (process.env.PAVENTECH_CODESPACES === "0") return false; // testlerde kapatmak için
  return (
    process.env.CODESPACES === "true" ||
    Boolean(process.env.CODESPACE_NAME) ||
    process.env.PAVENTECH_CODESPACES === "1" ||
    existsSync("/workspaces/.codespaces")
  );
}

/** Demo ortamı mı (kurgusal veri)? Canlı müşteri ortamında NEXT_PUBLIC_DEMO=0 olmalı. */
export function demoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO === "1";
}

/** Codespaces'in uygulamayı yayınladığı adresler (https://<ad>-3000.app.github.dev) */
export const CODESPACES_HOST_PATTERN = "*.app.github.dev";
