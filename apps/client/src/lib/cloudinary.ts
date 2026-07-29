/**
 * Responsive image URLs.
 *
 * A 300-shoe catalog browsed over mobile data is the worst case this shop has,
 * and phone cameras produce 4000px photos. Cloudinary can resize and re-encode
 * on delivery, so the browser fetches a right-sized AVIF or WebP instead of a
 * full-resolution JPEG:
 *
 *   f_auto      pick AVIF/WebP/JPEG from the Accept header
 *   q_auto      perceptual quality, typically 40-70% smaller
 *   dpr_auto    account for retina screens
 *   c_limit     never upscale past the original
 *   w_<n>       the width this particular srcset entry is for
 */

/** Widths offered in `srcset`; the browser picks using `sizes`. */
export const IMAGE_WIDTHS = [320, 480, 640, 960, 1280] as const;

const CLOUDINARY_UPLOAD_MARKER = '/image/upload/';

/**
 * True for URLs this module can actually transform.
 *
 * This matters in development: `seedProducts.ts` uses picsum.photos
 * placeholders, and splicing Cloudinary transforms into those URLs would break
 * every seeded image. Anything that is not a Cloudinary upload URL is passed
 * through untouched.
 */
export function isCloudinaryUrl(url: string): boolean {
  return url.includes('res.cloudinary.com') && url.includes(CLOUDINARY_UPLOAD_MARKER);
}

/**
 * Insert delivery transforms into a Cloudinary URL, or return it unchanged.
 */
export function cloudinaryUrl(url: string, width: number): string {
  if (!isCloudinaryUrl(url)) return url;

  const [prefix, rest] = url.split(CLOUDINARY_UPLOAD_MARKER);
  if (prefix === undefined || rest === undefined) return url;

  return `${prefix}${CLOUDINARY_UPLOAD_MARKER}f_auto,q_auto,dpr_auto,c_limit,w_${width}/${rest}`;
}

/** `srcset` across `IMAGE_WIDTHS`, or empty for URLs we cannot resize. */
export function cloudinarySrcSet(url: string): string | undefined {
  if (!isCloudinaryUrl(url)) return undefined;

  return IMAGE_WIDTHS.map((width) => `${cloudinaryUrl(url, width)} ${width}w`).join(', ');
}
