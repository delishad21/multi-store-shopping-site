import type { DiscountRule, Product, StoreTotals } from "./types";

const GST_RATE = 0.09;

export function priceStore(
  productsBySku: Record<string, Product>,
  lines: { sku: string; qty: number }[],
  discounts: DiscountRule[],
  baseShipping: number
): StoreTotals {
  const units: number[] = [];
  let itemsSubtotal = 0;
  for (const { sku, qty } of lines) {
    const p = productsBySku[sku];
    if (!p) continue;
    itemsSubtotal += p.price * qty;
    for (let i = 0; i < qty; i++) units.push(p.price);
  }
  let itemsDiscount = 0;

  const nthRule = discounts.find((d) => d.type === "nthItemPercent") as
    | { type: "nthItemPercent"; nth: number; percentOff: number }
    | undefined;
  if (nthRule && nthRule.nth > 0) {
    for (let idx = nthRule.nth - 1; idx < units.length; idx += nthRule.nth) {
      itemsDiscount += (units[idx] * nthRule.percentOff) / 100;
    }
  }

  let itemsNet = itemsSubtotal - itemsDiscount;

  const overall = discounts.find((d) => d.type === "overallPercent") as
    | { type: "overallPercent"; percentOff: number }
    | undefined;
  if (overall) {
    const extra = (itemsNet * overall.percentOff) / 100;
    itemsDiscount += extra;
    itemsNet -= extra;
  }

  let shippingBase = baseShipping;
  let shippingDiscount = 0;
  const shipRule = discounts.find((d) => d.type === "shippingThreshold") as
    | {
        type: "shippingThreshold";
        threshold: number;
        shippingPercentOff: number;
      }
    | undefined;
  if (shipRule && itemsNet >= shipRule.threshold) {
    shippingDiscount = (shippingBase * shipRule.shippingPercentOff) / 100;
  }

  const shippingNet = Math.max(0, shippingBase - shippingDiscount);
  const netBeforeGST = itemsNet + shippingNet;
  const gst = round2(netBeforeGST * GST_RATE);
  const storeTotal = round2(netBeforeGST + gst);

  return {
    itemsSubtotal: round2(itemsSubtotal),
    itemsDiscount: round2(itemsDiscount),
    itemsNet: round2(itemsNet),
    shippingBase: round2(shippingBase),
    shippingDiscount: round2(shippingDiscount),
    shippingNet: round2(shippingNet),
    gst,
    storeTotal,
  };
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}
