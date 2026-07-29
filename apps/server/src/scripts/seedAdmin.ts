import { connectToDatabase, disconnectFromDatabase } from '../config/db.js';
import { env, isProduction } from '../config/env.js';
import { Admin } from '../models/Admin.js';
import { hashPassword } from '../services/auth.service.js';
import { logger } from '../utils/logger.js';

/**
 * Creates or updates the single admin account from ADMIN_EMAIL and
 * ADMIN_PASSWORD. There is no public signup route — this script is the only
 * way an admin comes into existence.
 *
 * Safe to re-run: it resets the password of an existing account, which doubles
 * as the password-reset mechanism.
 */
export async function seedAdmin(): Promise<void> {
  const email = env.ADMIN_EMAIL;
  const password = env.ADMIN_PASSWORD;

  if (isProduction && password === 'change-this-before-going-live') {
    throw new Error('Refusing to seed the example admin password in production.');
  }
  if (password.length < 10) {
    throw new Error('ADMIN_PASSWORD must be at least 10 characters.');
  }

  const passwordHash = await hashPassword(password);
  const existing = await Admin.findOne({ email });

  if (existing) {
    existing.passwordHash = passwordHash;
    // Invalidates any session issued before this reset.
    existing.tokensValidFrom = new Date();
    await existing.save();
    logger.info({ email }, 'Admin password reset');
    return;
  }

  await Admin.create({ email, passwordHash, tokensValidFrom: new Date() });
  logger.info({ email }, 'Admin account created');
}

// Only run when invoked directly, so `seed.ts` can import and compose it.
if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  connectToDatabase()
    .then(seedAdmin)
    .then(disconnectFromDatabase)
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      logger.error({ err: error }, 'Admin seed failed');
      process.exit(1);
    });
}
