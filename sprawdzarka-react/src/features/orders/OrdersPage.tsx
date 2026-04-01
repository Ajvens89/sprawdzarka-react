import React from 'react';
import { useOrdersSync } from '../../hooks/useOrdersSync';
import { OrdersProductGrid } from './OrdersProductGrid';
import { OrdersCart } from './OrdersCart';

export function OrdersPage() {
  useOrdersSync();

  return (
    <div className="orders-page">
      <header className="orders-page-header">
        <h1 className="orders-page-title">
          <span className="orders-title-accent">☑</span> Kasa
        </h1>
      </header>

      <div className="orders-page-body">
        <div className="orders-grid-section">
          <OrdersProductGrid />
        </div>
        <aside className="orders-cart-section">
          <OrdersCart />
        </aside>
      </div>
    </div>
  );
}
