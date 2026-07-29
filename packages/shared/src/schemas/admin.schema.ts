import { z } from 'zod';

import { emailSchema } from './common.schema.js';

export const adminLoginSchema = z.object({
  email: emailSchema,
  /**
   * No complexity rules on login — they belong at the point a password is set,
   * and enforcing them here only tells an attacker which guesses to skip.
   */
  password: z.string().min(1, { error: 'Enter your password' }),
});

export const adminSchema = z.object({
  email: z.string(),
});

export const loginResponseSchema = z.object({
  /**
   * Short-lived, held in memory on the client only. The long-lived refresh
   * token travels in an httpOnly cookie the JavaScript cannot read, so an XSS
   * bug cannot walk away with a durable session.
   */
  accessToken: z.string(),
  admin: adminSchema,
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type Admin = z.infer<typeof adminSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
