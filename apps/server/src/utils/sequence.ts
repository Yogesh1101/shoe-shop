import { Counter } from '../models/Counter.js';

/**
 * Claim the next value of a named sequence.
 *
 * `findOneAndUpdate` with `$inc` and `upsert` is a single atomic operation in
 * MongoDB, so concurrent callers each receive a distinct number with no
 * transaction and no read-then-write window.
 */
export async function nextSequence(name: string): Promise<number> {
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

  // `new: true` with `upsert` always returns the document; this satisfies the
  // type checker without an assertion that could mask a real null one day.
  if (!counter) {
    throw new Error(`Sequence "${name}" could not be allocated`);
  }
  return counter.seq;
}

/**
 * The Indian financial year runs April to March, so 2026-07-29 falls in
 * "2026-27". Invoice numbering restarts each financial year, and the series
 * must be gapless within it.
 */
export function financialYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  // getMonth() is zero-based: 3 is April.
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/**
 * Human-facing order reference, e.g. `SS-20260729-0007`.
 *
 * The date is for the shop owner's benefit when scanning a list; the sequence
 * is what actually guarantees uniqueness.
 */
export async function nextOrderNumber(date: Date = new Date()): Promise<string> {
  const seq = await nextSequence('order');
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');
  return `SS-${stamp}-${String(seq).padStart(4, '0')}`;
}

/**
 * GST invoice number, e.g. `INV/2026-27/0001`. Scoped to the financial year so
 * the series restarts each April, as the rules require.
 */
export async function nextInvoiceNumber(date: Date = new Date()): Promise<string> {
  const fy = financialYear(date);
  const seq = await nextSequence(`invoice-${fy}`);
  return `INV/${fy}/${String(seq).padStart(4, '0')}`;
}
