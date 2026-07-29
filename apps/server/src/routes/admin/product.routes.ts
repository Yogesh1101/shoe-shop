import {
  type IdParam,
  idParamSchema,
  type ProductInput,
  productInputSchema,
  type ProductListQuery,
  productListQuerySchema,
  type ProductUpdate,
  productUpdateSchema,
} from '@shoe-shop/shared';
import { Router } from 'express';
import multer from 'multer';

import { uploadLimiter } from '../../middleware/rateLimit.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  validBody,
  validParams,
  validQuery,
} from '../../middleware/validate.js';
import {
  createProduct,
  deleteProduct,
  getProductById,
  listProducts,
  updateProduct,
} from '../../services/product.service.js';
import { uploadLimits, uploadProductImage } from '../../services/upload.service.js';

export const adminProductRoutes: Router = Router();

adminProductRoutes.use(requireAdmin);

/**
 * memoryStorage, not diskStorage: Render's free filesystem is ephemeral, and
 * the buffer is piped straight to Cloudinary without ever being written down.
 */
const upload = multer({ storage: multer.memoryStorage(), limits: uploadLimits });

adminProductRoutes.get('/', validateQuery(productListQuerySchema), async (req, res) => {
  const query = validQuery<ProductListQuery>(req);
  // The admin does need to see unpublished shoes — that is the whole point of
  // the isActive toggle.
  res.json(await listProducts(query, { includeInactive: true }));
});

adminProductRoutes.get('/:id', validateParams(idParamSchema), async (req, res) => {
  res.json(await getProductById(validParams<IdParam>(req).id));
});

adminProductRoutes.post('/', validateBody(productInputSchema), async (req, res) => {
  const product = await createProduct(validBody<ProductInput>(req));
  res.status(201).json(product);
});

adminProductRoutes.patch(
  '/:id',
  validateParams(idParamSchema),
  validateBody(productUpdateSchema),
  async (req, res) => {
    res.json(await updateProduct(validParams<IdParam>(req).id, validBody<ProductUpdate>(req)));
  },
);

adminProductRoutes.delete('/:id', validateParams(idParamSchema), async (req, res) => {
  await deleteProduct(validParams<IdParam>(req).id);
  res.status(204).end();
});

/**
 * Uploads return `{ url, publicId }` for each file. The admin form collects
 * these and submits them as part of the product payload, so an abandoned form
 * leaves orphaned assets — acceptable, and far simpler than a two-phase commit.
 */
adminProductRoutes.post('/images', uploadLimiter, upload.array('images', 8), async (req, res) => {
  const files = (req.files ?? []) as Express.Multer.File[];
  const images = await Promise.all(files.map((file) => uploadProductImage(file)));
  res.status(201).json({ images });
});
