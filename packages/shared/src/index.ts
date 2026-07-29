/**
 * The API contract between the Express server and the React client.
 *
 * Each payload is defined once, as a Zod schema. The server validates incoming
 * requests with it; the client validates its forms with the same schema through
 * `zodResolver`. Types are always `z.infer<typeof schema>` and never written by
 * hand alongside a schema — that is how the two drift apart.
 *
 * The practical effect: rename a field here and both sides stop compiling,
 * instead of checkout quietly breaking in production.
 */

export * from './constants.js';
export * from './money.js';
export * from './schemas/admin.schema.js';
export * from './schemas/checkout.schema.js';
export * from './schemas/common.schema.js';
export * from './schemas/order.schema.js';
export * from './schemas/product.schema.js';
export * from './schemas/settings.schema.js';
