/** Opcjonalny suffix e-maila (np. @zatekfantastyki.pl) — ustaw w VITE_FIREBASE_ALLOWED_EMAIL_SUFFIX */
export function isEmailAllowedForApp(email: string | null | undefined): boolean {
  const suffix = import.meta.env.VITE_FIREBASE_ALLOWED_EMAIL_SUFFIX?.trim();
  if (!suffix) return true;
  const normalized = email?.trim().toLowerCase() ?? "";
  const allowed = suffix.startsWith("@") ? suffix.toLowerCase() : `@${suffix.toLowerCase()}`;
  return normalized.endsWith(allowed);
}

export function allowedEmailSuffixHint(): string | null {
  const suffix = import.meta.env.VITE_FIREBASE_ALLOWED_EMAIL_SUFFIX?.trim();
  if (!suffix) return null;
  return suffix.startsWith("@") ? suffix : `@${suffix}`;
}
