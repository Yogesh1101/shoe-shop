import { zodResolver } from '@hookform/resolvers/zod';
import { type AdminLoginInput, adminLoginSchema } from '@shoe-shop/shared';
import { useForm } from 'react-hook-form';
import { type Location, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useLoginMutation } from '@/app/api/authApi';
import { normaliseError } from '@/app/api/baseApi';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/primitives';
import { credentialsReceived } from '@/features/admin/auth/authSlice';

/** Where `RequireAdmin` sent the visitor from, if it redirected them here. */
function redirectDestination(state: unknown): string {
  const from = (state as { from?: Location } | null)?.from;
  return from?.pathname ?? '/admin';
}

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const accessToken = useAppSelector((state) => state.auth.accessToken);

  const [login, loginResult] = useLoginMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminLoginInput>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Already signed in — a bookmark to /admin/login should not re-prompt.
  if (accessToken) {
    return <Navigate to={redirectDestination(location.state)} replace />;
  }

  async function onValid(input: AdminLoginInput) {
    try {
      const response = await login(input).unwrap();
      dispatch(credentialsReceived(response));
      void navigate(redirectDestination(location.state), { replace: true });
    } catch {
      // The mutation's rejected state already drives the error message below.
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold tracking-tight">Shoe Shop admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to manage the shop.</p>

        <form onSubmit={(event) => void handleSubmit(onValid)(event)} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" className="mt-1.5" {...register('email')} />
            {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" className="mt-1.5" {...register('password')} />
            {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
          </div>

          {loginResult.isError && (
            <p className="text-sm text-destructive">{normaliseError(loginResult.error).message}</p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={loginResult.isLoading}>
            {loginResult.isLoading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
