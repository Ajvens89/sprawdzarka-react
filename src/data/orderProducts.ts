/**
 * orderProducts.ts
 *
 * Produkty widoczne w kasie (/orders).
 * Pole bistroProductId musi być DOKŁADNIE równe BistroProduct.id z bistroDefaults.ts.
 *
 * Aktualne ID Bistro:
 *   b1  Popcorn słony
 *   b2  Popcorn słodki
 *   b3  Frytki małe
 *   b4  Frytki duże
 *   b5  Hot dog
 *   b6  Zapiekanka
 *   b7  Napój (0,5 l)
 *   b8  Kawa
 *   b9  Herbata
 *   b10 Woda (0,5 l)
 *   b11 Wata cukrowa  ← dodaj do bistroDefaults.ts!
 */

export interface OrderProduct {
  id: string;
  name: string;
  unitPrice: number;
  category: string;
  emoji: string;
  /**
   * ID produktu z BistroProduct.id (useAppStore → bistroProducts).
   * null = nie liczyć w Bistro.
   */
  bistroProductId: string | null;
}

export const ORDER_PRODUCTS: OrderProduct[] = [
  // ── Popcorn ──────────────────────────────────────────────────────────────
  { id: 'p1', name: 'Popcorn słony',   unitPrice: 7,  category: 'Popcorn',  emoji: '🍿', bistroProductId: 'b1' },
  { id: 'p2', name: 'Popcorn słodki',  unitPrice: 7,  category: 'Popcorn',  emoji: '🍿', bistroProductId: 'b2' },
  { id: 'p11', name: 'Wata cukrowa',   unitPrice: 8,  category: 'Popcorn',  emoji: '🩷', bistroProductId: 'b11' },

  // ── Przekąski ─────────────────────────────────────────────────────────────
  { id: 'p3', name: 'Frytki małe',     unitPrice: 9,  category: 'Przekąski', emoji: '🍟', bistroProductId: 'b3' },
  { id: 'p4', name: 'Frytki duże',     unitPrice: 14, category: 'Przekąski', emoji: '🍟', bistroProductId: 'b4' },
  { id: 'p5', name: 'Hot dog',         unitPrice: 12, category: 'Przekąski', emoji: '🌭', bistroProductId: 'b5' },
  { id: 'p6', name: 'Zapiekanka',      unitPrice: 14, category: 'Przekąski', emoji: '🥖', bistroProductId: 'b6' },

  // ── Napoje ────────────────────────────────────────────────────────────────
  { id: 'p7',  name: 'Napój 0,5 l',   unitPrice: 5,  category: 'Napoje',   emoji: '🥤', bistroProductId: 'b7'  },
  { id: 'p8',  name: 'Kawa',          unitPrice: 6,  category: 'Napoje',   emoji: '☕', bistroProductId: 'b8'  },
  { id: 'p9',  name: 'Herbata',       unitPrice: 4,  category: 'Napoje',   emoji: '🍵', bistroProductId: 'b9'  },
  { id: 'p10', name: 'Woda 0,5 l',    unitPrice: 3,  category: 'Napoje',   emoji: '💧', bistroProductId: 'b10' },
];

export const CATEGORIES = [...new Set(ORDER_PRODUCTS.map(p => p.category))];

/**
 * Szybki lookup: orderProduct.id → bistroProductId
 * Zawiera tylko produkty z niepustym bistroProductId.
 */
export const ORDER_TO_BISTRO_MAP: Map<string, string> = new Map(
  ORDER_PRODUCTS
    .filter((p): p is OrderProduct & { bistroProductId: string } => p.bistroProductId !== null)
    .map(p => [p.id, p.bistroProductId])
);
