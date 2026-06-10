import { useState } from "react";
import { Link } from "react-router-dom";
import { EVENT_DATE, EVENT_NAME } from "../../data/meta";
import { xlsxDownload } from "../../lib/export";
import { bistroCalcProduct } from "../../lib/bistro";
import { applyTheme, getStoredTheme, type AppTheme } from "../../lib/theme";
import { downloadJson, readJsonFile } from "../../lib/utils";
import { useAppStore } from "../../store/useAppStore";
import { exportClientExportSnapshot, importClientExportSnapshot } from "../../store/useClientExportStore";
import type { AppSnapshot } from "../../types/app";
import { useAuth } from "../auth/AuthProvider";
import { LoginScreen } from "../auth/LoginScreen";
import { PageHeader } from "../../components/ui/PageHeader";

export function SettingsPage(): JSX.Element {
  const { isFirebaseEnabled, logout, user } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(() => getStoredTheme());

  const saveStatus = useAppStore((state) => state.saveStatus);
  const saveLabel = useAppStore((state) => state.saveLabel);
  const connectionLabel = useAppStore((state) => state.connectionLabel);
  const exportSnapshot = useAppStore((state) => state.exportSnapshot);
  const importSnapshot = useAppStore((state) => state.importSnapshot);
  const resetInventory = useAppStore((state) => state.resetInventory);
  const resetBistro = useAppStore((state) => state.resetBistro);
  const bistroProducts = useAppStore((state) => state.bistroProducts);

  function exportBistroXlsx(): void {
    const rows: Array<Array<string | number>> = [
      ["Produkt", "Jednostka", "Porcja", "Cena porcji", "Sprzedano", "Przychód", "Zysk"]
    ];

    bistroProducts.forEach((product) => {
      const calc = bistroCalcProduct(product);
      rows.push([
        product.name,
        product.batchUnit,
        product.portionQty,
        product.portionPrice,
        product.soldQty,
        calc.revenue,
        calc.profit
      ]);
    });

    xlsxDownload(rows, "bistro.xlsx", "Bistro");
  }

  async function handleImport(file: File | null): Promise<void> {
    if (!file) return;

    if (
      !window.confirm(
        "Wczytanie kopii JSON nadpisze bieżące dane w tej przeglądarce. Kontynuować?"
      )
    ) {
      return;
    }

    try {
      const payload = await readJsonFile<AppSnapshot>(file);
      importSnapshot(payload);
      importClientExportSnapshot(payload.clientExport);
      window.alert(
        payload.clientExport
          ? "Wczytano kopię zapasową wraz ze szkicem eksportu klienta."
          : "Wczytano kopię zapasową."
      );
    } catch {
      window.alert("Nie udało się wczytać pliku JSON. Wybierz plik wyeksportowany z tej aplikacji.");
    }
  }

  function toggleTheme(): void {
    const next: AppTheme = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div className="settings-page">
      <PageHeader
        label="Ustawienia"
        title="Konfiguracja aplikacji"
        description="Logowanie, synchronizacja, kopia zapasowa i opcje wyglądu."
      />

      <section className="panel settings-section">
        <h2 className="settings-section__title">Wydarzenie</h2>
        <p className="settings-section__text">
          {EVENT_NAME} · {EVENT_DATE}
        </p>
      </section>

      <section className="panel settings-section">
        <h2 className="settings-section__title">Synchronizacja</h2>
        <div className="settings-sync-row">
          <div className={`save-dot ${saveStatus}`} />
          <span className={`save-label ${saveStatus}`}>{saveLabel}</span>
          <span className="settings-muted">{connectionLabel}</span>
        </div>

        {!isFirebaseEnabled ? (
          <div className="banner banner-warning settings-banner">
            Firebase nie jest skonfigurowane — aplikacja działa tylko lokalnie. Uzupełnij plik <code>.env</code>.
          </div>
        ) : null}

        {isFirebaseEnabled && !user ? (
          <div className="banner banner-warning settings-banner">
            Tryb lokalny — dane zapisują się tylko w tej przeglądarce. Zaloguj się, aby synchronizować koszty i stany.
          </div>
        ) : null}

        <div className="settings-actions">
          {isFirebaseEnabled && user ? (
            <button className="btn-ghost" type="button" onClick={() => void logout()}>
              Wyloguj ({user.email ?? "użytkownik"})
            </button>
          ) : null}
          {isFirebaseEnabled && !user ? (
            <button className="btn-search" type="button" onClick={() => setShowLogin(true)}>
              Zaloguj przez Firebase
            </button>
          ) : null}
        </div>
      </section>

      <section className="panel settings-section">
        <h2 className="settings-section__title">Wygląd</h2>
        <p className="settings-section__text">Domyślnie jasny motyw. Możesz włączyć tryb ciemny na targach wieczorem.</p>
        <button className={`btn-toggle${theme === "dark" ? " active" : ""}`} type="button" onClick={toggleTheme}>
          {theme === "dark" ? "Tryb ciemny (wł.)" : "Tryb ciemny (wył.)"}
        </button>
      </section>

      <section className="panel settings-section">
        <h2 className="settings-section__title">Kopia zapasowa</h2>
        <p className="settings-section__text">Pełny eksport danych aplikacji do pliku JSON.</p>
        <div className="settings-actions">
          <button
            className="btn-ghost"
            type="button"
            onClick={() =>
              downloadJson("sprawdzarka-backup.json", {
                ...exportSnapshot(),
                clientExport: exportClientExportSnapshot()
              })
            }
          >
            Pobierz kopię JSON
          </button>
          <label className="btn-ghost settings-file-btn">
            Wczytaj kopię JSON
            <input type="file" accept=".json,application/json" onChange={(event) => void handleImport(event.target.files?.[0] ?? null)} />
          </label>
        </div>
      </section>

      <section className="panel settings-section settings-section--technical">
        <h2 className="settings-section__title">Narzędzia techniczne</h2>
        <p className="settings-section__text">Operacje dla administratora — używaj ostrożnie.</p>
        <div className="settings-actions">
          <button
            className="btn-ghost"
            type="button"
            onClick={() => {
              if (window.confirm("Wyzerować liczniki inwentaryzacji?")) resetInventory();
            }}
          >
            Reset inwentaryzacji
          </button>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => {
              if (window.confirm("Wyzerować sprzedaż bistro?")) resetBistro();
            }}
          >
            Reset sprzedaży bistro
          </button>
          <button className="btn-ghost" type="button" onClick={exportBistroXlsx}>
            Eksport bistro XLSX
          </button>
          <Link className="btn-ghost" to="/sprzedaz/bistro">
            Moduł Bistro
          </Link>
        </div>
      </section>

      {showLogin && !user ? (
        <LoginScreen onSuccess={() => setShowLogin(false)} onClose={() => setShowLogin(false)} />
      ) : null}
    </div>
  );
}
