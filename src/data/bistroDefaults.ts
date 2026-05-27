import type { BistroProduct } from '../types/app';

/** Produkty wycofane z menu — filtrowane przy wczytywaniu starych danych. */
export const REMOVED_BISTRO_PRODUCT_IDS = new Set([
  'b2',
  'b3',
  'b5',
  'b6',
  'b8',
  'b9',
  'b10'
]);

export const BISTRO_DEFAULTS: BistroProduct[] = [
  {
    "id": "b1",
    "name": "Popcorn słony",
    "batchUnit": "g",
    "portionQty": 100,
    "portionPrice": 7.0,
    "soldQty": 0,
    "purchases": []
  },
  {
    "id": "b4",
    "name": "Frytki duże",
    "batchUnit": "g",
    "portionQty": 300,
    "portionPrice": 14.0,
    "soldQty": 0,
    "purchases": []
  },
  {
    "id": "b7",
    "name": "Napój (0,5 l)",
    "batchUnit": "szt",
    "portionQty": 1,
    "portionPrice": 5.0,
    "soldQty": 0,
    "purchases": []
  },
  {
    "id": "b11",
    "name": "Wata cukrowa",
    "batchUnit": "szt",
    "portionQty": 1,
    "portionPrice": 8.0,
    "soldQty": 0,
    "purchases": []
  },
  {
    "id": "b12",
    "name": "Zakręcony ziemniak",
    "batchUnit": "szt",
    "portionQty": 1,
    "portionPrice": 12.0,
    "soldQty": 0,
    "purchases": []
  },
  {
    "id": "b13",
    "name": "Bubble tea",
    "batchUnit": "szt",
    "portionQty": 1,
    "portionPrice": 16.0,
    "soldQty": 0,
    "purchases": []
  }
];

export const BISTRO_UNITS = ['g', 'kg', 'ml', 'l', 'szt'] as const;