import { z } from 'zod';

import { ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from '../constants.js';
import { customerSchema, taxBreakdownSchema } from './checkout.schema.js';
import { objectIdSchema, paiseSchema, phoneSchema } from './common.schema.js';

/**
 * A line as it was at the moment of purchase.
 *
 * Deliberately denormalised — name, image, price and HSN are copied rather than
 * referenced. Editing a shoe's price or deleting it later must not retroactively
 * change what an old invoice says, and a GST invoice has to stay reproducible
 * for years.
 */
export const orderItemSchema = z.object({
  productId: objectIdSchema,
  name: z.string(),
  slug: z.string(),
  brand: z.string(),
  image: z.string(),
  color: z.string(),
  size: z.number(),
  qty: z.number().int(),
  hsnCode: z.string(),
  unitPricePaise: paiseSchema,
  lineTotalPaise: paiseSchema,
});

export const orderStatusEventSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  at: z.iso.datetime(),
  note: z.string().optional(),
});

export const invoiceSchema = z.object({
  /** Gapless per financial year, e.g. INV/2026-27/0001. */
  number: z.string(),
  generatedAt: z.iso.datetime(),
});

export const orderSchema = z.object({
  _id: objectIdSchema,
  orderNumber: z.string(),

  items: z.array(orderItemSchema),
  customer: customerSchema,

  subtotalPaise: paiseSchema,
  deliveryChargePaise: paiseSchema,
  codChargePaise: paiseSchema,
  totalPaise: paiseSchema,
  tax: taxBreakdownSchema,

  paymentMethod: z.enum(PAYMENT_METHODS),
  paymentStatus: z.enum(PAYMENT_STATUSES),

  status: z.enum(ORDER_STATUSES),
  statusHistory: z.array(orderStatusEventSchema),

  /**
   * Guards the stock-restore path. Cancelling twice must not put the same pair
   * back into inventory twice.
   */
  stockRestored: z.boolean(),
  /** True once stock has actually been taken — COD on placement, online on payment. */
  stockCommitted: z.boolean(),

  invoice: invoiceSchema.nullable(),
  notes: z.string().optional(),

  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/**
 * The customer-facing view. Everything the buyer legitimately needs to see and
 * nothing else — no internal flags, no Razorpay identifiers.
 */
export const publicOrderSchema = orderSchema.pick({
  orderNumber: true,
  items: true,
  subtotalPaise: true,
  deliveryChargePaise: true,
  codChargePaise: true,
  totalPaise: true,
  tax: true,
  paymentMethod: true,
  paymentStatus: true,
  status: true,
  statusHistory: true,
  invoice: true,
  createdAt: true,
});

/**
 * Guest order lookup. There are no accounts, so the order number alone is not
 * enough — the phone number on the order acts as the shared secret, which is
 * why this endpoint is also rate limited.
 */
export const trackOrderQuerySchema = z.object({
  orderNumber: z.string().trim().min(4).max(40),
  phone: phoneSchema,
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(300).optional(),
});

export const adminOrderListQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  q: z.string().trim().max(80).optional(),
  /** Unpaid online orders are hidden by default — they are abandoned carts, not orders. */
  includeAbandoned: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * Admin view of an order, plus the risk signal that matters before dispatching
 * a cash-on-delivery parcel.
 */
export const adminOrderSchema = orderSchema.extend({
  /** How many previous orders from this phone number were cancelled. */
  priorCancelledCount: z.number().int(),
});

export type OrderItem = z.infer<typeof orderItemSchema>;
export type OrderStatusEvent = z.infer<typeof orderStatusEventSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type Order = z.infer<typeof orderSchema>;
export type PublicOrder = z.infer<typeof publicOrderSchema>;
export type AdminOrder = z.infer<typeof adminOrderSchema>;
export type TrackOrderQuery = z.infer<typeof trackOrderQuerySchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type AdminOrderListQuery = z.infer<typeof adminOrderListQuerySchema>;
