import { Check, ShoppingBag, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { useGetProductQuery } from '@/app/api/productApi';
import { useGetPublicSettingsQuery } from '@/app/api/settingsApi';
import { useAppDispatch } from '@/app/hooks';
import { Price } from '@/components/common/Money';
import { ErrorState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Badge, Separator, Skeleton } from '@/components/ui/primitives';
import { addItem } from '@/features/cart/cartSlice';
import { ImageGallery } from '@/features/product/ImageGallery';
import { SizeSelector } from '@/features/product/SizeSelector';
import { cn } from '@/lib/utils';

export default function ProductPage() {
  const { slug = '' } = useParams();
  const dispatch = useAppDispatch();

  const productQuery = useGetProductQuery(slug, { skip: !slug });
  const { data: settings } = useGetPublicSettingsQuery();

  const [colorIndex, setColorIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);

  /**
   * A size chosen for one colour may not exist, or may be sold out, in another,
   * so changing colour clears the size.
   *
   * Adjusted during render rather than in an effect: React re-runs this
   * component immediately without painting the stale value, so the user never
   * sees a size briefly selected under the wrong colour. This is React's
   * documented pattern for deriving state from a change.
   */
  const [previousColorIndex, setPreviousColorIndex] = useState(colorIndex);
  if (previousColorIndex !== colorIndex) {
    setPreviousColorIndex(colorIndex);
    setSelectedSize(null);
  }

  const product = productQuery.data;
  const variant = product?.variants[colorIndex] ?? product?.variants[0];

  // Product pages are shared as links, so the tab title should say what the
  // page is. (Crawler-facing previews need server rendering — deferred; see
  // the README.)
  useEffect(() => {
    if (!product) return;
    const previous = document.title;
    document.title = `${product.brand} ${product.name} — Shoe Shop`;
    return () => {
      document.title = previous;
    };
  }, [product]);

  if (productQuery.isLoading) {
    return (
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-8 lg:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (productQuery.isError || !product || !variant) {
    return (
      <div className="mx-auto max-w-6xl px-4">
        <ErrorState error={productQuery.error} onRetry={() => void productQuery.refetch()} />
      </div>
    );
  }

  const selectedStock = variant.sizes.find((size) => size.size === selectedSize)?.stock ?? 0;
  const variantSoldOut = variant.sizes.every((size) => size.stock === 0);

  function handleAddToCart() {
    if (!product || !variant || selectedSize === null) return;

    dispatch(
      addItem({
        productId: product._id,
        color: variant.color,
        size: selectedSize,
        qty: 1,
      }),
    );

    toast.success('Added to cart', {
      description: `${product.name} — ${variant.color}, UK ${selectedSize}`,
      action: { label: 'View cart', onClick: () => window.location.assign('/cart') },
    });
  }

  const freeDeliveryFrom = settings?.freeDeliveryAbovePaise;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link to="/shoes" className="hover:underline">
          All shoes
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Keyed by colour: a different colour is a different set of photos,
            so remounting resets the selected thumbnail. */}
        <ImageGallery
          key={variant.color}
          images={variant.images}
          alt={`${product.brand} ${product.name}`}
        />

        <div>
          <p className="text-sm tracking-wide text-muted-foreground uppercase">{product.brand}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{product.name}</h1>

          <Price
            pricePaise={product.pricePaise}
            mrpPaise={product.mrpPaise}
            size="lg"
            className="mt-4"
          />
          <p className="mt-1 text-xs text-muted-foreground">Inclusive of all taxes</p>

          {product.variants.length > 1 && (
            <div className="mt-8">
              <h2 className="text-sm font-medium">
                Colour: <span className="text-muted-foreground">{variant.color}</span>
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.variants.map((option, index) => (
                  <button
                    key={option.color}
                    type="button"
                    onClick={() => setColorIndex(index)}
                    aria-pressed={index === colorIndex}
                    aria-label={option.color}
                    title={option.color}
                    className={cn(
                      'flex size-10 items-center justify-center rounded-full border-2',
                      index === colorIndex ? 'border-primary' : 'border-transparent',
                    )}
                  >
                    <span
                      className="size-7 rounded-full border border-border"
                      style={{ backgroundColor: option.colorHex }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8">
            <h2 className="mb-3 text-sm font-medium">Select size (UK)</h2>
            {variantSoldOut ? (
              <Badge variant="muted">This colour is sold out</Badge>
            ) : (
              <SizeSelector
                sizes={variant.sizes}
                selectedSize={selectedSize}
                onSelect={setSelectedSize}
              />
            )}
          </div>

          {/* Scarcity, but only when it is true — a permanent "only 2 left!"
              is the kind of thing that costs a small shop its credibility. */}
          {selectedSize !== null && selectedStock > 0 && selectedStock <= 3 && (
            <p className="mt-3 text-sm text-highlight">Only {selectedStock} left in this size</p>
          )}

          <Button
            size="lg"
            className="mt-8 w-full"
            disabled={selectedSize === null || selectedStock === 0}
            onClick={handleAddToCart}
          >
            <ShoppingBag />
            {selectedSize === null ? 'Select a size' : 'Add to cart'}
          </Button>

          <Separator className="my-8" />

          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <Truck className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Delivery in {settings?.estimatedDeliveryDays ?? '3-7 business days'}
                {freeDeliveryFrom ? (
                  <>
                    {' '}
                    · Free delivery on orders over{' '}
                    <span className="font-medium">₹{Math.round(freeDeliveryFrom / 100)}</span>
                  </>
                ) : null}
              </span>
            </li>
            {settings?.codEnabled && (
              <li className="flex items-start gap-3">
                <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>Cash on delivery available</span>
              </li>
            )}
          </ul>

          {product.description && (
            <>
              <Separator className="my-8" />
              <h2 className="text-sm font-medium">Details</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {product.description}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
