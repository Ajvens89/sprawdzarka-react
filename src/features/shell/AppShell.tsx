import { useState } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { EVENT_DATE, EVENT_NAME } from "../../data/meta";
import { LEGACY_ROUTE_REDIRECTS } from "../../navigation/modules";
import { useAppStore } from "../../store/useAppStore";
import { useAuth } from "../auth/AuthProvider";
import { BistroPage } from "../bistro/BistroPage";
import { ClientExportPage } from "../client-export/ClientExportPage";
import { OrdersDisplayPage } from "../orders/OrdersDisplayPage";
import { OrdersFirebaseGate } from "../orders/OrdersFirebaseGate";
import { OrdersPage } from "../orders/OrdersPage";
import { CostsMarginPage } from "../pricing/CostsMarginPage";
import { MarketPricesPage } from "../pricing/MarketPricesPage";
import { PricingImportPage } from "../pricing/PricingImportPage";
import { InventoryPage } from "../scanner/InventoryPage";
import { ProductsPage } from "../scanner/ProductsPage";
import { ScannerPage } from "../scanner/ScannerPage";
import { InventoryReportPage } from "../reports/InventoryReportPage";
import { ReportsHubPage } from "../reports/ReportsHubPage";
import { SettingsPage } from "../settings/SettingsPage";
import { LegacyMagazynRedirect } from "./LegacyMagazynRedirect";
import { HelpPanel, ModuleNav } from "./ModuleNav";
import { NotFoundPage } from "./NotFoundPage";

export function AppShell(): JSX.Element {
  const { isFirebaseEnabled, user } = useAuth();
  const saveStatus = useAppStore((state) => state.saveStatus);
  const saveLabel = useAppStore((state) => state.saveLabel);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  function closeMobileNav(): void {
    setMobileNavOpen(false);
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-topbar__left">
          <button
            className="app-topbar__menu-btn"
            type="button"
            aria-label={mobileNavOpen ? "Zamknij menu" : "Otwórz menu"}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            ☰
          </button>
          <div className="app-topbar__brand">
            <strong className="app-topbar__title">Sprawdzarka ZF</strong>
            <span className="app-topbar__context">
              {EVENT_NAME} · {EVENT_DATE}
            </span>
          </div>
        </div>

        <div className="app-topbar__actions">
          <nav className="app-topbar__shortcuts" aria-label="Skróty">
            <Link className="app-topbar__shortcut" to="/sprzedaz/skanuj" title="Start — skanuj grę">
              <span aria-hidden="true">🏠</span>
              <span className="app-topbar__shortcut-label">Start</span>
            </Link>
            <Link className="app-topbar__shortcut" to="/ustawienia" title="Ustawienia i synchronizacja">
              <span aria-hidden="true">⚙</span>
              <span className="app-topbar__shortcut-label">Sync</span>
            </Link>
            <button
              className="app-topbar__shortcut"
              type="button"
              title="Szybka pomoc"
              onClick={() => setHelpOpen(true)}
            >
              <span aria-hidden="true">?</span>
              <span className="app-topbar__shortcut-label">Pomoc</span>
            </button>
          </nav>

          <div className="app-topbar__status">
            <div className={`save-dot ${saveStatus}`} />
            <span className={`save-label ${saveStatus}`}>{saveLabel}</span>
          </div>
        </div>
      </header>

      {isFirebaseEnabled && !user ? (
        <div className="banner banner-warning app-local-banner" role="status">
          Tryb lokalny — dane tylko w tej przeglądarce.{" "}
          <Link to="/ustawienia">Zaloguj w Ustawieniach</Link>, aby synchronizować.
        </div>
      ) : null}

      {mobileNavOpen ? (
        <button
          className="app-nav-overlay"
          type="button"
          aria-label="Zamknij menu"
          onClick={closeMobileNav}
        />
      ) : null}

      <div className="app-layout">
        <ModuleNav variant="sidebar" mobileOpen={mobileNavOpen} onNavigate={closeMobileNav} />

        <div className="app-content">
          <ModuleNav variant="sub" />

          <main className="app-main container bistro-wide">
            <Routes>
              <Route path="/" element={<Navigate to="/sprzedaz/skanuj" replace />} />

              <Route path="/sprzedaz/skanuj" element={<ScannerPage />} />
              <Route path="/sprzedaz/inwentaryzacja" element={<InventoryPage />} />
              <Route path="/sprzedaz/produkty" element={<ProductsPage />} />

              <Route path="/sprzedaz/bistro" element={<BistroPage />} />
              <Route
                path="/sprzedaz/kasa"
                element={
                  <OrdersFirebaseGate>
                    <OrdersPage />
                  </OrdersFirebaseGate>
                }
              />
              <Route
                path="/sprzedaz/wydawanie"
                element={
                  <OrdersFirebaseGate>
                    <OrdersDisplayPage />
                  </OrdersFirebaseGate>
                }
              />

              <Route path="/ceny/rynek" element={<MarketPricesPage />} />
              <Route path="/ceny/koszty" element={<CostsMarginPage />} />
              <Route path="/ceny/import" element={<PricingImportPage />} />

              <Route path="/raporty" element={<ReportsHubPage />} />
              <Route path="/raporty/klient" element={<ClientExportPage />} />
              <Route path="/raporty/inwentaryzacja" element={<InventoryReportPage />} />

              <Route path="/ustawienia" element={<SettingsPage />} />

              {Object.entries(LEGACY_ROUTE_REDIRECTS).map(([from, to]) => (
                <Route key={from} path={from} element={<Navigate to={to} replace />} />
              ))}

              <Route path="/magazyn/*" element={<LegacyMagazynRedirect />} />

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
        </div>
      </div>

      <ModuleNav variant="bottom" />

      {helpOpen ? <HelpPanel onClose={() => setHelpOpen(false)} /> : null}
    </div>
  );
}
