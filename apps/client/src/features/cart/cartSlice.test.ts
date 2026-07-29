import { MAX_CART_ITEMS, MAX_ITEM_QUANTITY } from '@shoe-shop/shared';
import { describe, expect, it } from 'vitest';

import type { CartState } from './cartSlice';
import { addItem, cartKey, cartReducer, clearCart, removeItem, setQty } from './cartSlice';

const BLACK_9 = {
  productId: '507f1f77bcf86cd799439011',
  color: 'Black',
  size: 9,
  qty: 1,
};

const empty: CartState = { items: [] };

describe('cartKey', () => {
  it('treats colour case-insensitively, because shoppers do', () => {
    expect(cartKey({ ...BLACK_9, color: 'Black' })).toBe(cartKey({ ...BLACK_9, color: 'black' }));
  });

  it('separates different sizes of the same shoe', () => {
    expect(cartKey(BLACK_9)).not.toBe(cartKey({ ...BLACK_9, size: 10 }));
  });

  it('separates different colours of the same shoe', () => {
    expect(cartKey(BLACK_9)).not.toBe(cartKey({ ...BLACK_9, color: 'White' }));
  });
});

describe('addItem', () => {
  it('adds a new line', () => {
    const state = cartReducer(empty, addItem(BLACK_9));
    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toMatchObject({ color: 'Black', size: 9, qty: 1 });
  });

  it('never stores a price', () => {
    const state = cartReducer(empty, addItem(BLACK_9));
    // The browser records what is being bought, never what it costs.
    expect(Object.keys(state.items[0]!).sort()).toEqual(['color', 'productId', 'qty', 'size']);
  });

  it('bumps quantity instead of creating a duplicate line', () => {
    // A second line for the same variant would produce a cart the server's
    // cartSchema rejects outright.
    let state = cartReducer(empty, addItem(BLACK_9));
    state = cartReducer(state, addItem(BLACK_9));

    expect(state.items).toHaveLength(1);
    expect(state.items[0]!.qty).toBe(2);
  });

  it('merges across colour casing', () => {
    let state = cartReducer(empty, addItem(BLACK_9));
    state = cartReducer(state, addItem({ ...BLACK_9, color: 'black' }));

    expect(state.items).toHaveLength(1);
    expect(state.items[0]!.qty).toBe(2);
  });

  it('keeps different sizes as separate lines', () => {
    let state = cartReducer(empty, addItem(BLACK_9));
    state = cartReducer(state, addItem({ ...BLACK_9, size: 10 }));
    expect(state.items).toHaveLength(2);
  });

  it('clamps quantity to the shared maximum', () => {
    const state = cartReducer(empty, addItem({ ...BLACK_9, qty: 999 }));
    expect(state.items[0]!.qty).toBe(MAX_ITEM_QUANTITY);
  });

  it('clamps when merging past the maximum too', () => {
    let state = cartReducer(empty, addItem({ ...BLACK_9, qty: MAX_ITEM_QUANTITY }));
    state = cartReducer(state, addItem(BLACK_9));
    expect(state.items[0]!.qty).toBe(MAX_ITEM_QUANTITY);
  });

  it('refuses to exceed the maximum number of distinct lines', () => {
    let state = empty;
    for (let i = 0; i < MAX_CART_ITEMS + 5; i += 1) {
      state = cartReducer(state, addItem({ ...BLACK_9, size: 1 + i * 0.5 }));
    }
    expect(state.items).toHaveLength(MAX_CART_ITEMS);
  });
});

describe('setQty', () => {
  it('updates a line', () => {
    let state = cartReducer(empty, addItem(BLACK_9));
    state = cartReducer(state, setQty({ key: cartKey(BLACK_9), qty: 4 }));
    expect(state.items[0]!.qty).toBe(4);
  });

  it('removes the line when quantity drops to zero', () => {
    // Which is what the stepper's minus button should do at 1.
    let state = cartReducer(empty, addItem(BLACK_9));
    state = cartReducer(state, setQty({ key: cartKey(BLACK_9), qty: 0 }));
    expect(state.items).toHaveLength(0);
  });

  it('ignores an unknown key', () => {
    const state = cartReducer(
      cartReducer(empty, addItem(BLACK_9)),
      setQty({ key: 'nope', qty: 5 }),
    );
    expect(state.items[0]!.qty).toBe(1);
  });

  it('clamps to the maximum', () => {
    let state = cartReducer(empty, addItem(BLACK_9));
    state = cartReducer(state, setQty({ key: cartKey(BLACK_9), qty: 500 }));
    expect(state.items[0]!.qty).toBe(MAX_ITEM_QUANTITY);
  });
});

describe('removeItem and clearCart', () => {
  it('removes only the matching line', () => {
    let state = cartReducer(empty, addItem(BLACK_9));
    state = cartReducer(state, addItem({ ...BLACK_9, size: 10 }));
    state = cartReducer(state, removeItem(cartKey(BLACK_9)));

    expect(state.items).toHaveLength(1);
    expect(state.items[0]!.size).toBe(10);
  });

  it('empties the cart', () => {
    let state = cartReducer(empty, addItem(BLACK_9));
    state = cartReducer(state, clearCart());
    expect(state.items).toHaveLength(0);
  });
});
