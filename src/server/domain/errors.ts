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
