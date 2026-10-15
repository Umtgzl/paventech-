import "server-only";
import { UserError } from "@/server/domain/errors";

/** Server Action'ların istemciye döndürdüğü standart sonuç. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Server Action gövdesini sarar: beklenen hataları (UserError, veritabanı
 * kısıt ihlalleri) kullanıcı dostu mesaja çevirir, beklenmeyenleri loglar.
 */
export async function runAction<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message };
  } catch (err) {
    // redirect()/notFound() Next.js tarafından fırlatılır, yakalanmamalı.
    if (isNextControlFlow(err)) throw err;
    if (err instanceof UserError) {
      return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
    }
    const pg = pgError(err);
    if (pg?.code === "23505") {
      return { ok: false, error: "Bu kod/numara zaten kullanılıyor. Lütfen farklı bir değer girin." };
    }
    if (pg?.code === "23503") {
      return {
        ok: false,
        error: "Bu kayıt başka kayıtlarda kullanıldığı için silinemiyor. Bunun yerine pasife alabilirsiniz.",
      };
    }
    console.error("[action]", err);
    return { ok: false, error: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin." };
  }
}

function pgError(err: unknown): { code?: string } | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { code?: string; cause?: unknown };
  if (typeof e.code === "string") return e;
  if (e.cause) return pgError(e.cause);
  return null;
}

function isNextControlFlow(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR"));
}
