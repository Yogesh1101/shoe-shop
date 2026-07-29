/**
 * Process entry point. Kept separate from `app.ts` so tests can mount the
 * Express app with supertest without binding a port or opening a DB connection.
 */
const port = Number(process.env.PORT ?? 5000);

console.log(`shoe-shop server scaffold ready (port ${port})`);
