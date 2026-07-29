import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { env, isTest } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { apiRoutes } from './routes/index.js';
import { logger } from './utils/logger.js';

/**
 * Builds the Express app without binding a port or connecting to MongoDB, so
 * tests can mount it with supertest against an in-memory database.
 */
export function createApp(): Express {
  const app = express();

  // Render terminates TLS at its proxy. Without this, every client looks like
  // it shares one IP and the rate limiters would throttle all customers together.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // The API serves only JSON; CSP belongs on the Vercel-hosted frontend.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(cors({ origin: buildCorsOrigin(), credentials: true }));

  if (!isTest) {
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
  }

  app.use(generalLimiter);

  // Razorpay's webhook signature is computed over the exact bytes Razorpay
  // sent. Parsing to an object and re-serialising would change whitespace and
  // key order, breaking the HMAC — so that one route keeps the raw Buffer.
  app.use('/api/webhooks', express.raw({ type: 'application/json', limit: '256kb' }));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // Every handler reads validated input from `req.valid`, never `req.body`.
  app.use((req, _res, next) => {
    req.valid = {};
    next();
  });

  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/**
 * CORS allowlist: the configured storefront, plus Vercel preview deployments so
 * a branch build can talk to the API without a config change. Credentials are
 * enabled for the admin refresh cookie, which rules out a wildcard origin.
 */
function buildCorsOrigin() {
  const allowed = new Set(
    env.CLIENT_URL.split(',')
      .map((url) => url.trim().replace(/\/$/, ''))
      .filter(Boolean),
  );
  const vercelPreview = /^https:\/\/[a-z0-9-]+\.vercel\.app$/;

  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Same-origin requests, curl and server-to-server calls send no Origin.
    if (!origin) return callback(null, true);

    const normalised = origin.replace(/\/$/, '');
    if (allowed.has(normalised) || vercelPreview.test(normalised)) {
      return callback(null, true);
    }
    return callback(null, false);
  };
}
