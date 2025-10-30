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

export interface Store {
  id: string;
  name: string;
  alerts?: StoreAlert[];
  shipping: { baseFee: number };
  constraints: { maxQtyPerItem: number };
  discounts: DiscountRule[];
  products: Product[];
}

export interface CartLine {
  storeId: string;
  sku: string;
  qty: number;
}

export interface StoreTotals {
  itemsSubtotal: number;
  itemsDiscount: number;
  itemsNet: number;
  shippingBase: number;
  shippingDiscount: number;
  shippingNet: number;
  gst: number;
  storeTotal: number;
}

export type CalcEntry = {
  store: Store;
  items: {
    storeId: string;
    sku: string;
    name: string;
    img: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  totals: {
    itemsSubtotal: number;
    itemsDiscount: number;
    itemsNet: number;
    shippingBase: number;
    shippingDiscount: number;
    shippingNet: number;
    gst: number;
    storeTotal: number;
  };
};
