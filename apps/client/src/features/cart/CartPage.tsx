import { MAX_ITEM_QUANTITY, type Product } from '@shoe-shop/shared';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { useGetProductsQuery } from '@/app/api/productApi';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { CloudinaryImage } from '@/components/common/CloudinaryImage';
import { Money } from '@/components/common/Money';
import { EmptyState, ErrorState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Badge, Separator, Skeleton } from '@/components/ui/primitives';
import { cartKey, removeItem, setQty } from '@/features/cart/cartSlice';

export default function CartPage() {
  const dispatch = useAppDispatch();
  const items = useAppSelector((state) => state.cart.items);

  const productIds = useMemo(() => [...new Set(items.map((item) => item.productId))], [items]);

  // The cart holds no names, images or prices — only ids — so display data is
  // resolved here and is always current. `skip` avoids a pointless request for
  // an empty cart.
  const productsQuery = useGetProductsQuery(
    { ids: productIds, limit: 60 },
    { skip: productIds.length === 0 },
  );

  const productsById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const product of productsQuery.data?.items ?? []) map.set(product._id, product);
    return map;
  }, [productsQuery.data]);

  /**
   * Indicative only. The authoritative total — with delivery, GST and any COD
   * surcharge — is computed by the checkout page's quote endpoint, which also
   * re-checks stock. This is a preview, and is labelled as one.
   */
  const subtotalPaise = items.reduce((total, item) => {
    const product = productsById.get(item.productId);
    return total + (product ? product.pricePaise * item.qty : 0);
  }, 0);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4">
        <EmptyState
          title="Your cart is empty"
          description="Shoes you add will show up here."
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
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Your cart</h1>

      {productsQuery.isError && (
        <ErrorState error={productsQuery.error} onRetry={() => void productsQuery.refetch()} />
      )}

      <ul className="mt-8 divide-y">
        {items.map((item) => {
          const key = cartKey(item);
          const product = productsById.get(item.productId);
          const variant = product?.variants.find(
            (candidate) => candidate.color.toLowerCase() === item.color.toLowerCase(),
          );
          const stock = variant?.sizes.find((size) => size.size === item.size)?.stock ?? 0;

          return (
            <li key={key} className="flex gap-4 py-5">
              <div className="size-24 shrink-0 overflow-hidden rounded-md bg-muted">
                {productsQuery.isLoading ? (
                  <Skeleton className="size-full" />
                ) : variant?.images[0] ? (
                  <CloudinaryImage
                    src={variant.images[0].url}
                    alt={product ? `${product.brand} ${product.name}` : ''}
                    width={240}
                    sizes="96px"
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                {productsQuery.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ) : product ? (
                  <>
                    <Link
                      to={`/shoes/${product.slug}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {product.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {product.brand} · {item.color} · UK {item.size}
                    </p>
                    <Money paise={product.pricePaise} className="mt-1 block text-sm" />
                    {/* Stock can fall between adding to the cart and checking
                        out. Saying so here is kinder than a failure at payment. */}
                    {stock === 0 ? (
                      <Badge variant="muted" className="mt-2">
                        Out of stock
                      </Badge>
                    ) : stock < item.qty ? (
                      <Badge variant="sale" className="mt-2">
                        Only {stock} left
                      </Badge>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">This shoe is no longer available.</p>
                )}

                <div className="mt-3 flex items-center gap-3">
                  <div className="flex items-center rounded-md border">
                    <button
                      type="button"
                      className="px-2.5 py-2 hover:bg-accent disabled:opacity-40"
                      onClick={() => dispatch(setQty({ key, qty: item.qty - 1 }))}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="w-8 text-center text-sm tabular-nums">{item.qty}</span>
                    <button
                      type="button"
                      className="px-2.5 py-2 hover:bg-accent disabled:opacity-40"
                      disabled={item.qty >= MAX_ITEM_QUANTITY}
                      onClick={() => dispatch(setQty({ key, qty: item.qty + 1 }))}
                      aria-label="Increase quantity"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dispatch(removeItem(key))}
                    aria-label="Remove from cart"
                  >
                    <Trash2 />
                    Remove
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <Separator className="my-6" />

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Subtotal</span>
        {productsQuery.isLoading ? (
          <Skeleton className="h-5 w-20" />
        ) : (
          <Money paise={subtotalPaise} className="text-lg font-semibold" />
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Delivery and taxes are calculated at checkout.
      </p>

      <Button asChild size="lg" className="mt-6 w-full">
        <Link to="/checkout">Proceed to checkout</Link>
      </Button>
    </div>
  );
}
