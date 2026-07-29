import {
  type ProductListQuery,
  productListQuerySchema,
  type SlugParam,
  slugParamSchema,
} from '@shoe-shop/shared';
import { Router } from 'express';

import { validateParams, validateQuery, validParams, validQuery } from '../middleware/validate.js';
import { getFacets, getProductBySlug, listProducts } from '../services/product.service.js';

export const productRoutes: Router = Router();

productRoutes.get('/', validateQuery(productListQuerySchema), async (req, res) => {
  const query = validQuery<ProductListQuery>(req);
  // Public callers never see unpublished shoes, whatever the query string says.
  res.json(await listProducts(query, { includeInactive: false }));
});

// Declared before `/:slug` so "facets" is not swallowed as a product slug.
productRoutes.get('/facets', async (_req, res) => {
  res.json(await getFacets());
});

productRoutes.get('/:slug', validateParams(slugParamSchema), async (req, res) => {
  res.json(await getProductBySlug(validParams<SlugParam>(req).slug));
});
