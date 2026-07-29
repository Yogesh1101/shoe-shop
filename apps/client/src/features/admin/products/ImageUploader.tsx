import type { ProductImage } from '@shoe-shop/shared';
import { Loader2, Upload, X } from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';

import { useUploadProductImagesMutation } from '@/app/api/adminProductApi';
import { normaliseError } from '@/app/api/baseApi';
import { CloudinaryImage } from '@/components/common/CloudinaryImage';
import { cn } from '@/lib/utils';

export interface ImageUploaderProps {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
}

/**
 * Photos for one variant. Uploads go straight to Cloudinary — see
 * `services/upload.service.ts` — and the server reconciles anything an edit
 * drops from this list when the product is saved, so removing a photo here is
 * enough; there is no separate delete step.
 */
export function ImageUploader({ images, onChange }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [upload, uploadResult] = useUploadProductImagesMutation();

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    try {
      const result = await upload(Array.from(files)).unwrap();
      onChange([...images, ...result.images]);
    } catch (error) {
      toast.error('Upload failed', { description: normaliseError(error).message });
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {images.map((image, index) => (
          <div
            key={image.publicId}
            className="group relative size-20 overflow-hidden rounded-md border"
          >
            <CloudinaryImage src={image.url} alt="" width={160} sizes="80px" />
            <button
              type="button"
              onClick={() => removeAt(index)}
              aria-label="Remove photo"
              className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploadResult.isLoading}
          className={cn(
            'flex size-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground',
            'hover:border-foreground hover:text-foreground',
          )}
        >
          {uploadResult.isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Upload className="size-4" />
              Add
            </>
          )}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />
    </div>
  );
}
