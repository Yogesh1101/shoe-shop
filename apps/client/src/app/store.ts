import { combineReducers, configureStore } from '@reduxjs/toolkit';
import {
  FLUSH,
  PAUSE,
  PERSIST,
  persistReducer,
  persistStore,
  PURGE,
  REGISTER,
  REHYDRATE,
} from 'redux-persist';

import { baseApi } from '@/app/api/baseApi';
import { storage } from '@/app/storage';
import { authReducer } from '@/features/admin/auth/authSlice';
import { cartReducer } from '@/features/cart/cartSlice';

const rootReducer = combineReducers({
  [baseApi.reducerPath]: baseApi.reducer,
  cart: cartReducer,
  auth: authReducer,
});

const persistedReducer = persistReducer(
  {
    key: 'shoe-shop',
    version: 1,
    storage,
    /**
     * Only the cart survives a reload.
     *
     * The API cache is excluded on purpose — persisting it would show a
     * returning visitor last week's prices and stock. The auth slice is
     * excluded because the access token must stay in memory; its durable half
     * is an httpOnly cookie instead.
     */
    whitelist: ['cart'],
  },
  rootReducer,
);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // redux-persist dispatches these internally with non-serializable
        // payloads; everything else stays under the check.
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(baseApi.middleware),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
