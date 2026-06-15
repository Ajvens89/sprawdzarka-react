import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

if (getApps().length === 0) {
  initializeApp();
}

function normalizeSuffix(raw) {
  const suffix = String(raw ?? "").trim();
  if (!suffix) return "";
  return suffix.startsWith("@") ? suffix.toLowerCase() : `@${suffix.toLowerCase()}`;
}

function getAllowedEmailSuffix() {
  return normalizeSuffix(process.env.ALLOWED_EMAIL_SUFFIX ?? "@zf.pl");
}

export function isEmailAllowedForSync(email) {
  const suffix = getAllowedEmailSuffix();
  if (!suffix) return true;
  const normalized = String(email ?? "").trim().toLowerCase();
  return normalized.endsWith(suffix);
}

export async function verifyPriceCheckAuth(req) {
  const header = String(req.headers.authorization ?? "");
  if (!header.startsWith("Bearer ")) {
    return {
      ok: false,
      status: 401,
      payload: {
        ok: false,
        price: null,
        source: "",
        message: "Zaloguj się, aby sprawdzić cenę online."
      }
    };
  }

  try {
    const decoded = await getAuth().verifyIdToken(header.slice(7));

    if (!decoded.email_verified) {
      return {
        ok: false,
        status: 403,
        payload: {
          ok: false,
          price: null,
          source: "",
          message: "Potwierdź adres e-mail, aby sprawdzić cenę online."
        }
      };
    }

    if (!isEmailAllowedForSync(decoded.email)) {
      return {
        ok: false,
        status: 403,
        payload: {
          ok: false,
          price: null,
          source: "",
          message: "To konto nie ma dostępu do sprawdzania cen online."
        }
      };
    }

    return { ok: true, uid: decoded.uid };
  } catch {
    return {
      ok: false,
      status: 401,
      payload: {
        ok: false,
        price: null,
        source: "",
        message: "Sesja wygasła. Zaloguj się ponownie."
      }
    };
  }
}
