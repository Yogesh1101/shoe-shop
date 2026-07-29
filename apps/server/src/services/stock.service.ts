import { Product } from '../models/Product.js';

export interface StockAdjustment {
  productId: string;
  color: string;
  size: number;
  qty: number;
}

/**
 * Take one line's stock, but only if enough is still there. `arrayFilters`
 * makes the whole read-check-write atomic in MongoDB, so two customers buying
 * the last pair at the same moment cannot both succeed.
 */
async function takeOne(item: StockAdjustment): Promise<boolean> {
  const result = await Product.updateOne(
    { _id: item.productId },
    { $inc: { 'variants.$[v].sizes.$[s].stock': -item.qty } },
    {
      arrayFilters: [{ 'v.color': item.color }, { 's.size': item.size, 's.stock': { $gte: item.qty } }],
    },
  );
  return result.modifiedCount === 1;
}

async function returnOne(item: StockAdjustment): Promise<void> {
  await Product.updateOne(
    { _id: item.productId },
    { $inc: { 'variants.$[v].sizes.$[s].stock': item.qty } },
    { arrayFilters: [{ 'v.color': item.color }, { 's.size': item.size }] },
  );
}

/**
 * Commit an order's stock, all lines or none.
 *
 * The quote already checked availability moments earlier, so failure here
 * means a genuine race — someone else bought the last pair in between. Rather
 * than leave the order half-decremented, everything already taken in this
 * attempt is put back before reporting failure.
 */
export async function commitStock(items: StockAdjustment[]): Promise<boolean> {
  const taken: StockAdjustment[] = [];

  for (const item of items) {
    const ok = await takeOne(item);
    if (!ok) {
      for (const done of taken) await returnOne(done);
      return false;
    }
    taken.push(item);
  }

  return true;
}

/** Puts stock back — a cancelled order, or one whose payment never arrived. */
export async function restoreStock(items: StockAdjustment[]): Promise<void> {
  for (const item of items) await returnOne(item);
}
