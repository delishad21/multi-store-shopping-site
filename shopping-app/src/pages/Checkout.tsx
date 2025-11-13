// src/pages/Checkout.tsx
import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
  TextField,
  Chip,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import { useCart } from "../lib/useCart";
import { money } from "../lib/format";
import StoreCartCard from "../components/StoreCartCard";
import type { CalcEntry } from "../lib/types";
import CheckoutFormDialog, {
  type CheckoutFormValues,
} from "../components/CheckoutFormDialog";
import { useStoresList } from "../lib/useStores";
import type { DiscountCode } from "../lib/useStores";
import { APPS_SCRIPT_URL } from "../lib/config";
import PaymentDialog from "../components/PaymentDialog";

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function Checkout() {
  const { lines, clear } = useCart();
  const clearStore = useCart((s) => s.clearStore);
  const { classes, discountCodes, discountCap } = useStoresList();
  const nav = useNavigate();

  // ----- Cart --> per-store pricing -----
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

  // Grand total before overall discount codes
  const grandTotalRaw = Object.values(calcByStore).reduce(
    (a, s) => a + s.totals.storeTotal,
    0
  );

  const richItems = useMemo(
    () =>
      Object.values(calcByStore).flatMap((entry) =>
        (entry.totals.perItem ?? []).map((pi) => ({
          storeId: entry.store.id,
          storeName: entry.store.name,
          sku: pi.sku,
          name: pi.name,
          img: pi.img,
          qty: pi.qty,
          unitPrice: pi.unitPrice,
          originalLineTotal: pi.originalLineTotal,
          finalLineTotal: pi.finalLineTotal,
          discounts: pi.discounts ?? [],
          lineTotal: pi.finalLineTotal, // what Apps Script expects
        }))
      ),
    [calcByStore]
  );

  // ----- Overall discount codes -----
  const [codeInput, setCodeInput] = useState("");
  const [appliedCodes, setAppliedCodes] = useState<string[]>([]);
  const [codeError, setCodeError] = useState<string | null>(null);

  const normalise = (s: string) => s.trim().toLowerCase();

  const appliedCodeObjects = useMemo(
    () =>
      appliedCodes
        .map(
          (c) =>
            discountCodes.find((dc) => normalise(dc.code) === normalise(c)) as
              | DiscountCode
              | undefined
        )
        .filter((x): x is DiscountCode => Boolean(x)),
    [appliedCodes, discountCodes]
  );

  const handleApplyCode = () => {
    const raw = codeInput.trim();
    if (!raw) {
      setCodeError("Enter a discount code");
      return;
    }
    const match = discountCodes.find(
      (dc) => normalise(dc.code) === normalise(raw)
    );
    if (!match) {
      setCodeError("Code not recognised");
      return;
    }
    if (appliedCodes.some((c) => normalise(c) === normalise(match.code))) {
      setCodeError("Code already applied");
      return;
    }
    if (match.kind === "percent") {
      const alreadyPercent = appliedCodes.some((code) => {
        const dc = discountCodes.find(
          (d) => normalise(d.code) === normalise(code)
        );
        return dc?.kind === "percent";
      });
      if (alreadyPercent) {
        setCodeError("Only one percentage discount can be used");
        return;
      }
    }
    setAppliedCodes((prev) => [...prev, match.code]);
    setCodeInput("");
    setCodeError(null);
  };

  const handleRemoveCode = (code: string) => {
    setAppliedCodes((prev) =>
      prev.filter((c) => normalise(c) !== normalise(code))
    );
    setCodeError(null);
  };

  // Compute stacked discounts with a global cap
  const {
    grandBeforeCodes,
    percentCode,
    percentDiscountAmount,
    absoluteDiscountAmount,
    grandAfterCodes,
    capApplied,
  } = useMemo(() => {
    const grandBefore = round2(grandTotalRaw);

    if (grandBefore <= 0 || appliedCodeObjects.length === 0) {
      return {
        grandBeforeCodes: grandBefore,
        percentCode: undefined as DiscountCode | undefined,
        percentDiscountAmount: 0,
        absoluteDiscountAmount: 0,
        grandAfterCodes: grandBefore,
        capApplied: false,
      };
    }

    let pc: DiscountCode | undefined;
    const absCodes: DiscountCode[] = [];
    for (const dc of appliedCodeObjects) {
      if (dc.kind === "percent") pc = dc;
      else absCodes.push(dc);
    }

    const rawPercentAmt =
      pc && pc.amount > 0 ? round2((grandBefore * pc.amount) / 100) : 0;

    const rawAbsTotal = absCodes.reduce(
      (sum, dc) => sum + Math.max(0, dc.amount),
      0
    );

    const capAbsValue =
      discountCap && typeof discountCap.absoluteMax === "number"
        ? Math.max(0, discountCap.absoluteMax)
        : Number.POSITIVE_INFINITY;

    const capPercentValue =
      discountCap && typeof discountCap.percentMax === "number"
        ? Math.max(0, (grandBefore * discountCap.percentMax) / 100)
        : Number.POSITIVE_INFINITY;

    const maxAllowedTotal = Math.min(grandBefore, capAbsValue, capPercentValue);

    let usedPercent = rawPercentAmt;
    let usedAbs = rawAbsTotal;
    let capWasApplied = false;

    if (rawPercentAmt + rawAbsTotal > maxAllowedTotal) {
      capWasApplied = true;
      const totalCap = maxAllowedTotal;
      usedPercent = Math.min(rawPercentAmt, totalCap);
      const remainingCap = totalCap - usedPercent;
      usedAbs = Math.min(rawAbsTotal, Math.max(0, remainingCap));
    }

    const grandAfter = round2(Math.max(0, grandBefore - usedPercent - usedAbs));

    return {
      grandBeforeCodes: grandBefore,
      percentCode: pc,
      percentDiscountAmount: usedPercent,
      absoluteDiscountAmount: usedAbs,
      grandAfterCodes: grandAfter,
      capApplied: capWasApplied,
    };
  }, [grandTotalRaw, appliedCodeObjects, discountCap]);

  const overallDiscounts =
    appliedCodeObjects.length === 0 &&
    percentDiscountAmount === 0 &&
    absoluteDiscountAmount === 0
      ? undefined
      : {
          grandTotalBeforeDiscounts: grandBeforeCodes,
          grandTotalAfterDiscounts: grandAfterCodes,
          percentDiscountAmount,
          absoluteDiscountAmount,
          appliedCodes: appliedCodeObjects.map((dc) => ({
            code: dc.code,
            kind: dc.kind,
            amount: dc.amount,
            description: dc.description ?? "",
          })),
          capApplied,
          configuredCap: discountCap ?? null,
        };

  const effectiveGrandTotal = grandAfterCodes;

  // ----- New flow state: details first, payment second -----
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [buyer, setBuyer] = useState<CheckoutFormValues | null>(null);
  const [payOpen, setPayOpen] = useState(false);

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

      {/* GRAND TOTAL + DISCOUNT CODES */}
      <Paper sx={{ p: 2 }}>
        {/* Pre-discount total */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1,
          }}
        >
          <Typography color="text.secondary">
            Grand total (before codes)
          </Typography>
          <Typography fontWeight={600}>{money(grandBeforeCodes)}</Typography>
        </Box>

        {/* Discount code input */}
        {grandBeforeCodes > 0 && (
          <Box sx={{ mt: 1, mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Discount codes
            </Typography>
            <Box
              sx={{
                display: "flex",
                gap: 1,
                flexWrap: "wrap",
                alignItems: "start",
              }}
            >
              <TextField
                size="small"
                label="Enter code"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleApplyCode();
                  }
                }}
                error={!!codeError}
                helperText={codeError || " "}
              />
              <Button
                variant="outlined"
                size="medium"
                onClick={handleApplyCode}
              >
                Apply
              </Button>
            </Box>

            {appliedCodeObjects.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                {appliedCodeObjects.map((dc) => (
                  <Chip
                    key={dc.code}
                    label={
                      dc.kind === "percent"
                        ? `${dc.code} — ${dc.amount}% off`
                        : `${dc.code} — ${money(dc.amount)} off`
                    }
                    onDelete={() => handleRemoveCode(dc.code)}
                    size="small"
                  />
                ))}
              </Stack>
            )}
          </Box>
        )}

        {/* Discount summary */}
        {(percentDiscountAmount > 0 || absoluteDiscountAmount > 0) && (
          <Stack spacing={0.25} sx={{ mb: 1.5 }}>
            {percentDiscountAmount > 0 && (
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography color="text.secondary">
                  {percentCode
                    ? `Percent discount (${percentCode.code})`
                    : "Percent discount"}
                </Typography>
                <Typography color="success.main" fontWeight={600}>
                  − {money(percentDiscountAmount)}
                </Typography>
              </Box>
            )}
            {absoluteDiscountAmount > 0 && (
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography color="text.secondary">
                  Absolute discounts
                </Typography>
                <Typography color="success.main" fontWeight={600}>
                  − {money(absoluteDiscountAmount)}
                </Typography>
              </Box>
            )}
            {capApplied && (
              <Typography variant="body2" color="warning.main" sx={{ mt: 0.5 }}>
                You have exceeded the maximum discount limit. Your discount has
                been capped.
              </Typography>
            )}
          </Stack>
        )}

        {/* Final total after codes */}
        <Box
          sx={{
            mt: 1,
            pt: 1,
            borderTop: "1px solid",
            borderColor: "divider",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="h6">Grand Total</Typography>
          <Typography variant="h6" fontWeight={700}>
            {money(effectiveGrandTotal)}
          </Typography>
        </Box>

        <Box sx={{ mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Button
            variant="contained"
            size="large"
            disabled={richItems.length === 0}
            onClick={() => setDetailsOpen(true)} // details first
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

      {/* 1) Checkout details modal (name, class, justifications) */}
      <CheckoutFormDialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        onSubmit={(vals) => {
          setBuyer(vals);
          setDetailsOpen(false);
          setPayOpen(true); // open payment next
        }}
        items={richItems}
        classes={classes}
      />

      {/* 2) Payment modal (does Apps Script POST) */}
      <PaymentDialog
        open={payOpen && !!buyer}
        onClose={() => setPayOpen(false)}
        amount={effectiveGrandTotal}
        appsScriptUrl={APPS_SCRIPT_URL}
        items={richItems}
        perStoreTotals={Object.values(calcByStore).map((s) => ({
          storeId: s.store.id,
          storeName: s.store.name,
          itemsSubtotal: s.totals.itemsSubtotal,
          itemsDiscount: s.totals.itemsDiscount,
          itemsNet: s.totals.itemsNet,
          shippingBase: s.totals.shippingBase,
          shippingDiscount: s.totals.shippingDiscount,
          shippingNet: s.totals.shippingNet,
          gst: s.totals.gst,
          storeTotal: s.totals.storeTotal,
        }))}
        overallDiscounts={overallDiscounts}
        buyer={buyer ?? { name: "", className: "", justifications: [] }}
        onPaid={(payload) => {
          localStorage.setItem("last-order", JSON.stringify(payload));
          clear();
          setPayOpen(false);
          setBuyer(null);
          nav("/receipt");
        }}
      />
    </Stack>
  );
}
