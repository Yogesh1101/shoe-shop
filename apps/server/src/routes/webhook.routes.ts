import { Router } from 'express';

import { handleRazorpayWebhookEvent } from '../services/order.service.js';
import { verifyWebhookSignature } from '../services/razorpay.service.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export const webhookRoutes: Router = Router();

/**
 * Razorpay's webhook. Mounted under `express.raw` (see app.ts) rather than
 * `express.json` — the signature is computed over the exact bytes Razorpay
 * sent, and re-serialising a parsed object would change whitespace and key
 * order, breaking the HMAC.
 */
webhookRoutes.post('/razorpay', (req, res, next) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.body as Buffer;

  if (typeof signature !== 'string' || !verifyWebhookSignature(rawBody, signature)) {
    next(ApiError.unauthorized('Invalid webhook signature'));
    return;
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody.toString());
  } catch {
    next(ApiError.badRequest('Malformed webhook body'));
    return;
  }

  // Acknowledge immediately: Razorpay retries a webhook that does not get a
  // fast 2xx, and our own handler already tolerates being called more than
  // once for the same event.
  res.status(200).json({ received: true });

  void handleRazorpayWebhookEvent(event as Parameters<typeof handleRazorpayWebhookEvent>[0]).catch(
    (error: unknown) => {
      logger.error({ err: error }, 'Failed to process Razorpay webhook');
    },
  );
});
