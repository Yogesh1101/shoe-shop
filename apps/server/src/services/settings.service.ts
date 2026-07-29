import { type PublicSettings, type Settings as SettingsShape, settingsSchema, type SettingsUpdate } from '@shoe-shop/shared';

import { Settings, SETTINGS_ID, type SettingsDocument } from '../models/Settings.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Load the singleton settings document, creating it with defaults on first
 * call. Every pricing, delivery and tax decision reads from here, so the shop
 * owner can change business rules from the admin panel without a redeploy.
 */
export async function getSettings(): Promise<SettingsDocument> {
  const existing = await Settings.findById(SETTINGS_ID);
  if (existing) return existing;

  // `upsert` rather than `create` so two simultaneous first requests cannot
  // both try to insert `_id: 'shop'` and have one fail on the duplicate key.
  const created = await Settings.findOneAndUpdate(
    { _id: SETTINGS_ID },
    { $setOnInsert: { _id: SETTINGS_ID } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  if (!created) {
    throw new Error('Settings document could not be created');
  }
  return created;
}

/**
 * The subset the storefront may read. Deliberately narrow: the COD abuse
 * thresholds, GST slabs and blocked PIN list are operational details that
 * should not be enumerable by anyone who opens devtools.
 */
export function toPublicSettings(settings: SettingsDocument): PublicSettings {
  return {
    shopName: settings.shopName,
    contactPhone: settings.contactPhone,
    contactEmail: settings.contactEmail,
    instagramUrl: settings.instagramUrl,
    deliveryChargePaise: settings.deliveryChargePaise,
    freeDeliveryAbovePaise: settings.freeDeliveryAbovePaise,
    estimatedDeliveryDays: settings.estimatedDeliveryDays,
    codEnabled: settings.codEnabled,
    codExtraChargePaise: settings.codExtraChargePaise,
    codMaxOrderValuePaise: settings.codMaxOrderValuePaise,
  };
}

/** Every editable field, for the admin settings screen. */
export function toAdminSettings(settings: SettingsDocument): SettingsShape {
  return {
    shopName: settings.shopName,
    legalName: settings.legalName,
    contactPhone: settings.contactPhone,
    contactEmail: settings.contactEmail,
    instagramUrl: settings.instagramUrl,
    deliveryChargePaise: settings.deliveryChargePaise,
    freeDeliveryAbovePaise: settings.freeDeliveryAbovePaise,
    blockedPincodes: settings.blockedPincodes,
    estimatedDeliveryDays: settings.estimatedDeliveryDays,
    codEnabled: settings.codEnabled,
    codExtraChargePaise: settings.codExtraChargePaise,
    codMaxOrderValuePaise: settings.codMaxOrderValuePaise,
    maxOrdersPerPhonePerDay: settings.maxOrdersPerPhonePerDay,
    gstEnabled: settings.gstEnabled,
    gstin: settings.gstin,
    sellerState: settings.sellerState,
    sellerAddress: settings.sellerAddress,
    pricesIncludeTax: settings.pricesIncludeTax,
    gstSlabs: settings.gstSlabs,
    hsnDefault: settings.hsnDefault,
  };
}

/**
 * Apply a partial edit from the admin settings screen.
 *
 * `settingsUpdateSchema` only checks its cross-field rules (GSTIN required,
 * slab ladder) against whatever the patch itself contains — toggling
 * `codEnabled` alone must not demand a GSTIN in the same request. The merged
 * document is re-validated here against the full `settingsSchema` before
 * saving, so a patch that leaves the *stored* settings inconsistent (GST
 * switched on with no GSTIN already on file) is still caught.
 */
export async function updateSettings(patch: SettingsUpdate): Promise<SettingsDocument> {
  const settings = await getSettings();

  const merged = settingsSchema.safeParse({ ...toAdminSettings(settings), ...patch });
  if (!merged.success) {
    throw ApiError.validation(
      merged.error.issues[0]?.message ?? 'Some of the details you entered are not valid',
      merged.error.issues.map((issue) => ({
        field: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
    );
  }

  Object.assign(settings, patch);
  await settings.save();
  return settings;
}
