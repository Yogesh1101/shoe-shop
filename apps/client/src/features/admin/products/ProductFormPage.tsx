import { zodResolver } from '@hookform/resolvers/zod';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  DEFAULT_HSN_CODE,
  HSN_CODES,
  type ProductInput,
  SHOE_SIZES,
  SHOE_TYPE_LABELS,
  SHOE_TYPES,
  toPaise,
  toRupees,
} from '@shoe-shop/shared';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import {
  useCreateProductMutation,
  useGetAdminProductQuery,
  useUpdateProductMutation,
} from '@/app/api/adminProductApi';
import { normaliseError } from '@/app/api/baseApi';
import { ErrorState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, Label, Separator, Skeleton, Textarea } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImageUploader } from '@/features/admin/products/ImageUploader';

/**
 * The form works in rupees, not paise — `toPaise`/`toRupees` are the only two
 * places rupees legitimately exist in this system, and an admin form typing
 * in a price is one of them. Converted back to paise at submit time.
 *
 * Cross-field rules (MRP vs price, duplicate colours) are re-checked by the
 * server regardless, so this schema only needs to catch obviously incomplete
 * input before a round trip.
 */
const formSchema = z.object({
  name: z.string().trim().min(3, { error: 'Name is too short' }),
  brand: z.string().trim().min(1, { error: 'Enter a brand' }),
  description: z.string().trim().max(2000),
  category: z.enum(CATEGORIES),
  type: z.enum(SHOE_TYPES),
  priceRupees: z.number({ error: 'Enter a price' }).positive({ error: 'Price is required' }),
  mrpRupees: z.number({ error: 'Enter an MRP' }).positive({ error: 'MRP is required' }),
  hsnCode: z.string().trim().regex(/^\d{4,8}$/, { error: 'HSN must be 4-8 digits' }),
  tags: z.string(),
  isActive: z.boolean(),
  variants: z
    .array(
      z.object({
        color: z.string().trim().min(1, { error: 'Name the colour' }),
        colorHex: z.string(),
        images: z.array(z.object({ url: z.string(), publicId: z.string() })),
        sizes: z.array(z.object({ size: z.number(), stock: z.number().int().min(0) })),
      }),
    )
    .min(1, { error: 'Add at least one colour' }),
});

type FormValues = z.infer<typeof formSchema>;

function emptyVariant(): FormValues['variants'][number] {
  return {
    color: '',
    colorHex: '#141414',
    images: [],
    sizes: SHOE_SIZES.map((size) => ({ size, stock: 0 })),
  };
}

const NEW_PRODUCT_DEFAULTS: FormValues = {
  name: '',
  brand: '',
  description: '',
  category: 'men',
  type: 'sneakers',
  priceRupees: 0,
  mrpRupees: 0,
  hsnCode: DEFAULT_HSN_CODE,
  tags: '',
  isActive: true,
  variants: [emptyVariant()],
};

export default function ProductFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id) && id !== 'new';
  const navigate = useNavigate();

  const productQuery = useGetAdminProductQuery(id ?? '', { skip: !isEditing });
  const [createProduct, createResult] = useCreateProductMutation();
  const [updateProduct, updateResult] = useUpdateProductMutation();
  const saving = createResult.isLoading || updateResult.isLoading;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: NEW_PRODUCT_DEFAULTS,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'variants' });

  // Half sizes are a data-model allowance, not something this grid edits —
  // see the note on SHOE_SIZES in packages/shared/src/constants.ts. Any
  // half-size stock on a product edited here reverts to the whole-size grid.
  useEffect(() => {
    const product = productQuery.data;
    if (!product) return;

    reset({
      name: product.name,
      brand: product.brand,
      description: product.description,
      category: product.category,
      type: product.type,
      priceRupees: toRupees(product.pricePaise),
      mrpRupees: toRupees(product.mrpPaise),
      hsnCode: product.hsnCode,
      tags: product.tags.join(', '),
      isActive: product.isActive,
      variants: product.variants.map((variant) => ({
        color: variant.color,
        colorHex: variant.colorHex,
        images: variant.images,
        sizes: SHOE_SIZES.map((size) => ({
          size,
          stock: variant.sizes.find((s) => s.size === size)?.stock ?? 0,
        })),
      })),
    });
  }, [productQuery.data, reset]);

  async function onValid(values: FormValues) {
    const emptyVariantIndex = values.variants.findIndex((v) => v.images.length === 0);
    if (emptyVariantIndex !== -1) {
      toast.error('Add at least one photo', {
        description: `"${values.variants[emptyVariantIndex]?.color || 'That colour'}" has no photos yet.`,
      });
      return;
    }

    const payload: ProductInput = {
      name: values.name,
      brand: values.brand,
      description: values.description,
      category: values.category,
      type: values.type,
      pricePaise: toPaise(values.priceRupees),
      mrpPaise: toPaise(values.mrpRupees),
      hsnCode: values.hsnCode,
      tags: values.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      isActive: values.isActive,
      variants: values.variants,
    };

    try {
      if (isEditing && id) {
        await updateProduct({ id, patch: payload }).unwrap();
        toast.success('Product updated');
      } else {
        const created = await createProduct(payload).unwrap();
        toast.success('Product created');
        void navigate(`/admin/products/${created._id}`, { replace: true });
        return;
      }
    } catch (error) {
      toast.error('Could not save product', { description: normaliseError(error).message });
    }
  }

  if (isEditing && productQuery.isLoading) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isEditing && productQuery.isError) {
    return <ErrorState error={productQuery.error} onRetry={() => void productQuery.refetch()} />;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        {isEditing ? 'Edit product' : 'Add product'}
      </h1>

      <form onSubmit={(event) => void handleSubmit(onValid)(event)} className="mt-8 space-y-8">
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" className="mt-1.5" {...register('name')} />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="brand">Brand</Label>
              <Input id="brand" className="mt-1.5" {...register('brand')} />
              {errors.brand && <p className="mt-1 text-xs text-destructive">{errors.brand.message}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" className="mt-1.5" {...register('description')} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="category">Category</Label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="category" className="mt-1.5 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label htmlFor="type">Type</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="type" className="mt-1.5 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHOE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {SHOE_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="priceRupees">Price (₹)</Label>
              <Input
                id="priceRupees"
                type="number"
                step="0.01"
                min="0"
                className="mt-1.5"
                {...register('priceRupees', { valueAsNumber: true })}
              />
              {errors.priceRupees && (
                <p className="mt-1 text-xs text-destructive">{errors.priceRupees.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="mrpRupees">MRP (₹)</Label>
              <Input
                id="mrpRupees"
                type="number"
                step="0.01"
                min="0"
                className="mt-1.5"
                {...register('mrpRupees', { valueAsNumber: true })}
              />
              {errors.mrpRupees && (
                <p className="mt-1 text-xs text-destructive">{errors.mrpRupees.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="hsnCode">HSN code</Label>
              <Controller
                control={control}
                name="hsnCode"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="hsnCode" className="mt-1.5 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HSN_CODES.map(({ code, label }) => (
                        <SelectItem key={code} value={code}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input id="tags" className="mt-1.5" {...register('tags')} />
          </div>

          <div className="flex items-center gap-3">
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <Checkbox id="isActive" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label htmlFor="isActive" className="cursor-pointer font-normal">
              Published — visible in the storefront
            </Label>
          </div>
        </section>

        <Separator />

        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Colours</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => append(emptyVariant())}>
              <Plus />
              Add colour
            </Button>
          </div>
          {errors.variants?.root && (
            <p className="mt-2 text-xs text-destructive">{errors.variants.root.message}</p>
          )}

          <div className="mt-4 space-y-6">
            {fields.map((field, index) => (
              <div key={field.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_auto]">
                    <div>
                      <Label htmlFor={`variants.${index}.color`}>Colour name</Label>
                      <Input
                        id={`variants.${index}.color`}
                        className="mt-1.5"
                        {...register(`variants.${index}.color`)}
                      />
                      {errors.variants?.[index]?.color && (
                        <p className="mt-1 text-xs text-destructive">
                          {errors.variants[index]?.color?.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor={`variants.${index}.colorHex`}>Swatch</Label>
                      <input
                        id={`variants.${index}.colorHex`}
                        type="color"
                        className="mt-1.5 h-11 w-14 rounded-md border border-input"
                        {...register(`variants.${index}.colorHex`)}
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={fields.length <= 1}
                    onClick={() => remove(index)}
                    aria-label="Remove colour"
                    className="mt-6"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="mt-4">
                  <Label>Photos</Label>
                  <div className="mt-1.5">
                    <Controller
                      control={control}
                      name={`variants.${index}.images`}
                      render={({ field: imagesField }) => (
                        <ImageUploader
                          images={imagesField.value}
                          onChange={imagesField.onChange}
                        />
                      )}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <Label>Stock by size (UK)</Label>
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {SHOE_SIZES.map((size, sizeIndex) => (
                      <div key={size} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                        <span className="w-6 text-xs text-muted-foreground">{size}</span>
                        <input
                          type="number"
                          min="0"
                          className="w-full min-w-0 text-sm outline-none"
                          {...register(`variants.${index}.sizes.${sizeIndex}.stock`, {
                            valueAsNumber: true,
                          })}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex gap-3">
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Create product'}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => void navigate('/admin/products')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
