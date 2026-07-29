import { zodResolver } from '@hookform/resolvers/zod';
import {
  HSN_CODES,
  INDIAN_STATE_NAMES,
  type SettingsUpdate,
  stateNameSchema,
  toPaise,
  toRupees,
} from '@shoe-shop/shared';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import {
  useGetAdminSettingsQuery,
  useUpdateAdminSettingsMutation,
} from '@/app/api/adminSettingsApi';
import { normaliseError } from '@/app/api/baseApi';
import { ErrorState } from '@/components/common/States';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, Label, Separator, Skeleton, Textarea } from '@/components/ui/primitives';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Rupees and whole-percent GST rates in the form; converted to paise/bps at submit. */
const formSchema = z.object({
  shopName: z.string().trim().min(2, { error: 'Enter a shop name' }),
  legalName: z.string().trim(),
  contactPhone: z.string().trim(),
  contactEmail: z.string().trim(),
  instagramUrl: z.string().trim(),
  deliveryChargeRupees: z.number().min(0),
  freeDeliveryAboveRupees: z.number().min(0),
  blockedPincodesText: z.string(),
  estimatedDeliveryDays: z.string().trim(),
  codEnabled: z.boolean(),
  codExtraChargeRupees: z.number().min(0),
  codMaxOrderValueRupees: z.number().min(0),
  maxOrdersPerPhonePerDay: z.number().int().min(1),
  gstEnabled: z.boolean(),
  gstin: z.string().trim(),
  sellerState: stateNameSchema,
  sellerAddress: z.string().trim(),
  pricesIncludeTax: z.boolean(),
  gstSlabs: z
    .array(
      z.object({
        maxPriceRupees: z.number().positive().nullable(),
        ratePercent: z.number().min(0).max(100),
      }),
    )
    .min(1),
  hsnDefault: z.string().trim(),
});

type FormValues = z.infer<typeof formSchema>;

export default function SettingsPage() {
  const query = useGetAdminSettingsQuery();
  const [updateSettings, updateResult] = useUpdateAdminSettingsMutation();

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  const { fields, insert, remove } = useFieldArray({ control, name: 'gstSlabs' });
  const gstEnabled = watch('gstEnabled');

  useEffect(() => {
    const settings = query.data;
    if (!settings) return;

    reset({
      shopName: settings.shopName,
      legalName: settings.legalName,
      contactPhone: settings.contactPhone,
      contactEmail: settings.contactEmail,
      instagramUrl: settings.instagramUrl,
      deliveryChargeRupees: toRupees(settings.deliveryChargePaise),
      freeDeliveryAboveRupees: toRupees(settings.freeDeliveryAbovePaise),
      blockedPincodesText: settings.blockedPincodes.join(', '),
      estimatedDeliveryDays: settings.estimatedDeliveryDays,
      codEnabled: settings.codEnabled,
      codExtraChargeRupees: toRupees(settings.codExtraChargePaise),
      codMaxOrderValueRupees: toRupees(settings.codMaxOrderValuePaise),
      maxOrdersPerPhonePerDay: settings.maxOrdersPerPhonePerDay,
      gstEnabled: settings.gstEnabled,
      gstin: settings.gstin,
      sellerState: settings.sellerState,
      sellerAddress: settings.sellerAddress,
      pricesIncludeTax: settings.pricesIncludeTax,
      gstSlabs: settings.gstSlabs.map((slab) => ({
        maxPriceRupees: slab.maxPricePaise === null ? null : toRupees(slab.maxPricePaise),
        ratePercent: slab.rateBps / 100,
      })),
      hsnDefault: settings.hsnDefault,
    });
  }, [query.data, reset]);

  async function onValid(values: FormValues) {
    const payload: SettingsUpdate = {
      shopName: values.shopName,
      legalName: values.legalName,
      contactPhone: values.contactPhone,
      contactEmail: values.contactEmail,
      instagramUrl: values.instagramUrl,
      deliveryChargePaise: toPaise(values.deliveryChargeRupees),
      freeDeliveryAbovePaise: toPaise(values.freeDeliveryAboveRupees),
      blockedPincodes: values.blockedPincodesText
        .split(/[\s,]+/)
        .map((pincode) => pincode.trim())
        .filter(Boolean),
      estimatedDeliveryDays: values.estimatedDeliveryDays,
      codEnabled: values.codEnabled,
      codExtraChargePaise: toPaise(values.codExtraChargeRupees),
      codMaxOrderValuePaise: toPaise(values.codMaxOrderValueRupees),
      maxOrdersPerPhonePerDay: values.maxOrdersPerPhonePerDay,
      gstEnabled: values.gstEnabled,
      gstin: values.gstin,
      sellerState: values.sellerState,
      sellerAddress: values.sellerAddress,
      pricesIncludeTax: values.pricesIncludeTax,
      gstSlabs: values.gstSlabs.map((slab) => ({
        maxPricePaise: slab.maxPriceRupees === null ? null : toPaise(slab.maxPriceRupees),
        rateBps: Math.round(slab.ratePercent * 100),
      })),
      hsnDefault: values.hsnDefault,
    };

    try {
      await updateSettings(payload).unwrap();
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Could not save settings', { description: normaliseError(error).message });
    }
  }

  if (query.isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <form onSubmit={(event) => void handleSubmit(onValid)(event)} className="mt-8 space-y-10">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold">Shop identity</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="shopName">Shop name</Label>
              <Input id="shopName" className="mt-1.5" {...register('shopName')} />
              {errors.shopName && (
                <p className="mt-1 text-xs text-destructive">{errors.shopName.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="legalName">Legal name (for invoices)</Label>
              <Input id="legalName" className="mt-1.5" {...register('legalName')} />
            </div>
            <div>
              <Label htmlFor="contactPhone">Contact phone</Label>
              <Input id="contactPhone" className="mt-1.5" {...register('contactPhone')} />
            </div>
            <div>
              <Label htmlFor="contactEmail">Contact email</Label>
              <Input
                id="contactEmail"
                type="email"
                className="mt-1.5"
                {...register('contactEmail')}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="instagramUrl">Instagram URL</Label>
              <Input id="instagramUrl" className="mt-1.5" {...register('instagramUrl')} />
            </div>
          </div>
        </section>

        <Separator />

        <section className="space-y-4">
          <h2 className="text-sm font-semibold">Delivery</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="deliveryChargeRupees">Delivery charge (₹)</Label>
              <Input
                id="deliveryChargeRupees"
                type="number"
                step="0.01"
                min="0"
                className="mt-1.5"
                {...register('deliveryChargeRupees', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="freeDeliveryAboveRupees">Free delivery above (₹)</Label>
              <Input
                id="freeDeliveryAboveRupees"
                type="number"
                step="0.01"
                min="0"
                className="mt-1.5"
                {...register('freeDeliveryAboveRupees', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="estimatedDeliveryDays">Estimated delivery</Label>
              <Input
                id="estimatedDeliveryDays"
                className="mt-1.5"
                {...register('estimatedDeliveryDays')}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="blockedPincodesText">Blocked PIN codes (comma-separated)</Label>
            <Textarea
              id="blockedPincodesText"
              rows={3}
              className="mt-1.5"
              {...register('blockedPincodesText')}
            />
          </div>
        </section>

        <Separator />

        <section className="space-y-4">
          <h2 className="text-sm font-semibold">Cash on delivery</h2>
          <div className="flex items-center gap-3">
            <Controller
              control={control}
              name="codEnabled"
              render={({ field }) => (
                <Checkbox id="codEnabled" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label htmlFor="codEnabled" className="cursor-pointer font-normal">
              Accept cash on delivery
            </Label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="codExtraChargeRupees">COD fee (₹)</Label>
              <Input
                id="codExtraChargeRupees"
                type="number"
                step="0.01"
                min="0"
                className="mt-1.5"
                {...register('codExtraChargeRupees', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="codMaxOrderValueRupees">Max COD order (₹, 0 = no cap)</Label>
              <Input
                id="codMaxOrderValueRupees"
                type="number"
                step="0.01"
                min="0"
                className="mt-1.5"
                {...register('codMaxOrderValueRupees', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label htmlFor="maxOrdersPerPhonePerDay">Max orders/phone/day</Label>
              <Input
                id="maxOrdersPerPhonePerDay"
                type="number"
                step="1"
                min="1"
                className="mt-1.5"
                {...register('maxOrdersPerPhonePerDay', { valueAsNumber: true })}
              />
            </div>
          </div>
        </section>

        <Separator />

        <section className="space-y-4">
          <h2 className="text-sm font-semibold">Tax</h2>

          <div className="flex items-center gap-3">
            <Controller
              control={control}
              name="gstEnabled"
              render={({ field }) => (
                <Checkbox id="gstEnabled" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label htmlFor="gstEnabled" className="cursor-pointer font-normal">
              Charge GST and issue tax invoices
            </Label>
          </div>

          {gstEnabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="gstin">GSTIN</Label>
                <Input id="gstin" className="mt-1.5" {...register('gstin')} />
                {errors.gstin && (
                  <p className="mt-1 text-xs text-destructive">{errors.gstin.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="sellerState">Seller state</Label>
                <Controller
                  control={control}
                  name="sellerState"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="sellerState" className="mt-1.5 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATE_NAMES.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="sellerAddress">Seller address (shown on invoices)</Label>
                <Textarea
                  id="sellerAddress"
                  rows={2}
                  className="mt-1.5"
                  {...register('sellerAddress')}
                />
              </div>
              <div>
                <Label htmlFor="hsnDefault">Default HSN code</Label>
                <Controller
                  control={control}
                  name="hsnDefault"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="hsnDefault" className="mt-1.5 w-full">
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
              <div className="flex items-center gap-3 sm:col-span-2">
                <Controller
                  control={control}
                  name="pricesIncludeTax"
                  render={({ field }) => (
                    <Checkbox
                      id="pricesIncludeTax"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="pricesIncludeTax" className="cursor-pointer font-normal">
                  Listed prices already include GST
                </Label>
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label>GST rate slabs</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      // Inserted before the last (open-ended) slab, which must stay last.
                      insert(fields.length - 1, { maxPriceRupees: 1000, ratePercent: 12 })
                    }
                  >
                    <Plus />
                    Add slab
                  </Button>
                </div>
                <div className="mt-2 space-y-2">
                  {fields.map((field, index) => {
                    const isLast = index === fields.length - 1;
                    return (
                      <div key={field.id} className="flex items-center gap-2">
                        {isLast ? (
                          <span className="flex-1 text-sm text-muted-foreground">
                            Above all other slabs
                          </span>
                        ) : (
                          <div className="flex flex-1 items-center gap-2">
                            <span className="text-sm text-muted-foreground">Up to ₹</span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              {...register(`gstSlabs.${index}.maxPriceRupees`, {
                                valueAsNumber: true,
                              })}
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            className="w-24"
                            {...register(`gstSlabs.${index}.ratePercent`, { valueAsNumber: true })}
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={isLast || fields.length <= 1}
                          onClick={() => remove(index)}
                          aria-label="Remove slab"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
                {errors.gstSlabs && (
                  <p className="mt-1 text-xs text-destructive">
                    Slabs must be in ascending order of price, with the last one left open-ended.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        <Button type="submit" size="lg" disabled={updateResult.isLoading}>
          {updateResult.isLoading ? 'Saving…' : 'Save settings'}
        </Button>
      </form>
    </div>
  );
}
