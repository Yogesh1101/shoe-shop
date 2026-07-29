import { z } from 'zod';

import { MAX_CART_ITEMS, MAX_ITEM_QUANTITY, PAYMENT_METHODS } from '../constants.js';
import {
  addressSchema,
  emailSchema,
  objectIdSchema,
  paiseSchema,
  phoneSchema,
  pincodeSchema,
  stateNameSchema,
} from './common.schema.js';

/**
 * One line in the cart.
 *
 * Note what is absent: **no price**. The browser tells the server *what* is
 * being bought, never *what it costs*. Prices are looked up server-side from
 * the database on every quote and every order, so a tampered request or a cart
 * that sat in localStorage for three weeks cannot influence the amount charged.
 */
export const cartItemSchema = z.object({
  productId: objectIdSchema,
  color: z.string().trim().min(1).max(40),
  size: z.number().min(1).max(14),
  qty: z.number().int().min(1).max(MAX_ITEM_QUANTITY),
});

export const cartSchema = z
  .array(cartItemSchema)
  .min(1, { error: 'Your cart is empty' })
  .max(MAX_CART_ITEMS, { error: 'Too many different items in one order' })
  .refine(
    (items) =>
      new Set(items.map((i) => `${i.productId}|${i.color.toLowerCase()}|${i.size}`)).size ===
      items.length,
    { error: 'The same shoe, colour and size is listed twice' },
  );

// ---------------------------------------------------------------------------
// Quote — priced cart, before an order exists
// ---------------------------------------------------------------------------

/**
 * Pincode and state are optional so the cart page can show a subtotal before
 * the customer has typed an address. Delivery and tax are only computed once
 * they are known.
 */
export const quoteRequestSchema = z.object({
  items: cartSchema,
  pincode: pincodeSchema.optional(),
  state: stateNameSchema.optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).default('razorpay'),
});

export const quoteLineSchema = z.object({
  productId: objectIdSchema,
  name: z.string(),
  slug: z.string(),
  image: z.string(),
  brand: z.string(),
  color: z.string(),
  size: z.number(),
  qty: z.number().int(),
  unitPricePaise: paiseSchema,
  lineTotalPaise: paiseSchema,
});

/** A cart line the shop cannot currently fulfil. */
export const stockIssueSchema = z.object({
  productId: objectIdSchema,
  name: z.string(),
  color: z.string(),
  size: z.number(),
  requested: z.number().int(),
  available: z.number().int(),
  reason: z.enum(['out-of-stock', 'insufficient-stock', 'unavailable']),
});

export const taxLineSchema = z.object({
  /** Rendered on the invoice, e.g. "CGST 2.5%". */
  label: z.string(),
  rateBps: z.number().int(),
  amountPaise: paiseSchema,
});

export const taxBreakdownSchema = z.object({
  /** Intra-state sales split into CGST + SGST; inter-state charge a single IGST. */
  mode: z.enum(['cgst_sgst', 'igst', 'none']),
  taxablePaise: paiseSchema,
  lines: z.array(taxLineSchema),
  totalPaise: paiseSchema,
});

export const quoteSchema = z.object({
  lines: z.array(quoteLineSchema),
  subtotalPaise: paiseSchema,
  deliveryChargePaise: paiseSchema,
  codChargePaise: paiseSchema,
  totalPaise: paiseSchema,
  tax: taxBreakdownSchema,

  /** How much more to spend to qualify for free delivery; null when it already applies. */
  freeDeliveryShortfallPaise: paiseSchema.nullable(),
  /** Null until a pincode is supplied. */
  pincodeServiceable: z.boolean().nullable(),
  codAvailable: z.boolean(),
  /** Non-empty means checkout must be blocked. */
  stockIssues: z.array(stockIssueSchema),
});

// ---------------------------------------------------------------------------
// Placing the order
// ---------------------------------------------------------------------------

export const customerSchema = z.object({
  name: z.string().trim().min(2, { error: 'Enter your name' }).max(80),
  phone: phoneSchema,
  email: emailSchema,
  address: addressSchema,
});

export const createOrderSchema = z.object({
  items: cartSchema,
  customer: customerSchema,
  paymentMethod: z.enum(PAYMENT_METHODS),
  notes: z.string().trim().max(500).optional(),
  /**
   * Honeypot. Hidden from real users with CSS, so anything that fills it in is
   * a bot. The server rejects the request when this is non-empty.
   */
  website: z.string().max(0).optional(),
});

/** What the server hands back so the browser can open Razorpay Checkout. */
export const createOrderResponseSchema = z.object({
  orderId: objectIdSchema,
  orderNumber: z.string(),
  totalPaise: paiseSchema,
  paymentMethod: z.enum(PAYMENT_METHODS),
  razorpay: z
    .object({
      orderId: z.string(),
      keyId: z.string(),
      amountPaise: paiseSchema,
      currency: z.literal('INR'),
    })
    .optional(),
});

/** Returned by Razorpay Checkout, verified server-side against the HMAC. */
export const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export type CartItem = z.infer<typeof cartItemSchema>;
export type Cart = z.infer<typeof cartSchema>;
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
export type QuoteLine = z.infer<typeof quoteLineSchema>;
export type StockIssue = z.infer<typeof stockIssueSchema>;
export type TaxLine = z.infer<typeof taxLineSchema>;
export type TaxBreakdown = z.infer<typeof taxBreakdownSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type Customer = z.infer<typeof customerSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CreateOrderResponse = z.infer<typeof createOrderResponseSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
