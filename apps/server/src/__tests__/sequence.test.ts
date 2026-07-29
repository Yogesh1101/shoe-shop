import { expect, it } from 'vitest';

import { nextInvoiceNumber, nextOrderNumber, nextSequence } from '../utils/sequence.js';
import { describeWithMongo } from './helpers/mongo.js';

describeWithMongo('sequences', () => {
  it('starts at 1 and increments', async () => {
    expect(await nextSequence('test')).toBe(1);
    expect(await nextSequence('test')).toBe(2);
    expect(await nextSequence('test')).toBe(3);
  });

  it('keeps separate sequences independent', async () => {
    await nextSequence('alpha');
    await nextSequence('alpha');
    expect(await nextSequence('beta')).toBe(1);
    expect(await nextSequence('alpha')).toBe(3);
  });

  it('is gapless and collision-free under concurrency', async () => {
    // This is the whole point of using an atomic $inc rather than a
    // countDocuments() or a timestamp: fifty simultaneous checkouts must
    // produce fifty distinct, consecutive numbers.
    const results = await Promise.all(Array.from({ length: 50 }, () => nextSequence('concurrent')));

    const sorted = [...results].sort((a, b) => a - b);
    expect(new Set(results).size).toBe(50);
    expect(sorted).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });

  it('formats an order number with the date and a padded sequence', async () => {
    const orderNumber = await nextOrderNumber(new Date(2026, 6, 29));
    expect(orderNumber).toBe('SS-20260729-0001');
  });

  it('scopes invoice numbers to the financial year', async () => {
    // March and April fall in different financial years, so each series
    // restarts at 1 — which is what GST requires.
    expect(await nextInvoiceNumber(new Date(2027, 2, 31))).toBe('INV/2026-27/0001');
    expect(await nextInvoiceNumber(new Date(2027, 2, 31))).toBe('INV/2026-27/0002');
    expect(await nextInvoiceNumber(new Date(2027, 3, 1))).toBe('INV/2027-28/0001');
  });

  it('gives concurrent orders distinct numbers', async () => {
    const date = new Date(2026, 6, 29);
    const numbers = await Promise.all(Array.from({ length: 20 }, () => nextOrderNumber(date)));
    expect(new Set(numbers).size).toBe(20);
  });
});
