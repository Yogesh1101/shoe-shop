import Razorpay from 'razorpay';

import { env, features } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Wraps the Razorpay SDK behind the two operations this shop needs: opening an
 * order and checking that a payment claimed against it is genuine.
 *
 * Constructed lazily rather than at module load — a dev environment with no
 * Razorpay keys should still boot and serve the rest of the catalog, and only
 * fail the moment someone actually tries to pay online.
 */

let client: Razorpay | undefined;

function getClient(): Razorpay {
  if (!features.razorpay) {
    throw ApiError.notConfigured('Razorpay');
  }
  client ??= new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  return client;
}

export interface RazorpayOrder {
  id: string;
  amountPaise: number;
  currency: string;
}

/**
 * Opens a Razorpay order for the amount already computed by the quote service.
 * `receipt` is the shop's own order number, so a payment can always be traced
 * back to the order it belongs to from the Razorpay dashboard alone.
 */
export async function createRazorpayOrder(amountPaise: number, receipt: string): Promise<RazorpayOrder> {
  const order = await getClient().orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt,
    payment_capture: true,
  });

  return {
    id: order.id,
    amountPaise: Number(order.amount),
    currency: order.currency,
  };
}

/**
 * Checkout's client-side success callback returns a signature over
 * `orderId|paymentId`, HMAC-SHA256 with the key secret. This is what proves the
 * callback actually came from Razorpay and was not forged by a browser that
 * skipped payment and called the API directly.
 */
export function verifyPaymentSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  if (!features.razorpay) return false;
  const payload = `${params.razorpayOrderId}|${params.razorpayPaymentId}`;
  return Razorpay.validateWebhookSignature(payload, params.razorpaySignature, env.RAZORPAY_KEY_SECRET);
}

/**
 * The webhook is the authoritative confirmation path — it arrives from
 * Razorpay's servers directly and does not depend on the customer's browser
 * still being open, unlike the checkout callback above. Signed with a
 * separate secret configured in the Razorpay dashboard, over the exact raw
 * request body.
 */
export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  if (!features.razorpayWebhook) return false;
  return Razorpay.validateWebhookSignature(rawBody.toString(), signature, env.RAZORPAY_WEBHOOK_SECRET);
}
