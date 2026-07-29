import { formatINR } from '@shoe-shop/shared';

import { cn } from '@/lib/utils';

export interface MoneyProps {
  /** Always paise. Every amount in this system is an integer number of paise. */
  paise: number;
  className?: string;
  alwaysShowPaise?: boolean;
}

/**
 * The only component that renders a price.
 *
 * Keeps the integer-paise rule from leaking into JSX: no component ever divides
 * by 100 or writes a ₹ by hand, so there is exactly one place where a
 * formatting bug could live.
 */
export function Money({ paise, className, alwaysShowPaise }: MoneyProps) {
  return (
    <span className={cn('tabular-nums', className)}>{formatINR(paise, { alwaysShowPaise })}</span>
  );
}

export interface PriceProps {
  pricePaise: number;
  mrpPaise: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Selling price with the MRP struck through, plus the discount percentage.
 *
 * The MRP is only shown when it is genuinely higher — a struck-through price
 * identical to the one being charged is the kind of fake-discount pattern that
 * costs a small shop its credibility.
 */
export function Price({ pricePaise, mrpPaise, className, size = 'md' }: PriceProps) {
  const hasDiscount = mrpPaise > pricePaise;
  const percentOff = hasDiscount ? Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100) : 0;

  const priceSize = { sm: 'text-sm', md: 'text-base', lg: 'text-2xl' }[size];

  return (
    <span className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      <Money paise={pricePaise} className={cn('font-semibold', priceSize)} />
      {hasDiscount && (
        <>
          <Money paise={mrpPaise} className="text-sm text-muted-foreground line-through" />
          {/* Only worth calling out once it is a real saving. */}
          {percentOff >= 5 && (
            <span className="text-sm font-medium text-highlight">{percentOff}% off</span>
          )}
        </>
      )}
    </span>
  );
}
