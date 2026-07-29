import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { Admin } from '../models/Admin.js';
import { hashPassword } from '../services/auth.service.js';
import { describeWithMongo } from './helpers/mongo.js';

const EMAIL = 'owner@example.com';
const PASSWORD = 'correct-horse-battery';

let app: Express;

async function adminToken(): Promise<string> {
  await Admin.create({
    email: EMAIL,
    passwordHash: await hashPassword(PASSWORD),
    tokensValidFrom: new Date(),
  });
  const login = await request(app)
    .post('/api/admin/login')
    .send({ email: EMAIL, password: PASSWORD });
  return login.body.accessToken as string;
}

describeWithMongo('admin settings', () => {
  beforeAll(() => {
    app = createApp();
  });

  it('requires authentication', async () => {
    const response = await request(app).get('/api/admin/settings');
    expect(response.status).toBe(401);
  });

  it('reads the full settings document, including fields the public route hides', async () => {
    const token = await adminToken();

    const response = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('gstSlabs');
    expect(response.body).toHaveProperty('maxOrdersPerPhonePerDay');
    expect(response.body).toHaveProperty('blockedPincodes');
  });

  it('applies a partial update without disturbing untouched fields', async () => {
    const token = await adminToken();

    const response = await request(app)
      .patch('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ shopName: 'New Shoe Co' });

    expect(response.status).toBe(200);
    expect(response.body.shopName).toBe('New Shoe Co');
    // Untouched — still whatever the default was.
    expect(response.body.deliveryChargePaise).toBeGreaterThan(0);
  });

  it('requires a GSTIN once GST is turned on, even if the patch itself has no GSTIN field', async () => {
    const token = await adminToken();

    // First switch GST off with an empty GSTIN.
    await request(app)
      .patch('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ gstEnabled: false, gstin: '' });

    // Then try to switch it back on without ever supplying a GSTIN.
    const response = await request(app)
      .patch('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ gstEnabled: true });

    expect(response.status).toBe(422);
  });

  it('accepts turning GST on together with a GSTIN in the same request', async () => {
    const token = await adminToken();

    const response = await request(app)
      .patch('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ gstEnabled: true, gstin: '29ABCDE1234F1Z5' });

    expect(response.status).toBe(200);
    expect(response.body.gstin).toBe('29ABCDE1234F1Z5');
  });

  it('rejects GST slabs that are not a valid ascending ladder', async () => {
    const token = await adminToken();

    const response = await request(app)
      .patch('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        gstSlabs: [
          { maxPricePaise: 100_000, rateBps: 1800 },
          { maxPricePaise: 50_000, rateBps: 500 }, // out of order
        ],
      });

    expect(response.status).toBe(422);
  });

  it('rejects an update that is invalid on its own terms before touching the database', async () => {
    const token = await adminToken();

    const response = await request(app)
      .patch('/api/admin/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ deliveryChargePaise: -100 });

    expect(response.status).toBe(422);
  });
});
