import React from "react";
import { useOrdersSync } from "../../hooks/useOrdersSync";
import { PageHeader } from "../../components/ui/PageHeader";
import { OrdersProductGrid } from "./OrdersProductGrid";
import { OrdersCart } from "./OrdersCart";

export function OrdersPage() {
  useOrdersSync();

  return (
    <div className="module-page orders-page">
      <PageHeader
        label="Sprzedaż"
        title="Kasa"
        description="Przyjmuj zamówienia i wysyłaj je do kolejki wydawania."
      />

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
