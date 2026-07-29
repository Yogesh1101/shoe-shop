import {
  ORDER_STATUSES,
  type OrderStatus,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type PaymentMethod,
  type PaymentStatus,
} from '@shoe-shop/shared';
import { type HydratedDocument, model, Schema, type Types } from 'mongoose';

export interface OrderItemDoc {
  productId: Types.ObjectId;
  name: string;
  slug: string;
  brand: string;
  image: string;
  color: string;
  size: number;
  qty: number;
  hsnCode: string;
  unitPricePaise: number;
  lineTotalPaise: number;
}

export interface OrderTaxLineDoc {
  label: string;
  rateBps: number;
  amountPaise: number;
}

export interface OrderDoc {
  orderNumber: string;
  items: OrderItemDoc[];
  customer: {
    name: string;
    phone: string;
    email: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      pincode: string;
    };
  };

  subtotalPaise: number;
  deliveryChargePaise: number;
  codChargePaise: number;
  totalPaise: number;
  tax: {
    mode: 'cgst_sgst' | 'igst' | 'none';
    taxablePaise: number;
    lines: OrderTaxLineDoc[];
    totalPaise: number;
  };

  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  razorpay?: {
    orderId?: string;
    paymentId?: string;
    signature?: string;
  };

  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: Date; note?: string }[];

  stockCommitted: boolean;
  stockRestored: boolean;

  invoice?: { number: string; generatedAt: Date };
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Line items are stored denormalised — name, brand, image, price and HSN are
 * copied at purchase time rather than referenced.
 *
 * A GST invoice must remain reproducible for years. If items pointed at the
 * product collection, raising a price or deleting a discontinued shoe would
 * silently rewrite history on every invoice that referenced it.
 */
const orderItemSchema = new Schema<OrderItemDoc>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    brand: { type: String, required: true },
    image: { type: String, required: true },
    color: { type: String, required: true },
    size: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
    hsnCode: { type: String, required: true },
    unitPricePaise: { type: Number, required: true, min: 0 },
    lineTotalPaise: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const taxLineSchema = new Schema<OrderTaxLineDoc>(
  {
    label: { type: String, required: true },
    rateBps: { type: Number, required: true },
    amountPaise: { type: Number, required: true },
  },
  { _id: false },
);

const orderSchema = new Schema<OrderDoc>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    items: { type: [orderItemSchema], required: true },

    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true, index: true },
      email: { type: String, required: true },
      address: {
        line1: { type: String, required: true },
        line2: { type: String },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true },
      },
    },

    subtotalPaise: { type: Number, required: true, min: 0 },
    deliveryChargePaise: { type: Number, required: true, default: 0, min: 0 },
    codChargePaise: { type: Number, required: true, default: 0, min: 0 },
    totalPaise: { type: Number, required: true, min: 0 },
    tax: {
      mode: { type: String, required: true, enum: ['cgst_sgst', 'igst', 'none'], default: 'none' },
      taxablePaise: { type: Number, required: true, default: 0 },
      lines: { type: [taxLineSchema], default: [] },
      totalPaise: { type: Number, required: true, default: 0 },
    },

    paymentMethod: { type: String, required: true, enum: PAYMENT_METHODS },
    paymentStatus: {
      type: String,
      required: true,
      enum: PAYMENT_STATUSES,
      default: 'pending',
    },
    razorpay: {
      orderId: { type: String, index: true, sparse: true },
      paymentId: { type: String },
      // Retained for dispute resolution: it proves the payment notification
      // genuinely came from Razorpay and was not forged.
      signature: { type: String },
    },

    status: { type: String, required: true, enum: ORDER_STATUSES, default: 'placed' },
    statusHistory: {
      type: [
        new Schema(
          {
            status: { type: String, required: true, enum: ORDER_STATUSES },
            at: { type: Date, required: true, default: Date.now },
            note: { type: String },
          },
          { _id: false },
        ),
      ],
      default: [],
    },

    /** True once stock has been taken: COD on placement, online on payment. */
    stockCommitted: { type: Boolean, required: true, default: false },
    /**
     * Guards the restore path. Cancelling an order twice — a double-click, a
     * retried request — must not put the same pair back into inventory twice.
     */
    stockRestored: { type: Boolean, required: true, default: false },

    invoice: {
      number: { type: String },
      generatedAt: { type: Date },
    },
    notes: { type: String },
  },
  { timestamps: true },
);

// The admin list: newest first, optionally filtered by status.
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
// Counting a phone number's prior cancellations before dispatching a COD parcel.
orderSchema.index({ 'customer.phone': 1, status: 1 });
// Sweeping abandoned unpaid online orders.
orderSchema.index({ paymentStatus: 1, createdAt: 1 });

export type OrderDocument = HydratedDocument<OrderDoc>;

export const Order = model<OrderDoc>('Order', orderSchema);
