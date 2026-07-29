import type { WebStorage } from 'redux-persist';

/**
 * Storage adapter for redux-persist.
 *
 * Written out rather than imported from `redux-persist/lib/storage` for two
 * reasons:
 *
 * 1. redux-persist ships CommonJS, and its default export does not survive
 *    Vite's ESM interop — the import arrives as a module namespace, so
 *    `storage.getItem` is undefined and the store throws on the very first
 *    dispatch. That failure blanks the entire page.
 * 2. `localStorage` is not always available. Safari in private mode, and any
 *    browser with site data blocked, throws on access rather than returning
 *    null. A shop that renders nothing because it could not save a cart is far
 *    worse than one that simply forgets the cart.
 *
 * The interface is three async methods; that is the whole contract.
 */

function readLocalStorage(): Storage | null {
  try {
    const probe = '__shoe_shop_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

const available = typeof window !== 'undefined' ? readLocalStorage() : null;

export const storage: WebStorage = {
  getItem(key) {
    return Promise.resolve(available?.getItem(key) ?? null);
  },
  setItem(key, value) {
    try {
      available?.setItem(key, value);
    } catch {
      // Quota exceeded, most likely. Losing the persisted cart is acceptable;
      // breaking the page is not.
    }
    return Promise.resolve();
  },
  removeItem(key) {
    try {
      available?.removeItem(key);
    } catch {
      /* ignore */
    }
    return Promise.resolve();
  },
};
