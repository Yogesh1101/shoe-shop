import { Product } from '../models/Product.js';

/** `"Nike Air Max 90 (Black/White)"` -> `"nike-air-max-90-black-white"`. */
export function slugify(input: string): string {
  return (
    input
      .normalize('NFKD')
      // Strip diacritics so "Adidas Forum Ré" and "Adidas Forum Re" do not become
      // two different-looking URLs.
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/, '')
  );
}

/**
 * Produce a slug not already taken, appending `-2`, `-3` and so on.
 *
 * `excludeId` lets an edit keep its own slug: without it, renaming a product to
 * the name it already has would collide with itself and drift to `-2`.
 *
 * There is a theoretical race if two products with the same name are created in
 * the same instant; the unique index on `slug` is what actually guarantees
 * correctness, and the caller surfaces that as a duplicate-key conflict.
 */
export async function uniqueSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name) || 'shoe';

  for (let suffix = 1; suffix < 100; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    const clash = await Product.findOne({ slug: candidate }).select('_id').lean();
    if (!clash || (excludeId && String(clash._id) === excludeId)) {
      return candidate;
    }
  }

  // Vanishingly unlikely; a timestamp suffix is better than looping forever.
  return `${base}-${Date.now().toString(36)}`;
}
