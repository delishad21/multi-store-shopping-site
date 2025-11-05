export type DiscountRule =
  | { type: "nthItemPercent"; nth: number; percentOff: number }
  | { type: "overallPercent"; percentOff: number }
  | {
      type: "shippingThreshold";
      threshold: number;
      shippingPercentOff: number;
    };

export interface Product {
  sku: string;
  name: string;
  price: number;
  img: string;
}

export type StoreAlert = {
  message: string;
  severity?: "info" | "warning" | "error" | "success";
};

export type Store = {
  id: string;
  name: string;
  alerts?: {
    message: string;
    severity?: "info" | "success" | "warning" | "error";
  }[];
  shipping: { baseFee: number };
  constraints: { maxQtyPerItem: number };
  discounts: DiscountRule[];
  products: Product[];
  showDiscountBreakdown?: boolean;
};

export interface CartLine {
  storeId: string;
  sku: string;
  qty: number;
}

export type ItemDiscount = {
  kind: "nthItemPercent" | "overallPercent" | string;
  label: string;
  amount: number;
};

export type PricedItem = {
  storeId: string;
  sku: string;
  name: string;
  img: string;
  qty: number;
  unitPrice: number;
  originalLineTotal: number;
  discounts: ItemDiscount[];
  finalLineTotal: number;
};

export type StoreTotals = {
  itemsSubtotal: number;
  itemsDiscount: number;
  itemsNet: number;
  shippingBase: number;
  shippingDiscount: number;
  shippingNet: number;
  gst: number;
  storeTotal: number;
  perItem: PricedItem[];
  discountFlags: {
    nthAppliedUnits: { sku: string; unitPrice: number; amount: number }[];
    overallPercent?: number;
  };
};

export type CalcEntryItem = {
  storeId: string;
  storeName?: string;
  sku: string;
  name: string;
  img: string;
  qty: number;
  unitPrice: number;

  /** final per-line price used for totals */
  lineTotal: number;

  /** optional extra fields for receipts / debugging */
  originalLineTotal?: number;
  finalLineTotal?: number;
  discounts?: { label: string; amount: number }[];
};

export type CalcEntry = {
  store: Store;
  items: CalcEntryItem[];
  totals: StoreTotals;
};
