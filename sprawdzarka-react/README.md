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

1. Skopiuj `.env.example` do `.env`
2. Uzupełnij wartości `VITE_FIREBASE_*`
3. Uruchom aplikację ponownie

Jeśli `.env` nie jest skonfigurowane, aplikacja działa lokalnie bez logowania.

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
