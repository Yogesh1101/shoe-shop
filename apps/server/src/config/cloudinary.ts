import { v2 as cloudinary } from 'cloudinary';

import { env, features } from './env.js';

if (features.cloudinary) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export { cloudinary };

/** Everything this shop uploads lives under one folder, so it is easy to audit. */
export const CLOUDINARY_FOLDER = 'shoe-shop/products';
