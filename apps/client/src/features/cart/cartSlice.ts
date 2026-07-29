import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { type CartItem, MAX_CART_ITEMS, MAX_ITEM_QUANTITY } from '@shoe-shop/shared';

/**
 * The cart.
 *
 * A plain slice, deliberately not RTK Query — this is client-owned state, not a
 * cached copy of something the server knows.
 *
 * Note what a `CartItem` does NOT contain: a price. The browser records *what*
 * is being bought, never *what it costs*. Totals always come from the server's
 * pricing service, which re-reads every product from the database. So a cart
 * that has sat in localStorage for three weeks cannot carry a stale price into
 * checkout — it never held one.
 */

export interface CartState {
  items: CartItem[];
}

const initialState: CartState = { items: [] };

/**
 * Identity of a cart line. Colour is lowercased because "Black" and "black"
 * are the same variant to a shopper, and the shared `cartSchema` rejects a cart
 * containing the same product/colour/size twice.
 */
export function cartKey(item: Pick<CartItem, 'productId' | 'color' | 'size'>): string {
  return `${item.productId}|${item.color.toLowerCase()}|${item.size}`;
}

function clampQty(qty: number): number {
  return Math.min(Math.max(Math.round(qty), 1), MAX_ITEM_QUANTITY);
}

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    /**
     * Add a variant, or increase its quantity if it is already in the cart.
     * Appending a second line for the same variant would produce a cart the
     * server rejects outright.
     */
    addItem(state, action: PayloadAction<CartItem>) {
      const incoming = action.payload;
      const key = cartKey(incoming);
      const existing = state.items.find((item) => cartKey(item) === key);

      if (existing) {
        existing.qty = clampQty(existing.qty + incoming.qty);
        return;
      }

      if (state.items.length >= MAX_CART_ITEMS) return;

      state.items.push({ ...incoming, qty: clampQty(incoming.qty) });
    },

    setQty(state, action: PayloadAction<{ key: string; qty: number }>) {
      const { key, qty } = action.payload;
      const item = state.items.find((entry) => cartKey(entry) === key);
      if (!item) return;

      // Dropping to zero from the quantity stepper means "remove", which is
      // what a shopper expects rather than a line stuck at 1.
      if (qty <= 0) {
        state.items = state.items.filter((entry) => cartKey(entry) !== key);
        return;
      }

      item.qty = clampQty(qty);
    },

    removeItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter((item) => cartKey(item) !== action.payload);
    },

    clearCart(state) {
      state.items = [];
    },
  },
});

export const { addItem, setQty, removeItem, clearCart } = cartSlice.actions;
export const cartReducer = cartSlice.reducer;
