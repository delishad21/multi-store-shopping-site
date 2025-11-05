import { useMemo, useEffect } from "react";
import { useStore, useStoresList } from "../lib/useStores";
import { money } from "../lib/format";
import { priceStore } from "../lib/pricing";
import type { CalcEntry, StoreTotals } from "../lib/types";
import { useCart } from "../lib/useCart";
import StoreTotalsPanel from "./StoreTotalsPanel";
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
  IconButton,
  Alert,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import DeleteIcon from "@mui/icons-material/Delete";

export default function StoreCartCard({
  storeId,
  onCalcChange,
  onClearStore,
}: {
  storeId: string;
  onCalcChange: (entry: CalcEntry | null) => void;
  onClearStore: () => void;
}) {
  const { store, productsBySku } = useStore(storeId);
  const { gstRate } = useStoresList();
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const lines = useCart((s) => s.lines[storeId] || {});

  const { l, items, totals } = useMemo(() => {
    if (!store) {
      return {
        l: [] as { sku: string; qty: number }[],
        items: [] as Array<{
          storeId: string;
          sku: string;
          name: string;
          img: string;
          qty: number;
          unitPrice: number;
          originalLineTotal: number;
          finalLineTotal: number;
          maxQ: number;
          discounts: { label: string; amount: number }[];
        }>,
        totals: {
          itemsSubtotal: 0,
          itemsDiscount: 0,
          itemsNet: 0,
          shippingBase: 0,
          shippingDiscount: 0,
          shippingNet: 0,
          gst: 0,
          storeTotal: 0,
          perItem: [],
          discountFlags: {
            nthAppliedUnits: [],
          },
        } as StoreTotals,
      };
    }

    const entries = Object.entries(lines).filter(([, q]) => q > 0);
    const l = entries.map(([sku, qty]) => ({ sku, qty }));

    const totals = priceStore(
      productsBySku,
      l,
      store.discounts,
      store.shipping.baseFee,
      gstRate
    );

    const items =
      (totals.perItem || []).map((pi) => ({
        storeId,
        sku: pi.sku,
        name: pi.name,
        img: pi.img,
        qty: pi.qty,
        unitPrice: pi.unitPrice,
        originalLineTotal: pi.originalLineTotal,
        finalLineTotal: pi.finalLineTotal,
        maxQ: store.constraints.maxQtyPerItem,
        discounts: (pi.discounts || []).map((d) => ({
          label: d.label,
          amount: d.amount,
        })),
      })) ?? [];

    return { entries, l, items, totals };
  }, [store, productsBySku, lines, storeId, gstRate]);

  useEffect(() => {
    if (!store || l.length === 0) {
      onCalcChange(null);
      return;
    }

    const payloadItems: CalcEntry["items"] = items.map(
      ({ maxQ, discounts, originalLineTotal, finalLineTotal, ...rest }) => ({
        ...rest,
        storeName: store.name,
        lineTotal: finalLineTotal,
        originalLineTotal,
        finalLineTotal,
        discounts,
      })
    );

    onCalcChange({
      store,
      items: payloadItems,
      totals,
    });
  }, [
    store,
    store?.id,
    l.length,
    totals.itemsSubtotal,
    totals.itemsDiscount,
    totals.itemsNet,
    totals.shippingBase,
    totals.shippingDiscount,
    totals.shippingNet,
    totals.gst,
    totals.storeTotal,
    gstRate,
    JSON.stringify(
      items.map((i) => [
        i.sku,
        i.qty,
        i.unitPrice,
        i.originalLineTotal,
        i.finalLineTotal,
      ])
    ),
  ]);

  if (!store) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
          Loading…
        </Typography>
        <Typography color="text.secondary">Fetching store data…</Typography>
      </Paper>
    );
  }

  if (l.length === 0) {
    return null;
  }

  const showBreakdown = store.showDiscountBreakdown !== false;

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>
          {store.name}
        </Typography>
        <Button size="small" color="error" onClick={onClearStore}>
          Remove all from store
        </Button>
      </Box>

      {!showBreakdown && (
        <Alert severity="warning" sx={{ mb: 1.5, borderRadius: 2 }}>
          The discount calculation system for the store is down. The overall
          discounts shown are still accurate, but per item discounts will not be
          shown.
        </Alert>
      )}

      <Stack spacing={1.5}>
        {items.map((i) => {
          const hasDiscounts = showBreakdown && (i.discounts?.length ?? 0) > 0;
          const showStrike =
            showBreakdown && i.finalLineTotal < i.originalLineTotal;

          return (
            <Box
              key={`${i.storeId}-${i.sku}`}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                py: 1,
                borderBottom: "1px solid",
                borderColor: "divider",
                "&:last-of-type": { borderBottom: "none" },
              }}
            >
              <Box
                component="img"
                src={i.img}
                alt={i.name}
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: 1,
                  objectFit: "cover",
                  flexShrink: 0,
                  bgcolor: "action.hover",
                }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap title={i.name} fontWeight={600}>
                  {i.name}
                </Typography>

                {showBreakdown ? (
                  <Stack spacing={0.25}>
                    <Typography variant="body2" color="text.secondary">
                      {money(i.unitPrice)} each × {i.qty}
                    </Typography>
                    {hasDiscounts &&
                      i.discounts!.map((d, idx) => (
                        <Typography
                          key={idx}
                          variant="caption"
                          color="success.main"
                          sx={{ display: "block" }}
                        >
                          − {d.label}: {money(d.amount)}
                        </Typography>
                      ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {money(i.unitPrice)} each × {i.qty}
                  </Typography>
                )}
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <IconButton
                  size="small"
                  onClick={() => setQty(i.storeId, i.sku, i.qty - 1)}
                  aria-label="Decrease"
                >
                  <RemoveIcon />
                </IconButton>
                <Typography width={20} textAlign="center">
                  {i.qty}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() =>
                    setQty(
                      i.storeId,
                      i.sku,
                      Math.min(store.constraints.maxQtyPerItem, i.qty + 1)
                    )
                  }
                  aria-label="Increase"
                >
                  <AddIcon />
                </IconButton>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => remove(i.storeId, i.sku)}
                  aria-label="Remove"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>

              <Box sx={{ width: 120, textAlign: "right" }}>
                {showStrike ? (
                  <Stack alignItems="flex-end">
                    <Typography
                      sx={{ textDecoration: "line-through", opacity: 0.6 }}
                    >
                      {money(i.originalLineTotal)}
                    </Typography>
                    <Typography fontWeight={700} color="success.main">
                      {money(i.finalLineTotal)}
                    </Typography>
                  </Stack>
                ) : (
                  <Typography fontWeight={600}>
                    {money(i.finalLineTotal)}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Stack>

      <Box sx={{ mt: 2 }}>
        <StoreTotalsPanel totals={totals} />
      </Box>
    </Paper>
  );
}
