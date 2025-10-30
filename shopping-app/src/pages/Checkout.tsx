import { useMemo, useState } from "react";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

import { useCart } from "../lib/useCart";
import { money } from "../lib/format";
import StoreCartCard from "../components/StoreCartCard";
import type { CalcEntry } from "../lib/types";
import CheckoutFormDialog from "../components/CheckoutFormDialog";
import type { CheckoutFormValues } from "../components/CheckoutFormDialog";
import { useStoresList } from "../lib/useStores";
import { APPS_SCRIPT_URL } from "../lib/config";

export default function Checkout() {
  const { lines, clear } = useCart();
  const clearStore = useCart((s) => s.clearStore);
  const { classes } = useStoresList();
  const nav = useNavigate();

  const nonEmptyStoreIds = useMemo(
    () =>
      Object.entries(lines)
        .filter(([, skus]) => Object.values(skus).some((q) => q > 0))
        .map(([id]) => id)
        .sort(),
    [lines]
  );

  const [calcByStore, setCalcByStore] = useState<Record<string, CalcEntry>>({});

  const upsertCalc = (storeId: string, entry: CalcEntry | null) => {
    setCalcByStore((prev) => {
      if (!entry || entry.items.length === 0) {
        if (!(storeId in prev)) return prev;
        const next = { ...prev };
        delete next[storeId];
        return next;
      }
      const prevEntry = prev[storeId];
      if (prevEntry && JSON.stringify(prevEntry) === JSON.stringify(entry)) {
        return prev;
      }
      return { ...prev, [storeId]: entry };
    });
  };

  const grandTotal = Object.values(calcByStore).reduce(
    (a, s) => a + s.totals.storeTotal,
    0
  );

  const richItems = useMemo(
    () =>
      Object.values(calcByStore).flatMap((s) =>
        s.items.map((i) => ({
          sku: i.sku,
          name: i.name,
          img: i.img,
          storeName: s.store.name,
          qty: i.qty,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
        }))
      ),
    [calcByStore]
  );

  // Dialog open/close
  const [open, setOpen] = useState(false);

  const handleSubmitOrder = (data: CheckoutFormValues) => {
    const payload = {
      name: data.name,
      className: data.className,
      justifications: data.justifications,
      items: richItems, // ✅ use the enriched items
      perStoreTotals: Object.values(calcByStore).map((s) => ({
        storeId: s.store.id,
        storeName: s.store.name,
        itemsSubtotal: s.totals.itemsSubtotal,
        itemsDiscount: s.totals.itemsDiscount,
        shippingNet: s.totals.shippingNet,
        gst: s.totals.gst,
        storeTotal: s.totals.storeTotal,
      })),
      grandTotal,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem("last-order", JSON.stringify(payload));
    clear();
    setOpen(false);
    nav("/receipt");
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h5" fontWeight={700}>
        Cart
      </Typography>

      {/* CART LIST */}
      <Stack spacing={2}>
        {nonEmptyStoreIds.length === 0 && (
          <Paper sx={{ p: 2 }}>
            <Typography color="text.secondary">Your cart is empty.</Typography>
          </Paper>
        )}

        {nonEmptyStoreIds.map((storeId) => (
          <StoreCartCard
            key={storeId}
            storeId={storeId}
            onCalcChange={(entry) => upsertCalc(storeId, entry)}
            onClearStore={() => {
              clearStore(storeId);
              upsertCalc(storeId, null);
            }}
          />
        ))}
      </Stack>

      <Paper sx={{ p: 2 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="h6">Grand Total</Typography>
          <Typography variant="h6" fontWeight={700}>
            {money(grandTotal)}
          </Typography>
        </Box>
        <Box sx={{ mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Button
            variant="contained"
            size="large"
            disabled={richItems.length === 0}
            onClick={() => setOpen(true)}
          >
            Proceed to Checkout
          </Button>
          {richItems.length > 0 && (
            <Button variant="text" color="error" onClick={() => clear()}>
              Clear Cart
            </Button>
          )}
        </Box>
      </Paper>

      <CheckoutFormDialog
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmitOrder}
        items={richItems}
        classes={classes}
        appsScriptUrl={APPS_SCRIPT_URL}
        grandTotal={grandTotal}
        perStoreTotals={Object.values(calcByStore).map((s) => ({
          storeId: s.store.id,
          storeName: s.store.name,
          itemsSubtotal: s.totals.itemsSubtotal,
          itemsDiscount: s.totals.itemsDiscount,
          shippingNet: s.totals.shippingNet,
          gst: s.totals.gst,
          storeTotal: s.totals.storeTotal,
        }))}
      />
    </Stack>
  );
}
