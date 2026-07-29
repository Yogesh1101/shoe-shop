import { connectToDatabase, disconnectFromDatabase, syncIndexes } from '../config/db.js';
import { getSettings } from '../services/settings.service.js';
import { logger } from '../utils/logger.js';
import { seedAdmin } from './seedAdmin.js';
import { seedProducts } from './seedProducts.js';

/**
 * One-shot setup: indexes, the admin account, the settings document and a
 * sample catalog. Safe to re-run — everything it does is idempotent apart from
 * `--reset`, which wipes products first.
 *
 *   npm run seed
 *   npm run seed -- --reset
 */
async function main(): Promise<void> {
  const reset = process.argv.includes('--reset');

  await connectToDatabase();
  await syncIndexes();
  await seedAdmin();

  // Creates the singleton settings document with defaults if it is missing.
  const settings = await getSettings();
  logger.info({ shopName: settings.shopName }, 'Settings ready');

  await seedProducts({ reset });
  await disconnectFromDatabase();

  logger.info('Seed complete');
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    logger.error({ err: error }, 'Seed failed');
    process.exit(1);
  });
