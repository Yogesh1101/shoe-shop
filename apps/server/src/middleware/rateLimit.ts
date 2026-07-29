import rateLimit, { type Options } from 'express-rate-limit';

import { isTest } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Rate limits.
 *
 * Note the storage: the default in-memory store is per-process, which is fine
 * here because the free Render tier runs a single instance. If the API is ever
 * scaled to more than one instance these limits become per-instance and a
 * shared store (Redis) is needed — worth remembering before scaling up.
 */

function baseOptions(message: string): Partial<Options> {
  return {
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Tests exercise the routes repeatedly and would otherwise trip the limits.
    skip: () => isTest,
    handler: (_req, _res, next) => {
      next(ApiError.tooManyRequests(message));
    },
  };
}

/** Broad backstop across the whole API. Generous — real browsing is bursty. */
export const generalLimiter = rateLimit({
  ...baseOptions('Too many requests. Please slow down and try again shortly.'),
  windowMs: 60_000,
  limit: 300,
});

/**
 * Login. Tight, because this is the one endpoint where an attacker gains
 * something by trying thousands of times.
 */
export const loginLimiter = rateLimit({
  ...baseOptions('Too many sign-in attempts. Please wait a few minutes.'),
  windowMs: 15 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true,
});

/**
 * Order placement. The first line of defence against prank COD orders — the
 * per-phone-per-day cap in Settings is the second, and is enforced in the order
 * service where the phone number is actually known.
 */
export const createOrderLimiter = rateLimit({
  ...baseOptions('Too many orders from this connection. Please try again later.'),
  windowMs: 60 * 60_000,
  limit: 10,
});

/**
 * Guest order tracking. With no accounts, the phone number is the only secret
 * protecting an order, so this must not be brute-forceable.
 */
export const trackOrderLimiter = rateLimit({
  ...baseOptions('Too many lookups. Please wait a minute and try again.'),
  windowMs: 15 * 60_000,
  limit: 20,
});

/** Image uploads are slow and expensive; the admin never needs to burst. */
export const uploadLimiter = rateLimit({
  ...baseOptions('Too many uploads at once. Please wait a moment.'),
  windowMs: 60_000,
  limit: 30,
});
