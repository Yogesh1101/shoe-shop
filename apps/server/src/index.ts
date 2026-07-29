import { createApp } from './app.js';
import { connectToDatabase, disconnectFromDatabase, syncIndexes } from './config/db.js';
import { assertProductionConfig, env, features, isProduction } from './config/env.js';
import { logger } from './utils/logger.js';

/**
 * Process entry point. `app.ts` builds the Express app separately so tests can
 * mount it without binding a port or touching a real database.
 */
async function main(): Promise<void> {
  // Refuses to boot a live shop that cannot take payments or send order emails.
  assertProductionConfig();

  await connectToDatabase();

  // Building indexes can block on a large collection, so in production this is
  // a deliberate post-deploy step (`npm run seed`) rather than a startup cost.
  if (!isProduction) {
    await syncIndexes();
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        env: env.NODE_ENV,
        integrations: features,
      },
      `Shoe Shop API listening on :${env.PORT}`,
    );

    const disabled = Object.entries(features)
      .filter(([, enabled]) => !enabled)
      .map(([name]) => name);
    if (disabled.length > 0) {
      logger.warn(
        { disabled },
        'Some integrations are not configured — those features will return 503',
      );
    }
  });

  // Render sends SIGTERM on deploy and on idle shutdown. Draining first means
  // an in-flight order finishes writing instead of being cut off mid-request.
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => {
      void disconnectFromDatabase().then(() => process.exit(0));
    });
    // If connections do not drain in 10s, stop waiting.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'Failed to start server');
  process.exit(1);
});
