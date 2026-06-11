import { afterEach, describe, expect, it, vi } from "vitest";
import {
  allowedEmailSuffixHint,
  canSyncWithFirebase,
  getFirebaseAccessBlockReason,
  isEmailAllowedForApp
} from "./authPolicy";

describe("isEmailAllowedForApp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("dopuszcza dowolny e-mail gdy suffix nie jest ustawiony", () => {
    vi.stubEnv("VITE_FIREBASE_ALLOWED_EMAIL_SUFFIX", "");
    expect(isEmailAllowedForApp("ktoś@example.com")).toBe(true);
  });

  it("filtruje po sufiksie domeny", () => {
    vi.stubEnv("VITE_FIREBASE_ALLOWED_EMAIL_SUFFIX", "@zf.pl");
    expect(isEmailAllowedForApp("volunteer@zf.pl")).toBe(true);
    expect(isEmailAllowedForApp("volunteer@gmail.com")).toBe(false);
  });
});

describe("allowedEmailSuffixHint", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("zwraca null bez konfiguracji", () => {
    vi.stubEnv("VITE_FIREBASE_ALLOWED_EMAIL_SUFFIX", "");
    expect(allowedEmailSuffixHint()).toBeNull();
  });
});

describe("canSyncWithFirebase", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("wymaga zweryfikowanego e-maila i dozwolonej domeny", () => {
    vi.stubEnv("VITE_FIREBASE_ALLOWED_EMAIL_SUFFIX", "@zf.pl");
    expect(
      canSyncWithFirebase({
        uid: "abc",
        email: "volunteer@zf.pl",
        emailVerified: true
      } as never)
    ).toBe(true);

    expect(
      canSyncWithFirebase({
        uid: "abc",
        email: "volunteer@zf.pl",
        emailVerified: false
      } as never)
    ).toBe(false);
  });

  it("ignoruje lokalnego użytkownika", () => {
    expect(canSyncWithFirebase({ uid: "local-user" } as never)).toBe(false);
  });
});

describe("getFirebaseAccessBlockReason", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("zwraca komunikat o weryfikacji e-maila", () => {
    expect(
      getFirebaseAccessBlockReason({
        uid: "abc",
        email: "volunteer@zf.pl",
        emailVerified: false
      } as never)
    ).toMatch(/Potwierdź adres e-mail/i);
  });
});
