import { toPaise } from '@shoe-shop/shared';
import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { Product, type ProductDoc } from '../models/Product.js';
import { Settings, SETTINGS_ID } from '../models/Settings.js';
import { describeWithMongo } from './helpers/mongo.js';

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
    pricePaise: toPaise(999), // sits in the 5% slab by default
    mrpPaise: toPaise(1499),
    hsnCode: '6404',
    tags: [],
    isActive: true,
    variants: [
      {
        color: 'Black',
        colorHex: '#141414',
        images: [{ url: 'https://example.com/a.jpg', publicId: 'seed/a' }],
        sizes: [
          { size: 8, stock: 4 },
          { size: 9, stock: 0 },
        ],
      },
    ],
    ...overrides,
  };
}

describeWithMongo('checkout quote', () => {
  beforeAll(() => {
    app = createApp();
  });

  beforeEach(async () => {
    await Settings.findOneAndUpdate(
      { _id: SETTINGS_ID },
      {
        $set: {
          deliveryChargePaise: toPaise(50),
          freeDeliveryAbovePaise: toPaise(999),
          codEnabled: true,
          codExtraChargePaise: toPaise(20),
          codMaxOrderValuePaise: 0,
          gstEnabled: true,
          gstin: '29ABCDE1234F1Z5',
          sellerState: 'Karnataka',
          pricesIncludeTax: true,
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

  it('rejects an empty cart', async () => {
    const response = await request(app).post('/api/checkout/quote').send({ items: [] });
    expect(response.status).toBe(422);
  });

  it('prices a valid cart from database prices, ignoring anything the client claims', async () => {
    const productId = await seedProduct();

    const response = await request(app)
      .post('/api/checkout/quote')
      .send({ items: [{ productId, color: 'Black', size: 8, qty: 2 }] });

    expect(response.status).toBe(200);
    expect(response.body.lines).toHaveLength(1);
    expect(response.body.lines[0].unitPricePaise).toBe(toPaise(999));
    expect(response.body.lines[0].lineTotalPaise).toBe(toPaise(999) * 2);
    expect(response.body.subtotalPaise).toBe(toPaise(999) * 2);
    expect(response.body.stockIssues).toHaveLength(0);
  });

  it('flags an out-of-stock size', async () => {
    const productId = await seedProduct();

    const response = await request(app)
      .post('/api/checkout/quote')
      .send({ items: [{ productId, color: 'Black', size: 9, qty: 1 }] });

    expect(response.body.stockIssues).toEqual([
      expect.objectContaining({ reason: 'out-of-stock', available: 0, requested: 1 }),
    ]);
    expect(response.body.lines).toHaveLength(0);
  });

  it('flags a quantity beyond what is in stock', async () => {
    const productId = await seedProduct();

    const response = await request(app)
      .post('/api/checkout/quote')
      .send({ items: [{ productId, color: 'Black', size: 8, qty: 5 }] });

    expect(response.body.stockIssues).toEqual([
      expect.objectContaining({ reason: 'insufficient-stock', available: 4, requested: 5 }),
    ]);
  });

  it('flags a colour that does not exist on the product as unavailable', async () => {
    const productId = await seedProduct();

    const response = await request(app)
      .post('/api/checkout/quote')
      .send({ items: [{ productId, color: 'Purple', size: 8, qty: 1 }] });

    expect(response.body.stockIssues).toEqual([expect.objectContaining({ reason: 'unavailable' })]);
  });

  it('flags a product that has been unpublished since it was added to the cart', async () => {
    const productId = await seedProduct({ isActive: false });

    const response = await request(app)
      .post('/api/checkout/quote')
      .send({ items: [{ productId, color: 'Black', size: 8, qty: 1 }] });

    expect(response.body.stockIssues).toEqual([expect.objectContaining({ reason: 'unavailable' })]);
  });

  it('ships free once the subtotal meets the threshold', async () => {
    const productId = await seedProduct(); // priced at exactly the threshold

    const response = await request(app)
      .post('/api/checkout/quote')
      .send({ items: [{ productId, color: 'Black', size: 8, qty: 1 }] });

    expect(response.body.deliveryChargePaise).toBe(0);
    expect(response.body.freeDeliveryShortfallPaise).toBeNull();
  });

  it('reports a shortfall and charges delivery when below the threshold', async () => {
    const productId = await seedProduct({ pricePaise: toPaise(500), mrpPaise: toPaise(500) });

    const response = await request(app)
      .post('/api/checkout/quote')
      .send({ items: [{ productId, color: 'Black', size: 8, qty: 1 }] });

    expect(response.body.deliveryChargePaise).toBe(toPaise(50));
    expect(response.body.freeDeliveryShortfallPaise).toBe(toPaise(999) - toPaise(500));
  });

  it('splits intra-state tax into CGST and SGST that reconcile exactly', async () => {
    const productId = await seedProduct(); // 999 paise-rupees, 5% slab

    const response = await request(app)
      .post('/api/checkout/quote')
      .send({
        items: [{ productId, color: 'Black', size: 8, qty: 1 }],
        state: 'Karnataka', // same as sellerState
      });

    expect(response.body.tax.mode).toBe('cgst_sgst');
    expect(response.body.tax.lines).toEqual([
      expect.objectContaining({ label: 'CGST 2.5%' }),
      expect.objectContaining({ label: 'SGST 2.5%' }),
    ]);
    const [cgst, sgst] = response.body.tax.lines;
    expect(cgst.amountPaise + sgst.amountPaise).toBe(response.body.tax.totalPaise);
  });

  it('charges a single IGST line for an inter-state shipment', async () => {
    const productId = await seedProduct();

    const response = await request(app)
      .post('/api/checkout/quote')
      .send({
        items: [{ productId, color: 'Black', size: 8, qty: 1 }],
        state: 'Maharashtra',
      });

    expect(response.body.tax.mode).toBe('igst');
    expect(response.body.tax.lines).toEqual([expect.objectContaining({ label: 'IGST 5%' })]);
  });

  it('does not add tax-inclusive GST on top of the total', async () => {
    const productId = await seedProduct();

    const response = await request(app)
      .post('/api/checkout/quote')
      .send({ items: [{ productId, color: 'Black', size: 8, qty: 1 }] });

    // pricesIncludeTax is true: the tax breakdown is informational only.
    expect(response.body.totalPaise).toBe(
      response.body.subtotalPaise +
        response.body.deliveryChargePaise +
        response.body.codChargePaise,
    );
  });

  it('reports no tax when GST is switched off', async () => {
    await Settings.findOneAndUpdate({ _id: SETTINGS_ID }, { $set: { gstEnabled: false } });
    const productId = await seedProduct();

    const response = await request(app)
      .post('/api/checkout/quote')
      .send({ items: [{ productId, color: 'Black', size: 8, qty: 1 }] });

    expect(response.body.tax).toEqual({
      mode: 'none',
      taxablePaise: response.body.subtotalPaise,
      lines: [],
      totalPaise: 0,
    });
  });

  it('adds a COD surcharge only when cash on delivery is requested', async () => {
    const productId = await seedProduct();

    const online = await request(app)
      .post('/api/checkout/quote')
      .send({ items: [{ productId, color: 'Black', size: 8, qty: 1 }], paymentMethod: 'razorpay' });
    expect(online.body.codChargePaise).toBe(0);

    const cod = await request(app)
      .post('/api/checkout/quote')
      .send({ items: [{ productId, color: 'Black', size: 8, qty: 1 }], paymentMethod: 'cod' });
    expect(cod.body.codChargePaise).toBe(toPaise(20));
  });

  it('refuses cash on delivery above the configured cap', async () => {
    await Settings.findOneAndUpdate(
      { _id: SETTINGS_ID },
      { $set: { codMaxOrderValuePaise: toPaise(500) } },
    );
    const productId = await seedProduct(); // 999 rupees, above the 500 cap

    const response = await request(app)
      .post('/api/checkout/quote')
      .send({ items: [{ productId, color: 'Black', size: 8, qty: 1 }], paymentMethod: 'cod' });

    expect(response.body.codAvailable).toBe(false);
    expect(response.body.codChargePaise).toBe(0);
  });

  it('flags a blocked PIN code as unserviceable', async () => {
    await Settings.findOneAndUpdate(
      { _id: SETTINGS_ID },
      { $set: { blockedPincodes: ['110001'] } },
    );
    const productId = await seedProduct();

    const blocked = await request(app)
      .post('/api/checkout/quote')
      .send({ items: [{ productId, color: 'Black', size: 8, qty: 1 }], pincode: '110001' });
    expect(blocked.body.pincodeServiceable).toBe(false);

    const served = await request(app)
      .post('/api/checkout/quote')
      .send({ items: [{ productId, color: 'Black', size: 8, qty: 1 }], pincode: '560001' });
    expect(served.body.pincodeServiceable).toBe(true);
  });

  it('leaves pincode serviceability unknown when no pincode was given', async () => {
    const productId = await seedProduct();

    const response = await request(app)
      .post('/api/checkout/quote')
      .send({ items: [{ productId, color: 'Black', size: 8, qty: 1 }] });

    expect(response.body.pincodeServiceable).toBeNull();
  });
});
