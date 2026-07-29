import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import mongoose from 'mongoose';

import { connectToDatabase, disconnectFromDatabase } from '../config/db.js';
import { logger } from '../utils/logger.js';

/**
 * Dumps every collection to timestamped JSON files under `backups/`.
 *
 * Atlas's free M0 tier has no built-in automated backups, so this script is
 * the shop's entire backup story. Run it against the *production*
 * `MONGODB_URI` from a trusted machine — never from Render itself, whose
 * filesystem is wiped on every deploy and every wake from sleep, so anything
 * written there would not survive to be useful.
 *
 *   MONGODB_URI="<production connection string>" npm run backup
 *
 * A cron job or a calendar reminder to run this weekly is a reasonable bar
 * for a shop this size; anything past that is over-engineering it.
 */
async function main(): Promise<void> {
  await connectToDatabase();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(process.cwd(), 'backups', timestamp);
  await mkdir(dir, { recursive: true });

  const summary: Record<string, number> = {};

  // Every model registered anywhere in the app, not a hard-coded list — a
  // model added later is backed up automatically, the same reasoning as
  // `syncIndexes()` in config/db.ts.
  for (const [name, model] of Object.entries(mongoose.models)) {
    const documents = await model.find().lean();
    await writeFile(path.join(dir, `${name}.json`), JSON.stringify(documents, null, 2));
    summary[name] = documents.length;
  }

  await disconnectFromDatabase();
  logger.info({ dir, summary }, 'Backup complete');
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'Backup failed');
  process.exit(1);
});
