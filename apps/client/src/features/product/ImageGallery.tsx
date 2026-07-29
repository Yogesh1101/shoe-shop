import type { ProductImage } from '@shoe-shop/shared';
import { useState } from 'react';

import { CloudinaryImage } from '@/components/common/CloudinaryImage';
import { cn } from '@/lib/utils';

export interface ImageGalleryProps {
  images: ProductImage[];
  alt: string;
}

/**
 * Switching colour swaps the whole image set, which must reset the selected
 * thumbnail. The caller does that by passing `key={variant.color}` — remounting
 * is React's own idiom for "this is conceptually a different gallery", and it
 * avoids an effect that writes state on every prop change.
 */
export function ImageGallery({ images, alt }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const active = images[activeIndex] ?? images[0];

  if (!active) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
        No photos yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-square overflow-hidden rounded-lg bg-muted">
        <CloudinaryImage
          src={active.url}
          alt={alt}
          priority
          width={1280}
          sizes="(min-width: 1024px) 50vw, 100vw"
        />
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={image.publicId}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`View photo ${index + 1} of ${images.length}`}
              aria-current={index === activeIndex}
              className={cn(
                'size-20 shrink-0 overflow-hidden rounded-md border-2 bg-muted',
                index === activeIndex ? 'border-primary' : 'border-transparent',
              )}
            >
              <CloudinaryImage src={image.url} alt="" width={160} sizes="80px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
