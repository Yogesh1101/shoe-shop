import { Router } from 'express';
import mongoose from 'mongoose';

import { getSettings, toPublicSettings } from '../services/settings.service.js';
import { authRoutes } from './admin/auth.routes.js';
import { adminOrderRoutes } from './admin/order.routes.js';
import { adminProductRoutes } from './admin/product.routes.js';
import { adminSettingsRoutes } from './admin/settings.routes.js';
import { checkoutRoutes } from './checkout.routes.js';
import { orderRoutes } from './order.routes.js';
import { productRoutes } from './product.routes.js';
import { webhookRoutes } from './webhook.routes.js';

export const apiRoutes: Router = Router();

/**
 * Liveness probe. Render uses it as the service health check, and a free-tier
 * instance sleeps after 15 minutes idle — pointing a free UptimeRobot monitor
 * at this endpoint every 5 minutes keeps the shop warm for customers arriving
 * from Instagram. See the README.
 */
apiRoutes.get('/health', (_req, res) => {
  // 1 === ConnectionStates.connected
  const dbReady = mongoose.connection.readyState === mongoose.ConnectionStates.connected;

  res.status(dbReady ? 200 : 503).json({
    status: dbReady ? 'ok' : 'degraded',
    database: dbReady ? 'connected' : 'disconnected',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

apiRoutes.get('/settings/public', async (_req, res) => {
  const settings = await getSettings();
  res.json(toPublicSettings(settings));
});

apiRoutes.use('/products', productRoutes);
apiRoutes.use('/checkout', checkoutRoutes);
apiRoutes.use('/orders', orderRoutes);
apiRoutes.use('/webhooks', webhookRoutes);

apiRoutes.use('/admin', authRoutes);
apiRoutes.use('/admin/products', adminProductRoutes);
apiRoutes.use('/admin/orders', adminOrderRoutes);
apiRoutes.use('/admin/settings', adminSettingsRoutes);
