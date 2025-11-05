import { Box, Divider, Stack, Typography } from "@mui/material";
import { money } from "../lib/format";
import type { StoreTotals } from "../lib/types";

/**
 * Renders totals with optional breakdown.
 * - Items subtotal / discounts / items net
 * - GST (items only)
 * - Shipping base / discount / to pay
 * - Store total
 */
export default function StoreTotalsPanel({
  totals,
  showBreakdown = true,
}: {
  totals: StoreTotals;
  showBreakdown?: boolean;
}) {
  const {
    itemsSubtotal,
    itemsDiscount,
    itemsNet,
    shippingBase,
    shippingDiscount,
    shippingNet,
    gst,
    storeTotal,
  } = totals;

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
        <Row k="Items subtotal" v={money(itemsSubtotal)} />

        {showBreakdown ? (
          <>
            <Row k="Item discounts" v={`- ${money(itemsDiscount)}`} />
            <Row k="Items net (after discounts)" v={money(itemsNet)} />
          </>
        ) : (
          <Row k="Discounts" v={`- ${money(itemsDiscount)}`} />
        )}

        <Row k="GST (items only)" v={money(gst)} />

        <Divider />

        {showBreakdown ? (
          <>
            <Row k="Shipping (base)" v={money(shippingBase)} />
            <Row k="Shipping discount" v={`- ${money(shippingDiscount)}`} />
            <Row k="Shipping to pay" v={money(shippingNet)} />
          </>
        ) : (
          <Row k="Shipping" v={money(shippingNet)} />
        )}

        <Divider />

        <Row k="Store total" v={money(storeTotal)} strong />
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
