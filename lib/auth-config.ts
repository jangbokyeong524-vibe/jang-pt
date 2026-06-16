export const ADMIN_EMAILS = [
  "ydhcjswo.vibe@gmail.com",
  "jbk524@naver.com",
  "jangbokyeong524@gmail.com"
] as const;

export function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

export function isAllowedAdminEmail(email: string | null | undefined) {
  const normalizedEmail = normalizeEmail(email);
  return ADMIN_EMAILS.some((adminEmail) => adminEmail === normalizedEmail);
}

export function adminDisplayName(email: string | null | undefined) {
  const normalizedEmail = normalizeEmail(email);

  if (normalizedEmail === "jbk524@naver.com" || normalizedEmail === "jangbokyeong524@gmail.com") {
    return "관장";
  }

  return "관리자";
}
