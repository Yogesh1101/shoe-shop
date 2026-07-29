import { type AdminLoginInput, adminLoginSchema, type LoginResponse } from '@shoe-shop/shared';
import type { Request, Response } from 'express';

import { validBody } from '../middleware/validate.js';
import {
  authenticate,
  clearRefreshCookie,
  issueTokens,
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
  verifyToken,
} from '../services/auth.service.js';
import { ApiError } from '../utils/ApiError.js';

export const loginSchema = adminLoginSchema;

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = validBody<AdminLoginInput>(req);

  const admin = await authenticate(email, password);
  const { accessToken, refreshToken } = issueTokens(admin);

  setRefreshCookie(res, refreshToken);

  const body: LoginResponse = {
    accessToken,
    admin: { email: admin.email },
  };
  res.json(body);
}

/**
 * Exchange the refresh cookie for a fresh access token. The client calls this
 * on page load — the access token lives only in memory, so a reload always
 * starts without one.
 */
export async function refresh(req: Request, res: Response): Promise<void> {
  const token = (req.cookies as Record<string, string | undefined>)[REFRESH_COOKIE_NAME];
  if (!token) {
    throw ApiError.unauthorized('Please sign in to continue');
  }

  const admin = await verifyToken(token, 'refresh');
  const { accessToken, refreshToken } = issueTokens(admin);

  // Rotate the refresh token on every use, so a captured cookie has a shorter
  // useful life than its seven-day expiry suggests.
  setRefreshCookie(res, refreshToken);

  const body: LoginResponse = {
    accessToken,
    admin: { email: admin.email },
  };
  res.json(body);
}

export function logout(_req: Request, res: Response): void {
  clearRefreshCookie(res);
  res.status(204).end();
}

export function me(req: Request, res: Response): void {
  if (!req.admin) {
    throw ApiError.unauthorized();
  }
  res.json({ email: req.admin.email });
}
