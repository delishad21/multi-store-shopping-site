import { Box, Divider, Stack, Typography } from "@mui/material";
import { money } from "../lib/format";
import type { StoreTotals } from "../lib/types";

export default function StoreTotalsPanel({ totals }: { totals: StoreTotals }) {
  return (
    <Box
      sx={{
        p: 2,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <Stack spacing={0.5}>
        <Row k="Items subtotal" v={money(totals.itemsSubtotal)} />
        <Row k="Discounts" v={`- ${money(totals.itemsDiscount)}`} />
        <Divider />
        <Row k="Shipping" v={money(totals.shippingNet)} />
        <Row k="GST (9%)" v={money(totals.gst)} />
        <Divider />
        <Row k="Store total" v={money(totals.storeTotal)} strong />
      </Stack>
    </Box>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
      <Typography color="text.secondary">{k}</Typography>
      <Typography fontWeight={strong ? 700 : 500}>{v}</Typography>
    </Box>
  );
}
