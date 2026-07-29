/**
 * Runs before any test file imports application code, so `config/env.ts` sees a
 * complete environment when it validates at module load.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-only-secret-at-least-32-characters-long';
process.env.MONGODB_URI ??=
  process.env.MONGODB_URI_TEST ?? 'mongodb://127.0.0.1:27017/shoe-shop-test';
process.env.CLIENT_URL ??= 'http://localhost:5173';
process.env.ADMIN_EMAIL ??= 'owner@example.com';
process.env.ADMIN_PASSWORD ??= 'test-password-123';
