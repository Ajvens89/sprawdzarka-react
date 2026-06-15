import type { User } from "firebase/auth";

/** Kontakt do ręcznego zatwierdzania kont wolontariuszy. */
export const ACCOUNT_APPROVAL_EMAIL = "fundacja@zakatekfantastyki.pl";

export function accountApprovalRequestMessage(): string {
  return `Wyślij prośbę o zatwierdzenie konta na ${ACCOUNT_APPROVAL_EMAIL}, aby korzystać z synchronizacji i cen online.`;
}

/** Opcjonalny suffix e-maila (np. @zf.pl) — ustaw w VITE_FIREBASE_ALLOWED_EMAIL_SUFFIX */
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

/** Wymaga zweryfikowanego e-maila + opcjonalnego suffixu (musi być zgodny z regułami RTDB). */
export function canSyncWithFirebase(user: User | null | undefined): boolean {
  if (!user || isLocalUser(user)) return false;
  if (!user.emailVerified) return false;
  return isEmailAllowedForApp(user.email);
}

export function getFirebaseAccessBlockReason(user: User | null | undefined): string | null {
  if (!user || isLocalUser(user)) return null;

  if (!isEmailAllowedForApp(user.email)) {
    return accountApprovalRequestMessage();
  }

  if (!user.emailVerified) {
    return `Potwierdź adres e-mail (link w wiadomości od Firebase). ${accountApprovalRequestMessage()}`;
  }

  return null;
}
