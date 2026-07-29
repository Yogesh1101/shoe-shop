import { z } from 'zod';

import { INDIAN_STATE_NAMES } from '../constants.js';

/** A Mongo ObjectId as it appears over the wire. */
export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, { error: 'Not a valid id' });

/**
 * Any money field. The `int()` is the point: it turns a stray decimal — a
 * client that sent rupees instead of paise, a miscalculated tax split — into a
 * validation error at the edge rather than a rounding bug deep inside an
 * invoice.
 */
export const paiseSchema = z
  .number()
  .int({ error: 'Amounts must be whole paise' })
  .nonnegative({ error: 'Amounts cannot be negative' })
  // ₹10,00,000. Nothing in a shoe shop legitimately exceeds this, and the bound
  // stops an overflow or a misplaced decimal from reaching Razorpay.
  .max(100_000_000, { error: 'Amount is implausibly large' });

/**
 * Indian mobile number. Accepts what people actually type — `+91 98765 43210`,
 * `098765-43210` — and normalises to the bare ten digits before validating,
 * so the stored value is always comparable for order lookup and rate limiting.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, '').replace(/^(?:91|0)(?=\d{10}$)/, ''))
  .pipe(
    z.string().regex(/^[6-9]\d{9}$/, {
      error: 'Enter a valid 10-digit Indian mobile number',
    }),
  );

/** Six digits, never starting with zero. */
export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d{5}$/, { error: 'Enter a valid 6-digit PIN code' });

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: 'Not a valid slug' });

export const emailSchema = z.email({ error: 'Enter a valid email address' }).trim().toLowerCase();

/** Hex colour for a variant swatch, `#fff` or `#ffffff`. */
export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, { error: 'Enter a hex colour like #1a1a1a' });

export const stateNameSchema = z.enum(INDIAN_STATE_NAMES as [string, ...string[]], {
  error: 'Select a state',
});

export const addressSchema = z.object({
  line1: z.string().trim().min(5, { error: 'Address is too short' }).max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2, { error: 'Enter a city' }).max(60),
  state: stateNameSchema,
  pincode: pincodeSchema,
});

/** Shape every error response takes, so the client normalises it in one place. */
export const apiErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string(),
    details: z.unknown().optional(),
  }),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

export function paginatedSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  });
}

export type Address = z.infer<typeof addressSchema>;
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
