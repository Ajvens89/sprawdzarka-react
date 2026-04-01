import React from 'react';
import { useOrdersStore } from '../../store/useOrdersStore';
import { formatPrice } from './orders.utils';

export function OrdersCart() {
  const cartItems       = useOrdersStore((s) => s.cartItems);
  const cartNote        = useOrdersStore((s) => s.cartNote);
  const incrementItem   = useOrdersStore((s) => s.incrementCartItem);
  const decrementItem   = useOrdersStore((s) => s.decrementCartItem);
  const removeItem      = useOrdersStore((s) => s.removeCartItem);
  const setCartNote     = useOrdersStore((s) => s.setCartNote);
  const clearCart       = useOrdersStore((s) => s.clearCart);
  const submitOrder     = useOrdersStore((s) => s.submitOrder);

  const total = cartItems.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const isEmpty = cartItems.length === 0;

  const handleSubmit = async () => {
    if (isEmpty) return;
    await submitOrder();
  };

  return (
    <div className="orders-cart">
      <div className="cart-header">
        <h2 className="cart-title">Koszyk</h2>
        {!isEmpty && (
          <button className="cart-clear-btn" onClick={clearCart}>
            Wyczyść
          </button>
        )}
      </div>

      {isEmpty ? (
        <div className="cart-empty">
          <span>Brak produktów</span>
          <p>Kliknij produkt, aby dodać do zamówienia</p>
        </div>
      ) : (
        <>
          <ul className="cart-items">
            {cartItems.map((item) => (
              <li key={item.id} className="cart-item">
                <div className="cart-item-info">
                  <span className="cart-item-name">{item.name}</span>
                  <span className="cart-item-unit">{item.unitPrice} zł / szt.</span>
                </div>
                <div className="cart-item-controls">
                  <button
                    className="qty-btn"
                    onClick={() => decrementItem(item.id)}
                  >−</button>
                  <span className="qty-value">{item.qty}</span>
                  <button
                    className="qty-btn"
                    onClick={() => incrementItem(item.id)}
                  >+</button>
                  <button
                    className="remove-btn"
                    onClick={() => removeItem(item.id)}
                  >✕</button>
                </div>
                <span className="cart-item-total">
                  {formatPrice(item.qty * item.unitPrice)}
                </span>
              </li>
            ))}
          </ul>

          <div className="cart-note-section">
            <label className="cart-note-label">Notatka</label>
            <textarea
              className="cart-note-input"
              placeholder="np. bez cebuli, alergia na gluten..."
              value={cartNote}
              onChange={(e) => setCartNote(e.target.value)}
              rows={2}
            />
          </div>

          <div className="cart-footer">
            <div className="cart-total">
              <span>Suma</span>
              <strong>{formatPrice(total)}</strong>
            </div>
            <button
              className="submit-btn"
              onClick={handleSubmit}
            >
              Wyślij zamówienie
            </button>
          </div>
        </>
      )}
    </div>
  );
}
