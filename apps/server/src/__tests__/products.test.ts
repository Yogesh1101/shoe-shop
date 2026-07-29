import { toPaise } from '@shoe-shop/shared';
import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { syncIndexes } from '../config/db.js';
import { Admin } from '../models/Admin.js';
import { Product, type ProductDoc } from '../models/Product.js';
import { hashPassword } from '../services/auth.service.js';
import { describeWithMongo } from './helpers/mongo.js';

const EMAIL = 'owner@example.com';
const PASSWORD = 'correct-horse-battery';

let app: Express;

type ProductSeed = Omit<ProductDoc, 'createdAt' | 'updatedAt'>;

/** A complete document, for inserting straight into MongoDB. */
function productFixture(overrides: Partial<ProductSeed> = {}): ProductSeed {
  return {
    name: 'Air Rush 90',
    slug: 'air-rush-90',
    brand: 'Nike',
    description: 'Everyday cushioned sneaker.',
    category: 'men',
    type: 'sneakers',
    pricePaise: toPaise(4999),
    mrpPaise: toPaise(7999),
    hsnCode: '6404',
    tags: ['running'],
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

/**
 * The same shape minus `slug`, for POSTing to the API — the server derives the
 * slug itself and the input schema has no such field.
 */
function productPayload(overrides: Partial<ProductSeed> = {}): Omit<ProductSeed, 'slug'> {
  const { slug: _slug, ...rest } = productFixture(overrides);
  return rest;
}

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

describeWithMongo('public catalog', () => {
  beforeAll(async () => {
    app = createApp();
    // The text index has to exist before $text queries work.
    await syncIndexes();
  });

  beforeEach(async () => {
    await Product.create([
      productFixture(),
      productFixture({
        name: 'Court Classic',
        slug: 'court-classic',
        brand: 'Adidas',
        type: 'casual',
        pricePaise: toPaise(3499),
        mrpPaise: toPaise(4999),
        variants: [
          {
            color: 'White',
            colorHex: '#fafafa',
            images: [{ url: 'https://example.com/b.jpg', publicId: 'seed/b' }],
            sizes: [{ size: 10, stock: 2 }],
          },
        ],
      }),
      productFixture({
        name: 'Hidden Draft',
        slug: 'hidden-draft',
        brand: 'Puma',
        isActive: false,
      }),
    ]);
  });

  it('lists only active products', async () => {
    const response = await request(app).get('/api/products');

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);
    expect(response.body.items.map((p: { slug: string }) => p.slug)).not.toContain('hidden-draft');
  });

  it('cannot be tricked into revealing drafts via the query string', async () => {
    // `includeInactive` exists for the admin route; the public one must ignore it.
    const response = await request(app).get('/api/products?includeInactive=true');

    expect(response.body.total).toBe(2);
    expect(response.body.items.map((p: { slug: string }) => p.slug)).not.toContain('hidden-draft');
  });

  it('filters by brand', async () => {
    const response = await request(app).get('/api/products?brand=Adidas');
    expect(response.body.total).toBe(1);
    expect(response.body.items[0].brand).toBe('Adidas');
  });

  it('accepts comma-separated brands', async () => {
    const response = await request(app).get('/api/products?brand=Adidas,Nike');
    expect(response.body.total).toBe(2);
  });

  it('filters by category and type', async () => {
    expect((await request(app).get('/api/products?type=casual')).body.total).toBe(1);
    expect((await request(app).get('/api/products?category=men')).body.total).toBe(2);
  });

  it('filters by size, and only when that size is in stock', async () => {
    // Size 8 has stock 4 on Air Rush.
    expect((await request(app).get('/api/products?size=8')).body.total).toBe(1);
    // Size 9 exists on Air Rush but has zero stock, so it must not match.
    expect((await request(app).get('/api/products?size=9')).body.total).toBe(0);
  });

  it('filters by colour case-insensitively', async () => {
    expect((await request(app).get('/api/products?color=black')).body.total).toBe(1);
    expect((await request(app).get('/api/products?color=BLACK')).body.total).toBe(1);
  });

  it('treats a colour containing regex characters as a literal', async () => {
    // A naive implementation would build /^.*$/i here and match everything.
    const response = await request(app).get('/api/products?color=.*');
    expect(response.body.total).toBe(0);
  });

  it('filters by price range', async () => {
    const response = await request(app).get(
      `/api/products?minPricePaise=${toPaise(4000)}&maxPricePaise=${toPaise(6000)}`,
    );
    expect(response.body.total).toBe(1);
    expect(response.body.items[0].name).toBe('Air Rush 90');
  });

  it('sorts by price', async () => {
    const ascending = await request(app).get('/api/products?sort=price-asc');
    expect(ascending.body.items[0].name).toBe('Court Classic');

    const descending = await request(app).get('/api/products?sort=price-desc');
    expect(descending.body.items[0].name).toBe('Air Rush 90');
  });

  it('searches by brand and name', async () => {
    const response = await request(app).get('/api/products?q=adidas');
    expect(response.body.total).toBe(1);
    expect(response.body.items[0].brand).toBe('Adidas');
  });

  it('paginates', async () => {
    const response = await request(app).get('/api/products?limit=1&page=2');
    expect(response.body.items).toHaveLength(1);
    expect(response.body.page).toBe(2);
    expect(response.body.totalPages).toBe(2);
  });

  it('rejects an out-of-range limit rather than clamping silently', async () => {
    const response = await request(app).get('/api/products?limit=5000');
    expect(response.status).toBe(422);
  });

  it('returns a single product by slug', async () => {
    const response = await request(app).get('/api/products/air-rush-90');
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Air Rush 90');
    expect(response.body.variants[0].sizes).toHaveLength(2);
  });

  it('404s for an inactive product', async () => {
    const response = await request(app).get('/api/products/hidden-draft');
    expect(response.status).toBe(404);
  });

  it('serves facets for the filter sidebar', async () => {
    const response = await request(app).get('/api/products/facets');

    expect(response.status).toBe(200);
    expect(response.body.brands).toEqual(['Adidas', 'Nike']);
    // Only in-stock sizes are offered as filters.
    expect(response.body.sizes).toEqual([8, 10]);
    expect(response.body.priceRangePaise).toEqual({
      min: toPaise(3499),
      max: toPaise(4999),
    });
  });

  it('does not treat "facets" as a product slug', async () => {
    const response = await request(app).get('/api/products/facets');
    expect(response.body).toHaveProperty('brands');
  });
});

describeWithMongo('admin product management', () => {
  beforeAll(() => {
    app = createApp();
  });

  it('requires authentication for every write', async () => {
    const paths: [string, 'post' | 'patch' | 'delete'][] = [
      ['/api/admin/products', 'post'],
      ['/api/admin/products/507f1f77bcf86cd799439011', 'patch'],
      ['/api/admin/products/507f1f77bcf86cd799439011', 'delete'],
    ];

    for (const [path, method] of paths) {
      const response = await request(app)[method](path).send({});
      expect(response.status).toBe(401);
    }
  });

  it('creates a product and derives a unique slug', async () => {
    const token = await adminToken();

    const response = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send(productPayload());

    expect(response.status).toBe(201);
    expect(response.body.slug).toBe('air-rush-90');
  });

  it('gives a second product of the same name a distinct slug', async () => {
    const token = await adminToken();
    const payload = productPayload();

    await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    const second = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(second.status).toBe(201);
    expect(second.body.slug).toBe('air-rush-90-2');
  });

  it('rejects an MRP below the selling price', async () => {
    const token = await adminToken();

    const response = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send(productPayload({ mrpPaise: toPaise(100) }));

    expect(response.status).toBe(422);
  });

  it('rejects a price sent in rupees instead of paise', async () => {
    const token = await adminToken();

    const response = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send(productPayload({ pricePaise: 4999.5 }));

    expect(response.status).toBe(422);
  });

  it('sees inactive products the storefront cannot', async () => {
    const token = await adminToken();
    await Product.create(productFixture({ isActive: false }));

    const response = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${token}`);

    expect(response.body.total).toBe(1);
  });

  it('re-checks MRP against the stored price on a partial update', async () => {
    const token = await adminToken();
    const created = await Product.create(productFixture());

    // The patch carries only a price. The partial schema cannot compare it to
    // an MRP that is not in the payload, so the service must consult the
    // stored document — otherwise this would slip through.
    const response = await request(app)
      .patch(`/api/admin/products/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ pricePaise: toPaise(9999) });

    expect(response.status).toBe(422);
  });

  it('allows a partial update that does not break the price rule', async () => {
    const token = await adminToken();
    const created = await Product.create(productFixture());

    const response = await request(app)
      .patch(`/api/admin/products/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });

    expect(response.status).toBe(200);
    expect(response.body.isActive).toBe(false);
  });

  it('re-slugs when the name changes', async () => {
    const token = await adminToken();
    const created = await Product.create(productFixture());

    const response = await request(app)
      .patch(`/api/admin/products/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Air Rush 91' });

    expect(response.body.slug).toBe('air-rush-91');
  });

  it('keeps its own slug when renamed to the name it already has', async () => {
    const token = await adminToken();
    const created = await Product.create(productFixture());

    // Without excludeId this would collide with itself and drift to -2.
    const response = await request(app)
      .patch(`/api/admin/products/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Air Rush 90', description: 'Updated copy.' });

    expect(response.body.slug).toBe('air-rush-90');
  });

  it('deletes a product', async () => {
    const token = await adminToken();
    const created = await Product.create(productFixture());

    const response = await request(app)
      .delete(`/api/admin/products/${created.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(await Product.countDocuments()).toBe(0);
  });

  it('rejects a malformed id before it reaches Mongo', async () => {
    const token = await adminToken();

    const response = await request(app)
      .get('/api/admin/products/not-an-object-id')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(422);
  });
});
