import type {
  Product as SharedProduct,
  ProductFacets,
  ProductInput,
  ProductListQuery,
  ProductUpdate,
} from '@shoe-shop/shared';
// Mongoose 9 renamed `FilterQuery` to `QueryFilter`.
import type { QueryFilter, SortOrder } from 'mongoose';

import { Product, type ProductDoc, type ProductDocument } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { uniqueSlug } from '../utils/slug.js';
import { deleteProductImages } from './upload.service.js';

export interface PaginatedProducts {
  items: SharedProduct[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Mongo document -> the shape declared in the shared contract. */
export function toApiProduct(doc: ProductDocument): SharedProduct {
  return {
    _id: doc.id,
    slug: doc.slug,
    name: doc.name,
    brand: doc.brand,
    description: doc.description,
    category: doc.category,
    type: doc.type,
    pricePaise: doc.pricePaise,
    mrpPaise: doc.mrpPaise,
    hsnCode: doc.hsnCode,
    tags: doc.tags,
    isActive: doc.isActive,
    variants: doc.variants.map((variant) => ({
      color: variant.color,
      colorHex: variant.colorHex,
      images: variant.images.map((image) => ({ url: image.url, publicId: image.publicId })),
      sizes: variant.sizes.map((size) => ({ size: size.size, stock: size.stock })),
    })),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function buildFilter(query: ProductListQuery, includeInactive: boolean): QueryFilter<ProductDoc> {
  const filter: QueryFilter<ProductDoc> = {};

  // `includeInactive` is passed by the caller, not read from the query — the
  // public route hard-codes `false` so a crafted `?includeInactive=true` can
  // never expose unpublished products.
  if (!includeInactive) filter.isActive = true;

  if (query.q) filter.$text = { $search: query.q };
  if (query.category) filter.category = query.category;
  if (query.type) filter.type = query.type;
  if (query.brand) filter.brand = { $in: query.brand };
  if (query.color) {
    filter['variants.color'] = {
      // Colour names are user-entered, so match case-insensitively and
      // escape the input rather than interpolating it into a regex.
      $in: query.color.map((color) => new RegExp(`^${escapeRegex(color)}$`, 'i')),
    };
  }

  if (query.size) {
    // A size only counts as available if that exact size has stock — matching
    // `size` and `stock` in separate clauses would happily pair size 7 from one
    // variant with stock from size 11 of another.
    filter.variants = {
      $elemMatch: {
        sizes: { $elemMatch: { size: { $in: query.size }, stock: { $gt: 0 } } },
      },
    };
  }

  if (query.minPricePaise !== undefined || query.maxPricePaise !== undefined) {
    filter.pricePaise = {
      ...(query.minPricePaise !== undefined ? { $gte: query.minPricePaise } : {}),
      ...(query.maxPricePaise !== undefined ? { $lte: query.maxPricePaise } : {}),
    };
  }

  return filter;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSort(
  sort: ProductListQuery['sort'],
  hasSearch: boolean,
): Record<string, SortOrder | { $meta: string }> {
  switch (sort) {
    case 'price-asc':
      return { pricePaise: 1 };
    case 'price-desc':
      return { pricePaise: -1 };
    case 'name-asc':
      return { name: 1 };
    case 'relevance':
      // Only meaningful alongside a $text query; without one, fall back to
      // newest rather than asking Mongo to sort by a score that does not exist.
      return hasSearch ? { score: { $meta: 'textScore' } } : { createdAt: -1 };
    case 'newest':
    default:
      return { createdAt: -1 };
  }
}

export async function listProducts(
  query: ProductListQuery,
  { includeInactive = false } = {},
): Promise<PaginatedProducts> {
  const filter = buildFilter(query, includeInactive);
  const hasSearch = Boolean(query.q);
  const sort = buildSort(query.sort, hasSearch);

  const projection = hasSearch ? { score: { $meta: 'textScore' } } : {};

  const [items, total] = await Promise.all([
    Product.find(filter, projection)
      .sort(sort)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    Product.countDocuments(filter),
  ]);

  return {
    items: items.map(toApiProduct),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export async function getProductBySlug(slug: string): Promise<SharedProduct> {
  const product = await Product.findOne({ slug, isActive: true });
  if (!product) throw ApiError.notFound('That shoe is no longer available');
  return toApiProduct(product);
}

export async function getProductById(id: string): Promise<SharedProduct> {
  const product = await Product.findById(id);
  if (!product) throw ApiError.notFound('Product not found');
  return toApiProduct(product);
}

/**
 * Distinct values for the filter sidebar, computed in one aggregation so the
 * catalog page does not need a second round trip to render its filters.
 */
export async function getFacets(): Promise<ProductFacets> {
  const [result] = await Product.aggregate<{
    brands: string[];
    colors: { color: string; colorHex: string }[];
    sizes: number[];
    priceRangePaise: { min: number; max: number }[];
  }>([
    { $match: { isActive: true } },
    {
      $facet: {
        brands: [{ $group: { _id: '$brand' } }, { $sort: { _id: 1 } }],
        colors: [
          { $unwind: '$variants' },
          {
            $group: {
              _id: { $toLower: '$variants.color' },
              color: { $first: '$variants.color' },
              colorHex: { $first: '$variants.colorHex' },
            },
          },
          { $sort: { color: 1 } },
        ],
        sizes: [
          { $unwind: '$variants' },
          { $unwind: '$variants.sizes' },
          // Only offer a size as a filter when something is actually in stock.
          { $match: { 'variants.sizes.stock': { $gt: 0 } } },
          { $group: { _id: '$variants.sizes.size' } },
          { $sort: { _id: 1 } },
        ],
        priceRangePaise: [
          { $group: { _id: null, min: { $min: '$pricePaise' }, max: { $max: '$pricePaise' } } },
        ],
      },
    },
    {
      $project: {
        brands: '$brands._id',
        colors: {
          $map: { input: '$colors', as: 'c', in: { color: '$$c.color', colorHex: '$$c.colorHex' } },
        },
        sizes: '$sizes._id',
        priceRangePaise: 1,
      },
    },
  ]);

  return {
    brands: result?.brands ?? [],
    colors: result?.colors ?? [],
    sizes: result?.sizes ?? [],
    priceRangePaise: {
      min: result?.priceRangePaise[0]?.min ?? 0,
      max: result?.priceRangePaise[0]?.max ?? 0,
    },
  };
}

export async function createProduct(input: ProductInput): Promise<SharedProduct> {
  const slug = await uniqueSlug(input.name);
  const product = await Product.create({ ...input, slug });
  return toApiProduct(product);
}

export async function updateProduct(id: string, patch: ProductUpdate): Promise<SharedProduct> {
  const product = await Product.findById(id);
  if (!product) throw ApiError.notFound('Product not found');

  // The partial schema can only compare price and MRP when the patch carries
  // both. Here the stored document fills the gap, so `{ pricePaise: 999999 }`
  // alone cannot slip past an unchanged, now-lower MRP.
  const nextPrice = patch.pricePaise ?? product.pricePaise;
  const nextMrp = patch.mrpPaise ?? product.mrpPaise;
  if (nextMrp < nextPrice) {
    throw ApiError.validation('MRP cannot be lower than the selling price', [
      { field: 'mrpPaise', message: 'MRP cannot be lower than the selling price' },
    ]);
  }

  // Photos dropped from the payload are gone from the product, so their
  // Cloudinary assets should go too rather than linger on a 25 GB free tier.
  const removedImageIds =
    patch.variants === undefined
      ? []
      : imageIdsOf(product.variants).filter((id) => !imageIdsOf(patch.variants ?? []).includes(id));

  if (patch.name !== undefined && patch.name !== product.name) {
    product.slug = await uniqueSlug(patch.name, id);
  }

  Object.assign(product, patch);
  await product.save();

  await deleteProductImages(removedImageIds);

  return toApiProduct(product);
}

function imageIdsOf(variants: { images: { publicId: string }[] }[]): string[] {
  return variants.flatMap((variant) => variant.images.map((image) => image.publicId));
}

export async function deleteProduct(id: string): Promise<void> {
  const product = await Product.findById(id);
  if (!product) throw ApiError.notFound('Product not found');

  const imageIds = imageIdsOf(product.variants);
  await product.deleteOne();
  await deleteProductImages(imageIds);
}
