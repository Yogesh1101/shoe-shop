import type { VariantSize } from '@shoe-shop/shared';

import { cn } from '@/lib/utils';

export interface SizeSelectorProps {
  sizes: VariantSize[];
  selectedSize: number | null;
  onSelect: (size: number) => void;
}

/**
 * Size picker.
 *
 * Out-of-stock sizes are rendered and disabled, never hidden. "They don't have
 * my size" is useful information a shopper can act on — by checking another
 * colour, or coming back later. A silently missing button just reads as a
 * broken page, and for a shop whose customers used to ask about sizes over DM,
 * being visibly out of stock is the whole point of putting stock online.
 */
export function SizeSelector({ sizes, selectedSize, onSelect }: SizeSelectorProps) {
  const ordered = [...sizes].sort((a, b) => a.size - b.size);

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a size">
      {ordered.map(({ size, stock }) => {
        const outOfStock = stock === 0;
        const selected = selectedSize === size;

        return (
          <button
            key={size}
            type="button"
            disabled={outOfStock}
            aria-pressed={selected}
            aria-label={`UK ${size}${outOfStock ? ', out of stock' : ''}`}
            onClick={() => onSelect(size)}
            className={cn(
              'relative h-12 min-w-12 rounded-md border px-3 text-sm transition-colors',
              selected && 'border-primary bg-primary font-medium text-primary-foreground',
              !selected && !outOfStock && 'border-input hover:border-foreground',
              outOfStock && 'cursor-not-allowed border-input text-muted-foreground opacity-50',
            )}
          >
            {size}
            {outOfStock && (
              // Diagonal strike, so it reads as unavailable at a glance rather
              // than needing the colour difference to be noticed.
              <span
                aria-hidden
                className="absolute top-1/2 left-1/2 h-px w-[140%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-muted-foreground"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
