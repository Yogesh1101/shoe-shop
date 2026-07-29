import { describe, expect, it } from 'vitest';

import {
  addTaxExclusive,
  applyBps,
  formatINR,
  splitTaxInclusive,
  sumPaise,
  toPaise,
  toRupees,
} from './money.js';

describe('toPaise', () => {
  it('converts rupees to paise', () => {
    expect(toPaise(1499)).toBe(149_900);
    expect(toPaise(0)).toBe(0);
    expect(toPaise(0.5)).toBe(50);
  });

  it('rounds to the nearest paisa rather than truncating', () => {
    expect(toPaise(10.005)).toBe(1001);
    expect(toPaise(10.004)).toBe(1000);
  });

  it('survives float representation error', () => {
    // 19.99 * 100 is 1998.9999999999998 in IEEE-754. Truncating would lose a paisa.
    expect(toPaise(19.99)).toBe(1999);
    expect(toPaise(1.1)).toBe(110);
    expect(toPaise(2.2)).toBe(220);
  });

  it('rejects non-finite input instead of producing NaN money', () => {
    expect(() => toPaise(Number.NaN)).toThrow(TypeError);
    expect(() => toPaise(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });
});

describe('toRupees', () => {
  it('round-trips with toPaise', () => {
    for (const rupees of [0, 1, 99.5, 1499, 249_999.99]) {
      expect(toRupees(toPaise(rupees))).toBeCloseTo(rupees, 2);
    }
  });
});

describe('sumPaise', () => {
  it('adds integers exactly, where floats would drift', () => {
    // The float equivalent (0.1 + 0.2) is 0.30000000000000004.
    expect(sumPaise([10, 20])).toBe(30);
    expect(sumPaise([])).toBe(0);
    expect(sumPaise([149_900, 89_900, 249_900])).toBe(489_700);
  });
});

describe('applyBps', () => {
  it('applies a basis-point rate', () => {
    expect(applyBps(100_000, 500)).toBe(5_000); // 5% of ₹1000
    expect(applyBps(100_000, 1800)).toBe(18_000); // 18%
    expect(applyBps(100_000, 0)).toBe(0);
  });

  it('rounds to whole paise', () => {
    expect(applyBps(333, 500)).toBe(17); // 16.65 -> 17
  });
});

describe('splitTaxInclusive', () => {
  it('separates a tax-inclusive total into taxable value and tax', () => {
    // ₹1,180 inclusive of 18% GST -> ₹1,000 taxable + ₹180 tax
    const { taxablePaise, taxPaise } = splitTaxInclusive(118_000, 1800);
    expect(taxablePaise).toBe(100_000);
    expect(taxPaise).toBe(18_000);
  });

  it('handles the 5% slab', () => {
    // ₹1,050 inclusive of 5% -> ₹1,000 + ₹50
    expect(splitTaxInclusive(105_000, 500)).toEqual({ taxablePaise: 100_000, taxPaise: 5_000 });
  });

  it('always reconstructs the original total exactly', () => {
    // This is the property that matters: an invoice must add up. Deriving tax by
    // subtraction rather than a second rounding is what guarantees it.
    const awkwardTotals = [1, 7, 99, 333, 1_234, 45_678, 149_900, 999_999];
    for (const total of awkwardTotals) {
      for (const rateBps of [0, 500, 1200, 1800]) {
        const { taxablePaise, taxPaise } = splitTaxInclusive(total, rateBps);
        expect(taxablePaise + taxPaise).toBe(total);
        expect(Number.isInteger(taxablePaise)).toBe(true);
        expect(Number.isInteger(taxPaise)).toBe(true);
      }
    }
  });

  it('charges no tax at a zero rate', () => {
    expect(splitTaxInclusive(149_900, 0)).toEqual({ taxablePaise: 149_900, taxPaise: 0 });
  });
});

describe('addTaxExclusive', () => {
  it('adds tax on top of the listed price', () => {
    expect(addTaxExclusive(100_000, 1800)).toEqual({ taxablePaise: 100_000, taxPaise: 18_000 });
  });
});

describe('formatINR', () => {
  it('uses Indian digit grouping, not thousands', () => {
    // ₹1,23,456 — lakh grouping, not ₹123,456.
    expect(formatINR(12_345_600)).toBe('₹1,23,456');
  });

  it('omits paise on whole-rupee amounts', () => {
    expect(formatINR(149_900)).toBe('₹1,499');
  });

  it('shows paise when the amount has them', () => {
    expect(formatINR(149_950)).toBe('₹1,499.50');
  });

  it('can force paise for invoice columns', () => {
    expect(formatINR(149_900, { alwaysShowPaise: true })).toBe('₹1,499.00');
  });

  it('can drop the symbol', () => {
    expect(formatINR(149_900, { omitSymbol: true })).toBe('1,499');
  });

  it('formats zero', () => {
    expect(formatINR(0)).toBe('₹0');
  });
});
