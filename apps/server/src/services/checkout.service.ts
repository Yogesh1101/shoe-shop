import {
  addTaxExclusive,
  type Quote,
  type QuoteLine,
  type QuoteRequest,
  splitTaxInclusive,
  type StockIssue,
  sumPaise,
  type TaxBreakdown,
  type TaxLine,
} from '@shoe-shop/shared';

import { Product } from '../models/Product.js';
import { type GstSlabDoc, type SettingsDocument } from '../models/Settings.js';
import { getSettings } from './settings.service.js';

/**
 * Price a cart.
 *
 * This is the one place a total is computed. Every price is re-read from the
 * database rather than trusted from the request, so a tampered cart or one
 * that sat in localStorage for weeks cannot influence what gets charged.
 */
export async function buildQuote(request: QuoteRequest): Promise<Quote> {
  const settings = await getSettings();

  const productIds = [...new Set(request.items.map((item) => item.productId))];
  const products = await Product.find({ _id: { $in: productIds } });
  const productsById = new Map(products.map((product) => [product.id, product]));

  const lines: QuoteLine[] = [];
  const stockIssues: StockIssue[] = [];

  for (const item of request.items) {
    const product = productsById.get(item.productId);

    if (!product || !product.isActive) {
      stockIssues.push({
        productId: item.productId,
        name: product?.name ?? 'This item',
        color: item.color,
        size: item.size,
        requested: item.qty,
        available: 0,
        reason: 'unavailable',
      });
      continue;
    }

    const variant = product.variants.find(
      (candidate) => candidate.color.toLowerCase() === item.color.toLowerCase(),
    );
    if (!variant) {
      stockIssues.push({
        productId: item.productId,
        name: product.name,
        color: item.color,
        size: item.size,
        requested: item.qty,
        available: 0,
        reason: 'unavailable',
      });
      continue;
    }

    const available = variant.sizes.find((size) => size.size === item.size)?.stock ?? 0;
    if (available === 0) {
      stockIssues.push({
        productId: item.productId,
        name: product.name,
        color: item.color,
        size: item.size,
        requested: item.qty,
        available,
        reason: 'out-of-stock',
      });
      continue;
    }
    if (available < item.qty) {
      stockIssues.push({
        productId: item.productId,
        name: product.name,
        color: item.color,
        size: item.size,
        requested: item.qty,
        available,
        reason: 'insufficient-stock',
      });
      continue;
    }

    const unitPricePaise = product.pricePaise;
    lines.push({
      productId: item.productId,
      name: product.name,
      slug: product.slug,
      image: variant.images[0]?.url ?? '',
      brand: product.brand,
      color: variant.color,
      size: item.size,
      qty: item.qty,
      unitPricePaise,
      lineTotalPaise: unitPricePaise * item.qty,
    });
  }

  const subtotalPaise = sumPaise(lines.map((line) => line.lineTotalPaise));

  // No delivery charge on a cart that cannot be fulfilled at all — there is
  // nothing to ship.
  const freeDeliveryApplies = lines.length > 0 && subtotalPaise >= settings.freeDeliveryAbovePaise;
  const deliveryChargePaise = lines.length === 0 || freeDeliveryApplies ? 0 : settings.deliveryChargePaise;
  const freeDeliveryShortfallPaise = freeDeliveryApplies
    ? null
    : Math.max(0, settings.freeDeliveryAbovePaise - subtotalPaise);

  // The cap is checked against what the customer would actually owe the
  // delivery agent, i.e. goods plus delivery, before any COD surcharge.
  const codOrderValuePaise = subtotalPaise + deliveryChargePaise;
  const codAvailable =
    settings.codEnabled &&
    (settings.codMaxOrderValuePaise === 0 || codOrderValuePaise <= settings.codMaxOrderValuePaise);
  const codChargePaise = request.paymentMethod === 'cod' && codAvailable ? settings.codExtraChargePaise : 0;

  const tax = computeTaxBreakdown(lines, settings, request.state);

  // Tax-inclusive prices already contain GST, so it is only added on top when
  // the shop's prices are configured as tax-exclusive.
  const totalPaise =
    subtotalPaise + deliveryChargePaise + codChargePaise + (settings.pricesIncludeTax ? 0 : tax.totalPaise);

  const pincodeServiceable = request.pincode
    ? !settings.blockedPincodes.includes(request.pincode)
    : null;

  return {
    lines,
    subtotalPaise,
    deliveryChargePaise,
    codChargePaise,
    totalPaise,
    tax,
    freeDeliveryShortfallPaise,
    pincodeServiceable,
    codAvailable,
    stockIssues,
  };
}

/** The GST slab that applies to a given per-pair price, banded ascending by `maxPricePaise`. */
function slabRateFor(unitPricePaise: number, slabs: GstSlabDoc[]): number {
  const match = slabs.find((slab) => slab.maxPricePaise === null || unitPricePaise <= slab.maxPricePaise);
  return match?.rateBps ?? 0;
}

/** `500` basis points -> `"5"`; `250` -> `"2.5"`. */
function ratePercentLabel(rateBps: number): string {
  return String(rateBps / 100);
}

/**
 * GST invoice breakdown.
 *
 * Rate bands apply per pair (line-by-line), not to the order as a whole — a
 * ₹999 pair of sandals and a ₹4,999 pair of boots in the same cart can sit in
 * different slabs. Lines are grouped by rate afterwards so the invoice shows
 * one CGST/SGST (or IGST) pair per rate rather than one per cart line.
 *
 * Whether the sale is intra-state (CGST + SGST) or inter-state (IGST) is
 * decided by comparing the shipping state to the seller's — the standard
 * place-of-supply rule. Delivery and COD charges are not taxed here; this shop
 * treats them as flat pass-through charges rather than a separately taxable
 * service.
 */
function computeTaxBreakdown(
  lines: QuoteLine[],
  settings: SettingsDocument,
  shipToState: string | undefined,
): TaxBreakdown {
  if (!settings.gstEnabled || lines.length === 0) {
    return {
      mode: 'none',
      taxablePaise: sumPaise(lines.map((line) => line.lineTotalPaise)),
      lines: [],
      totalPaise: 0,
    };
  }

  const mode: 'cgst_sgst' | 'igst' =
    shipToState !== undefined && shipToState !== settings.sellerState ? 'igst' : 'cgst_sgst';

  const byRate = new Map<number, { taxablePaise: number; taxPaise: number }>();
  for (const line of lines) {
    const rateBps = slabRateFor(line.unitPricePaise, settings.gstSlabs);
    const split = settings.pricesIncludeTax
      ? splitTaxInclusive(line.lineTotalPaise, rateBps)
      : addTaxExclusive(line.lineTotalPaise, rateBps);

    const group = byRate.get(rateBps) ?? { taxablePaise: 0, taxPaise: 0 };
    group.taxablePaise += split.taxablePaise;
    group.taxPaise += split.taxPaise;
    byRate.set(rateBps, group);
  }

  const taxLines: TaxLine[] = [];
  let taxablePaise = 0;
  let totalPaise = 0;

  for (const [rateBps, group] of [...byRate.entries()].sort(([a], [b]) => a - b)) {
    taxablePaise += group.taxablePaise;
    totalPaise += group.taxPaise;

    if (mode === 'igst') {
      taxLines.push({ label: `IGST ${ratePercentLabel(rateBps)}%`, rateBps, amountPaise: group.taxPaise });
      continue;
    }

    const halfRateBps = Math.round(rateBps / 2);
    // Split by amount rather than re-deriving each half from the rate, so
    // CGST + SGST always reconciles to the group's tax exactly — no stray
    // paisa left over from rounding two halves independently.
    const cgstPaise = Math.floor(group.taxPaise / 2);
    const sgstPaise = group.taxPaise - cgstPaise;
    taxLines.push({
      label: `CGST ${ratePercentLabel(halfRateBps)}%`,
      rateBps: halfRateBps,
      amountPaise: cgstPaise,
    });
    taxLines.push({
      label: `SGST ${ratePercentLabel(halfRateBps)}%`,
      rateBps: halfRateBps,
      amountPaise: sgstPaise,
    });
  }

  return { mode, taxablePaise, lines: taxLines, totalPaise };
}
