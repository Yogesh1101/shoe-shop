import {
  ABANDONED_ORDER_TTL_HOURS,
  type AdminOrder,
  type AdminOrderListQuery,
  type CreateOrderInput,
  type CreateOrderResponse,
  ORDER_STATUS_FLOW,
  type OrderStatusEvent,
  type PublicOrder,
  type TrackOrderQuery,
  type UpdateOrderStatusInput,
  type VerifyPaymentInput,
} from '@shoe-shop/shared';
// Mongoose 9 renamed `FilterQuery` to `QueryFilter`.
import type { QueryFilter } from 'mongoose';

import { env, features } from '../config/env.js';
import { Order, type OrderDoc, type OrderDocument, type OrderItemDoc } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { nextInvoiceNumber, nextOrderNumber } from '../utils/sequence.js';
import { buildQuote } from './checkout.service.js';
import { sendOrderConfirmationEmail, sendOrderStatusEmail, sendOwnerNewOrderAlert } from './email.service.js';
import { createRazorpayOrder, verifyPaymentSignature } from './razorpay.service.js';
import { getSettings } from './settings.service.js';
import { commitStock, restoreStock, type StockAdjustment } from './stock.service.js';

export interface PaginatedAdminOrders {
  items: AdminOrder[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function toStockAdjustment(item: OrderItemDoc): StockAdjustment {
  return { productId: item.productId.toString(), color: item.color, size: item.size, qty: item.qty };
}

function toStatusHistory(order: OrderDocument): OrderStatusEvent[] {
  return order.statusHistory.map((event) => ({
    status: event.status,
    at: event.at.toISOString(),
    note: event.note,
  }));
}

function toOrderItems(order: OrderDocument): PublicOrder['items'] {
  return order.items.map((item) => ({
    productId: item.productId.toString(),
    name: item.name,
    slug: item.slug,
    brand: item.brand,
    image: item.image,
    color: item.color,
    size: item.size,
    qty: item.qty,
    hsnCode: item.hsnCode,
    unitPricePaise: item.unitPricePaise,
    lineTotalPaise: item.lineTotalPaise,
  }));
}

/**
 * The buyer-facing view of an order. No customer details and no Razorpay
 * identifiers — this is what a guest tracking their order by phone number
 * gets back, so it deliberately carries nothing an attacker could use beyond
 * what they already had to know to look it up.
 */
function toPublicOrder(order: OrderDocument): PublicOrder {
  return {
    orderNumber: order.orderNumber,
    items: toOrderItems(order),
    subtotalPaise: order.subtotalPaise,
    deliveryChargePaise: order.deliveryChargePaise,
    codChargePaise: order.codChargePaise,
    totalPaise: order.totalPaise,
    tax: order.tax,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    status: order.status,
    statusHistory: toStatusHistory(order),
    invoice: order.invoice
      ? { number: order.invoice.number, generatedAt: order.invoice.generatedAt.toISOString() }
      : null,
    createdAt: order.createdAt.toISOString(),
  };
}

function toAdminOrder(order: OrderDocument, priorCancelledCount: number): AdminOrder {
  return {
    _id: order.id,
    orderNumber: order.orderNumber,
    items: toOrderItems(order),
    customer: order.customer,
    subtotalPaise: order.subtotalPaise,
    deliveryChargePaise: order.deliveryChargePaise,
    codChargePaise: order.codChargePaise,
    totalPaise: order.totalPaise,
    tax: order.tax,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    status: order.status,
    statusHistory: toStatusHistory(order),
    stockRestored: order.stockRestored,
    stockCommitted: order.stockCommitted,
    invoice: order.invoice
      ? { number: order.invoice.number, generatedAt: order.invoice.generatedAt.toISOString() }
      : null,
    notes: order.notes,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    priorCancelledCount,
  };
}

/**
 * How many of this phone number's *other* orders were cancelled — the signal
 * an admin checks before dispatching a cash-on-delivery parcel to someone with
 * a history of refusing them. Batched by phone rather than one query per row.
 */
async function priorCancelledCounts(orders: OrderDocument[]): Promise<Map<string, number>> {
  const phones = [...new Set(orders.map((order) => order.customer.phone))];
  if (phones.length === 0) return new Map();

  const grouped = await Order.aggregate<{ _id: string; count: number }>([
    { $match: { 'customer.phone': { $in: phones }, status: 'cancelled' } },
    { $group: { _id: '$customer.phone', count: { $sum: 1 } } },
  ]);
  return new Map(grouped.map((group) => [group._id, group.count]));
}

function priorCancelledCountFor(order: OrderDocument, counts: Map<string, number>): number {
  const raw = counts.get(order.customer.phone) ?? 0;
  // The aggregation counts every cancelled order for the phone, including this
  // one if it is itself cancelled — "prior" means everything before it.
  return order.status === 'cancelled' ? Math.max(0, raw - 1) : raw;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Places an order.
 *
 * Pricing and stock are re-checked here via the same quote used by the
 * checkout page moments earlier — the request is never trusted for what
 * anything costs or whether it is in stock, only for *what* is being bought.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResponse> {
  // Honeypot: a real shopper never fills in a field hidden with CSS.
  if (input.website) {
    throw ApiError.badRequest('Something went wrong. Please try again.');
  }
  if (input.paymentMethod === 'razorpay' && !features.razorpay) {
    throw ApiError.notConfigured('Razorpay');
  }

  const quote = await buildQuote({
    items: input.items,
    pincode: input.customer.address.pincode,
    state: input.customer.address.state,
    paymentMethod: input.paymentMethod,
  });

  if (quote.stockIssues.length > 0) {
    throw ApiError.conflict(
      'STOCK_UNAVAILABLE',
      'Some items in your cart are no longer available',
      quote.stockIssues,
    );
  }
  if (quote.pincodeServiceable === false) {
    throw ApiError.badRequest('Sorry, we cannot deliver to this PIN code');
  }
  if (input.paymentMethod === 'cod' && !quote.codAvailable) {
    throw ApiError.badRequest('Cash on delivery is not available for this order');
  }

  const settings = await getSettings();

  if (input.paymentMethod === 'cod') {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await Order.countDocuments({
      'customer.phone': input.customer.phone,
      createdAt: { $gte: since },
    });
    if (recentCount >= settings.maxOrdersPerPhonePerDay) {
      throw ApiError.tooManyRequests(
        'Too many orders placed from this number today. Please contact us directly.',
      );
    }
  }

  // The quote does not carry HSN codes — the client has no use for them — so
  // they are looked up once more here, for the invoice.
  const productIds = [...new Set(quote.lines.map((line) => line.productId))];
  const products = await Product.find({ _id: { $in: productIds } }, { hsnCode: 1 });
  const hsnById = new Map(products.map((product) => [product.id, product.hsnCode]));

  const orderNumber = await nextOrderNumber();

  const order = await Order.create({
    orderNumber,
    items: quote.lines.map((line) => ({
      productId: line.productId,
      name: line.name,
      slug: line.slug,
      brand: line.brand,
      image: line.image,
      color: line.color,
      size: line.size,
      qty: line.qty,
      hsnCode: hsnById.get(line.productId) ?? settings.hsnDefault,
      unitPricePaise: line.unitPricePaise,
      lineTotalPaise: line.lineTotalPaise,
    })),
    customer: input.customer,
    subtotalPaise: quote.subtotalPaise,
    deliveryChargePaise: quote.deliveryChargePaise,
    codChargePaise: quote.codChargePaise,
    totalPaise: quote.totalPaise,
    tax: quote.tax,
    paymentMethod: input.paymentMethod,
    paymentStatus: 'pending',
    status: 'placed',
    statusHistory: [{ status: 'placed', at: new Date() }],
    stockCommitted: false,
    stockRestored: false,
    notes: input.notes,
  });

  if (input.paymentMethod === 'cod') {
    // Cash on delivery has no payment step to wait for, so the sale is final
    // the moment the order is placed — stock is taken now, not later.
    const committed = await commitStock(order.items.map(toStockAdjustment));
    if (!committed) {
      order.status = 'cancelled';
      order.statusHistory.push({
        status: 'cancelled',
        at: new Date(),
        note: 'Stock sold out before the order could be confirmed',
      });
      await order.save();
      throw ApiError.conflict('STOCK_CHANGED', 'One or more items sold out while you were checking out');
    }

    order.stockCommitted = true;
    order.invoice = { number: await nextInvoiceNumber(), generatedAt: new Date() };
    await order.save();

    await sendOrderConfirmationEmail(order);
    await sendOwnerNewOrderAlert(order);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalPaise: order.totalPaise,
      paymentMethod: 'cod',
    };
  }

  const razorpayOrder = await createRazorpayOrder(order.totalPaise, order.orderNumber);
  order.razorpay = { orderId: razorpayOrder.id };
  await order.save();

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalPaise: order.totalPaise,
    paymentMethod: 'razorpay',
    razorpay: {
      orderId: razorpayOrder.id,
      keyId: env.RAZORPAY_KEY_ID,
      amountPaise: razorpayOrder.amountPaise,
      currency: 'INR',
    },
  };
}

/**
 * Marks a Razorpay order as paid: commits stock, assigns the invoice number,
 * and sends the confirmation emails that a COD order gets at placement time.
 *
 * Shared by both confirmation paths — the checkout page's callback right
 * after payment, and the webhook that arrives independently from Razorpay's
 * servers. Those two can genuinely race each other (the whole reason the
 * webhook exists is that the callback might never arrive), so the "claim" on
 * the order is an atomic conditional update rather than a plain save: only
 * one of two simultaneous callers can flip `paymentStatus` away from
 * `pending`, which is what stops both from committing stock and double-taking
 * the same pair.
 */
async function finalizePaidOrder(
  order: OrderDocument,
  paymentId: string,
  signature?: string,
): Promise<OrderDocument> {
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: { $ne: 'paid' } },
    { $set: { paymentStatus: 'paid', razorpay: { ...order.razorpay, paymentId, signature } } },
    { new: true },
  );
  // Already finalized by the other path — return its result rather than the
  // stale, pre-finalization document the caller started with.
  if (!claimed) return (await Order.findById(order._id)) ?? order;

  const committed = await commitStock(claimed.items.map(toStockAdjustment));
  if (committed) {
    claimed.stockCommitted = true;
    claimed.invoice = { number: await nextInvoiceNumber(), generatedAt: new Date() };
  } else {
    // The order was priced and quoted as available, but two online buyers can
    // still both reach payment for the same last pair. The money has already
    // been captured by Razorpay at this point, so this is a manual-review flag
    // for the shop owner rather than something to fail the request over.
    claimed.notes = [claimed.notes, 'Stock could not be reserved after payment — review manually.']
      .filter(Boolean)
      .join(' ');
    logger.error({ orderNumber: claimed.orderNumber }, 'Paid order could not commit stock; needs manual review');
  }

  await claimed.save();
  await sendOrderConfirmationEmail(claimed);
  await sendOwnerNewOrderAlert(claimed);
  return claimed;
}

/** The checkout page's callback once Razorpay Checkout reports success. */
export async function verifyRazorpayPayment(
  orderId: string,
  input: VerifyPaymentInput,
): Promise<PublicOrder> {
  const order = await Order.findById(orderId);
  if (!order) throw ApiError.notFound('Order not found');
  if (order.paymentMethod !== 'razorpay') {
    throw ApiError.badRequest('This order does not use online payment');
  }
  if (order.razorpay?.orderId !== input.razorpayOrderId) {
    throw ApiError.badRequest('This payment does not match the order');
  }
  // Already confirmed, most likely by the webhook arriving first — same
  // result either way, so this is a no-op rather than an error.
  if (order.paymentStatus === 'paid') return toPublicOrder(order);

  const valid = verifyPaymentSignature({
    razorpayOrderId: input.razorpayOrderId,
    razorpayPaymentId: input.razorpayPaymentId,
    razorpaySignature: input.razorpaySignature,
  });
  if (!valid) {
    order.paymentStatus = 'failed';
    await order.save();
    throw ApiError.badRequest('Payment verification failed');
  }

  const finalized = await finalizePaidOrder(order, input.razorpayPaymentId, input.razorpaySignature);
  return toPublicOrder(finalized);
}

interface RazorpayWebhookPayload {
  event: string;
  payload?: { payment?: { entity?: { id: string; order_id: string } } };
}

/**
 * The reliable confirmation path: it arrives from Razorpay's own servers, so
 * unlike the checkout callback above it does not depend on the customer's
 * browser still being open once payment succeeds.
 */
export async function handleRazorpayWebhookEvent(payload: RazorpayWebhookPayload): Promise<void> {
  if (payload.event === 'payment.failed') {
    const entity = payload.payload?.payment?.entity;
    if (!entity) return;
    const order = await Order.findOne({ 'razorpay.orderId': entity.order_id });
    if (order && order.paymentStatus === 'pending') {
      order.paymentStatus = 'failed';
      await order.save();
    }
    return;
  }

  if (payload.event !== 'payment.captured') return;

  const entity = payload.payload?.payment?.entity;
  if (!entity) return;

  const order = await Order.findOne({ 'razorpay.orderId': entity.order_id });
  if (!order || order.paymentStatus === 'paid') return;

  await finalizePaidOrder(order, entity.id);
}

/**
 * Guest order lookup. There are no accounts, so the phone number on the order
 * acts as the shared secret — matching it is what stands in for auth here.
 */
export async function trackOrder(query: TrackOrderQuery): Promise<PublicOrder> {
  const order = await Order.findOne({ orderNumber: query.orderNumber });
  if (!order || order.customer.phone !== query.phone) {
    throw ApiError.notFound('No order found with that order number and phone number');
  }
  return toPublicOrder(order);
}

/** Same lookup as `trackOrder`, but returns the raw document for the invoice PDF. */
export async function getOrderForInvoiceByTracking(
  orderNumber: string,
  phone: string,
): Promise<OrderDocument> {
  const order = await Order.findOne({ orderNumber });
  if (!order || order.customer.phone !== phone) {
    throw ApiError.notFound('No order found with that order number and phone number');
  }
  return order;
}

export async function getOrderDocument(id: string): Promise<OrderDocument> {
  const order = await Order.findById(id);
  if (!order) throw ApiError.notFound('Order not found');
  return order;
}

export async function listOrders(query: AdminOrderListQuery): Promise<PaginatedAdminOrders> {
  const filter: QueryFilter<OrderDoc> = {};
  if (query.status) filter.status = query.status;
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
  if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;
  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ orderNumber: regex }, { 'customer.phone': regex }, { 'customer.name': regex }];
  }
  // Unpaid online orders are abandoned carts, not orders — hidden by default
  // so the admin's list only shows things that actually happened.
  if (!query.includeAbandoned) {
    const cutoff = new Date(Date.now() - ABANDONED_ORDER_TTL_HOURS * 60 * 60 * 1000);
    filter.$nor = [{ paymentMethod: 'razorpay', paymentStatus: 'pending', createdAt: { $lt: cutoff } }];
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    Order.countDocuments(filter),
  ]);

  const counts = await priorCancelledCounts(orders);

  return {
    items: orders.map((order) => toAdminOrder(order, priorCancelledCountFor(order, counts))),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export async function getAdminOrder(id: string): Promise<AdminOrder> {
  const order = await getOrderDocument(id);
  const counts = await priorCancelledCounts([order]);
  return toAdminOrder(order, priorCancelledCountFor(order, counts));
}

/**
 * Moves an order through its fulfilment pipeline. Cancelling restores stock
 * exactly once — `stockRestored` guards a double-click or a retried request
 * from putting the same pair back into inventory twice.
 */
export async function updateOrderStatus(id: string, input: UpdateOrderStatusInput): Promise<AdminOrder> {
  const order = await getOrderDocument(id);

  const allowed: readonly string[] = ORDER_STATUS_FLOW[order.status];
  if (!allowed.includes(input.status)) {
    throw ApiError.badRequest(`An order cannot move from "${order.status}" to "${input.status}"`);
  }

  if (input.status === 'cancelled' && order.stockCommitted && !order.stockRestored) {
    // Atomic claim: only one concurrent cancellation of the same order can
    // flip `stockRestored` from false to true, so a double-click (or a
    // retried request) cannot put the same pair back into inventory twice.
    const claimed = await Order.findOneAndUpdate(
      { _id: order._id, stockRestored: false },
      { $set: { stockRestored: true } },
    );
    if (claimed) {
      await restoreStock(order.items.map(toStockAdjustment));
      order.stockRestored = true;
    }
  }

  order.status = input.status;
  order.statusHistory.push({ status: input.status, at: new Date(), note: input.note });
  await order.save();

  await sendOrderStatusEmail(order);

  const counts = await priorCancelledCounts([order]);
  return toAdminOrder(order, priorCancelledCountFor(order, counts));
}
