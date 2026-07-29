import type { Product } from '@shoe-shop/shared';
import { Link } from 'react-router-dom';

import { CloudinaryImage } from '@/components/common/CloudinaryImage';
import { Price } from '@/components/common/Money';
import { Badge } from '@/components/ui/primitives';
import { totalStock } from '@/features/catalog/productStock';

export interface ProductCardProps {
  product: Product;
  /** First row of the grid should load eagerly; the rest lazily. */
  priority?: boolean;
}

export function ProductCard({ product, priority = false }: ProductCardProps) {
  const firstVariant = product.variants[0];
  const image = firstVariant?.images[0];
  const soldOut = totalStock(product) === 0;

  return (
    <article className="group">
      <Link to={`/shoes/${product.slug}`} className="block">
        <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
          {image ? (
            <CloudinaryImage
              src={image.url}
              alt={`${product.brand} ${product.name}`}
              priority={priority}
              width={640}
              className="transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No photo
            </div>
          )}

          {soldOut && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Badge variant="muted">Sold out</Badge>
            </div>
          )}
        </div>

        <div className="mt-3 space-y-1">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">{product.brand}</p>
          <h3 className="text-sm leading-snug font-medium">{product.name}</h3>
          <Price pricePaise={product.pricePaise} mrpPaise={product.mrpPaise} size="sm" />
        </div>
      </Link>

      {/* Colour swatches double as a signal that the shoe comes in variants,
          which is a reason to tap through. */}
      {product.variants.length > 1 && (
        <div className="mt-2 flex items-center gap-1.5">
          {product.variants.slice(0, 5).map((variant) => (
            <span
              key={variant.color}
              className="size-3.5 rounded-full border border-border"
              style={{ backgroundColor: variant.colorHex }}
              title={variant.color}
            />
          ))}
          {product.variants.length > 5 && (
            <span className="text-xs text-muted-foreground">+{product.variants.length - 5}</span>
          )}
        </div>
      )}
    </article>
  );
}
