import { LayoutDashboard, LogOut, Package, Settings, ShoppingBag } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useLogoutMutation } from '@/app/api/authApi';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { signedOut } from '@/features/admin/auth/authSlice';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Products', icon: Package, end: false },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag, end: false },
  { to: '/admin/settings', label: 'Settings', icon: Settings, end: false },
] as const;

export function AdminLayout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const admin = useAppSelector((state) => state.auth.admin);
  const [logout] = useLogoutMutation();

  async function handleSignOut() {
    // Best-effort: the client-side session ends regardless of whether the
    // server round trip succeeds.
    try {
      await logout().unwrap();
    } catch {
      // Nothing left to do — proceed to sign out locally either way.
    }
    dispatch(signedOut());
    void navigate('/admin/login', { replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[16rem_1fr]">
      <aside className="border-b bg-muted/30 p-4 lg:border-r lg:border-b-0">
        <div className="flex h-full flex-col">
          <div className="px-2 py-2">
            <p className="text-sm font-semibold tracking-tight">Shoe Shop admin</p>
            {admin && <p className="mt-0.5 truncate text-xs text-muted-foreground">{admin.email}</p>}
          </div>

          <nav className="mt-4 flex flex-1 flex-col gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm',
                    isActive ? 'bg-accent font-medium' : 'text-muted-foreground hover:bg-accent',
                  )
                }
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground hover:bg-accent"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-6 sm:px-8">
        <Outlet />
      </main>
    </div>
  );
}
