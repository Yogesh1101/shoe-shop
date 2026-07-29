import bcrypt from 'bcryptjs';
import type { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env, isProduction } from '../config/env.js';
import { Admin, type AdminDocument } from '../models/Admin.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * There is one admin — the shop owner — and no public signup route. The account
 * is created by `npm run seed:admin` from environment variables.
 *
 * Sessions use a split-token scheme:
 *
 *   access token   15 minutes, returned in the response body, held only in
 *                  memory by the client (a Redux slice, never localStorage)
 *   refresh token   7 days, set as an httpOnly cookie the page's JavaScript
 *                  cannot read
 *
 * The point of the split is blast radius. If an XSS bug ever lands on the admin
 * panel, the attacker can read the access token and has fifteen minutes with
 * it; they cannot read the refresh cookie, so they cannot mint a durable
 * session or keep access after the tab closes.
 */

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 7;
const BCRYPT_ROUNDS = 12;

export const REFRESH_COOKIE_NAME = 'shoeshop_refresh';

interface TokenPayload {
  sub: string;
  email: string;
  type: 'access' | 'refresh';
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function signToken(admin: AdminDocument, type: 'access' | 'refresh'): string {
  const payload: TokenPayload = {
    sub: admin.id,
    email: admin.email,
    type,
  };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: type === 'access' ? ACCESS_TOKEN_TTL : `${REFRESH_TOKEN_TTL_DAYS}d`,
  });
}

export function issueTokens(admin: AdminDocument): { accessToken: string; refreshToken: string } {
  return {
    accessToken: signToken(admin, 'access'),
    refreshToken: signToken(admin, 'refresh'),
  };
}

/**
 * Verify a token and load the admin it belongs to.
 *
 * Beyond the signature check, the token's issued-at is compared with the
 * account's `tokensValidFrom`. Changing the password moves that timestamp
 * forward, which instantly invalidates every token issued before it — so a
 * password change actually ends other sessions rather than leaving them alive
 * until they expire on their own.
 */
export async function verifyToken(
  token: string,
  expectedType: 'access' | 'refresh',
): Promise<AdminDocument> {
  let decoded: jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
  } catch {
    throw ApiError.unauthorized('Your session has expired. Please sign in again.');
  }

  const payload = decoded as Partial<TokenPayload> & { iat?: number };
  if (payload.type !== expectedType || typeof payload.sub !== 'string') {
    throw ApiError.unauthorized('Your session is not valid. Please sign in again.');
  }

  const admin = await Admin.findById(payload.sub);
  if (!admin) {
    throw ApiError.unauthorized('That account no longer exists');
  }

  const issuedAtMs = (payload.iat ?? 0) * 1000;
  // One second of slack: `iat` is whole seconds, so a token minted in the same
  // second as the account was created can otherwise look older than it is.
  if (issuedAtMs + 1000 < admin.tokensValidFrom.getTime()) {
    throw ApiError.unauthorized('Your password changed. Please sign in again.');
  }

  return admin;
}

/**
 * Check an email and password.
 *
 * The failure message is identical whether the email is unknown or the password
 * is wrong, so the endpoint cannot be used to enumerate accounts. When no
 * account matches, a hash comparison still runs against a dummy value — without
 * it, a missing account would return measurably faster than a wrong password.
 */
const DUMMY_HASH = '$2a$12$k8Y1YQXHqZ0Z9J1qKQ0Z9uJ0qKQ0Z9uJ0qKQ0Z9uJ0qKQ0Z9uJ0q';

export async function authenticate(email: string, password: string): Promise<AdminDocument> {
  const admin = await Admin.findOne({ email }).select('+passwordHash');

  if (!admin) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw ApiError.unauthorized('Incorrect email or password');
  }

  const matches = await bcrypt.compare(password, admin.passwordHash);
  if (!matches) {
    throw ApiError.unauthorized('Incorrect email or password');
  }

  admin.lastLoginAt = new Date();
  await admin.save();

  return admin;
}

function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    // The API (Render) and the storefront (Vercel) are on different sites, so
    // the cookie has to be SameSite=None — which browsers only accept when
    // Secure is also set. Locally both are http, so lax is used instead.
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    path: '/api/admin',
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

export function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
}

export function clearRefreshCookie(res: Response): void {
  // Must match the original attributes or the browser will not remove it.
  const { maxAge: _maxAge, ...options } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE_NAME, options);
}
