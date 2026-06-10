import { useState } from "react";
import { useAuth } from "./AuthProvider";

const ERRORS: Record<string, string> = {
  "auth/unauthorized-email": "Ten adres e-mail nie ma dostępu do danych wydarzenia.",
  "auth/user-not-found": "Nie znaleziono użytkownika.",
  "auth/user-disabled": "To konto jest zablokowane w Firebase.",
  "auth/wrong-password": "Błędne hasło.",
  "auth/invalid-credential": "Błędny e-mail lub hasło.",
  "auth/operation-not-allowed": "Logowanie e-mail/hasło jest wyłączone w Firebase.",
  "auth/invalid-api-key": "Klucz API Firebase jest nieprawidłowy.",
  "auth/app-not-authorized": "Ta domena aplikacji nie jest dopuszczona w konfiguracji Firebase.",
  "auth/too-many-requests": "Za dużo prób. Spróbuj za chwilę.",
  "auth/network-request-failed": "Brak połączenia z internetem."
};

function getAuthErrorMessage(err: unknown, fallback: string): string {
  const code = typeof err === "object" && err && "code" in err ? String((err as { code: string }).code) : "";
  const message = typeof err === "object" && err && "message" in err ? String((err as { message: string }).message) : "";

  if (code in ERRORS) return `${ERRORS[code]} (${code})`;
  if (code.includes("requests-from-referer") || message.includes("requests-from-referer")) {
    return "Klucz API Firebase blokuje tę domenę. Dodaj sprawdzarkazf.web.app w ograniczeniach klucza API. (auth/requests-from-referer-blocked)";
  }
  if (code) return `${fallback} (${code})`;
  return fallback;
}

export function LoginScreen({
  onSuccess,
  onClose
}: {
  onSuccess?: () => void;
  onClose?: () => void;
} = {}): JSX.Element {
  const { resetPassword, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  async function handleSubmit(): Promise<void> {
    if (!email.trim() || !password) {
      setError("Wpisz e-mail i hasło.");
      setNotice("");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      setNotice("");
      await signIn(email.trim(), password);
      onSuccess?.();
    } catch (err) {
      const hint =
        typeof err === "object" && err && "hint" in err && (err as { hint?: string }).hint
          ? ` Dozwolone konta: ${(err as { hint: string }).hint}`
          : "";
      setError(getAuthErrorMessage(err, "Nie udało się zalogować.") + hint);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordReset(): Promise<void> {
    if (!email.trim()) {
      setError("Wpisz e-mail, a wyślemy link do zmiany hasła.");
      setNotice("");
      return;
    }

    try {
      setIsResetting(true);
      setError("");
      setNotice("");
      await resetPassword(email.trim());
      setNotice("Wysłano link do zmiany hasła. Sprawdź skrzynkę e-mail.");
    } catch (err) {
      setError(getAuthErrorMessage(err, "Nie udało się wysłać linku resetującego hasło."));
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div
      className="login-overlay"
      style={{ display: "flex" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="login-panel">
        {onClose ? (
          <button
            type="button"
            className="login-link-btn"
            style={{ position: "absolute", top: "1rem", right: "1rem", margin: 0 }}
            onClick={onClose}
          >
            Zamknij
          </button>
        ) : null}
        <div className="login-badge">Panel dostępu</div>
        <h2 className="login-title">
          Zaloguj się do <span>Sprawdzarki</span>
        </h2>
        <p className="login-subtitle">Firebase Auth — dostęp do danych wydarzenia</p>

        <div className="login-fields">
          <div className="login-field">
            <label className="login-label" htmlFor="loginEmail">E-mail</label>
            <input
              id="loginEmail"
              className="login-input"
              type="email"
              autoComplete="email"
              placeholder="adres@email.pl"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleSubmit();
              }}
            />
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="loginPassword">Hasło</label>
            <input
              id="loginPassword"
              className="login-input"
              type="password"
              autoComplete="current-password"
              placeholder="********"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleSubmit();
              }}
            />
          </div>
        </div>

        <div
          className="login-error"
          style={{ display: error ? "block" : "none" }}
          role="alert"
        >
          {error}
        </div>

        <div
          className="login-notice"
          style={{ display: notice ? "block" : "none" }}
          role="status"
        >
          {notice}
        </div>

        <button
          className="login-btn"
          type="button"
          onClick={() => void handleSubmit()}
          disabled={isSubmitting || isResetting}
        >
          {isSubmitting ? "Logowanie..." : "Zaloguj się"}
        </button>

        <button
          className="login-link-btn"
          type="button"
          onClick={() => void handlePasswordReset()}
          disabled={isSubmitting || isResetting}
        >
          {isResetting ? "Wysyłam link..." : "Nie pamiętasz hasła?"}
        </button>
      </div>
    </div>
  );
}
