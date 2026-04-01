import type { BistroProduct } from '../types/app';

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
    "id": "b2",
    "name": "Popcorn słodki",
    "batchUnit": "g",
    "portionQty": 100,
    "portionPrice": 7.0,
    "soldQty": 0,
    "purchases": []
  },
  {
    "id": "b3",
    "name": "Frytki małe",
    "batchUnit": "g",
    "portionQty": 150,
    "portionPrice": 9.0,
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
    "id": "b5",
    "name": "Hot dog",
    "batchUnit": "szt",
    "portionQty": 1,
    "portionPrice": 12.0,
    "soldQty": 0,
    "purchases": []
  },
  {
    "id": "b6",
    "name": "Zapiekanka",
    "batchUnit": "szt",
    "portionQty": 1,
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
    "id": "b8",
    "name": "Kawa",
    "batchUnit": "g",
    "portionQty": 8,
    "portionPrice": 6.0,
    "soldQty": 0,
    "purchases": []
  },
  {
    "id": "b9",
    "name": "Herbata",
    "batchUnit": "szt",
    "portionQty": 1,
    "portionPrice": 4.0,
    "soldQty": 0,
    "purchases": []
  },
  {
    "id": "b10",
    "name": "Woda (0,5 l)",
    "batchUnit": "szt",
    "portionQty": 1,
    "portionPrice": 3.0,
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
}
];

export const BISTRO_UNITS = ['g', 'kg', 'ml', 'l', 'szt'] as const;
