import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { Admin } from '../models/Admin.js';
import { hashPassword, REFRESH_COOKIE_NAME } from '../services/auth.service.js';
import { describeWithMongo } from './helpers/mongo.js';

const EMAIL = 'owner@example.com';
const PASSWORD = 'correct-horse-battery';

let app: Express;

async function createAdmin(): Promise<void> {
  await Admin.create({
    email: EMAIL,
    passwordHash: await hashPassword(PASSWORD),
    tokensValidFrom: new Date(),
  });
}

/** Pull the refresh cookie out of a Set-Cookie header. */
function refreshCookie(headers: Record<string, unknown>): string | undefined {
  const setCookie = headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? (setCookie as string[]) : [];
  return cookies.find((cookie) => cookie.startsWith(REFRESH_COOKIE_NAME));
}

describeWithMongo('admin auth', () => {
  beforeAll(() => {
    app = createApp();
  });

  it('signs in with the right credentials', async () => {
    await createAdmin();

    const response = await request(app)
      .post('/api/admin/login')
      .send({ email: EMAIL, password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.admin.email).toBe(EMAIL);
    expect(typeof response.body.accessToken).toBe('string');
  });

  it('never returns the password hash', async () => {
    await createAdmin();

    const response = await request(app)
      .post('/api/admin/login')
      .send({ email: EMAIL, password: PASSWORD });

    expect(JSON.stringify(response.body)).not.toContain('$2');
    expect(response.body.admin).toEqual({ email: EMAIL });
  });

  it('puts the refresh token in an httpOnly cookie, not the body', async () => {
    await createAdmin();

    const response = await request(app)
      .post('/api/admin/login')
      .send({ email: EMAIL, password: PASSWORD });

    const cookie = refreshCookie(response.headers);
    // httpOnly is what stops an XSS bug from stealing a durable session.
    expect(cookie).toContain('HttpOnly');
    expect(response.body).not.toHaveProperty('refreshToken');
  });

  it('gives the same error for a wrong password and an unknown account', async () => {
    await createAdmin();

    const wrongPassword = await request(app)
      .post('/api/admin/login')
      .send({ email: EMAIL, password: 'nope' });
    const unknownEmail = await request(app)
      .post('/api/admin/login')
      .send({ email: 'nobody@example.com', password: PASSWORD });

    // Identical responses, so the endpoint cannot be used to discover which
    // email addresses have accounts.
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('rejects a malformed email before touching the database', async () => {
    const response = await request(app)
      .post('/api/admin/login')
      .send({ email: 'not-an-email', password: PASSWORD });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('guards /me and accepts a valid bearer token', async () => {
    await createAdmin();

    const anonymous = await request(app).get('/api/admin/me');
    expect(anonymous.status).toBe(401);

    const login = await request(app)
      .post('/api/admin/login')
      .send({ email: EMAIL, password: PASSWORD });

    const authorised = await request(app)
      .get('/api/admin/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    expect(authorised.status).toBe(200);
    expect(authorised.body.email).toBe(EMAIL);
  });

  it('rejects a tampered token', async () => {
    await createAdmin();

    const login = await request(app)
      .post('/api/admin/login')
      .send({ email: EMAIL, password: PASSWORD });

    const token = login.body.accessToken as string;
    const tampered = `${token.slice(0, -3)}xyz`;

    const response = await request(app)
      .get('/api/admin/me')
      .set('Authorization', `Bearer ${tampered}`);

    expect(response.status).toBe(401);
  });

  it('will not accept a refresh token as an access token', async () => {
    await createAdmin();

    const login = await request(app)
      .post('/api/admin/login')
      .send({ email: EMAIL, password: PASSWORD });

    const cookie = refreshCookie(login.headers) ?? '';
    const refreshToken = cookie.split(';')[0]?.split('=')[1] ?? '';

    // The two token types are distinguished by a `type` claim; a long-lived
    // refresh token must not be usable to call admin endpoints directly.
    const response = await request(app)
      .get('/api/admin/me')
      .set('Authorization', `Bearer ${refreshToken}`);

    expect(response.status).toBe(401);
  });

  it('exchanges the refresh cookie for a new access token', async () => {
    await createAdmin();

    const login = await request(app)
      .post('/api/admin/login')
      .send({ email: EMAIL, password: PASSWORD });

    const cookie = refreshCookie(login.headers) ?? '';

    const refreshed = await request(app).post('/api/admin/refresh').set('Cookie', cookie);

    expect(refreshed.status).toBe(200);
    expect(typeof refreshed.body.accessToken).toBe('string');
    // Rotated, so a captured cookie has a shorter useful life than its expiry.
    expect(refreshCookie(refreshed.headers as Record<string, unknown>)).toBeDefined();
  });

  it('refuses to refresh without a cookie', async () => {
    const response = await request(app).post('/api/admin/refresh');
    expect(response.status).toBe(401);
  });

  it('invalidates existing tokens when the password changes', async () => {
    await createAdmin();

    const login = await request(app)
      .post('/api/admin/login')
      .send({ email: EMAIL, password: PASSWORD });
    const token = login.body.accessToken as string;

    // Still valid right now.
    expect(
      (await request(app).get('/api/admin/me').set('Authorization', `Bearer ${token}`)).status,
    ).toBe(200);

    // Simulate a password reset: seedAdmin moves tokensValidFrom forward.
    await Admin.updateOne(
      { email: EMAIL },
      { $set: { tokensValidFrom: new Date(Date.now() + 60_000) } },
    );

    const after = await request(app).get('/api/admin/me').set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
  });

  it('clears the cookie on logout', async () => {
    const response = await request(app).post('/api/admin/logout');
    expect(response.status).toBe(204);
    expect(refreshCookie(response.headers as Record<string, unknown>)).toContain(
      `${REFRESH_COOKIE_NAME}=;`,
    );
  });
});

describeWithMongo('health and error handling', () => {
  beforeAll(() => {
    app = createApp();
  });

  it('reports healthy when the database is connected', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.database).toBe('connected');
  });

  it('returns the standard error shape for an unknown route', async () => {
    const response = await request(app).get('/api/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({ code: 'NOT_FOUND' });
    expect(typeof response.body.error.message).toBe('string');
  });

  it('creates the settings singleton on first read', async () => {
    const response = await request(app).get('/api/settings/public');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('shopName');
    // Operational details must not leak to the storefront.
    expect(response.body).not.toHaveProperty('gstSlabs');
    expect(response.body).not.toHaveProperty('blockedPincodes');
    expect(response.body).not.toHaveProperty('maxOrdersPerPhonePerDay');
  });
});
