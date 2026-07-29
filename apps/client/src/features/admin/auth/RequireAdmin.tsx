import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useRefreshMutation } from '@/app/api/authApi';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  credentialsReceived,
  initialisationFinished,
  signedOut,
} from '@/features/admin/auth/authSlice';

/**
 * Gate for every `/admin/*` route except the login page.
 *
 * The access token lives only in memory, so a fresh page load always starts
 * signed out and has to trade the httpOnly refresh cookie for a new one
 * before it knows whether anyone is actually signed in. Rendered only once
 * this settles, so a signed-in admin never sees a login-page flash.
 */
export function RequireAdmin() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { accessToken, initialised } = useAppSelector((state) => state.auth);
  const [refresh] = useRefreshMutation();

  useEffect(() => {
    if (initialised) return;
    refresh()
      .unwrap()
      .then((response) => dispatch(credentialsReceived(response)))
      .catch(() => dispatch(signedOut()))
      .finally(() => dispatch(initialisationFinished()));
  }, [initialised, refresh, dispatch]);

  if (!initialised) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
