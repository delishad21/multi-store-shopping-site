import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { money } from "../lib/format";

type Payload = {
  name: string;
  className: string;
  justifications: { sku: string; text: string }[];
  items: {
    sku: string;
    name: string;
    img?: string;
    storeName?: string;
    qty?: number;
    unitPrice?: number;
    lineTotal?: number;
  }[];
  perStoreTotals: {
    storeId: string;
    storeName?: string;
    itemsSubtotal: number;
    itemsDiscount: number;
    shippingNet: number;
    gst: number;
    storeTotal: number;
  }[];
  grandTotal: number;
  createdAt: string;
};

export default function Receipt() {
  const [payload, setPayload] = useState<Payload | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("last-order");
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Payload;
        if (!parsed.createdAt) parsed.createdAt = new Date().toISOString();
        setPayload(parsed);
      } catch {
        // ignore parse error
      }
      localStorage.removeItem("last-order");
    }
  }, []);

  const bySku = useMemo(() => {
    const m: Record<string, Payload["items"][number]> = {};
    if (!payload) return m;
    for (const it of payload.items) {
      if (!(it.sku in m)) m[it.sku] = it;
    }
    return m;
  }, [payload]);

  const itemsByStore = useMemo(() => {
    const m: Record<string, Payload["items"]> = {};
    if (!payload) return m;
    for (const it of payload.items) {
      const k = it.storeName || "Store";
      (m[k] ??= []).push(it);
    }
    return m;
  }, [payload]);

  if (!payload) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700}>
          No recent order found
        </Typography>
        <Typography color="text.secondary">
          Make a purchase to see a receipt here.
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h5" fontWeight={800}>
        Receipt
      </Typography>

      {/* Buyer summary */}
      <Paper sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.25}
          alignItems={{ sm: "center" }}
          justifyContent="space-between"
        >
          <Box>
            <Typography>
              <strong>Name:</strong> {payload.name}
            </Typography>
            <Typography>
              <strong>Class:</strong> {payload.className}
            </Typography>
          </Box>
          <Chip
            label={
              "Created: " +
              new Date(payload.createdAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })
            }
            variant="outlined"
          />
        </Stack>
      </Paper>

      {payload.justifications.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Your Justified Picks
          </Typography>

          <Stack
            spacing={1.5}
            sx={{
              "& > div": {
                borderBottom: "1px dashed",
                borderColor: "divider",
                pb: 1.25,
              },
              "& > div:last-of-type": { borderBottom: "none", pb: 0 },
            }}
          >
            {payload.justifications.map((j, idx) => {
              const ref = bySku[j.sku];
              return (
                <Box
                  key={`${j.sku}-${idx}`}
                  sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}
                >
                  <Avatar
                    variant="rounded"
                    src={ref?.img}
                    alt={ref?.name || j.sku}
                    sx={{ width: 56, height: 56, bgcolor: "action.hover" }}
                  />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="baseline"
                      flexWrap="wrap"
                    >
                      <Typography
                        fontWeight={700}
                        noWrap
                        title={ref?.name || j.sku}
                      >
                        {ref?.name || j.sku}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 0.5 }}
                        noWrap
                      >
                        {ref?.storeName ? `(${ref.storeName})` : ""}
                      </Typography>
                    </Stack>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.25, whiteSpace: "pre-wrap" }}
                    >
                      {j.text}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </Paper>
      )}

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Items by Store
        </Typography>

        <Stack spacing={2}>
          {Object.entries(itemsByStore).map(([store, items]) => (
            <Box key={store}>
              <Typography
                fontWeight={800}
                sx={{ mb: 1, letterSpacing: 0.2 }}
                variant="subtitle1"
              >
                {store}
              </Typography>

              <Stack spacing={1}>
                {items.map((i) => (
                  <Box
                    key={`${store}-${i.sku}`}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "64px 1fr auto",
                      alignItems: "center",
                      gap: 1,
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
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: 1,
                        objectFit: "cover",
                        bgcolor: "action.hover",
                      }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap title={i.name} fontWeight={600}>
                        {i.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {(i.qty ?? 0) + " × "}
                        {typeof i.unitPrice === "number"
                          ? money(i.unitPrice)
                          : "-"}
                      </Typography>
                    </Box>
                    <Typography
                      sx={{ textAlign: "right", fontWeight: 700, minWidth: 88 }}
                    >
                      {typeof i.lineTotal === "number"
                        ? money(i.lineTotal)
                        : ""}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>

        {payload.perStoreTotals?.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" fontWeight={700}>
              Store Totals
            </Typography>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {payload.perStoreTotals.map((s) => (
                <Box
                  key={s.storeId}
                  sx={{ display: "flex", justifyContent: "space-between" }}
                >
                  <Typography>
                    {s.storeName || s.storeId}
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 1 }}
                    >
                      (Incl. shipping & GST)
                    </Typography>
                  </Typography>
                  <Typography fontWeight={800}>
                    {money(s.storeTotal)}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </>
        )}

        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="h6">Grand Total</Typography>
          <Typography variant="h6" fontWeight={800}>
            {money(payload.grandTotal)}
          </Typography>
        </Box>
      </Paper>
    </Stack>
  );
}
