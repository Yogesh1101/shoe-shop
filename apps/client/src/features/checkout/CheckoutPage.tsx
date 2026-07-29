import { zodResolver } from '@hookform/resolvers/zod';
import {
  type Customer,
  customerSchema,
  INDIAN_STATE_NAMES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type PaymentMethod,
} from '@shoe-shop/shared';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { normaliseError } from '@/app/api/baseApi';
import { useGetQuoteMutation } from '@/app/api/checkoutApi';
import { useCreateOrderMutation, useVerifyPaymentMutation } from '@/app/api/orderApi';
import { useGetPublicSettingsQuery } from '@/app/api/settingsApi';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { Money } from '@/components/common/Money';
import { EmptyState, ErrorState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Input, Label, Separator, Skeleton } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { clearCart } from '@/features/cart/cartSlice';
import { loadRazorpayCheckout } from '@/lib/razorpay';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { cn } from '@/lib/utils';

const EMPTY_ADDRESS = { line1: '', line2: '', city: '', state: '', pincode: '' };

/**
 * Field errors, in one place. Every input below reads its own message off
 * `errors`, so a bug in this component shows up as a specific field silently
 * missing its error rather than a crash.
 */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

export default function CheckoutPage() {
  const items = useAppSelector((state) => state.cart.items);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { data: publicSettings } = useGetPublicSettingsQuery();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('razorpay');
  const [placing, setPlacing] = useState(false);
  const honeypotRef = useRef<HTMLInputElement>(null);

  const [createOrder] = useCreateOrderMutation();
  const [verifyPayment] = useVerifyPaymentMutation();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Customer>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', phone: '', email: '', address: EMPTY_ADDRESS },
  });

  const pincode = useWatch({ control, name: 'address.pincode' });
  const shipToState = useWatch({ control, name: 'address.state' });
  const debouncedPincode = useDebouncedValue(pincode, 400);

  const [getQuote, quoteResult] = useGetQuoteMutation();

  // Re-priced on every ingredient that affects the total: the cart itself,
  // the PIN code (debounced — it is typed digit by digit), the state (for
  // CGST/SGST vs IGST) and the payment method (for the COD surcharge and cap).
  useEffect(() => {
    if (items.length === 0) return;

    const validPincode = /^[1-9]\d{5}$/.test(debouncedPincode ?? '') ? debouncedPincode : undefined;

    void getQuote({
      items,
      pincode: validPincode,
      state: shipToState || undefined,
      paymentMethod,
    });
  }, [items, debouncedPincode, shipToState, paymentMethod, getQuote]);

  const quote = quoteResult.data;
  const codOffered = publicSettings?.codEnabled ?? true;
  const codBlockedByCap = paymentMethod === 'cod' && quote !== undefined && !quote.codAvailable;
  const hasStockIssues = (quote?.stockIssues.length ?? 0) > 0;
  const pincodeUnserviceable = quote?.pincodeServiceable === false;

  // Tax-inclusive shops fold GST into the price shown per line, so the
  // breakdown below is informational; a tax-exclusive shop adds it on top of
  // the total, which shows up here as the total exceeding subtotal + charges.
  const taxAddedOnTop =
    quote !== undefined &&
    quote.totalPaise > quote.subtotalPaise + quote.deliveryChargePaise + quote.codChargePaise;

  /**
   * Places the order, then either finishes immediately (COD) or opens
   * Razorpay Checkout and finishes once payment is confirmed.
   *
   * The server re-quotes and re-checks stock itself — this submit handler
   * only has to get the customer to that point and react to what comes back.
   */
  async function onValid(customer: Customer) {
    setPlacing(true);
    try {
      const response = await createOrder({
        items,
        customer,
        paymentMethod,
        website: honeypotRef.current?.value || undefined,
      }).unwrap();

      if (response.paymentMethod === 'cod' || !response.razorpay) {
        dispatch(clearCart());
        void navigate(`/order/${response.orderNumber}`, { state: { phone: customer.phone } });
        return;
      }

      const { razorpay } = response;
      const Razorpay = await loadRazorpayCheckout();

      const checkout = new Razorpay({
        key: razorpay.keyId,
        amount: razorpay.amountPaise,
        currency: razorpay.currency,
        order_id: razorpay.orderId,
        name: publicSettings?.shopName ?? 'Shoe Shop',
        prefill: { name: customer.name, email: customer.email, contact: customer.phone },
        handler: (paymentResponse) => {
          void (async () => {
            try {
              await verifyPayment({
                orderId: response.orderId,
                razorpayOrderId: paymentResponse.razorpay_order_id,
                razorpayPaymentId: paymentResponse.razorpay_payment_id,
                razorpaySignature: paymentResponse.razorpay_signature,
              }).unwrap();

              dispatch(clearCart());
              void navigate(`/order/${response.orderNumber}`, { state: { phone: customer.phone } });
            } catch (error) {
              toast.error('We could not confirm your payment', {
                description: `${normaliseError(error).message} If you were charged, track your order or contact us with the payment details.`,
              });
            } finally {
              setPlacing(false);
            }
          })();
        },
        modal: { ondismiss: () => setPlacing(false) },
      });
      checkout.open();
    } catch (error) {
      toast.error('Could not place your order', { description: normaliseError(error).message });
      setPlacing(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4">
        <EmptyState
          title="Your cart is empty"
          description="Add some shoes before checking out."
          action={
            <Button asChild>
              <Link to="/shoes">Browse shoes</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>

      <form
        onSubmit={(event) => void handleSubmit(onValid)(event)}
        className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]"
      >
        {/* Honeypot: invisible to a real shopper, irresistible to a bot that
            fills in every field it finds. The server rejects any submission
            where this is non-empty. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          ref={honeypotRef}
          className="absolute -left-[9999px] size-px opacity-0"
        />

        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold">Contact</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" className="mt-1.5" {...register('name')} />
                <FieldError message={errors.name?.message} />
              </div>
              <div>
                <Label htmlFor="phone">Mobile number</Label>
                <Input id="phone" type="tel" className="mt-1.5" {...register('phone')} />
                <FieldError message={errors.phone?.message} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" className="mt-1.5" {...register('email')} />
                <FieldError message={errors.email?.message} />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold">Delivery address</h2>
            <div className="mt-4 grid gap-4">
              <div>
                <Label htmlFor="line1">Address line 1</Label>
                <Input id="line1" className="mt-1.5" {...register('address.line1')} />
                <FieldError message={errors.address?.line1?.message} />
              </div>
              <div>
                <Label htmlFor="line2">Address line 2 (optional)</Label>
                <Input id="line2" className="mt-1.5" {...register('address.line2')} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" className="mt-1.5" {...register('address.city')} />
                  <FieldError message={errors.address?.city?.message} />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Controller
                    control={control}
                    name="address.state"
                    render={({ field }) => (
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <SelectTrigger id="state" className="mt-1.5 w-full">
                          <SelectValue placeholder="Select a state" />
                        </SelectTrigger>
                        <SelectContent>
                          {INDIAN_STATE_NAMES.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError message={errors.address?.state?.message} />
                </div>
                <div>
                  <Label htmlFor="pincode">PIN code</Label>
                  <Input
                    id="pincode"
                    inputMode="numeric"
                    className="mt-1.5"
                    {...register('address.pincode')}
                  />
                  <FieldError message={errors.address?.pincode?.message} />
                  {!errors.address?.pincode && pincodeUnserviceable && (
                    <p className="mt-1 text-xs text-destructive">
                      Sorry, we currently cannot deliver to this PIN code.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold">Payment method</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {PAYMENT_METHODS.filter((method) => method !== 'cod' || codOffered).map((method) => {
                const selected = paymentMethod === method;
                const blocked = method === 'cod' && codBlockedByCap;
                return (
                  <button
                    key={method}
                    type="button"
                    disabled={blocked}
                    aria-pressed={selected}
                    onClick={() => setPaymentMethod(method)}
                    className={cn(
                      'rounded-md border px-4 py-3 text-left text-sm transition-colors',
                      selected && 'border-primary bg-accent font-medium',
                      !selected && !blocked && 'border-input hover:bg-accent',
                      blocked && 'cursor-not-allowed border-input text-muted-foreground opacity-50',
                    )}
                  >
                    {PAYMENT_METHOD_LABELS[method]}
                    {blocked && (
                      <span className="mt-1 block text-xs">Not available for this order value</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-lg border p-5">
          <h2 className="text-sm font-semibold">Order summary</h2>

          {quoteResult.isError && (
            <ErrorState error={quoteResult.error} onRetry={() => void quoteResult.reset()} className="py-8" />
          )}

          {!quoteResult.isError && !quote && (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}

          {quote && (
            <>
              <ul className="mt-4 space-y-3 text-sm">
                {quote.lines.map((line) => (
                  <li
                    key={`${line.productId}|${line.color}|${line.size}`}
                    className="flex justify-between gap-3"
                  >
                    <span className="text-muted-foreground">
                      {line.name}
                      <span className="block text-xs">
                        {line.color} · UK {line.size} · Qty {line.qty}
                      </span>
                    </span>
                    <Money paise={line.lineTotalPaise} className="shrink-0" />
                  </li>
                ))}
              </ul>

              {hasStockIssues && (
                <div className="mt-4 flex gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <div>
                    <p className="font-medium">Some items in your cart are no longer available.</p>
                    <ul className="mt-1 list-inside list-disc">
                      {quote.stockIssues.map((issue) => (
                        <li key={`${issue.productId}|${issue.color}|${issue.size}`}>
                          {issue.name} — {issue.color}, UK {issue.size}
                        </li>
                      ))}
                    </ul>
                    <Link to="/cart" className="mt-1 inline-block underline">
                      Update your cart
                    </Link>
                  </div>
                </div>
              )}

              <Separator className="my-4" />

              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd>
                    <Money paise={quote.subtotalPaise} />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Delivery</dt>
                  <dd>
                    {quote.deliveryChargePaise === 0 ? 'Free' : <Money paise={quote.deliveryChargePaise} />}
                  </dd>
                </div>
                {paymentMethod === 'cod' && quote.codChargePaise > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Cash on delivery fee</dt>
                    <dd>
                      <Money paise={quote.codChargePaise} />
                    </dd>
                  </div>
                )}
                {quote.tax.lines.map((line) => (
                  <div key={line.label} className="flex justify-between text-muted-foreground">
                    <dt>
                      {line.label}
                      {!taxAddedOnTop && ' (included)'}
                    </dt>
                    <dd>
                      <Money paise={line.amountPaise} />
                    </dd>
                  </div>
                ))}
              </dl>

              {quote.freeDeliveryShortfallPaise !== null && quote.freeDeliveryShortfallPaise > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Add <Money paise={quote.freeDeliveryShortfallPaise} className="font-medium" /> more for
                  free delivery.
                </p>
              )}

              <Separator className="my-4" />

              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <Money paise={quote.totalPaise} />
              </div>

              <Button
                type="submit"
                size="lg"
                className="mt-6 w-full"
                disabled={
                  hasStockIssues || pincodeUnserviceable || codBlockedByCap || quoteResult.isLoading || placing
                }
              >
                {placing && <Loader2 className="animate-spin" />}
                {placing ? 'Placing order…' : 'Place order'}
              </Button>
              {paymentMethod === 'razorpay' && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  You'll be asked to pay via Razorpay on the next step.
                </p>
              )}
            </>
          )}
        </aside>
      </form>
    </div>
  );
}
