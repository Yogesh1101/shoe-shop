import {
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
  type OrderStatus,
  PAYMENT_METHOD_LABELS,
  type PaymentStatus,
} from '@shoe-shop/shared';
import { AlertTriangle, Download } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { useGetAdminOrderQuery, useUpdateOrderStatusMutation } from '@/app/api/adminOrderApi';
import { normaliseError } from '@/app/api/baseApi';
import { useAppSelector } from '@/app/hooks';
import { Money } from '@/components/common/Money';
import { ErrorState } from '@/components/common/States';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge, Label, Separator, Skeleton, Textarea } from '@/components/ui/primitives';

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

export default function OrderDetailPage() {
  const { id = '' } = useParams();
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const query = useGetAdminOrderQuery(id, { skip: !id });
  const [updateStatus, updateResult] = useUpdateOrderStatusMutation();
  const [note, setNote] = useState('');
  const [downloading, setDownloading] = useState(false);

  async function transition(status: OrderStatus) {
    try {
      await updateStatus({ id, status, note: note.trim() || undefined }).unwrap();
      setNote('');
      toast.success(`Order marked ${ORDER_STATUS_LABELS[status]}`);
    } catch (error) {
      toast.error('Could not update the order', { description: normaliseError(error).message });
    }
  }

  async function downloadInvoice() {
    setDownloading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL ?? ''}/api/admin/orders/${id}/invoice`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      if (!response.ok) throw new Error('The invoice could not be downloaded');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${query.data?.orderNumber ?? id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download the invoice');
    } finally {
      setDownloading(false);
    }
  }

  if (query.isLoading) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  const order = query.data;
  const nextStatuses = ORDER_STATUS_FLOW[order.status];

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Order {order.orderNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Placed {formatDate(order.createdAt)}</p>
        </div>
        {order.invoice && (
          <Button variant="outline" onClick={() => void downloadInvoice()} disabled={downloading}>
            <Download />
            {downloading ? 'Downloading…' : 'Invoice'}
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge>{ORDER_STATUS_LABELS[order.status]}</Badge>
        <Badge variant="outline">
          {PAYMENT_METHOD_LABELS[order.paymentMethod]} ·{' '}
          {PAYMENT_STATUS_LABELS[order.paymentStatus]}
        </Badge>
      </div>

      {order.paymentMethod === 'cod' && order.priorCancelledCount > 0 && (
        <div className="mt-4 flex gap-2 rounded-md border border-highlight/50 bg-highlight/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-highlight" aria-hidden />
          <span>
            This customer has {order.priorCancelledCount} previous cancelled{' '}
            {order.priorCancelledCount === 1 ? 'order' : 'orders'}. Worth confirming before
            dispatch.
          </span>
        </div>
      )}

      <Separator className="my-6" />

      <h2 className="text-sm font-semibold">Customer</h2>
      <div className="mt-3 text-sm">
        <p>{order.customer.name}</p>
        <p className="text-muted-foreground">
          {order.customer.phone} · {order.customer.email}
        </p>
        <p className="mt-2 text-muted-foreground">
          {order.customer.address.line1}
          {order.customer.address.line2 ? `, ${order.customer.address.line2}` : ''}
          <br />
          {order.customer.address.city}, {order.customer.address.state}{' '}
          {order.customer.address.pincode}
        </p>
      </div>
      {order.notes && (
        <p className="mt-3 rounded-md bg-muted p-3 text-sm text-muted-foreground">{order.notes}</p>
      )}

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
                {item.color} · UK {item.size} · Qty {item.qty} · HSN {item.hsnCode}
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

      {nextStatuses.length > 0 && (
        <>
          <Separator className="my-6" />
          <h2 className="text-sm font-semibold">Update status</h2>
          <div className="mt-3">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              rows={2}
              className="mt-1.5"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {nextStatuses.map((status) =>
              status === 'cancelled' ? (
                <AlertDialog key={status}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={updateResult.isLoading}>
                      Cancel order
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {order.stockCommitted
                        ? 'Stock taken for this order will be returned to inventory. This cannot be undone.'
                        : 'This cannot be undone.'}
                    </AlertDialogDescription>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep order</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void transition('cancelled')}>
                        Cancel order
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button
                  key={status}
                  variant="outline"
                  disabled={updateResult.isLoading}
                  onClick={() => void transition(status)}
                >
                  Mark {ORDER_STATUS_LABELS[status].toLowerCase()}
                </Button>
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}
