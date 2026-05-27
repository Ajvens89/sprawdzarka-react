/**
 * orderProducts.ts
 *
 * Produkty widoczne w kasie (/orders).
 * Pole bistroProductId musi być DOKŁADNIE równe BistroProduct.id z bistroDefaults.ts.
 *
 * Aktualne ID Bistro:
 *   b1  Popcorn słony
 *   b4  Frytki duże
 *   b7  Napój (0,5 l)
 *   b11 Wata cukrowa
 *   b12 Zakręcony ziemniak
 *   b13 Bubble tea
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
  { id: 'p1', name: 'Popcorn słony', unitPrice: 7, category: 'Popcorn', emoji: '🍿', bistroProductId: 'b1' },
  { id: 'p11', name: 'Wata cukrowa', unitPrice: 8, category: 'Popcorn', emoji: '🩷', bistroProductId: 'b11' },

  // ── Przekąski ─────────────────────────────────────────────────────────────
  { id: 'p4', name: 'Frytki duże', unitPrice: 14, category: 'Przekąski', emoji: '🍟', bistroProductId: 'b4' },
  { id: 'p12', name: 'Zakręcony ziemniak', unitPrice: 12, category: 'Przekąski', emoji: '🥔', bistroProductId: 'b12' },

  // ── Napoje ────────────────────────────────────────────────────────────────
  { id: 'p7', name: 'Napój 0,5 l', unitPrice: 5, category: 'Napoje', emoji: '🥤', bistroProductId: 'b7' },
  { id: 'p13', name: 'Bubble tea', unitPrice: 16, category: 'Napoje', emoji: '🧋', bistroProductId: 'b13' },
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
