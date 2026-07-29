/**
 * Vocabulary shared by the server, the storefront and the admin panel.
 * Everything here is `as const` so the Zod enums below stay in lockstep with
 * the TypeScript union types.
 */

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const CATEGORIES = ['men', 'women', 'kids'] as const;
export type Category = (typeof CATEGORIES)[number];

export const SHOE_TYPES = [
  'sneakers',
  'sports',
  'formal',
  'casual',
  'loafers',
  'boots',
  'sandals',
  'slippers',
] as const;
export type ShoeType = (typeof SHOE_TYPES)[number];

/**
 * UK sizing, which is what Indian footwear is sold in. Half sizes are allowed
 * on a product but this list drives the admin's size grid and the storefront
 * filter, so it stays to whole sizes across kids through adults.
 */
export const SHOE_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;

export const MIN_SHOE_SIZE = 1;
export const MAX_SHOE_SIZE = 14;

export const CATEGORY_LABELS: Record<Category, string> = {
  men: "Men's",
  women: "Women's",
  kids: 'Kids',
};

export const SHOE_TYPE_LABELS: Record<ShoeType, string> = {
  sneakers: 'Sneakers',
  sports: 'Sports',
  formal: 'Formal',
  casual: 'Casual',
  loafers: 'Loafers',
  boots: 'Boots',
  sandals: 'Sandals',
  slippers: 'Slippers',
};

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export const ORDER_STATUSES = [
  'placed',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  placed: 'Order placed',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/**
 * Which status can follow which. The server rejects any transition not listed
 * here, so a mis-click in the admin panel cannot move a delivered order back to
 * "packed" or resurrect a cancelled one.
 */
export const ORDER_STATUS_FLOW: Record<OrderStatus, readonly OrderStatus[]> = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

/** Statuses from which nothing further can happen. */
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ['delivered', 'cancelled'];

export const PAYMENT_METHODS = ['razorpay', 'cod'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  razorpay: 'Pay online',
  cod: 'Cash on delivery',
};

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Max distinct lines in one cart — a sanity bound, not a business rule. */
export const MAX_CART_ITEMS = 20;
/** Max quantity of a single size in one order. */
export const MAX_ITEM_QUANTITY = 10;

/**
 * Unpaid online orders older than this are swept by the cleanup job so the
 * admin's order list only shows things that actually happened.
 */
export const ABANDONED_ORDER_TTL_HOURS = 24;

// ---------------------------------------------------------------------------
// Tax
// ---------------------------------------------------------------------------

/**
 * Footwear sits in HSN chapter 64. The exact heading depends on the upper and
 * sole material; 6404 (uppers of textile) covers most sneakers and is used as
 * the default, overridable per product.
 */
export const HSN_CODES = [
  { code: '6401', label: '6401 — Waterproof footwear' },
  { code: '6402', label: '6402 — Other footwear, rubber/plastic' },
  { code: '6403', label: '6403 — Footwear with leather uppers' },
  { code: '6404', label: '6404 — Footwear with textile uppers' },
  { code: '6405', label: '6405 — Other footwear' },
] as const;

export const DEFAULT_HSN_CODE = '6404';

/**
 * Default GST slabs, in basis points, ordered ascending by `maxPricePaise`
 * (`null` means "no upper bound").
 *
 * IMPORTANT: footwear GST in India is price-banded and has been revised more
 * than once. These are seed values only — confirm the current rates with your
 * CA and update them in the admin Settings screen, which is the live source of
 * truth. Nothing here is hard-coded into the tax calculation.
 */
export const DEFAULT_GST_SLABS = [
  { maxPricePaise: 250_000, rateBps: 500 },
  { maxPricePaise: null, rateBps: 1800 },
] as const;

// ---------------------------------------------------------------------------
// Indian states — needed for GST place of supply
// ---------------------------------------------------------------------------

/**
 * Whether a sale is intra-state (CGST + SGST) or inter-state (IGST) is decided
 * by comparing the shipping address's state with the seller's. The two-digit
 * code is the GST state code that appears on the invoice.
 */
export const INDIAN_STATES = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
] as const;

export const INDIAN_STATE_NAMES = INDIAN_STATES.map((state) => state.name);

export type IndianStateName = (typeof INDIAN_STATES)[number]['name'];

export function gstStateCode(stateName: string): string | undefined {
  return INDIAN_STATES.find((state) => state.name === stateName)?.code;
}

// ---------------------------------------------------------------------------
// Catalog listing
// ---------------------------------------------------------------------------

export const PRODUCT_SORT_OPTIONS = [
  'newest',
  'price-asc',
  'price-desc',
  'name-asc',
  'relevance',
] as const;
export type ProductSort = (typeof PRODUCT_SORT_OPTIONS)[number];

export const PRODUCT_SORT_LABELS: Record<ProductSort, string> = {
  newest: 'Newest first',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  'name-asc': 'Name: A to Z',
  relevance: 'Best match',
};

export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 60;
