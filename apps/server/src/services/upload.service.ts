import type { ProductImage } from '@shoe-shop/shared';
import type { UploadApiResponse } from 'cloudinary';

import { cloudinary, CLOUDINARY_FOLDER } from '../config/cloudinary.js';
import { features } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

/**
 * Product photos live in Cloudinary rather than on disk.
 *
 * Render's free tier has an ephemeral filesystem — it is wiped on every deploy
 * and every wake from sleep — so a locally stored photo would vanish without
 * warning and take the product listing's image with it.
 *
 * Uploads stream straight from memory (multer's memoryStorage) to Cloudinary
 * and never touch the disk at all.
 */

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export function assertCloudinaryConfigured(): void {
  if (!features.cloudinary) {
    throw ApiError.notConfigured('Cloudinary');
  }
}

export async function uploadProductImage(file: Express.Multer.File): Promise<ProductImage> {
  assertCloudinaryConfigured();

  if (!ACCEPTED_MIME.has(file.mimetype)) {
    throw ApiError.badRequest(
      `${file.mimetype} is not a supported image type. Use JPEG, PNG, WebP or AVIF.`,
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw ApiError.badRequest('That image is larger than 8 MB. Please compress it first.');
  }

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDER,
        resource_type: 'image',
        // Phone cameras produce 4000px photos; nothing in the UI shows more
        // than ~1600, and the free tier's storage is finite.
        transformation: [{ width: 1600, height: 1600, crop: 'limit' }],
        // Strip EXIF. Photos taken on a phone can carry GPS coordinates, and
        // the shop owner's home address should not ship with the catalog.
        invalidate: true,
      },
      (error, uploadResult) => {
        if (error) {
          reject(new Error(error.message, { cause: error }));
          return;
        }
        if (!uploadResult) {
          reject(new Error('Cloudinary returned no result'));
          return;
        }
        resolve(uploadResult);
      },
    );

    stream.end(file.buffer);
  });

  return { url: result.secure_url, publicId: result.public_id };
}

/**
 * Remove assets from Cloudinary.
 *
 * Deliberately never throws: this runs after a product has already been deleted
 * or edited, and failing the whole request because a cleanup call failed would
 * leave the caller thinking the delete did not happen. Failures are logged so
 * orphans can be reconciled later.
 */
export async function deleteProductImages(publicIds: string[]): Promise<void> {
  if (!features.cloudinary || publicIds.length === 0) return;

  // Seeded sample products carry fake publicIds; skip them quietly.
  const real = publicIds.filter((id) => !id.startsWith('seed/'));
  if (real.length === 0) return;

  try {
    await cloudinary.api.delete_resources(real);
  } catch (error) {
    logger.warn(
      { err: error, publicIds: real },
      'Could not delete Cloudinary assets; they are now orphaned',
    );
  }
}

export const uploadLimits = { fileSize: MAX_FILE_BYTES, files: 8 };
