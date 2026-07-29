import { type ProductInput, toPaise } from '@shoe-shop/shared';

import { connectToDatabase, disconnectFromDatabase } from '../config/db.js';
import { Product } from '../models/Product.js';
import { logger } from '../utils/logger.js';
import { slugify } from '../utils/slug.js';

/**
 * Sample catalog for development, so no screen is ever empty while building.
 *
 * The photos are placeholder URLs, not Cloudinary assets — `publicId` is a
 * made-up value. Deleting a seeded product will therefore log a Cloudinary
 * miss, which is expected. Real products get real assets through the admin
 * upload route.
 */
function photo(seed: string): { url: string; publicId: string } {
  return {
    url: `https://picsum.photos/seed/${seed}/900/900`,
    publicId: `seed/${seed}`,
  };
}

type SeedProduct = Omit<ProductInput, 'description' | 'tags' | 'isActive'> &
  Partial<Pick<ProductInput, 'description' | 'tags' | 'isActive'>>;

const SEED_PRODUCTS: SeedProduct[] = [
  {
    name: 'Air Rush 90',
    brand: 'Nike',
    category: 'men',
    type: 'sneakers',
    pricePaise: toPaise(4999),
    mrpPaise: toPaise(7999),
    hsnCode: '6404',
    tags: ['running', 'everyday', 'cushioned'],
    description:
      'Everyday cushioned sneaker with a breathable mesh upper and a foam midsole that holds up to long days on your feet.',
    variants: [
      {
        color: 'Black',
        colorHex: '#141414',
        images: [photo('air-rush-black-1'), photo('air-rush-black-2')],
        sizes: [
          { size: 6, stock: 2 },
          { size: 7, stock: 5 },
          { size: 8, stock: 4 },
          { size: 9, stock: 3 },
          { size: 10, stock: 0 },
        ],
      },
      {
        color: 'White',
        colorHex: '#f5f5f5',
        images: [photo('air-rush-white-1')],
        sizes: [
          { size: 7, stock: 3 },
          { size: 8, stock: 6 },
          { size: 9, stock: 2 },
        ],
      },
    ],
  },
  {
    name: 'Court Classic',
    brand: 'Adidas',
    category: 'men',
    type: 'casual',
    pricePaise: toPaise(3499),
    mrpPaise: toPaise(4999),
    hsnCode: '6403',
    tags: ['retro', 'leather', 'court'],
    description: 'Clean leather court silhouette that goes with everything.',
    variants: [
      {
        color: 'White',
        colorHex: '#fafafa',
        images: [photo('court-white-1'), photo('court-white-2')],
        sizes: [
          { size: 7, stock: 4 },
          { size: 8, stock: 4 },
          { size: 9, stock: 5 },
          { size: 10, stock: 1 },
        ],
      },
      {
        color: 'Navy',
        colorHex: '#1e2a44',
        images: [photo('court-navy-1')],
        sizes: [
          { size: 8, stock: 2 },
          { size: 9, stock: 3 },
        ],
      },
    ],
  },
  {
    name: 'Trail Grip GTX',
    brand: 'Puma',
    category: 'men',
    type: 'sports',
    pricePaise: toPaise(6299),
    mrpPaise: toPaise(8999),
    hsnCode: '6402',
    tags: ['trail', 'grip', 'outdoor'],
    description: 'Aggressive lugs and a reinforced toe for wet, broken ground.',
    variants: [
      {
        color: 'Olive',
        colorHex: '#4a5320',
        images: [photo('trail-olive-1')],
        sizes: [
          { size: 8, stock: 3 },
          { size: 9, stock: 2 },
          { size: 10, stock: 2 },
          { size: 11, stock: 1 },
        ],
      },
    ],
  },
  {
    name: 'Oxford Heritage',
    brand: 'Red Chief',
    category: 'men',
    type: 'formal',
    pricePaise: toPaise(3899),
    mrpPaise: toPaise(5499),
    hsnCode: '6403',
    tags: ['office', 'leather', 'formal'],
    description: 'Full-grain leather Oxford with a stitched welt.',
    variants: [
      {
        color: 'Tan',
        colorHex: '#9a6b43',
        images: [photo('oxford-tan-1'), photo('oxford-tan-2')],
        sizes: [
          { size: 7, stock: 2 },
          { size: 8, stock: 3 },
          { size: 9, stock: 3 },
        ],
      },
      {
        color: 'Black',
        colorHex: '#1a1a1a',
        images: [photo('oxford-black-1')],
        sizes: [
          { size: 8, stock: 4 },
          { size: 9, stock: 2 },
          { size: 10, stock: 0 },
        ],
      },
    ],
  },
  {
    name: 'Cloudstep Runner',
    brand: 'Skechers',
    category: 'women',
    type: 'sports',
    pricePaise: toPaise(4499),
    mrpPaise: toPaise(5999),
    hsnCode: '6404',
    tags: ['walking', 'lightweight', 'memory-foam'],
    description: 'Featherweight knit upper over a memory-foam footbed.',
    variants: [
      {
        color: 'Blush',
        colorHex: '#e8b4b8',
        images: [photo('cloudstep-blush-1'), photo('cloudstep-blush-2')],
        sizes: [
          { size: 4, stock: 3 },
          { size: 5, stock: 5 },
          { size: 6, stock: 4 },
          { size: 7, stock: 2 },
        ],
      },
      {
        color: 'Grey',
        colorHex: '#8f9296',
        images: [photo('cloudstep-grey-1')],
        sizes: [
          { size: 5, stock: 2 },
          { size: 6, stock: 3 },
        ],
      },
    ],
  },
  {
    name: 'Ballet Flex',
    brand: 'Bata',
    category: 'women',
    type: 'casual',
    pricePaise: toPaise(1799),
    mrpPaise: toPaise(2499),
    hsnCode: '6404',
    tags: ['flats', 'daily', 'comfort'],
    description: 'Soft-sole ballet flat that folds flat enough for a handbag.',
    variants: [
      {
        color: 'Black',
        colorHex: '#111111',
        images: [photo('ballet-black-1')],
        sizes: [
          { size: 4, stock: 6 },
          { size: 5, stock: 6 },
          { size: 6, stock: 4 },
        ],
      },
      {
        color: 'Beige',
        colorHex: '#d8c3a5',
        images: [photo('ballet-beige-1')],
        sizes: [
          { size: 5, stock: 3 },
          { size: 6, stock: 2 },
        ],
      },
    ],
  },
  {
    name: 'Strap Slide Pro',
    brand: 'Adidas',
    category: 'women',
    type: 'sandals',
    pricePaise: toPaise(1299),
    mrpPaise: toPaise(1799),
    hsnCode: '6402',
    tags: ['slides', 'summer', 'quick-dry'],
    description: 'Contoured slide with a quick-dry footbed.',
    variants: [
      {
        color: 'White',
        colorHex: '#ffffff',
        images: [photo('slide-white-1')],
        sizes: [
          { size: 4, stock: 4 },
          { size: 5, stock: 4 },
          { size: 6, stock: 3 },
        ],
      },
    ],
  },
  {
    name: 'Metro Loafer',
    brand: 'Hush Puppies',
    category: 'women',
    type: 'loafers',
    pricePaise: toPaise(2999),
    mrpPaise: toPaise(3999),
    hsnCode: '6403',
    tags: ['office', 'slip-on'],
    description: 'Slip-on loafer with a padded collar for all-day wear.',
    variants: [
      {
        color: 'Brown',
        colorHex: '#6b4a2f',
        images: [photo('loafer-brown-1')],
        sizes: [
          { size: 5, stock: 3 },
          { size: 6, stock: 3 },
          { size: 7, stock: 1 },
        ],
      },
    ],
  },
  {
    name: 'Sprint Junior',
    brand: 'Puma',
    category: 'kids',
    type: 'sports',
    pricePaise: toPaise(1999),
    mrpPaise: toPaise(2799),
    hsnCode: '6404',
    tags: ['school', 'velcro', 'lightweight'],
    description: 'Velcro-strap trainer that a child can put on unaided.',
    variants: [
      {
        color: 'Blue',
        colorHex: '#2563eb',
        images: [photo('sprint-blue-1')],
        sizes: [
          { size: 1, stock: 5 },
          { size: 2, stock: 5 },
          { size: 3, stock: 4 },
        ],
      },
      {
        color: 'Red',
        colorHex: '#dc2626',
        images: [photo('sprint-red-1')],
        sizes: [
          { size: 2, stock: 3 },
          { size: 3, stock: 2 },
        ],
      },
    ],
  },
  {
    name: 'School Shine',
    brand: 'Bata',
    category: 'kids',
    type: 'formal',
    pricePaise: toPaise(1499),
    mrpPaise: toPaise(1899),
    hsnCode: '6403',
    tags: ['school', 'uniform', 'black'],
    description: 'Scuff-resistant school shoe with a wipe-clean finish.',
    variants: [
      {
        color: 'Black',
        colorHex: '#0f0f0f',
        images: [photo('school-black-1')],
        sizes: [
          { size: 1, stock: 8 },
          { size: 2, stock: 8 },
          { size: 3, stock: 6 },
          { size: 4, stock: 3 },
        ],
      },
    ],
  },
  {
    name: 'Canvas Everyday',
    brand: 'Converse',
    category: 'men',
    type: 'sneakers',
    pricePaise: toPaise(2799),
    mrpPaise: toPaise(3499),
    hsnCode: '6404',
    tags: ['canvas', 'classic', 'high-top'],
    description: 'The high-top canvas silhouette that never really goes away.',
    variants: [
      {
        color: 'Red',
        colorHex: '#b91c1c',
        images: [photo('canvas-red-1'), photo('canvas-red-2')],
        sizes: [
          { size: 7, stock: 2 },
          { size: 8, stock: 4 },
          { size: 9, stock: 4 },
          { size: 10, stock: 2 },
        ],
      },
      {
        color: 'Black',
        colorHex: '#151515',
        images: [photo('canvas-black-1')],
        sizes: [
          { size: 8, stock: 5 },
          { size: 9, stock: 3 },
          { size: 11, stock: 1 },
        ],
      },
    ],
  },
  {
    name: 'Monsoon Boot',
    brand: 'Woodland',
    category: 'men',
    type: 'boots',
    pricePaise: toPaise(7499),
    mrpPaise: toPaise(9999),
    hsnCode: '6401',
    tags: ['waterproof', 'ankle', 'monsoon'],
    description: 'Waterproof ankle boot built for standing water and mud.',
    variants: [
      {
        color: 'Brown',
        colorHex: '#5a3a22',
        images: [photo('boot-brown-1'), photo('boot-brown-2')],
        sizes: [
          { size: 8, stock: 2 },
          { size: 9, stock: 3 },
          { size: 10, stock: 2 },
          { size: 11, stock: 1 },
        ],
      },
    ],
  },
];

export async function seedProducts({ reset = false } = {}): Promise<void> {
  if (reset) {
    await Product.deleteMany({});
    logger.warn('Existing products deleted');
  }

  let created = 0;
  let skipped = 0;

  for (const product of SEED_PRODUCTS) {
    const slug = slugify(product.name);
    const exists = await Product.exists({ slug });

    if (exists) {
      skipped += 1;
      continue;
    }

    await Product.create({
      ...product,
      slug,
      description: product.description ?? '',
      tags: product.tags ?? [],
      isActive: product.isActive ?? true,
    });
    created += 1;
  }

  logger.info({ created, skipped }, 'Products seeded');
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  const reset = process.argv.includes('--reset');
  connectToDatabase()
    .then(() => seedProducts({ reset }))
    .then(disconnectFromDatabase)
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      logger.error({ err: error }, 'Product seed failed');
      process.exit(1);
    });
}
