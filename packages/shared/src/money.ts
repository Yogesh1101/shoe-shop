/**
 * Money handling for the whole system.
 *
 * Every amount — prices, subtotals, delivery charges, tax, totals — is a whole
 * number of **paise**, in the database, over the API, and in Redux. Never a
 * float of rupees.
 *
 * Two reasons:
 *
 * 1. Floating point cannot represent most decimal fractions. `0.1 + 0.2` is
 *    `0.30000000000000004`. Summing a dozen line items and a tax split drifts,
 *    and the drift lands on a GST invoice that has to add up exactly.
 * 2. Razorpay's API takes integer paise anyway, so rupees would be converted at
 *    the boundary regardless — better to never have them in the first place.
 *
 * Rupees exist in exactly two places: what the shop owner types into the admin
 * form, and what the customer reads on screen. `toPaise` and `formatINR` are
 * those two boundaries.
 */

/** One rupee, in paise. */
export const PAISE_PER_RUPEE = 100;

/**
 * Convert a rupee amount (typically from an admin input field) to paise.
 * Rounds to the nearest paisa, so `1499.999` becomes `150000`.
 */
export function toPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) {
    throw new TypeError(`toPaise received a non-finite value: ${rupees}`);
  }
  return Math.round(rupees * PAISE_PER_RUPEE);
}

/**
 * Convert paise back to rupees. Use this only to pre-fill an editable rupee
 * input — for anything the customer reads, use `formatINR` instead.
 */
export function toRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

/** Add up paise amounts. Trivial, but it keeps the reduce out of business code. */
export function sumPaise(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}

export interface FormatINROptions {
  /**
   * Show `.00` on whole-rupee amounts. Off by default because Indian retail
   * prices are quoted as `₹1,499`, not `₹1,499.00`. Invoices turn this on so
   * every column lines up.
   */
  alwaysShowPaise?: boolean;
  /** Drop the `₹` symbol — for invoice tables that already have a currency column. */
  omitSymbol?: boolean;
}

/**
 * Format paise as Indian rupees, with Indian digit grouping
 * (`₹1,23,456`, not `₹123,456`).
 */
export function formatINR(paise: number, options: FormatINROptions = {}): string {
  const { alwaysShowPaise = false, omitSymbol = false } = options;
  const isWholeRupees = paise % PAISE_PER_RUPEE === 0;
  const fractionDigits = alwaysShowPaise || !isWholeRupees ? 2 : 0;

  return new Intl.NumberFormat('en-IN', {
    style: omitSymbol ? 'decimal' : 'currency',
    currency: 'INR',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(toRupees(paise));
}

/**
 * Apply a basis-point rate to a paise amount, rounded to the nearest paisa.
 * Basis points keep tax rates as integers: 5% is 500 bps, 18% is 1800 bps.
 */
export function applyBps(paise: number, rateBps: number): number {
  return Math.round((paise * rateBps) / 10_000);
}

/**
 * Split a **tax-inclusive** amount into its taxable value and tax component.
 *
 * Indian retail quotes tax-inclusive prices — the ₹1,499 on the product page is
 * what the customer pays, with GST already inside it. So the invoice works
 * backwards from the total rather than adding tax on top:
 *
 *   taxable = total × 10000 / (10000 + rateBps)
 *   tax     = total − taxable
 *
 * Deriving `tax` by subtraction rather than by a second rounding is what
 * guarantees `taxable + tax === inclusiveTotal` exactly, with no stray paisa.
 */
export function splitTaxInclusive(
  inclusiveTotalPaise: number,
  rateBps: number,
): { taxablePaise: number; taxPaise: number } {
  const taxablePaise = Math.round((inclusiveTotalPaise * 10_000) / (10_000 + rateBps));
  return { taxablePaise, taxPaise: inclusiveTotalPaise - taxablePaise };
}

/**
 * Add tax on top of a **tax-exclusive** amount, for shops configured that way
 * (`Settings.pricesIncludeTax === false`). The listed price is the taxable
 * value and the customer pays taxable + tax.
 */
export function addTaxExclusive(
  exclusivePaise: number,
  rateBps: number,
): { taxablePaise: number; taxPaise: number } {
  return {
    taxablePaise: exclusivePaise,
    taxPaise: applyBps(exclusivePaise, rateBps),
  };
}
