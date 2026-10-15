/**
 * Kullanıcıya olduğu gibi gösterilebilecek iş kuralı hatası
 * (ör. "Yalnızca taslak belgeler onaylanabilir"). "server-only" içermez.
 */
export class UserError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "UserError";
  }
}

/** Zod doğrulama hatasını alan bazında ilk mesaja indirger (form altında gösterilir). */
export function zodFieldErrors(error: { issues: { path: PropertyKey[]; message: string }[] }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
