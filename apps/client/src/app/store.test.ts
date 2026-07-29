import { describe, expect, it } from 'vitest';

import { storage } from '@/app/storage';
import { store } from '@/app/store';
import { addItem } from '@/features/cart/cartSlice';

/**
 * Regression guard for a bug that blanked the entire site.
 *
 * `redux-persist` ships CommonJS, and importing its bundled
 * `redux-persist/lib/storage` through Vite produced a module namespace rather
 * than the storage object. The first dispatch then threw "getItem is not a
 * function" before React could render anything — every page was blank white,
 * while lint, typecheck, unit tests and the production build all passed.
 *
 * Only loading the real store in a browser-like environment catches this, so
 * that is exactly what these tests do.
 */
describe('store wiring', () => {
  it('exposes a storage adapter with the three methods redux-persist calls', () => {
    expect(typeof storage.getItem).toBe('function');
    expect(typeof storage.setItem).toBe('function');
    expect(typeof storage.removeItem).toBe('function');
  });

  it('round-trips a value', async () => {
    await storage.setItem('probe', 'value');
    await expect(storage.getItem('probe')).resolves.toBe('value');
    await storage.removeItem('probe');
    await expect(storage.getItem('probe')).resolves.toBeNull();
  });

  it('builds a store whose initial state has every slice', () => {
    const state = store.getState();
    expect(state).toHaveProperty('cart');
    expect(state).toHaveProperty('auth');
    expect(state).toHaveProperty('api');
  });

  it('dispatches without throwing — the exact failure that blanked the page', () => {
    expect(() =>
      store.dispatch(
        addItem({ productId: '507f1f77bcf86cd799439011', color: 'Black', size: 9, qty: 1 }),
      ),
    ).not.toThrow();

    expect(store.getState().cart.items).toHaveLength(1);
  });

  it('keeps the admin token out of persisted state', () => {
    // The access token must stay in memory; its durable half is an httpOnly
    // cookie the page's JavaScript cannot read.
    expect(store.getState().auth.accessToken).toBeNull();
  });
});
