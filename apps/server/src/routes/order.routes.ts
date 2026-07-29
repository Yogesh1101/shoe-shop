import {
  type CreateOrderInput,
  createOrderSchema,
  type IdParam,
  idParamSchema,
  type TrackOrderQuery,
  trackOrderQuerySchema,
  type VerifyPaymentInput,
  verifyPaymentSchema,
} from '@shoe-shop/shared';
import { Router } from 'express';

import { createOrderLimiter, trackOrderLimiter } from '../middleware/rateLimit.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  validBody,
  validParams,
  validQuery,
} from '../middleware/validate.js';
import { generateInvoicePdf } from '../services/invoice.service.js';
import {
  createOrder,
  getOrderForInvoiceByTracking,
  trackOrder,
  verifyRazorpayPayment,
} from '../services/order.service.js';
import { getSettings } from '../services/settings.service.js';

export const orderRoutes: Router = Router();

orderRoutes.post('/', createOrderLimiter, validateBody(createOrderSchema), async (req, res) => {
  const result = await createOrder(validBody<CreateOrderInput>(req));
  res.status(201).json(result);
});

orderRoutes.post(
  '/:id/verify-payment',
  validateParams(idParamSchema),
  validateBody(verifyPaymentSchema),
  async (req, res) => {
    const order = await verifyRazorpayPayment(
      validParams<IdParam>(req).id,
      validBody<VerifyPaymentInput>(req),
    );
    res.json(order);
  },
);

// Declared before anything that could be mistaken for an order number.
orderRoutes.get(
  '/track',
  trackOrderLimiter,
  validateQuery(trackOrderQuerySchema),
  async (req, res) => {
    res.json(await trackOrder(validQuery<TrackOrderQuery>(req)));
  },
);

orderRoutes.get(
  '/track/invoice',
  trackOrderLimiter,
  validateQuery(trackOrderQuerySchema),
  async (req, res) => {
    const { orderNumber, phone } = validQuery<TrackOrderQuery>(req);
    const [order, settings] = await Promise.all([
      getOrderForInvoiceByTracking(orderNumber, phone),
      getSettings(),
    ]);
    const pdf = await generateInvoicePdf(order, settings);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${order.orderNumber}.pdf"`);
    res.send(pdf);
  },
);
