import { useState } from "react";
import { useAuth } from "./AuthProvider";

const ERRORS: Record<string, string> = {
  "auth/invalid-email": "Nieprawidłowy format e-maila.",
  "auth/user-not-found": "Nie znaleziono użytkownika.",
  "auth/wrong-password": "Błędne hasło.",
  "auth/invalid-credential": "Błędny e-mail lub hasło.",
  "auth/too-many-requests": "Za dużo prób. Spróbuj za chwilę.",
  "auth/network-request-failed": "Brak połączenia z internetem."
};

export function LoginScreen(): JSX.Element {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(): Promise<void> {
    if (!email.trim() || !password) {
      setError("Wpisz e-mail i hasło.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError("");
      await signIn(email.trim(), password);
    } catch (err) {
      const code = typeof err === "object" && err && "code" in err ? String((err as { code: string }).code) : "";
      setError(ERRORS[code] || "Nie udało się zalogować.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-overlay" style={{ display: "flex" }}>
      <div className="login-panel">
        <div className="login-badge">Panel dostępu</div>
        <h2 className="login-title">
          Zaloguj się do <span>Sprawdzarki</span>
        </h2>
        <p className="login-subtitle">Firebase Auth · dostęp do danych wydarzenia</p>

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
                if (event.key === "Enter") handleSubmit();
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
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSubmit();
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

        <button
          className="login-btn"
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Logowanie…" : "Zaloguj się"}
        </button>
      </div>
    </div>
  );
}
