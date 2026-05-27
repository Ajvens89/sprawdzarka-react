import { Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./features/auth/AuthProvider";
import { AppShell } from "./features/shell/AppShell";
import { useFirebaseSync } from "./hooks/useFirebaseSync";
import { useLocalSaveFeedback } from "./hooks/useLocalSaveFeedback";

function AppSyncEffects(): null {
  const { isFirebaseEnabled, user } = useAuth();

  useFirebaseSync(Boolean(isFirebaseEnabled && user));
  useLocalSaveFeedback();

  return null;
}

function AppContent(): JSX.Element {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="login-overlay" style={{ display: "flex" }}>
        <div className="login-panel">
          <div className="login-badge">Ładowanie</div>
          <h2 className="login-title">Uruchamianie aplikacji…</h2>
          <p className="login-subtitle">Sprawdzam konfigurację i sesję użytkownika</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppSyncEffects />

      <Routes>
        <Route path="*" element={<AppShell />} />
      </Routes>
    </>
  );
}

export default function App(): JSX.Element {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
