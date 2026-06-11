import type { User } from "firebase/auth";

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

export function isLocalUser(user: User | null | undefined): boolean {
  return Boolean(user && user.uid === "local-user");
}

/** Zgodne z regułami RTDB: zweryfikowany e-mail + opcjonalny suffix domeny. */
export function canSyncWithFirebase(user: User | null | undefined): boolean {
  if (!user || isLocalUser(user)) return false;
  if (!user.emailVerified) return false;
  return isEmailAllowedForApp(user.email);
}

export function getFirebaseAccessBlockReason(user: User | null | undefined): string | null {
  if (!user || isLocalUser(user)) return null;

  if (!isEmailAllowedForApp(user.email)) {
    const hint = allowedEmailSuffixHint();
    return hint
      ? `Ten adres e-mail nie ma dostępu do synchronizacji. Dozwolone konta: ${hint}`
      : "Ten adres e-mail nie ma dostępu do synchronizacji.";
  }

  if (!user.emailVerified) {
    return "Potwierdź adres e-mail (link w wiadomości od Firebase), aby synchronizować dane wydarzenia.";
  }

  return null;
}
