import {
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type OrderStatus,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type PaymentMethod,
  type PaymentStatus,
} from '@shoe-shop/shared';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useGetAdminOrdersQuery } from '@/app/api/adminOrderApi';
import { Money } from '@/components/common/Money';
import { ErrorState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge, Input, Label, Skeleton } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

const PAGE_SIZE = 25;
const ALL = '__all__';

const STATUS_BADGE_VARIANT: Record<OrderStatus, 'default' | 'outline' | 'muted'> = {
  placed: 'outline',
  confirmed: 'outline',
  packed: 'outline',
  shipped: 'outline',
  delivered: 'default',
  cancelled: 'muted',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function OrderListPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(ALL);
  const [paymentStatus, setPaymentStatus] = useState<string>(ALL);
  const [paymentMethod, setPaymentMethod] = useState<string>(ALL);
  const [includeAbandoned, setIncludeAbandoned] = useState(false);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);

  const query = useGetAdminOrdersQuery({
    q: debouncedSearch || undefined,
    status: status === ALL ? undefined : (status as OrderStatus),
    paymentStatus: paymentStatus === ALL ? undefined : (paymentStatus as PaymentStatus),
    paymentMethod: paymentMethod === ALL ? undefined : (paymentMethod as PaymentMethod),
    includeAbandoned,
    page,
    limit: PAGE_SIZE,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <Input
          placeholder="Search order #, name or phone…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={paymentStatus}
          onValueChange={(value) => {
            setPaymentStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any payment status</SelectItem>
            {PAYMENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={paymentMethod}
          onValueChange={(value) => {
            setPaymentMethod(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any method</SelectItem>
            {PAYMENT_METHODS.map((m) => (
              <SelectItem key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 pb-2.5">
          <Checkbox
            id="includeAbandoned"
            checked={includeAbandoned}
            onCheckedChange={(checked) => {
              setIncludeAbandoned(checked === true);
              setPage(1);
            }}
          />
          <Label htmlFor="includeAbandoned" className="cursor-pointer font-normal">
            Include abandoned online orders
          </Label>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-muted-foreground">Order</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Customer</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Total</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Payment</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Date</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading &&
              Array.from({ length: 8 }, (_, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td colSpan={6} className="px-4 py-3">
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))}

            {!query.isLoading &&
              query.data?.items.map((order) => (
                <tr key={order._id} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/orders/${order._id}`}
                      className="font-medium hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div>{order.customer.name}</div>
                    <div className="text-xs text-muted-foreground">{order.customer.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Money paise={order.totalPaise} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE_VARIANT[order.status]}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {PAYMENT_METHOD_LABELS[order.paymentMethod]} · {order.paymentStatus}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(order.createdAt)}
                  </td>
                </tr>
              ))}

            {!query.isLoading && query.data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No orders match those filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {query.isError && <ErrorState error={query.error} onRetry={() => void query.refetch()} />}

      {query.data && query.data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {query.data.page} of {query.data.totalPages} · {query.data.total} orders
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= query.data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
