import { DEFAULT_GST_SLABS, DEFAULT_HSN_CODE } from '@shoe-shop/shared';
import { type HydratedDocument, model, Schema } from 'mongoose';

export interface GstSlabDoc {
  maxPricePaise: number | null;
  rateBps: number;
}

export interface SettingsDoc {
  /** Fixed `_id` so there can only ever be one settings document. */
  _id: string;

  shopName: string;
  legalName: string;
  contactPhone: string;
  contactEmail: string;
  instagramUrl: string;

  deliveryChargePaise: number;
  freeDeliveryAbovePaise: number;
  blockedPincodes: string[];
  estimatedDeliveryDays: string;

  codEnabled: boolean;
  codExtraChargePaise: number;
  codMaxOrderValuePaise: number;
  maxOrdersPerPhonePerDay: number;

  gstEnabled: boolean;
  gstin: string;
  sellerState: string;
  sellerAddress: string;
  pricesIncludeTax: boolean;
  gstSlabs: GstSlabDoc[];
  hsnDefault: string;

  createdAt: Date;
  updatedAt: Date;
}

/** The only valid `_id`. Enforced by `getSettings()` in the settings service. */
export const SETTINGS_ID = 'shop';

const gstSlabSchema = new Schema<GstSlabDoc>(
  {
    // `null` marks the open-ended top band.
    maxPricePaise: { type: Number, default: null },
    rateBps: { type: Number, required: true },
  },
  { _id: false },
);

const settingsSchema = new Schema<SettingsDoc>(
  {
    _id: { type: String, default: SETTINGS_ID },

    shopName: { type: String, required: true, default: 'Shoe Shop' },
    legalName: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    instagramUrl: { type: String, default: '' },

    deliveryChargePaise: { type: Number, required: true, default: 5_000 },
    freeDeliveryAbovePaise: { type: Number, required: true, default: 99_900 },
    /**
     * A blocklist, not an allowlist: India has roughly 19,000 PIN codes, so
     * enumerating the ones you *do* serve is unworkable, while listing the
     * handful you cannot reach is a two-minute job.
     */
    blockedPincodes: { type: [String], default: [] },
    estimatedDeliveryDays: { type: String, default: '3-7 business days' },

    codEnabled: { type: Boolean, required: true, default: true },
    codExtraChargePaise: { type: Number, required: true, default: 0 },
    /** 0 means no cap. Above this, the customer must prepay. */
    codMaxOrderValuePaise: { type: Number, required: true, default: 0 },
    maxOrdersPerPhonePerDay: { type: Number, required: true, default: 5 },

    // Off until the owner has actually entered a GSTIN — the default combination
    // of "GST on" with no GSTIN would violate the admin form's own validation
    // the moment anyone tried to save an unrelated setting.
    gstEnabled: { type: Boolean, required: true, default: false },
    gstin: { type: String, default: '' },
    sellerState: { type: String, default: 'Karnataka' },
    sellerAddress: { type: String, default: '' },
    /** Indian retail quotes tax-inclusive prices; invoices work backwards. */
    pricesIncludeTax: { type: Boolean, required: true, default: true },
    /**
     * Rates are data, not code. Footwear GST in India is price-banded and has
     * been revised more than once; hard-coding a rate guarantees wrong invoices
     * the next time it changes. The shop owner edits these in the admin panel.
     */
    gstSlabs: { type: [gstSlabSchema], default: () => [...DEFAULT_GST_SLABS] },
    hsnDefault: { type: String, default: DEFAULT_HSN_CODE },
  },
  { timestamps: true, versionKey: false, _id: false },
);

export type SettingsDocument = HydratedDocument<SettingsDoc>;

export const Settings = model<SettingsDoc>('Settings', settingsSchema);
