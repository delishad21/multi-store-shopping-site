import Grid from "@mui/material/Grid";
import { useParams } from "react-router-dom";
import { Typography, Alert, Stack } from "@mui/material";
import { useStore, useStoresList } from "../lib/useStores";
import ProductCard from "../components/ProductCard";
import { useCart } from "../lib/useCart";
import { priceStore } from "../lib/pricing";
import StoreTotalsPanel from "../components/StoreTotalsPanel";

export default function StorePage() {
  const { id } = useParams();
  const { store, productsBySku, loading, error } = useStore(id);
  const { gstRate } = useStoresList();
  const lines = useCart((s) => s.lines);

  if (loading) return <Typography>Loading store…</Typography>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!store) return null;

  const storeLines = Object.entries(lines[store.id] || {}).map(
    ([sku, qty]) => ({ sku, qty })
  );
  const totals = priceStore(
    productsBySku,
    storeLines,
    store.discounts,
    store.shipping.baseFee,
    gstRate
  );

  return (
    <Stack spacing={2}>
      {Array.isArray(store.alerts) && store.alerts.length > 0 && (
        <Stack spacing={1}>
          {store.alerts.map((a, idx) => (
            <Alert
              key={idx}
              severity={a.severity ?? "info"}
              variant="outlined"
              sx={{ borderRadius: 2 }}
            >
              {a.message}
            </Alert>
          ))}
          {store.showDiscountBreakdown === false && (
            <Alert
              severity="warning"
              variant="outlined"
              sx={{ borderRadius: 2 }}
            >
              The discount calculation system for the store is down. The overall
              discounts shown are still accurate, but per item discounts will
              not be shown.
            </Alert>
          )}
        </Stack>
      )}

      <Typography variant="h5" fontWeight={700}>
        {store.name}
      </Typography>

      <Grid container spacing={2}>
        {store.products.map((p) => (
          <Grid key={p.sku} size={{ xs: 6, md: 4, lg: 3 }}>
            <ProductCard product={p} store={store} />
          </Grid>
        ))}
      </Grid>

      <Alert severity="info">
        Quantities limited to {store.constraints.maxQtyPerItem} per item.
        Discounts and shipping are calculated per store; GST (
        {Math.round(gstRate * 100)}%) applies to items only
      </Alert>

      <StoreTotalsPanel
        totals={totals}
        showBreakdown={store.showDiscountBreakdown !== false}
      />
    </Stack>
  );
}
