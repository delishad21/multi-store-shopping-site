# multi-store-shopping-site

Simple JSON data based shopping site built with React.
Used for conducting lessons in primary schools to learn about budgetting, sums and percentages.

To quickly start up the project:

1. Clone the repository
2. cd into the /shopping-app directory
3. Run `npm install` to install dependencies
4. Run `npm start` to start the development server
5. Under /shopping-app/public, change sample-img folder name to 'img' and sample-stores folder name to 'stores'
6. Open `http://localhost:5173` in your browser to view the app

## Pricing & Store Data Guide

This section explains how the pricing engine works (priceStore), the order of operations (discounts, shipping, GST), and how to add your own store JSON so the app can render products, discounts, alerts, and classes.

### Overview

The app prices each store independently, then the checkout page sums up store totals into a grand total. For each store, we compute:

- `itemsSubtotal` — sum of price × qty for all cart lines
- `itemsDiscount` — total discount applied on items (all item-level rules)
- `itemsNet` — itemsSubtotal - itemsDiscount
- `shippingBase` — the store’s base shipping fee
- `shippingDiscount` — discount on shipping (e.g., free shipping threshold)
- `shippingNet` — shippingBase - shippingDiscount (min 0)
- `gst` — GST (9%) on (itemsNet + shippingNet)
- `storeTotal` — itemsNet + shippingNet + gst

All money values are rounded to 2 decimals (banker’s rounding not required; simple Math.round(n\*100)/100).

### Supported DiscountRules

1. `nthItemPercent`: Apply % off to every N-th unit across the whole cart (store-scoped), counting per unit ordered (not per SKU).

   `{ type: "nthItemPercent"; nth: number; percentOff: number }`

2. `overallPercent`: Apply a flat percent off after the nthItemPercent rule on the items net (not shipping).

   `{ type: "overallPercent"; percentOff: number }`

3. `shippingThreshold`: If itemsNet >= threshold, discount shipping by shippingPercentOff.

   `{ type: "shippingThreshold"; threshold: number; shippingPercentOff: number }`

The order of application is:

1. Sum items → itemsSubtotal
2. Apply nthItemPercent → increase itemsDiscount
3. Apply overallPercent on itemsNet → increase itemsDiscount
4. Evaluate shippingThreshold against current itemsNet
5. Compute shippingNet, then gst = 9% × (itemsNet + shippingNet)
6. storeTotal = itemsNet + shippingNet + gst

### Index JSON

/public/stores/index.json drives the gallery tabs and (optionally) your class list and site title:

Example:

```json
{
  "title": "School Cart",
  "alerts": [
    {
      "message": "Welcome to School Cart! Check out our latest discounts.",
      "severity": "info"
    }
  ],
  "discountCodes": [
    {
      "code": "WELCOME10",
      "kind": "percent",
      "amount": 10,
      "description": "10% off the whole order"
    },
    {
      "code": "MINUS5",
      "kind": "absolute",
      "amount": 5,
      "description": "S$5 off the grand total"
    }
  ],
  "classes": ["Class 1", "Class 2", "Class 3"],
  "stores": [
    { "id": "store-1", "name": "Store 1" },
    { "id": "store-2", "name": "Store 2" }
  ],
  "discountCap": {
    "percentMax": 100,
    "absoluteMax": 250
  }
}
```

- `title` appears in the AppBar.
- `classes` populates the class dropdown in the checkout dialog.
- `stores[]` controls the tabs and landing gallery cards.
- `alerts[]` (optional) array of alert messages to show at the top of the gallery page
  - `severity`: "info" | "warning" | "error" | "success"
- `discountCodes[]` (optional) array of discount codes that users can apply at checkout
  - `code`: the code string users enter
  - `kind`: "percent" | "absolute"
  - `amount`: number representing percent or absolute amount
  - `description`: short description of the discount code
- `discountCap` (optional) object to cap total discount amounts from discount codes
  - `percentMax`: maximum total percent discount from all percent-type discount codes
  - `absoluteMax`: maximum total absolute discount from all absolute-type discount codes

### Store JSON

Each store JSON is located at `/public/stores/{storeId}.json` and defines products, discounts, and alerts for that store.

Example:

```json
{
  "id": "rodalink",
  "name": "Rodalink",
  "showDiscountBreakdown": true,
  "alerts": [
    {
      "message": "18% storewide discount applied at checkout.",
      "severity": "success"
    },
    {
      "message": "Free shipping above S$100. Base shipping S$35.",
      "severity": "info"
    }
  ],
  "shipping": { "baseFee": 35 },
  "constraints": { "maxQtyPerItem": 3 },
  "discounts": [
    { "type": "overallPercent", "percentOff": 18 },
    { "type": "shippingThreshold", "threshold": 100, "shippingPercentOff": 100 }
  ],
  "products": [
    {
      "sku": "basket",
      "name": "Basket",
      "price": 52,
      "img": "/img/rodalink/basket.png"
    },
    {
      "sku": "bell",
      "name": "Bell",
      "price": 15,
      "img": "/img/rodalink/bell.png"
    },
    {
      "sku": "frame",
      "name": "Frame",
      "price": 2199,
      "img": "/img/rodalink/frame.png"
    }
  ]
}
```

Each store JSON supports:

- `id`: store identifier
- `name`: store display name
- `showDiscountBreakdown`: boolean to control whether per-item discount breakdowns are shown (Used for educational purposes to demonstrate discount calculations)
- `alerts[]`: array of alert messages to show at the top of the store page
  - `severity`: "info" | "warning" | "error" | "success"
- `shipping`: object with `baseFee` number
- `constraints`: object with `maxQtyPerItem` number
- `discounts[]`: array of DiscountRule objects as described above
- `products[]`: array of Product objects with `sku`, `name`, `price` and `img` path

### Cards JSON

This application also supports mock gift cards for payment testing. These are located at `/public/stores/cards.json`.

Example:

```json
{
  "cards": [
    { "number": "777700000001", "balance": 100.0 },
    { "number": "777700000002", "balance": 50.0 }
  ]
}
```

Each card object supports:

- `number`: card number string
- `balance`: number representing available balance on the card
