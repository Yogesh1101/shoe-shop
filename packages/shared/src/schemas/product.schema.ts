import { z } from 'zod';

import {
  CATEGORIES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_SHOE_SIZE,
  MIN_SHOE_SIZE,
  PRODUCT_SORT_OPTIONS,
  SHOE_TYPES,
} from '../constants.js';
import { hexColorSchema, objectIdSchema, paiseSchema, slugSchema } from './common.schema.js';

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

export const productImageSchema = z.object({
  url: z.url({ error: 'Image URL is invalid' }),
  /**
   * Cloudinary's identifier for the asset. Stored so deleting a product or
   * swapping a photo also removes the file from Cloudinary — without it, the
   * free tier slowly fills with orphaned images nobody can find.
   */
  publicId: z.string().min(1),
});

export const variantSizeSchema = z.object({
  size: z
    .number()
    .min(MIN_SHOE_SIZE)
    .max(MAX_SHOE_SIZE)
    // Half sizes are real; quarter sizes are a typo.
    .refine((size) => Number.isInteger(size * 2), {
      error: 'Size must be a whole or half number',
    }),
  stock: z.number().int().min(0, { error: 'Stock cannot be negative' }),
});

export const productVariantSchema = z
  .object({
    color: z.string().trim().min(1, { error: 'Name the colour' }).max(40),
    colorHex: hexColorSchema,
    images: z
      .array(productImageSchema)
      .min(1, { error: 'Add at least one photo' })
      .max(8, { error: 'At most 8 photos per colour' }),
    sizes: z.array(variantSizeSchema).min(1, { error: 'Add at least one size' }),
  })
  .refine((variant) => new Set(variant.sizes.map((s) => s.size)).size === variant.sizes.length, {
    error: 'The same size is listed twice',
    path: ['sizes'],
  });

// ---------------------------------------------------------------------------
// Product
// ---------------------------------------------------------------------------

/**
 * The raw field set, without cross-field rules. Kept separate because Zod
 * cannot `.partial()` a schema that carries refinements — and a partial update
 * needs different semantics anyway: "MRP >= price" can only be checked when
 * both values are actually present in the patch.
 */
const productFieldsSchema = z.object({
  name: z.string().trim().min(3, { error: 'Name is too short' }).max(120),
  brand: z.string().trim().min(1, { error: 'Enter a brand' }).max(60),
  description: z.string().trim().max(2000).default(''),
  category: z.enum(CATEGORIES),
  type: z.enum(SHOE_TYPES),

  /** What the customer pays. GST is inside this by default. */
  pricePaise: paiseSchema.refine((p) => p > 0, { error: 'Price is required' }),
  /** Shown struck through. Equal to price means no discount is displayed. */
  mrpPaise: paiseSchema,

  hsnCode: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, { error: 'HSN must be 4-8 digits' }),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
  isActive: z.boolean().default(true),

  variants: z
    .array(productVariantSchema)
    .min(1, { error: 'Add at least one colour' })
    .max(12, { error: 'At most 12 colours per product' }),
});

/** Colours must be distinct within a product, however the user cased them. */
function hasDistinctColors(variants: { color: string }[] | undefined): boolean {
  if (variants === undefined) return true;
  return new Set(variants.map((v) => v.color.toLowerCase())).size === variants.length;
}

/** What the admin panel submits when creating a shoe. */
export const productInputSchema = productFieldsSchema
  .refine((product) => product.mrpPaise >= product.pricePaise, {
    error: 'MRP cannot be lower than the selling price',
    path: ['mrpPaise'],
  })
  .refine((product) => hasDistinctColors(product.variants), {
    error: 'The same colour is listed twice',
    path: ['variants'],
  });

/**
 * Partial edit. The MRP rule only applies when the patch actually carries both
 * values — sending `{ isActive: false }` must not trip a price comparison.
 * When only one of the pair is present the server re-checks against the stored
 * document before saving.
 */
export const productUpdateSchema = productFieldsSchema
  .partial()
  .refine(
    (product) =>
      product.mrpPaise === undefined ||
      product.pricePaise === undefined ||
      product.mrpPaise >= product.pricePaise,
    { error: 'MRP cannot be lower than the selling price', path: ['mrpPaise'] },
  )
  .refine((product) => hasDistinctColors(product.variants), {
    error: 'The same colour is listed twice',
    path: ['variants'],
  });

/** What the API returns. Dates are ISO strings over the wire. */
export const productSchema = z.object({
  _id: objectIdSchema,
  slug: slugSchema,
  name: z.string(),
  brand: z.string(),
  description: z.string(),
  category: z.enum(CATEGORIES),
  type: z.enum(SHOE_TYPES),
  pricePaise: paiseSchema,
  mrpPaise: paiseSchema,
  hsnCode: z.string(),
  tags: z.array(z.string()),
  isActive: z.boolean(),
  variants: z.array(productVariantSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

// ---------------------------------------------------------------------------
// Catalog listing
// ---------------------------------------------------------------------------

/**
 * Comma-separated repeated filters (`?brand=Nike,Puma`) are normalised to
 * arrays here so both the URL and the API stay readable.
 */
const csvArray = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    const raw = Array.isArray(value) ? value : value.split(',');
    const cleaned = raw.map((item) => item.trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : undefined;
  });

export const productListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  /**
   * Fetch specific products by id. The cart stores only
   * `{ productId, color, size, qty }` — no names, images or prices — so the
   * cart page resolves its display data through this rather than caching
   * details that would go stale the moment a shoe is edited.
   */
  ids: csvArray,
  category: z.enum(CATEGORIES).optional(),
  type: z.enum(SHOE_TYPES).optional(),
  brand: csvArray,
  color: csvArray,
  size: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      const raw = Array.isArray(value) ? value : value.split(',');
      const sizes = raw.map((item) => Number(item.trim())).filter((n) => Number.isFinite(n));
      return sizes.length > 0 ? sizes : undefined;
    }),
  minPricePaise: z.coerce.number().int().nonnegative().optional(),
  maxPricePaise: z.coerce.number().int().nonnegative().optional(),
  /** Admin-only: include unpublished shoes. Ignored on public routes. */
  includeInactive: z.coerce.boolean().default(false),
  sort: z.enum(PRODUCT_SORT_OPTIONS).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

/** Distinct values used to build the filter sidebar without a second round trip. */
export const productFacetsSchema = z.object({
  brands: z.array(z.string()),
  colors: z.array(z.object({ color: z.string(), colorHex: z.string() })),
  sizes: z.array(z.number()),
  priceRangePaise: z.object({ min: paiseSchema, max: paiseSchema }),
});

export type ProductImage = z.infer<typeof productImageSchema>;
export type VariantSize = z.infer<typeof variantSizeSchema>;
export type ProductVariant = z.infer<typeof productVariantSchema>;
export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductUpdate = z.infer<typeof productUpdateSchema>;
export type Product = z.infer<typeof productSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type ProductFacets = z.infer<typeof productFacetsSchema>;
