import { afterEach, describe, expect, it, vi } from "vitest";
import { allowedEmailSuffixHint, isEmailAllowedForApp } from "./authPolicy";

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
