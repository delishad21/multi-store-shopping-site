import { useMemo, useEffect } from "react";
import { useStore } from "../lib/useStores";
import { money } from "../lib/format";
import { priceStore } from "../lib/pricing";
import type { CalcEntry } from "../lib/types";
import { useCart } from "../lib/useCart";
import StoreTotalsPanel from "./StoreTotalsPanel";
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
  IconButton,
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
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const lines = useCart((s) => s.lines[storeId] || {});

  const { entries, l, items, totals } = useMemo(() => {
    if (!store) {
      return {
        entries: [] as [string, number][],
        l: [] as { sku: string; qty: number }[],
        items: [] as Array<{
          storeId: string;
          sku: string;
          name: string;
          img: string;
          qty: number;
          unitPrice: number;
          lineTotal: number;
          maxQ: number;
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
        },
      };
    }

    const entries = Object.entries(lines).filter(([, q]) => q > 0);
    const l = entries.map(([sku, qty]) => ({ sku, qty }));

    const totals = priceStore(
      productsBySku,
      l,
      store.discounts,
      store.shipping.baseFee
    );

    const items = l.map(({ sku, qty }) => {
      const p = productsBySku[sku];
      return {
        storeId,
        sku,
        name: p?.name || sku,
        img: p?.img || "",
        qty,
        unitPrice: p?.price || 0,
        lineTotal: (p?.price || 0) * qty,
        maxQ: store.constraints.maxQtyPerItem,
      };
    });

    return { entries, l, items, totals };
  }, [store, productsBySku, lines, storeId]);

  useEffect(() => {
    if (!store) {
      onCalcChange(null);
      return;
    }
    if (l.length === 0) {
      onCalcChange(null);
      return;
    }
    const payloadItems = items.map(({ maxQ, ...rest }) => rest);
    onCalcChange({
      store,
      items: payloadItems,
      totals,
    });
  }, [
    store,
    // depend on cheap primitives to avoid thrash
    store?.id,
    totals.itemsSubtotal,
    totals.itemsDiscount,
    totals.itemsNet,
    totals.shippingBase,
    totals.shippingDiscount,
    totals.shippingNet,
    totals.gst,
    totals.storeTotal,
    JSON.stringify(items.map((i) => [i.sku, i.qty, i.unitPrice])),
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

      <Stack spacing={1.5}>
        {items.map((i) => (
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
              }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap title={i.name} fontWeight={600}>
                {i.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {money(i.unitPrice)} each
              </Typography>
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

            <Typography sx={{ width: 88, textAlign: "right", fontWeight: 600 }}>
              {money(i.lineTotal)}
            </Typography>
          </Box>
        ))}
      </Stack>

      <Box sx={{ mt: 2 }}>
        <StoreTotalsPanel totals={totals} />
      </Box>
    </Paper>
  );
}
