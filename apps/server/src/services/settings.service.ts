import type { PublicSettings } from '@shoe-shop/shared';

import { Settings, SETTINGS_ID, type SettingsDocument } from '../models/Settings.js';

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
