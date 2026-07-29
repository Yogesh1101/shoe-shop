import {
  type AdminOrderListQuery,
  adminOrderListQuerySchema,
  type IdParam,
  idParamSchema,
  type UpdateOrderStatusInput,
  updateOrderStatusSchema,
} from '@shoe-shop/shared';
import { Router } from 'express';

import { requireAdmin } from '../../middleware/requireAdmin.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  validBody,
  validParams,
  validQuery,
} from '../../middleware/validate.js';
import { generateInvoicePdf } from '../../services/invoice.service.js';
import {
  getAdminOrder,
  getOrderDocument,
  listOrders,
  updateOrderStatus,
} from '../../services/order.service.js';
import { getSettings } from '../../services/settings.service.js';

export const adminOrderRoutes: Router = Router();

adminOrderRoutes.use(requireAdmin);

adminOrderRoutes.get('/', validateQuery(adminOrderListQuerySchema), async (req, res) => {
  res.json(await listOrders(validQuery<AdminOrderListQuery>(req)));
});

adminOrderRoutes.get('/:id', validateParams(idParamSchema), async (req, res) => {
  res.json(await getAdminOrder(validParams<IdParam>(req).id));
});

adminOrderRoutes.patch(
  '/:id/status',
  validateParams(idParamSchema),
  validateBody(updateOrderStatusSchema),
  async (req, res) => {
    const order = await updateOrderStatus(
      validParams<IdParam>(req).id,
      validBody<UpdateOrderStatusInput>(req),
    );
    res.json(order);
  },
);

adminOrderRoutes.get('/:id/invoice', validateParams(idParamSchema), async (req, res) => {
  const [order, settings] = await Promise.all([
    getOrderDocument(validParams<IdParam>(req).id),
    getSettings(),
  ]);
  const pdf = await generateInvoicePdf(order, settings);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${order.orderNumber}.pdf"`);
  res.send(pdf);
});
