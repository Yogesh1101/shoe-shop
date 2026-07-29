import { describe, expect, it } from 'vitest';

import { cloudinarySrcSet, cloudinaryUrl, IMAGE_WIDTHS, isCloudinaryUrl } from './cloudinary';

const CLOUDINARY =
  'https://res.cloudinary.com/demo/image/upload/v1699999999/shoe-shop/products/abc123.jpg';
const PICSUM = 'https://picsum.photos/seed/air-rush-black-1/900/900';

describe('isCloudinaryUrl', () => {
  it('recognises a Cloudinary upload URL', () => {
    expect(isCloudinaryUrl(CLOUDINARY)).toBe(true);
  });

  it('rejects the seeded picsum placeholders', () => {
    expect(isCloudinaryUrl(PICSUM)).toBe(false);
  });

  it('rejects other hosts and malformed input', () => {
    expect(isCloudinaryUrl('https://example.com/a.jpg')).toBe(false);
    expect(isCloudinaryUrl('')).toBe(false);
  });
});

describe('cloudinaryUrl', () => {
  it('inserts delivery transforms after the upload marker', () => {
    const result = cloudinaryUrl(CLOUDINARY, 640);
    expect(result).toContain('/image/upload/f_auto,q_auto,dpr_auto,c_limit,w_640/');
    // The version and public id must survive intact, or the asset 404s.
    expect(result).toContain('v1699999999/shoe-shop/products/abc123.jpg');
  });

  it('passes non-Cloudinary URLs through untouched', () => {
    // This is what keeps the seeded development catalog rendering: splicing
    // Cloudinary transforms into a picsum URL would break every seed image.
    expect(cloudinaryUrl(PICSUM, 640)).toBe(PICSUM);
  });

  it('produces a different URL per width', () => {
    expect(cloudinaryUrl(CLOUDINARY, 320)).not.toBe(cloudinaryUrl(CLOUDINARY, 1280));
  });
});

describe('cloudinarySrcSet', () => {
  it('emits one candidate per configured width', () => {
    const srcSet = cloudinarySrcSet(CLOUDINARY);
    expect(srcSet).toBeDefined();

    const candidates = srcSet!.split(', ');
    expect(candidates).toHaveLength(IMAGE_WIDTHS.length);
    for (const width of IMAGE_WIDTHS) {
      expect(srcSet).toContain(`w_${width}`);
      expect(srcSet).toContain(`${width}w`);
    }
  });

  it('returns undefined for URLs it cannot resize', () => {
    // An empty srcset attribute would be worse than none at all.
    expect(cloudinarySrcSet(PICSUM)).toBeUndefined();
  });
});
