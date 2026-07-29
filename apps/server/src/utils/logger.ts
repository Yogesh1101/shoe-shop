import { pino } from 'pino';

import { env, isProduction, isTest } from '../config/env.js';

export const logger = pino({
  level: isTest ? 'silent' : isProduction ? 'info' : 'debug',
  // Render captures stdout as-is, so structured JSON is right in production.
  // Locally, pretty output is worth the dependency-free `transport` cost.
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino/file',
          options: { destination: 1 },
        },
      }),
  base: { env: env.NODE_ENV },
  redact: {
    // These travel through request bodies and must never reach a log line.
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.razorpaySignature',
      '*.accessToken',
    ],
    censor: '[redacted]',
  },
});
