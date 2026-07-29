import type { ComponentProps } from 'react';

import { cloudinarySrcSet, cloudinaryUrl } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';

export interface CloudinaryImageProps extends Omit<ComponentProps<'img'>, 'srcSet' | 'sizes'> {
  src: string;
  alt: string;
  /** Widest the image is ever displayed; drives the `src` fallback. */
  width?: number;
  /** CSS `sizes`, so the browser can choose from `srcset` before layout. */
  sizes?: string;
  /** Above-the-fold images (the product hero) should not be lazy. */
  priority?: boolean;
}

/**
 * The only component that renders a product photo.
 *
 * Centralising this is what makes a 300-shoe catalog usable on mobile data: a
 * single change here re-encodes and re-sizes every image in the shop. See
 * `lib/cloudinary.ts` for the transform details — including why non-Cloudinary
 * URLs (the seeded picsum placeholders) pass through untouched.
 */
export function CloudinaryImage({
  src,
  alt,
  width = 960,
  sizes = '(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw',
  priority = false,
  className,
  ...props
}: CloudinaryImageProps) {
  return (
    <img
      src={cloudinaryUrl(src, width)}
      srcSet={cloudinarySrcSet(src)}
      sizes={sizes}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      // Off the main thread, so a grid of twelve photos does not jank scrolling.
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      className={cn('h-full w-full object-cover', className)}
      {...props}
    />
  );
}
