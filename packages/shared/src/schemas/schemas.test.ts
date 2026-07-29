import { describe, expect, it } from 'vitest';

import { DEFAULT_GST_SLABS } from '../constants.js';
import { cartSchema, createOrderSchema } from './checkout.schema.js';
import { paiseSchema, phoneSchema, pincodeSchema } from './common.schema.js';
import { productInputSchema } from './product.schema.js';
import { settingsSchema } from './settings.schema.js';

/**
 * Local deep clone. `structuredClone` would need either DOM or Node typings,
 * and this package stays environment-agnostic so it can be imported by both the
 * Express server and the browser bundle.
 */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('phoneSchema', () => {
  it('normalises the formats people actually type', () => {
    for (const input of [
      '9876543210',
      '+91 98765 43210',
      '+919876543210',
      '098765-43210',
      '  9876543210  ',
      '91 9876543210',
    ]) {
      expect(phoneSchema.parse(input)).toBe('9876543210');
    }
  });

  it('rejects numbers that are not Indian mobiles', () => {
    // Landline prefixes, wrong length, letters.
    for (const input of ['1234567890', '5876543210', '98765', '98765432101', 'abcdefghij']) {
      expect(phoneSchema.safeParse(input).success).toBe(false);
    }
  });
});

describe('pincodeSchema', () => {
  it('accepts six digits not starting with zero', () => {
    expect(pincodeSchema.parse('560001')).toBe('560001');
  });

  it('rejects malformed PIN codes', () => {
    for (const input of ['012345', '56000', '5600011', 'ABC123']) {
      expect(pincodeSchema.safeParse(input).success).toBe(false);
    }
  });
});

describe('paiseSchema', () => {
  it('rejects a decimal, which means someone sent rupees', () => {
    expect(paiseSchema.safeParse(1499.5).success).toBe(false);
    expect(paiseSchema.safeParse(149_900).success).toBe(true);
  });

  it('rejects negative amounts', () => {
    expect(paiseSchema.safeParse(-1).success).toBe(false);
  });
});

describe('cartSchema', () => {
  const item = {
    productId: '507f1f77bcf86cd799439011',
    color: 'Black',
    size: 9,
    qty: 1,
  };

  it('accepts a valid cart', () => {
    expect(cartSchema.safeParse([item]).success).toBe(true);
  });

  it('rejects an empty cart', () => {
    expect(cartSchema.safeParse([]).success).toBe(false);
  });

  it('rejects the same shoe, colour and size listed twice', () => {
    // Two lines of the same variant should have been merged into one qty.
    expect(cartSchema.safeParse([item, { ...item, qty: 2 }]).success).toBe(false);
  });

  it('allows the same shoe in different sizes', () => {
    expect(cartSchema.safeParse([item, { ...item, size: 10 }]).success).toBe(true);
  });

  it('has no price field, so a client cannot propose one', () => {
    const parsed = cartSchema.parse([{ ...item, unitPricePaise: 1 }]);
    expect(parsed[0]).not.toHaveProperty('unitPricePaise');
  });
});

describe('createOrderSchema', () => {
  const validOrder = {
    items: [{ productId: '507f1f77bcf86cd799439011', color: 'Black', size: 9, qty: 1 }],
    customer: {
      name: 'Asha Rao',
      phone: '9876543210',
      email: 'asha@example.com',
      address: {
        line1: '12 MG Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
    },
    paymentMethod: 'cod' as const,
  };

  it('accepts a complete order', () => {
    expect(createOrderSchema.safeParse(validOrder).success).toBe(true);
  });

  it('rejects a filled honeypot', () => {
    const result = createOrderSchema.safeParse({ ...validOrder, website: 'http://spam.example' });
    expect(result.success).toBe(false);
  });

  it('accepts an empty honeypot, which is what real browsers send', () => {
    expect(createOrderSchema.safeParse({ ...validOrder, website: '' }).success).toBe(true);
  });

  it('rejects an unknown state', () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      customer: {
        ...validOrder.customer,
        address: { ...validOrder.customer.address, state: 'Atlantis' },
      },
    });
    expect(result.success).toBe(false);
  });
});

describe('productInputSchema', () => {
  const validProduct = {
    name: 'Air Runner',
    brand: 'Nike',
    category: 'men' as const,
    type: 'sneakers' as const,
    pricePaise: 249_900,
    mrpPaise: 349_900,
    hsnCode: '6404',
    variants: [
      {
        color: 'Black',
        colorHex: '#111111',
        images: [{ url: 'https://res.cloudinary.com/demo/a.jpg', publicId: 'shoes/a' }],
        sizes: [
          { size: 8, stock: 3 },
          { size: 9, stock: 0 },
        ],
      },
    ],
  };

  it('accepts a valid product', () => {
    expect(productInputSchema.safeParse(validProduct).success).toBe(true);
  });

  it('rejects an MRP below the selling price', () => {
    const result = productInputSchema.safeParse({ ...validProduct, mrpPaise: 100_000 });
    expect(result.success).toBe(false);
  });

  it('allows zero stock but not negative stock', () => {
    const negative = clone(validProduct);
    negative.variants[0]!.sizes[0]!.stock = -1;
    expect(productInputSchema.safeParse(negative).success).toBe(false);
  });

  it('rejects a duplicated size within one colour', () => {
    const duplicated = clone(validProduct);
    duplicated.variants[0]!.sizes = [
      { size: 9, stock: 1 },
      { size: 9, stock: 2 },
    ];
    expect(productInputSchema.safeParse(duplicated).success).toBe(false);
  });

  it('rejects the same colour twice, case-insensitively', () => {
    const duplicated = clone(validProduct);
    duplicated.variants.push({ ...duplicated.variants[0]!, color: 'black' });
    expect(productInputSchema.safeParse(duplicated).success).toBe(false);
  });

  it('requires at least one photo per colour', () => {
    const noImages = clone(validProduct);
    noImages.variants[0]!.images = [];
    expect(productInputSchema.safeParse(noImages).success).toBe(false);
  });

  it('accepts half sizes but rejects quarter sizes', () => {
    const half = clone(validProduct);
    half.variants[0]!.sizes = [{ size: 8.5, stock: 1 }];
    expect(productInputSchema.safeParse(half).success).toBe(true);

    const quarter = clone(validProduct);
    quarter.variants[0]!.sizes = [{ size: 8.25, stock: 1 }];
    expect(productInputSchema.safeParse(quarter).success).toBe(false);
  });
});

describe('settingsSchema', () => {
  const validSettings = {
    shopName: 'Sole Mate',
    contactPhone: '9876543210',
    contactEmail: 'shop@example.com',
    deliveryChargePaise: 5_000,
    freeDeliveryAbovePaise: 100_000,
    sellerState: 'Karnataka',
    gstEnabled: true,
    gstin: '29ABCDE1234F1Z5',
    gstSlabs: [...DEFAULT_GST_SLABS],
    hsnDefault: '6404',
  };

  it('accepts valid settings', () => {
    expect(settingsSchema.safeParse(validSettings).success).toBe(true);
  });

  it('requires a GSTIN when GST invoicing is enabled', () => {
    const result = settingsSchema.safeParse({ ...validSettings, gstin: '' });
    expect(result.success).toBe(false);
  });

  it('allows an empty GSTIN when GST is off', () => {
    const result = settingsSchema.safeParse({ ...validSettings, gstEnabled: false, gstin: '' });
    expect(result.success).toBe(true);
  });

  it('rejects a malformed GSTIN', () => {
    expect(settingsSchema.safeParse({ ...validSettings, gstin: '29ABCDE1234F1' }).success).toBe(
      false,
    );
  });

  it('requires the final GST slab to be open-ended', () => {
    const closed = {
      ...validSettings,
      gstSlabs: [
        { maxPricePaise: 250_000, rateBps: 500 },
        { maxPricePaise: 900_000, rateBps: 1800 },
      ],
    };
    expect(settingsSchema.safeParse(closed).success).toBe(false);
  });

  it('rejects slabs that are not in ascending price order', () => {
    const unordered = {
      ...validSettings,
      gstSlabs: [
        { maxPricePaise: 500_000, rateBps: 1800 },
        { maxPricePaise: 250_000, rateBps: 500 },
        { maxPricePaise: null, rateBps: 1800 },
      ],
    };
    expect(settingsSchema.safeParse(unordered).success).toBe(false);
  });

  it('accepts a single open-ended slab', () => {
    const flat = { ...validSettings, gstSlabs: [{ maxPricePaise: null, rateBps: 1200 }] };
    expect(settingsSchema.safeParse(flat).success).toBe(true);
  });
});
