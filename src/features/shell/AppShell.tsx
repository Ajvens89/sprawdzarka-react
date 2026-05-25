import { useState } from "react";
import { NavLink, Route, Routes, Navigate } from "react-router-dom";
import { EVENT_DATE, EVENT_NAME } from "../../data/meta";
import { downloadJson, readJsonFile } from "../../lib/utils";
import { useAppStore } from "../../store/useAppStore";
import type { AppSnapshot } from "../../types/app";
import { useAuth } from "../auth/AuthProvider";
import { LoginScreen } from "../auth/LoginScreen";
import { BistroPage } from "../bistro/BistroPage";
import { PriceAdvisorPage } from "../prices/PriceAdvisorPage";
import { ScannerPage } from "../scanner/ScannerPage";

export function AppShell(): JSX.Element {
  const { isFirebaseEnabled, logout, user } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  const saveStatus = useAppStore((state) => state.saveStatus);
  const saveLabel = useAppStore((state) => state.saveLabel);
  const connectionLabel = useAppStore((state) => state.connectionLabel);
  const exportSnapshot = useAppStore((state) => state.exportSnapshot);
  const importSnapshot = useAppStore((state) => state.importSnapshot);

  async function handleImport(file: File | null): Promise<void> {
    if (!file) return;
    const payload = await readJsonFile<AppSnapshot>(file);
    importSnapshot(payload);
  }

  return (
    <div className="container bistro-wide">
      <div className="topbar">
        <div className="topbar-left">
          <nav role="tablist" aria-label="Sekcje aplikacji" style={{ display: "flex" }}>
            <NavLink
              to="/scanner"
              className={({ isActive }) => `tab-btn${isActive ? " active" : ""}`}
            >
              Sprawdzarka
            </NavLink>

            <NavLink
              to="/bistro"
              className={({ isActive }) => `tab-btn${isActive ? " active" : ""}`}
            >
              Bistro
            </NavLink>

            <NavLink
              to="/prices"
              className={({ isActive }) => `tab-btn${isActive ? " active" : ""}`}
            >
              Ceny
            </NavLink>

            <NavLink
              to="/orders"
              className={({ isActive }) => `tab-btn${isActive ? " active" : ""}`}
            >
              Kasa
            </NavLink>

            <NavLink
              to="/orders-display"
              className={({ isActive }) => `tab-btn${isActive ? " active" : ""}`}
            >
              Wydawanie
            </NavLink>
          </nav>

          <span className="topbar-context">
            {EVENT_NAME} · {EVENT_DATE}
          </span>
        </div>

        <div className="topbar-center">
          <div className={`save-dot ${saveStatus}`}></div>
          <span className={`save-label ${saveStatus}`}>{saveLabel}</span>
          <span id="fbConnStatus">{connectionLabel}</span>
        </div>

        <div className="topbar-right">
          <button
            className="btn-ghost gsb-btn"
            type="button"
            onClick={() => downloadJson("sprawdzarka-backup.json", exportSnapshot())}
          >
            Kopia JSON
          </button>

          <label
            className="btn-ghost gsb-btn"
            style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}
          >
            Wczytaj
            <input
              type="file"
              accept=".json,application/json"
              style={{ display: "none" }}
              onChange={(event) => void handleImport(event.target.files?.[0] ?? null)}
            />
          </label>

          {isFirebaseEnabled && user ? (
            <button className="tab-btn tab-btn--logout" type="button" onClick={() => void logout()}>
              Wyloguj
            </button>
          ) : null}

          {isFirebaseEnabled && !user ? (
            <button className="tab-btn" type="button" onClick={() => setShowLogin(true)}>
              Zaloguj
            </button>
          ) : null}
        </div>
      </div>

      {isFirebaseEnabled && !user ? (
        <div className="banner banner-warning" style={{ marginBottom: "1rem" }}>
          <strong>Tryb lokalny</strong> — dane zapisują się tylko w tej przeglądarce. Kliknij{" "}
          <button
            type="button"
            className="btn-ghost gsb-btn"
            style={{ display: "inline-flex", marginLeft: ".35rem" }}
            onClick={() => setShowLogin(true)}
          >
            Zaloguj
          </button>
          , aby synchronizować dane przez Firebase.
        </div>
      ) : null}

      {showLogin && !user ? (
        <LoginScreen onSuccess={() => setShowLogin(false)} onClose={() => setShowLogin(false)} />
      ) : null}

      {!isFirebaseEnabled ? (
        <div className="banner banner-warning" style={{ marginBottom: "1rem" }}>
          <strong>Firebase nie skonfigurowane</strong> — aplikacja działa lokalnie w tej
          przeglądarce. Uzupełnij plik{" "}
          <code
            style={{
              background: "rgba(255,255,255,0.08)",
              padding: ".1rem .3rem",
              borderRadius: "4px"
            }}
          >
            .env
          </code>
          , aby włączyć logowanie i synchronizację.
        </div>
      ) : null}

      <Routes>
        <Route path="/" element={<Navigate to="/scanner" replace />} />
        <Route path="/scanner" element={<ScannerPage />} />
        <Route path="/bistro" element={<BistroPage />} />
        <Route path="/prices" element={<PriceAdvisorPage />} />
      </Routes>
    </div>
  );
}
