import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

/**
 * Environment validation.
 *
 * Everything the server needs is declared here and checked once, at boot. A
 * missing Razorpay secret should stop the process with a readable message on
 * line one of the logs — not surface three days later as a failed payment
 * verification for a customer who has already been charged.
 *
 * Third-party integrations are optional in development so the app boots before
 * you have signed up for Cloudinary, Razorpay and Brevo. In production they are
 * required: `assertProductionConfig` below refuses to start a live shop that
 * cannot take payments or send order emails.
 */

const optionalString = z.string().trim().default('');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  /** Storefront origin. Drives CORS and the links inside order emails. */
  CLIENT_URL: z.string().trim().default('http://localhost:5173'),

  MONGODB_URI: z.string().trim().min(1, { error: 'MONGODB_URI is required' }),

  /**
   * Signs admin sessions. 32 characters minimum because a short secret is
   * brute-forceable offline, and this one guards the whole admin panel.
   * Generate with: openssl rand -base64 48
   */
  JWT_SECRET: z.string().min(32, {
    error:
      'JWT_SECRET must be at least 32 characters — generate one with `openssl rand -base64 48`',
  }),

  /** Seeded admin account. Used only by the seed script, never at runtime. */
  ADMIN_EMAIL: z.string().trim().toLowerCase().default('owner@example.com'),
  ADMIN_PASSWORD: z.string().default('change-this-before-going-live'),

  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,

  RAZORPAY_KEY_ID: optionalString,
  RAZORPAY_KEY_SECRET: optionalString,
  RAZORPAY_WEBHOOK_SECRET: optionalString,

  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  OWNER_EMAIL: optionalString,
  MAIL_FROM: optionalString,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(
    `Invalid environment configuration:\n${problems}\n\n` +
      'Copy apps/server/.env.example to apps/server/.env and fill it in.',
  );
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/**
 * Which integrations are usable. Services consult these rather than reading
 * `env` directly, so a half-configured dev environment degrades predictably
 * instead of throwing an opaque error from inside a vendor SDK.
 */
export const features = {
  cloudinary: Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
  ),
  razorpay: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
  razorpayWebhook: Boolean(env.RAZORPAY_WEBHOOK_SECRET),
  email: Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.MAIL_FROM),
} as const;

/**
 * Production must be fully configured. A live shop that silently cannot email
 * the owner about a new order, or cannot verify a Razorpay signature, is worse
 * than one that refuses to start.
 */
export function assertProductionConfig(): void {
  if (!isProduction) return;

  const missing: string[] = [];
  if (!features.cloudinary) missing.push('Cloudinary (CLOUDINARY_*) — product photos');
  if (!features.razorpay) missing.push('Razorpay (RAZORPAY_KEY_ID / _SECRET) — online payments');
  if (!features.razorpayWebhook) missing.push('RAZORPAY_WEBHOOK_SECRET — payment webhook');
  if (!features.email) missing.push('SMTP (SMTP_* and MAIL_FROM) — order emails');
  if (!env.OWNER_EMAIL) missing.push('OWNER_EMAIL — where new-order alerts go');
  if (env.JWT_SECRET.includes('replace-me')) missing.push('JWT_SECRET is still the example value');

  if (missing.length > 0) {
    throw new Error(
      `Refusing to start in production with incomplete configuration:\n${missing
        .map((item) => `  - ${item}`)
        .join('\n')}`,
    );
  }
}
