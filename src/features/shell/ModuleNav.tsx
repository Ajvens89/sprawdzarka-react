import { NavLink, useLocation } from "react-router-dom";
import { APP_MODULES, findModuleByPath } from "../../navigation/modules";

function SubLinkIcon({ icon }: { icon?: string }): JSX.Element | null {
  if (!icon) return null;
  return (
    <span className="module-nav__sub-icon" aria-hidden="true">
      {icon}
    </span>
  );
}

export function ModuleNav({
  variant,
  mobileOpen = false,
  onNavigate
}: {
  variant: "sidebar" | "bottom" | "sub";
  mobileOpen?: boolean;
  onNavigate?: () => void;
}): JSX.Element | null {
  const { pathname } = useLocation();
  const activeModule = findModuleByPath(pathname) ?? APP_MODULES[0];

  if (variant === "bottom") {
    return (
      <nav className="module-nav module-nav--bottom" aria-label="Moduły aplikacji">
        {APP_MODULES.map((module) => (
          <NavLink
            key={module.id}
            to={module.links[0]?.to ?? module.basePath}
            className={({ isActive }) =>
              `module-nav__bottom-item${isActive || pathname.startsWith(module.basePath) ? " active" : ""}`
            }
          >
            <span className="module-nav__icon" aria-hidden="true">
              {module.icon}
            </span>
            <span className="module-nav__label">{module.shortLabel}</span>
          </NavLink>
        ))}
      </nav>
    );
  }

  if (variant === "sidebar") {
    return (
      <nav
        className={`module-nav module-nav--sidebar${mobileOpen ? " is-open" : ""}`}
        aria-label="Moduły aplikacji"
      >
        {APP_MODULES.map((module) => {
          const isModuleActive = pathname.startsWith(module.basePath);
          return (
            <div key={module.id} className={`module-nav__group${isModuleActive ? " active" : ""}`}>
              <NavLink
                to={module.links[0]?.to ?? module.basePath}
                className={() => `module-nav__module${isModuleActive ? " active" : ""}`}
                onClick={onNavigate}
              >
                <span className="module-nav__icon" aria-hidden="true">
                  {module.icon}
                </span>
                <span>{module.label}</span>
              </NavLink>
              {isModuleActive && module.links.length > 1 ? (
                <div className="module-nav__sub">
                  {module.links.map((link, index) => {
                    const prevSection = index > 0 ? module.links[index - 1].section : undefined;
                    const showSection = link.section && link.section !== prevSection;

                    return (
                      <div key={link.to} className="module-nav__sub-block">
                        {showSection ? (
                          <span className="module-nav__sub-heading">{link.section}</span>
                        ) : null}
                        <NavLink
                          to={link.to}
                          end={link.end}
                          className={({ isActive }) => `module-nav__sub-link${isActive ? " active" : ""}`}
                          onClick={onNavigate}
                        >
                          <SubLinkIcon icon={link.icon} />
                          <span>{link.label}</span>
                        </NavLink>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    );
  }

  if (variant === "sub" && activeModule.links.length > 1) {
    return (
      <nav className="module-nav module-nav--sub" aria-label={`Podmenu: ${activeModule.label}`}>
        {activeModule.links.map((link, index) => {
          const prevSection = index > 0 ? activeModule.links[index - 1].section : undefined;
          const showSection = link.section && link.section !== prevSection;

          return (
            <div key={link.to} className="module-nav__sub-pill-wrap">
              {showSection ? <span className="module-nav__sub-pill-heading">{link.section}</span> : null}
              <NavLink
                to={link.to}
                end={link.end}
                className={({ isActive }) => `module-nav__sub-pill${isActive ? " active" : ""}`}
              >
                <SubLinkIcon icon={link.icon} />
                {link.label}
              </NavLink>
            </div>
          );
        })}
      </nav>
    );
  }

  return null;
}

export function HelpPanel({ onClose }: { onClose: () => void }): JSX.Element {
  return (
    <div className="report-modal" role="dialog" aria-modal="true" aria-labelledby="help-panel-title" onClick={onClose}>
      <div className="report-modal-box help-panel" onClick={(event) => event.stopPropagation()}>
        <div className="report-modal-header">
          <h2 className="report-modal-title" id="help-panel-title">
            Szybka pomoc
          </h2>
          <button className="report-close" type="button" onClick={onClose} aria-label="Zamknij">
            ✕
          </button>
        </div>
        <div className="ui-modal-body help-panel__body">
          <p><strong>Sprzedaż → Skanuj grę</strong> — wpisz lub zeskanuj EAN planszówki.</p>
          <p><strong>Ceny rynkowe</strong> — status „Brak danych”? Kliknij „Szczegóły” i uzupełnij cenę online.</p>
          <p><strong>Koszty i marże</strong> — włącz „Konsola handlowa”, aby widzieć tylko stan, zakup i marżę.</p>
          <p><strong>Import kosztów</strong> — pobierz szablon Excel, wypełnij EAN + netto + VAT, załaduj plik.</p>
          <p><strong>Ustawienia</strong> — logowanie Firebase, kopia JSON, tryb ciemny.</p>
        </div>
      </div>
    </div>
  );
}
