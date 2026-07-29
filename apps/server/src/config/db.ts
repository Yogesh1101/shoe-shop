import mongoose from 'mongoose';

import { logger } from '../utils/logger.js';
import { env } from './env.js';

/**
 * Reject unknown fields in queries rather than silently ignoring them. A typo
 * in a filter key would otherwise widen a query instead of narrowing it — the
 * kind of bug that quietly exposes inactive products or somebody else's order.
 */
mongoose.set('strictQuery', 'throw');

export async function connectToDatabase(uri: string = env.MONGODB_URI): Promise<void> {
  mongoose.connection.on('error', (error) => {
    logger.error({ err: error }, 'MongoDB connection error');
  });
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  await mongoose.connect(uri, {
    // Fail fast rather than queuing requests behind an unreachable database.
    serverSelectionTimeoutMS: 10_000,
    // Atlas M0 allows 500 connections; Render's free instance needs far fewer.
    maxPoolSize: 10,
  });

  logger.info({ db: mongoose.connection.name }, 'MongoDB connected');
}

export async function disconnectFromDatabase(): Promise<void> {
  await mongoose.connection.close();
}

/**
 * Builds the indexes declared on the models. Called at boot in development and
 * by the seed script. In production Mongoose's `autoIndex` is off (building an
 * index on a large collection blocks), so run this deliberately after a deploy
 * that adds one.
 */
export async function syncIndexes(): Promise<void> {
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  logger.info('Indexes synced');
}
