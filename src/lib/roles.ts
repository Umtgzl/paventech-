/** Şirket içi roller (Better Auth organization eklentisi). */
export const ROLE_LABEL: Record<string, string> = { owner: "Sahip", admin: "Yönetici", member: "Kullanıcı" };

/** Şirket bilgilerini ve kullanıcıları yönetebilen roller */
export function canManageCompany(role: string, isSuperAdmin = false) {
  return isSuperAdmin || role === "owner" || role === "admin";
}
