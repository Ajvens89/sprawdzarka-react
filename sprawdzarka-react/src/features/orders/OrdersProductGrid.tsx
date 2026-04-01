import React, { useState } from 'react';
import { ORDER_PRODUCTS, CATEGORIES } from '../../data/orderProducts';
import { useOrdersStore } from '../../store/useOrdersStore';

export function OrdersProductGrid() {
  const addToCart = useOrdersStore((s) => s.addToCart);
  const [activeCategory, setActiveCategory] = useState<string>('Wszystkie');

  const categories = ['Wszystkie', ...CATEGORIES];
  const filtered =
    activeCategory === 'Wszystkie'
      ? ORDER_PRODUCTS
      : ORDER_PRODUCTS.filter((p) => p.category === activeCategory);

  return (
    <div className="orders-product-grid">
      {/* Filtry kategorii */}
      <div className="category-tabs">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`cat-tab ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Siatka produktów */}
      <div className="product-grid">
        {filtered.map((product) => (
          <button
            key={product.id}
            className="product-tile"
            onClick={() => addToCart(product)}
          >
            <span className="product-emoji">{product.emoji}</span>
            <span className="product-name">{product.name}</span>
            <span className="product-price">{product.unitPrice} zł</span>
          </button>
        ))}
      </div>
    </div>
  );
}
