import type { Product } from '@shoe-shop/shared';

/**
 * Total stock across every colour and size.
 *
 * Lives apart from `ProductCard` so that component file exports only a
 * component — which is what lets Fast Refresh replace it without remounting the
 * whole grid during development.
 */
export function totalStock(product: Product): number {
  return product.variants.reduce(
    (total, variant) => total + variant.sizes.reduce((sum, size) => sum + size.stock, 0),
    0,
  );
}
