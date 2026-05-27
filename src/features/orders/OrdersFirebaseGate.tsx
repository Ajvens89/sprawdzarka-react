import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { database, isFirebaseConfigured } from "../../lib/firebase";
import { useAuth } from "../auth/AuthProvider";

export function OrdersFirebaseGate({ children }: { children: ReactNode }): JSX.Element {
  const { isFirebaseEnabled, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="orders-page orders-page--blocked">
        <div className="orders-blocked-panel">
          <h1>Ładowanie…</h1>
          <p>Sprawdzam połączenie z Firebase.</p>
        </div>
      </div>
    );
  }

  if (!isFirebaseConfigured || !isFirebaseEnabled || !database || !user || user.uid === "local-user") {
    return (
      <div className="orders-page orders-page--blocked">
        <div className="orders-blocked-panel">
          <h1>Kasa wymaga Firebase</h1>
          <p>
            Moduł zamówień działa tylko po zalogowaniu i synchronizacji z chmurą. Skonfiguruj plik{" "}
            <code>.env.local</code>, zaloguj się w głównej aplikacji i wróć tutaj.
          </p>
          <Link className="btn-search orders-blocked-link" to="/scanner">
            Przejdź do Sprawdzarki
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
