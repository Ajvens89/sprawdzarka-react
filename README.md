# Sprawdzarka React + TypeScript

Migracja startowa z monolitycznego `index.html` do projektu React + TypeScript (Vite + Zustand).
Ten starter zachowuje:
- skaner EAN i kartę wyniku,
- listę produktów z filtrowaniem,
- stany magazynowe po wydarzeniu,
- moduł Bistro z KPI, edycją produktu i zakupami,
- eksport kopii JSON,
- eksport raportów XLSX,
- opcjonalne logowanie i synchronizację Firebase.

## Start

```bash
npm install
npm run dev
```

## Firebase

1. Skopiuj `.env.example` do `.env` (lub `.env.local`)
2. Uzupełnij wartości `VITE_FIREBASE_*`
3. Uruchom aplikację ponownie

Jeśli `.env` nie jest skonfigurowane, aplikacja działa lokalnie bez logowania.

### Wdrożenie na Firebase Hosting

Projekt: `sprawdzarkazf` · adres: https://sprawdzarkazf.web.app

```bash
npm install
npm run build          # wymaga .env z kluczami VITE_FIREBASE_*
firebase login
firebase deploy        # hosting + cloud function /api/price-check
```

Sekrety dla sprawdzania cen (Cloud Functions):

```bash
# PowerShell — wklej klucz z https://serpapi.com/manage-api-key
.\scripts\set-serpapi-secret.ps1 -ApiKey "TWOJ_KLUCZ_SERPAPI"
```

Alternatywnie ręcznie:

```bash
firebase functions:secrets:set SERPAPI_KEY
npm run deploy:functions
```

### Logowanie nie działa?

W [Google Cloud Console](https://console.cloud.google.com/apis/credentials) otwórz klucz API Firebase
i w **Ograniczenia aplikacji → Witryny HTTP** dodaj:

- `sprawdzarkazf.web.app`
- `sprawdzarkazf.firebaseapp.com`
- `localhost` (do developmentu)

Bez tego pojawia się błąd `auth/requests-from-referer-blocked`.

## Co jest już przeniesione

- baza produktów i bazowe stany z legacy HTML,
- logika filtrowania, sprawdzania EAN i weryfikacji stanów,
- logika Bistro (sprzedaż / zakupy / marża / KPI),
- zapis lokalny przez Zustand persist,
- eksport XLSX i JSON,
- szkielet synchronizacji Firebase.

## Co zostawiłem jako następny etap

- pełne mapowanie importu PDF z backendem `/api/parse-invoice`,
- import nowych produktów / nadpisywanie cen z modułu gier,
- 1:1 przeniesienie wszystkich widoków raportowych z legacy.

## Struktura

```txt
src/
  data/
  features/
  hooks/
  lib/
  store/
  styles/
  types/
```
