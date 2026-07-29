import crypto from 'node:crypto';

import { toPaise } from '@shoe-shop/shared';
import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';

vi.mock('razorpay', () => {
  class FakeRazorpay {
    static validateWebhookSignature(body: string, signature: string, secret: string): boolean {
      const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
      return expected === signature;
    }

    orders = {
      create: vi.fn((params: { amount: number; currency: string; receipt?: string }) => ({
        id: `order_test_${Math.random().toString(36).slice(2)}`,
        amount: params.amount,
        currency: params.currency,
        receipt: params.receipt,
        status: 'created',
      })),
    };

    constructor(_config: unknown) {}
  }

  return { default: FakeRazorpay };
});

import { createApp } from '../app.js';
import { Order } from '../models/Order.js';
import { Product, type ProductDoc } from '../models/Product.js';
import { Settings, SETTINGS_ID } from '../models/Settings.js';
import { describeWithMongo } from './helpers/mongo.js';

const RAZORPAY_KEY_SECRET = 'test-razorpay-key-secret';
const RAZORPAY_WEBHOOK_SECRET = 'test-razorpay-webhook-secret';

let app: Express;

type ProductSeed = Omit<ProductDoc, 'createdAt' | 'updatedAt'>;

function productFixture(overrides: Partial<ProductSeed> = {}): ProductSeed {
  return {
    name: 'Air Rush 90',
    slug: 'air-rush-90',
    brand: 'Nike',
    description: 'Everyday cushioned sneaker.',
    category: 'men',
    type: 'sneakers',
    pricePaise: toPaise(999),
    mrpPaise: toPaise(1499),
    hsnCode: '6404',
    tags: [],
    isActive: true,
    variants: [
      {
        color: 'Black',
        colorHex: '#141414',
        images: [{ url: 'https://example.com/a.jpg', publicId: 'seed/a' }],
        sizes: [{ size: 8, stock: 4 }],
      },
    ],
    ...overrides,
  };
}

function customerPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Asha Rao',
    phone: '9876543210',
    email: 'asha@example.com',
    address: {
      line1: '221B Brigade Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
    },
    ...overrides,
  };
}

function paymentSignature(orderId: string, paymentId: string): string {
  return crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

describeWithMongo('order creation and payment', () => {
  beforeAll(() => {
    app = createApp();
  });

  beforeEach(async () => {
    await Settings.findOneAndUpdate(
      { _id: SETTINGS_ID },
      {
        $set: {
          deliveryChargePaise: toPaise(50),
          freeDeliveryAbovePaise: toPaise(99_999), // effectively never free, for simpler assertions
          codEnabled: true,
          codExtraChargePaise: toPaise(20),
          codMaxOrderValuePaise: 0,
          maxOrdersPerPhonePerDay: 5,
          gstEnabled: true,
          gstin: '29ABCDE1234F1Z5',
          sellerState: 'Karnataka',
          pricesIncludeTax: true,
          blockedPincodes: [],
          gstSlabs: [
            { maxPricePaise: toPaise(1000), rateBps: 500 },
            { maxPricePaise: null, rateBps: 1800 },
          ],
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
  });

  async function seedProduct(overrides: Partial<ProductSeed> = {}) {
    const created = await Product.create(productFixture(overrides));
    return created.id;
  }

  it('places a COD order: prices it, takes stock, and assigns an invoice number', async () => {
    const productId = await seedProduct();

    const response = await request(app)
      .post('/api/orders')
      .send({
        items: [{ productId, color: 'Black', size: 8, qty: 2 }],
        customer: customerPayload(),
        paymentMethod: 'cod',
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      orderNumber: expect.stringMatching(/^SS-\d{8}-\d{4}$/),
      paymentMethod: 'cod',
      totalPaise: toPaise(999) * 2 + toPaise(50) + toPaise(20),
    });
    expect(response.body.razorpay).toBeUndefined();

    const order = await Order.findById(response.body.orderId);
    expect(order?.paymentStatus).toBe('pending'); // COD is paid on delivery, not at placement
    expect(order?.stockCommitted).toBe(true);
    expect(order?.invoice?.number).toMatch(/^INV\//);

    const product = await Product.findById(productId);
    expect(product?.variants[0]?.sizes[0]?.stock).toBe(2); // 4 - 2
  });

  it('rejects the honeypot field as a bot submission', async () => {
    const productId = await seedProduct();

    const response = await request(app)
      .post('/api/orders')
      .send({
        items: [{ productId, color: 'Black', size: 8, qty: 1 }],
        customer: customerPayload(),
        paymentMethod: 'cod',
        website: 'http://spam.example',
      });

    expect(response.status).toBe(400);
    const product = await Product.findById(productId);
    expect(product?.variants[0]?.sizes[0]?.stock).toBe(4); // untouched
  });

  it('refuses an order for a size that has sold out', async () => {
    const productId = await seedProduct({
      variants: [
        {
          color: 'Black',
          colorHex: '#141414',
          images: [{ url: 'https://example.com/a.jpg', publicId: 'seed/a' }],
          sizes: [{ size: 8, stock: 0 }],
        },
      ],
    });

    const response = await request(app)
      .post('/api/orders')
      .send({
        items: [{ productId, color: 'Black', size: 8, qty: 1 }],
        customer: customerPayload(),
        paymentMethod: 'cod',
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('STOCK_UNAVAILABLE');
  });

  it('blocks delivery to a PIN code the shop does not serve', async () => {
    await Settings.findOneAndUpdate(
      { _id: SETTINGS_ID },
      { $set: { blockedPincodes: ['560001'] } },
    );
    const productId = await seedProduct();

    const response = await request(app)
      .post('/api/orders')
      .send({
        items: [{ productId, color: 'Black', size: 8, qty: 1 }],
        customer: customerPayload(),
        paymentMethod: 'cod',
      });

    expect(response.status).toBe(400);
  });

  it('caps how many orders one phone number can place per day', async () => {
    await Settings.findOneAndUpdate({ _id: SETTINGS_ID }, { $set: { maxOrdersPerPhonePerDay: 1 } });
    const productId = await seedProduct({
      variants: [
        {
          color: 'Black',
          colorHex: '#141414',
          images: [{ url: 'https://example.com/a.jpg', publicId: 'seed/a' }],
          sizes: [{ size: 8, stock: 10 }],
        },
      ],
    });
    const order = () =>
      request(app)
        .post('/api/orders')
        .send({
          items: [{ productId, color: 'Black', size: 8, qty: 1 }],
          customer: customerPayload(),
          paymentMethod: 'cod',
        });

    expect((await order()).status).toBe(201);
    const second = await order();
    expect(second.status).toBe(429);
  });

  it('places a Razorpay order and confirms it via the checkout callback', async () => {
    const productId = await seedProduct();

    const created = await request(app)
      .post('/api/orders')
      .send({
        items: [{ productId, color: 'Black', size: 8, qty: 1 }],
        customer: customerPayload(),
        paymentMethod: 'razorpay',
      });

    expect(created.status).toBe(201);
    expect(created.body.razorpay).toMatchObject({ keyId: 'rzp_test_dummy', currency: 'INR' });

    // Stock is not committed until payment is confirmed.
    const pending = await Product.findById(productId);
    expect(pending?.variants[0]?.sizes[0]?.stock).toBe(4);

    const razorpayOrderId = created.body.razorpay.orderId as string;
    const razorpayPaymentId = 'pay_test_1';
    const signature = paymentSignature(razorpayOrderId, razorpayPaymentId);

    const verified = await request(app)
      .post(`/api/orders/${created.body.orderId}/verify-payment`)
      .send({ razorpayOrderId, razorpayPaymentId, razorpaySignature: signature });

    expect(verified.status).toBe(200);
    expect(verified.body.paymentStatus).toBe('paid');
    expect(verified.body.invoice?.number).toMatch(/^INV\//);

    const product = await Product.findById(productId);
    expect(product?.variants[0]?.sizes[0]?.stock).toBe(3);

    // Calling it again (a retried callback) must not double-charge stock.
    const again = await request(app)
      .post(`/api/orders/${created.body.orderId}/verify-payment`)
      .send({ razorpayOrderId, razorpayPaymentId, razorpaySignature: signature });
    expect(again.status).toBe(200);
    const stillFour = await Product.findById(productId);
    expect(stillFour?.variants[0]?.sizes[0]?.stock).toBe(3);
  });

  it('rejects a forged payment signature and marks the payment failed', async () => {
    const productId = await seedProduct();

    const created = await request(app)
      .post('/api/orders')
      .send({
        items: [{ productId, color: 'Black', size: 8, qty: 1 }],
        customer: customerPayload(),
        paymentMethod: 'razorpay',
      });

    const response = await request(app)
      .post(`/api/orders/${created.body.orderId}/verify-payment`)
      .send({
        razorpayOrderId: created.body.razorpay.orderId,
        razorpayPaymentId: 'pay_test_1',
        razorpaySignature: 'not-a-real-signature',
      });

    expect(response.status).toBe(400);
    const order = await Order.findById(created.body.orderId);
    expect(order?.paymentStatus).toBe('failed');
    expect(order?.stockCommitted).toBe(false);
  });

  it('confirms payment from the Razorpay webhook, independent of the checkout callback', async () => {
    const productId = await seedProduct();

    const created = await request(app)
      .post('/api/orders')
      .send({
        items: [{ productId, color: 'Black', size: 8, qty: 1 }],
        customer: customerPayload(),
        paymentMethod: 'razorpay',
      });

    const razorpayOrderId = created.body.razorpay.orderId as string;
    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_webhook_1', order_id: razorpayOrderId } } },
    });
    const signature = crypto
      .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    const response = await request(app)
      .post('/api/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', signature)
      .send(payload);

    expect(response.status).toBe(200);

    // The handler runs after the response is sent; give it a moment.
    await new Promise((resolve) => setTimeout(resolve, 100));

    const order = await Order.findById(created.body.orderId);
    expect(order?.paymentStatus).toBe('paid');
    expect(order?.stockCommitted).toBe(true);

    const product = await Product.findById(productId);
    expect(product?.variants[0]?.sizes[0]?.stock).toBe(3);
  });

  it('rejects a webhook call with a forged signature', async () => {
    const payload = JSON.stringify({ event: 'payment.captured', payload: {} });

    const response = await request(app)
      .post('/api/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', 'forged')
      .send(payload);

    expect(response.status).toBe(401);
  });

  it('lets a guest track their order by order number and phone', async () => {
    const productId = await seedProduct();
    const created = await request(app)
      .post('/api/orders')
      .send({
        items: [{ productId, color: 'Black', size: 8, qty: 1 }],
        customer: customerPayload(),
        paymentMethod: 'cod',
      });

    const found = await request(app)
      .get('/api/orders/track')
      .query({ orderNumber: created.body.orderNumber, phone: '9876543210' });
    expect(found.status).toBe(200);
    expect(found.body.orderNumber).toBe(created.body.orderNumber);
    expect(found.body.customer).toBeUndefined(); // public view carries no customer details

    const wrongPhone = await request(app)
      .get('/api/orders/track')
      .query({ orderNumber: created.body.orderNumber, phone: '9999999999' });
    expect(wrongPhone.status).toBe(404);
  });

  it('serves a PDF invoice once an order has one', async () => {
    const productId = await seedProduct();
    const created = await request(app)
      .post('/api/orders')
      .send({
        items: [{ productId, color: 'Black', size: 8, qty: 1 }],
        customer: customerPayload(),
        paymentMethod: 'cod',
      });

    const response = await request(app)
      .get('/api/orders/track/invoice')
      .query({ orderNumber: created.body.orderNumber, phone: '9876543210' });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.body.slice(0, 4).toString()).toBe('%PDF');
  });
});

describeWithMongo('admin order management', () => {
  beforeAll(() => {
    app = createApp();
  });

  beforeEach(async () => {
    await Settings.findOneAndUpdate(
      { _id: SETTINGS_ID },
      { $set: { codEnabled: true, codMaxOrderValuePaise: 0, maxOrdersPerPhonePerDay: 50 } },
      { upsert: true, setDefaultsOnInsert: true },
    );
  });

  async function placeOrder(productId: string, phone = '9876543210') {
    const response = await request(app)
      .post('/api/orders')
      .send({
        items: [{ productId, color: 'Black', size: 8, qty: 1 }],
        customer: customerPayload({ phone }),
        paymentMethod: 'cod',
      });
    return response.body as { orderId: string; orderNumber: string };
  }

  async function adminToken(): Promise<string> {
    const { Admin } = await import('../models/Admin.js');
    const { hashPassword } = await import('../services/auth.service.js');
    await Admin.create({
      email: 'owner@example.com',
      passwordHash: await hashPassword('correct-horse-battery'),
      tokensValidFrom: new Date(),
    });
    const login = await request(app)
      .post('/api/admin/login')
      .send({ email: 'owner@example.com', password: 'correct-horse-battery' });
    return login.body.accessToken as string;
  }

  it('requires authentication for every admin order route', async () => {
    const response = await request(app).get('/api/admin/orders');
    expect(response.status).toBe(401);
  });

  it('lists orders and fetches one with its cancellation history', async () => {
    const token = await adminToken();
    const productId = await seedProductForAdmin();
    const { orderId } = await placeOrder(productId);

    const list = await request(app)
      .get('/api/admin/orders')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].priorCancelledCount).toBe(0);

    const single = await request(app)
      .get(`/api/admin/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(single.status).toBe(200);
    expect(single.body.customer.phone).toBe('9876543210');
  });

  it('walks an order through its fulfilment pipeline', async () => {
    const token = await adminToken();
    const productId = await seedProductForAdmin();
    const { orderId } = await placeOrder(productId);

    const confirm = await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'confirmed' });
    expect(confirm.status).toBe(200);
    expect(confirm.body.status).toBe('confirmed');

    const invalid = await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'delivered' }); // cannot skip packed/shipped
    expect(invalid.status).toBe(400);
  });

  it('restores stock exactly once when an order is cancelled', async () => {
    const token = await adminToken();
    const productId = await seedProductForAdmin();
    const { orderId } = await placeOrder(productId);

    const beforeCancel = await Product.findById(productId);
    expect(beforeCancel?.variants[0]?.sizes[0]?.stock).toBe(3); // 4 - 1

    await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' });

    const afterCancel = await Product.findById(productId);
    expect(afterCancel?.variants[0]?.sizes[0]?.stock).toBe(4);
  });

  it('counts an earlier cancellation from the same phone number', async () => {
    const token = await adminToken();
    const productId = await seedProductForAdmin();

    const first = await placeOrder(productId, '9123456780');
    await request(app)
      .patch(`/api/admin/orders/${first.orderId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' });

    const second = await placeOrder(productId, '9123456780');
    const single = await request(app)
      .get(`/api/admin/orders/${second.orderId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(single.body.priorCancelledCount).toBe(1);
  });

  async function seedProductForAdmin() {
    const created = await Product.create(productFixture());
    return created.id;
  }
});
