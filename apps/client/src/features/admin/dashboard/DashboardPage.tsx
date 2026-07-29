import { ORDER_STATUS_LABELS } from '@shoe-shop/shared';
import { ArrowRight, Package, Settings, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useGetAdminOrdersQuery } from '@/app/api/adminOrderApi';
import { Money } from '@/components/common/Money';
import { Button } from '@/components/ui/button';
import { Badge, Skeleton } from '@/components/ui/primitives';

const QUICK_LINKS = [
  { to: '/admin/products', label: 'Manage products', icon: Package },
  { to: '/admin/orders', label: 'Manage orders', icon: ShoppingBag },
  { to: '/admin/settings', label: 'Shop settings', icon: Settings },
] as const;

export default function DashboardPage() {
  const needsAttention = useGetAdminOrdersQuery({ status: 'placed', limit: 1, page: 1 });
  const recent = useGetAdminOrdersQuery({ limit: 8, page: 1 });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center justify-between rounded-lg border p-4 text-sm font-medium hover:bg-accent"
          >
            <span className="flex items-center gap-2.5">
              <Icon className="size-4" aria-hidden />
              {label}
            </span>
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </div>

      {!needsAttention.isLoading && (needsAttention.data?.total ?? 0) > 0 && (
        <div className="mt-6 rounded-md border border-highlight/50 bg-highlight/10 p-4 text-sm">
          <Link to="/admin/orders?status=placed" className="font-medium hover:underline">
            {needsAttention.data?.total} new{' '}
            {needsAttention.data?.total === 1 ? 'order needs' : 'orders need'} confirmation
          </Link>
        </div>
      )}

      <h2 className="mt-8 text-sm font-semibold">Recent orders</h2>
      <div className="mt-3 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-muted-foreground">Order</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Customer</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Total</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {recent.isLoading &&
              Array.from({ length: 4 }, (_, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td colSpan={4} className="px-4 py-3">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ))}

            {!recent.isLoading &&
              recent.data?.items.map((order) => (
                <tr key={order._id} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <Link to={`/admin/orders/${order._id}`} className="font-medium hover:underline">
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{order.customer.name}</td>
                  <td className="px-4 py-3">
                    <Money paise={order.totalPaise} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{ORDER_STATUS_LABELS[order.status]}</Badge>
                  </td>
                </tr>
              ))}

            {!recent.isLoading && recent.data?.items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Button asChild variant="outline" className="mt-4">
        <Link to="/admin/orders">View all orders</Link>
      </Button>
    </div>
  );
}
