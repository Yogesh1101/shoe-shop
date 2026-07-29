import { type QuoteRequest, quoteRequestSchema } from '@shoe-shop/shared';
import { Router } from 'express';

import { validateBody, validBody } from '../middleware/validate.js';
import { buildQuote } from '../services/checkout.service.js';

export const checkoutRoutes: Router = Router();

/**
 * Price a cart. Called on every checkout keystroke (address typed, payment
 * method switched), so it stays a plain read: nothing here is reserved or
 * written until the order is actually placed, in the next phase.
 */
checkoutRoutes.post('/quote', validateBody(quoteRequestSchema), async (req, res) => {
  res.json(await buildQuote(validBody<QuoteRequest>(req)));
});
