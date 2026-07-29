import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Admin } from '@shoe-shop/shared';

/**
 * Admin session state.
 *
 * The access token lives here — in memory only, never in localStorage. It is
 * deliberately excluded from redux-persist's whitelist: the durable half of the
 * session is an httpOnly refresh cookie the page's JavaScript cannot read, so
 * an XSS bug on the admin panel yields at most a 15-minute token rather than a
 * session that survives the tab closing.
 *
 * A page reload therefore always starts signed-out and immediately calls
 * `POST /api/admin/refresh` to trade the cookie for a fresh access token.
 */

export interface AuthState {
  accessToken: string | null;
  admin: Admin | null;
  /** False until the initial refresh attempt settles, so guards do not bounce
   *  a signed-in admin to the login screen during that first round trip. */
  initialised: boolean;
}

const initialState: AuthState = {
  accessToken: null,
  admin: null,
  initialised: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    credentialsReceived(state, action: PayloadAction<{ accessToken: string; admin: Admin }>) {
      state.accessToken = action.payload.accessToken;
      state.admin = action.payload.admin;
      state.initialised = true;
    },
    signedOut(state) {
      state.accessToken = null;
      state.admin = null;
      state.initialised = true;
    },
    initialisationFinished(state) {
      state.initialised = true;
    },
  },
});

export const { credentialsReceived, signedOut, initialisationFinished } = authSlice.actions;
export const authReducer = authSlice.reducer;
