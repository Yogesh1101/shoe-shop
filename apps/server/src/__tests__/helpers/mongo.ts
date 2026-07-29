import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, describe } from 'vitest';

/**
 * Integration-test harness.
 *
 * These tests need a real MongoDB — the behaviour under test *is* database
 * behaviour (atomic `$inc` guards, unique indexes, upsert races), and a mock
 * would only assert that the mock works.
 *
 * Where no database is reachable the suites are reported as **skipped**, not
 * passed. That distinction matters: a test that silently returns early still
 * counts as green, so a misconfigured CI database would look like a hundred
 * passing tests while asserting nothing.
 *
 * CI supplies MongoDB through a service container (.github/workflows/ci.yml).
 * Locally:
 *   docker run -d --name shoe-shop-db -p 27017:27017 mongo:7
 */

const TEST_URI = process.env.MONGODB_URI_TEST ?? 'mongodb://127.0.0.1:27017/shoe-shop-test';

/**
 * Probed once at module load, via top-level await, so the result is a plain
 * boolean by the time `describe` blocks are collected — `describe.skipIf`
 * cannot await anything.
 */
const mongoAvailable = await probeMongo();

async function probeMongo(): Promise<boolean> {
  try {
    const connection = await mongoose
      .createConnection(TEST_URI, { serverSelectionTimeoutMS: 1500 })
      .asPromise();
    await connection.close();
    return true;
  } catch (error) {
    // CI sets REQUIRE_MONGO, because a green build made of skipped tests is
    // exactly the false confidence this harness exists to avoid. Skipping is a
    // local-developer convenience, never a CI outcome.
    if (process.env.REQUIRE_MONGO === '1') {
      throw new Error(
        `REQUIRE_MONGO is set but MongoDB is not reachable at ${TEST_URI}. ` +
          'Integration tests must not be skipped in CI.',
        { cause: error },
      );
    }

    console.warn(
      `\n  MongoDB not reachable at ${TEST_URI} — integration suites will be SKIPPED.` +
        '\n  Start one with: docker run -d -p 27017:27017 mongo:7\n',
    );
    return false;
  }
}

export { mongoAvailable };

/**
 * `describe` that connects to MongoDB for the block and truncates every
 * collection between tests, so each one starts from an empty database.
 */
export function describeWithMongo(name: string, suite: () => void): void {
  describe.skipIf(!mongoAvailable)(name, () => {
    beforeAll(async () => {
      await mongoose.connect(TEST_URI);
    });

    afterEach(async () => {
      const collections = await mongoose.connection.db?.collections();
      await Promise.all((collections ?? []).map((collection) => collection.deleteMany({})));
    });

    afterAll(async () => {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });

    suite();
  });
}
