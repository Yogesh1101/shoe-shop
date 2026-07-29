import {
  CATEGORIES,
  type Category,
  DEFAULT_HSN_CODE,
  SHOE_TYPES,
  type ShoeType,
} from '@shoe-shop/shared';
import { type HydratedDocument, model, Schema } from 'mongoose';

export interface VariantSizeDoc {
  size: number;
  stock: number;
}

export interface ProductImageDoc {
  url: string;
  publicId: string;
}

export interface ProductVariantDoc {
  color: string;
  colorHex: string;
  images: ProductImageDoc[];
  sizes: VariantSizeDoc[];
}

export interface ProductDoc {
  name: string;
  slug: string;
  brand: string;
  description: string;
  category: Category;
  type: ShoeType;
  pricePaise: number;
  mrpPaise: number;
  hsnCode: string;
  tags: string[];
  isActive: boolean;
  variants: ProductVariantDoc[];
  createdAt: Date;
  updatedAt: Date;
}

const imageSchema = new Schema<ProductImageDoc>(
  {
    url: { type: String, required: true },
    // Cloudinary's handle for the asset. Without it, replacing a photo or
    // deleting a product leaves a file nobody can locate on a 25 GB free tier.
    publicId: { type: String, required: true },
  },
  { _id: false },
);

const variantSizeSchema = new Schema<VariantSizeDoc>(
  {
    size: { type: Number, required: true },
    stock: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false },
);

const variantSchema = new Schema<ProductVariantDoc>(
  {
    color: { type: String, required: true, trim: true },
    colorHex: { type: String, required: true },
    images: { type: [imageSchema], default: [] },
    sizes: { type: [variantSizeSchema], default: [] },
  },
  { _id: false },
);

const productSchema = new Schema<ProductDoc>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    brand: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: { type: String, required: true, enum: CATEGORIES },
    type: { type: String, required: true, enum: SHOE_TYPES },

    // Money is stored as integer paise everywhere. See packages/shared/money.ts.
    pricePaise: { type: Number, required: true, min: 0 },
    mrpPaise: { type: Number, required: true, min: 0 },

    hsnCode: { type: String, required: true, default: DEFAULT_HSN_CODE },
    tags: { type: [String], default: [] },
    isActive: { type: Boolean, required: true, default: true },
    variants: { type: [variantSchema], default: [] },
  },
  { timestamps: true },
);

// Free-text search across the fields a shopper would actually type. `brand` is
// weighted above `name` because searches are far more often "nike" than a
// specific model name.
productSchema.index(
  { name: 'text', brand: 'text', tags: 'text' },
  { weights: { brand: 6, name: 4, tags: 1 }, name: 'product_text' },
);

// The catalog's default query: active products in a category, newest first.
productSchema.index({ isActive: 1, category: 1, createdAt: -1 });
// Price sorting and range filters.
productSchema.index({ isActive: 1, pricePaise: 1 });
// Size and colour filters reach into the variants array.
productSchema.index({ 'variants.sizes.size': 1 });
productSchema.index({ 'variants.color': 1 });

export type ProductDocument = HydratedDocument<ProductDoc>;

export const Product = model<ProductDoc>('Product', productSchema);
