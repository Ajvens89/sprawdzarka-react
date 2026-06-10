export type AppModuleId = "sprzedaz" | "ceny" | "raporty" | "ustawienia";

export type ModuleLink = {
  to: string;
  label: string;
  icon?: string;
  end?: boolean;
  /** Nagłówek sekcji w podmenu (np. Gry / Bistro) */
  section?: string;
};

export type AppModule = {
  id: AppModuleId;
  label: string;
  shortLabel: string;
  icon: string;
  basePath: string;
  links: ModuleLink[];
};

export const APP_MODULES: AppModule[] = [
  {
    id: "sprzedaz",
    label: "Sprzedaż",
    shortLabel: "Sprzedaż",
    icon: "🛒",
    basePath: "/sprzedaz",
    links: [
      { to: "/sprzedaz/skanuj", label: "Skanuj grę", icon: "🔍", section: "Gry" },
      { to: "/sprzedaz/produkty", label: "Lista produktów", icon: "📋" },
      { to: "/sprzedaz/inwentaryzacja", label: "Inwentaryzacja", icon: "📦" },
      { to: "/sprzedaz/bistro", label: "Bistro", icon: "🍿", section: "Bistro" },
      { to: "/sprzedaz/kasa", label: "Kasa", icon: "💳" },
      { to: "/sprzedaz/wydawanie", label: "Wydawanie", icon: "⚡" }
    ]
  },
  {
    id: "ceny",
    label: "Ceny i marże",
    shortLabel: "Ceny",
    icon: "💰",
    basePath: "/ceny",
    links: [
      { to: "/ceny/rynek", label: "Ceny rynkowe", icon: "🌐" },
      { to: "/ceny/koszty", label: "Koszty i marże", icon: "📊" },
      { to: "/ceny/import", label: "Import kosztów", icon: "📥" }
    ]
  },
  {
    id: "raporty",
    label: "Raporty",
    shortLabel: "Raporty",
    icon: "📊",
    basePath: "/raporty",
    links: [
      { to: "/raporty", label: "Przegląd", icon: "🗂️", end: true },
      { to: "/raporty/klient", label: "Raport dla klienta", icon: "📄" },
      { to: "/raporty/inwentaryzacja", label: "Eksport inwentaryzacji", icon: "📤" }
    ]
  },
  {
    id: "ustawienia",
    label: "Ustawienia",
    shortLabel: "Ustaw.",
    icon: "⚙",
    basePath: "/ustawienia",
    links: [{ to: "/ustawienia", label: "Ogólne", icon: "⚙", end: true }]
  }
];

export function findModuleByPath(pathname: string): AppModule | undefined {
  return APP_MODULES.find((module) => pathname === module.basePath || pathname.startsWith(`${module.basePath}/`));
}

export const LEGACY_ROUTE_REDIRECTS: Record<string, string> = {
  "/scanner": "/sprzedaz/skanuj",
  "/magazyn": "/sprzedaz/skanuj",
  "/magazyn/skanuj": "/sprzedaz/skanuj",
  "/magazyn/produkty": "/sprzedaz/produkty",
  "/magazyn/inwentaryzacja": "/sprzedaz/inwentaryzacja",
  "/bistro": "/sprzedaz/bistro",
  "/orders": "/sprzedaz/kasa",
  "/orders-display": "/sprzedaz/wydawanie",
  "/prices": "/ceny/rynek",
  "/admin": "/ceny/koszty",
  "/client-export": "/raporty/klient"
};
