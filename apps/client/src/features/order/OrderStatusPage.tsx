import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, type PaymentStatus } from '@shoe-shop/shared';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';

import { normaliseError } from '@/app/api/baseApi';
import { useTrackOrderQuery } from '@/app/api/orderApi';
import { Money } from '@/components/common/Money';
import { EmptyState, ErrorState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Input, Label, Separator, Skeleton } from '@/components/ui/primitives';

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Payment pending',
  paid: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function OrderStatusPage() {
  const { orderNumber = '' } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const statePhone = (location.state as { phone?: string } | null)?.phone;

  const [phoneInput, setPhoneInput] = useState('');
  const phone = statePhone ?? searchParams.get('phone') ?? undefined;

  const query = useTrackOrderQuery({ orderNumber, phone: phone ?? '' }, { skip: !phone });

  if (!phone) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-xl font-semibold tracking-tight">Order {orderNumber}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the mobile number this order was placed with to view it.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = phoneInput.trim();
            if (!trimmed) return;
            setSearchParams({ phone: trimmed });
          }}
          className="mt-6 space-y-4"
        >
          <div>
            <Label htmlFor="phone">Mobile number</Label>
            <Input
              id="phone"
              type="tel"
              className="mt-1.5"
              value={phoneInput}
              onChange={(event) => setPhoneInput(event.target.value)}
            />
          </div>
          <Button type="submit" size="lg" className="w-full">
            View order
          </Button>
        </form>
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-12">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    const notFound = normaliseError(query.error).status === 404;
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        {notFound ? (
          <EmptyState
            title="No matching order"
            description="Double-check the order number and mobile number and try again."
          />
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        )}
      </div>
    );
  }

  const order = query.data;
  const invoiceUrl = `${import.meta.env.VITE_API_URL ?? ''}/api/orders/track/invoice?orderNumber=${encodeURIComponent(
    order.orderNumber,
  )}&phone=${encodeURIComponent(phone)}`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Order {order.orderNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Placed {formatDate(order.createdAt)}</p>
        </div>
        {order.invoice && (
          <Button asChild variant="outline">
            <a href={invoiceUrl}>
              <Download />
              Invoice
            </a>
          </Button>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <span className="rounded-full bg-accent px-3 py-1 text-sm font-medium">
          {ORDER_STATUS_LABELS[order.status]}
        </span>
        <span className="rounded-full bg-accent px-3 py-1 text-sm font-medium">
          {PAYMENT_METHOD_LABELS[order.paymentMethod]} ·{' '}
          {PAYMENT_STATUS_LABELS[order.paymentStatus]}
        </span>
      </div>

      <Separator className="my-6" />

      <h2 className="text-sm font-semibold">Items</h2>
      <ul className="mt-4 space-y-3 text-sm">
        {order.items.map((item) => (
          <li
            key={`${item.productId}|${item.color}|${item.size}`}
            className="flex justify-between gap-3"
          >
            <span className="text-muted-foreground">
              {item.name}
              <span className="block text-xs">
                {item.color} · UK {item.size} · Qty {item.qty}
              </span>
            </span>
            <Money paise={item.lineTotalPaise} className="shrink-0" />
          </li>
        ))}
      </ul>

      <Separator className="my-6" />

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd>
            <Money paise={order.subtotalPaise} />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Delivery</dt>
          <dd>
            {order.deliveryChargePaise === 0 ? 'Free' : <Money paise={order.deliveryChargePaise} />}
          </dd>
        </div>
        {order.codChargePaise > 0 && (
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Cash on delivery fee</dt>
            <dd>
              <Money paise={order.codChargePaise} />
            </dd>
          </div>
        )}
        {order.tax.lines.map((line) => (
          <div key={line.label} className="flex justify-between text-muted-foreground">
            <dt>{line.label}</dt>
            <dd>
              <Money paise={line.amountPaise} />
            </dd>
          </div>
        ))}
      </dl>

      <Separator className="my-6" />

      <div className="flex justify-between text-base font-semibold">
        <span>Total</span>
        <Money paise={order.totalPaise} />
      </div>

      <Separator className="my-6" />

      <h2 className="text-sm font-semibold">Order history</h2>
      <ol className="mt-4 space-y-3 text-sm">
        {order.statusHistory.map((event, index) => (
          <li key={index} className="flex justify-between gap-3">
            <span>
              {ORDER_STATUS_LABELS[event.status]}
              {event.note && (
                <span className="block text-xs text-muted-foreground">{event.note}</span>
              )}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{formatDate(event.at)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
