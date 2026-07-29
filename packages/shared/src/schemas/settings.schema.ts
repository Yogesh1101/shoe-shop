import { z } from 'zod';

import {
  emailSchema,
  paiseSchema,
  phoneSchema,
  pincodeSchema,
  stateNameSchema,
} from './common.schema.js';

/**
 * One GST rate band. `maxPricePaise: null` marks the open-ended top slab.
 *
 * Slabs live in the database rather than in code because footwear GST in India
 * is price-banded and gets revised. A hard-coded rate would silently produce
 * wrong invoices the next time it changes; this way the shop owner fixes it in
 * the admin panel without a redeploy.
 */
export const gstSlabSchema = z.object({
  maxPricePaise: paiseSchema.positive().nullable(),
  rateBps: z.number().int().min(0).max(10_000, { error: 'A GST rate above 100% is not a rate' }),
});

/**
 * Raw fields, no cross-field rules — see the note on `productFieldsSchema` for
 * why the refinements are layered on separately.
 */
const settingsFieldsSchema = z.object({
  // --- Shop identity, used on the site and on invoices --------------------
  shopName: z.string().trim().min(2).max(80),
  legalName: z.string().trim().max(120).default(''),
  contactPhone: phoneSchema,
  contactEmail: emailSchema,
  instagramUrl: z.union([z.url(), z.literal('')]).default(''),

  // --- Delivery -----------------------------------------------------------
  deliveryChargePaise: paiseSchema,
  /** Orders at or above this subtotal ship free. */
  freeDeliveryAbovePaise: paiseSchema,
  /**
   * A blocklist, not an allowlist. India has roughly 19,000 PIN codes and
   * curating them by hand is unworkable; blocking the handful you cannot
   * reach is not.
   */
  blockedPincodes: z.array(pincodeSchema).max(2000).default([]),
  estimatedDeliveryDays: z.string().trim().max(40).default('3-7 business days'),

  // --- Cash on delivery ---------------------------------------------------
  codEnabled: z.boolean().default(true),
  codExtraChargePaise: paiseSchema.default(0),
  /** Above this, COD is refused and the customer must prepay. 0 disables the cap. */
  codMaxOrderValuePaise: paiseSchema.default(0),
  /** Rate limit against prank orders. */
  maxOrdersPerPhonePerDay: z.number().int().min(1).max(50).default(5),

  // --- Tax ----------------------------------------------------------------
  gstEnabled: z.boolean().default(true),
  gstin: z
    .union([
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/, {
          error: 'That does not look like a valid 15-character GSTIN',
        }),
      z.literal(''),
    ])
    .default(''),
  /** Seller's state — the other half of the place-of-supply comparison. */
  sellerState: stateNameSchema,
  sellerAddress: z.string().trim().max(300).default(''),
  /**
   * Indian retail quotes tax-inclusive prices: the ₹1,499 on the product page
   * already contains GST, and the invoice works backwards from it.
   */
  pricesIncludeTax: z.boolean().default(true),
  gstSlabs: z.array(gstSlabSchema).min(1, { error: 'Define at least one GST slab' }),
  hsnDefault: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/),
});

/**
 * Slabs must read as a ladder: ascending price bounds, with exactly one
 * open-ended band and it must be last. Anything else leaves a price range with
 * either no rate or two competing rates.
 */
function slabsFormAValidLadder(slabs: GstSlab[] | undefined): boolean {
  if (slabs === undefined) return true;

  const last = slabs.at(-1);
  if (!last || last.maxPricePaise !== null) return false;

  const bounded = slabs.slice(0, -1);
  if (bounded.some((slab) => slab.maxPricePaise === null)) return false;

  return bounded.every((slab, index) => {
    const previous = bounded[index - 1];
    return previous === undefined || previous.maxPricePaise! < slab.maxPricePaise!;
  });
}

const GSTIN_REQUIRED = 'A GSTIN is required when GST invoicing is on';
const SLAB_LADDER_ERROR =
  'GST slabs must be in ascending order of price, with the final slab left open-ended';

export const settingsSchema = settingsFieldsSchema
  .refine((settings) => !settings.gstEnabled || settings.gstin !== '', {
    error: GSTIN_REQUIRED,
    path: ['gstin'],
  })
  .refine((settings) => slabsFormAValidLadder(settings.gstSlabs), {
    error: SLAB_LADDER_ERROR,
    path: ['gstSlabs'],
  });

/** The subset the storefront is allowed to read — no internal limits leak out. */
export const publicSettingsSchema = z.object({
  shopName: z.string(),
  contactPhone: z.string(),
  contactEmail: z.string(),
  instagramUrl: z.string(),
  deliveryChargePaise: paiseSchema,
  freeDeliveryAbovePaise: paiseSchema,
  estimatedDeliveryDays: z.string(),
  codEnabled: z.boolean(),
  codExtraChargePaise: paiseSchema,
  codMaxOrderValuePaise: paiseSchema,
});

/**
 * Partial update. Both rules stay enforced, but only against what the patch
 * actually contains — toggling `codEnabled` alone must not demand a GSTIN in
 * the same request. Fields absent here keep their stored values, and the server
 * re-validates the merged document before saving.
 */
export const settingsUpdateSchema = settingsFieldsSchema
  .partial()
  .refine((settings) => settings.gstEnabled !== true || settings.gstin !== '', {
    error: GSTIN_REQUIRED,
    path: ['gstin'],
  })
  .refine((settings) => slabsFormAValidLadder(settings.gstSlabs), {
    error: SLAB_LADDER_ERROR,
    path: ['gstSlabs'],
  });

export type GstSlab = z.infer<typeof gstSlabSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type PublicSettings = z.infer<typeof publicSettingsSchema>;
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
