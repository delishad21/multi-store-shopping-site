// src/components/PaymentDialog.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  TextField,
  Typography,
  Alert,
  LinearProgress,
} from "@mui/material";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { CheckoutFormValues } from "./CheckoutFormDialog";

/** Env-driven switch (Vite) */
export const USE_PROXY =
  import.meta.env.VITE_USE_PROXY === "true" || import.meta.env.PROD;
export const GAS_URL = String(import.meta.env.VITE_APPS_SCRIPT_URL || "");

/** Direct-to-GAS (dev) */
async function postToAppsScript(url: string, payload: unknown) {
  const body = JSON.stringify(payload);
  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    });
    return { ok: true };
  } catch (err) {
    console.error("[GAS] network error:", err);
    return { ok: false };
  }
}

/** Via same-origin proxy (prod) */
export async function postToAppsScriptViaProxy(payload: unknown) {
  const res = await fetch("/api/apps-script", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const ct = res.headers.get("content-type") || "";
  const body = ct.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text();
  return { ok: res.ok, body };
}

type OverallDiscountsSummary = {
  grandTotalBeforeDiscounts: number;
  grandTotalAfterDiscounts: number;
  percentDiscountAmount: number;
  absoluteDiscountAmount: number;
  appliedCodes: {
    code: string;
    kind: "percent" | "absolute";
    amount: number;
    description?: string;
  }[];
  capApplied?: boolean;
  configuredCap?: {
    absoluteMax?: number | null;
    percentMax?: number | null;
  } | null;
};

export type PostedItem = {
  storeId: string;
  storeName?: string;
  sku: string;
  name: string;
  img?: string;
  qty: number;
  unitPrice: number;
  originalLineTotal: number;
  finalLineTotal: number;
  discounts: { label: string; amount: number }[];
  lineTotal: number;
};

type GiftCardRow = { number: string; balance: number };
type GiftCardsFile = { cards: GiftCardRow[] };

const schema = z.object({
  cardNumber: z
    .string()
    .trim()
    .regex(/^\d{6,24}$/, "Enter 6–24 digits"),
});

export default function PaymentDialog({
  open,
  onClose,
  amount,
  /** Optional override for direct URL (mainly for dev/testing) */
  appsScriptUrl,
  items,
  perStoreTotals,
  overallDiscounts,
  buyer,
  onPaid,
}: {
  open: boolean;
  onClose: () => void;
  amount: number;
  appsScriptUrl?: string; // optional override; otherwise uses GAS_URL in dev
  items: PostedItem[];
  perStoreTotals: Array<{
    storeId: string;
    storeName?: string;
    itemsSubtotal: number;
    itemsDiscount: number;
    itemsNet: number;
    shippingBase: number;
    shippingDiscount: number;
    shippingNet: number;
    gst: number;
    storeTotal: number;
  }>;
  overallDiscounts?: OverallDiscountsSummary;
  buyer: CheckoutFormValues;
  onPaid: (payload: any) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<{ cardNumber: string }>({
    resolver: zodResolver(schema),
    defaultValues: { cardNumber: "" },
  });

  const [cards, setCards] = useState<GiftCardRow[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Load mock gift cards when modal opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoadErr(null);
      try {
        const res = await fetch("/stores/cards.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as GiftCardsFile;
        setCards(Array.isArray(data.cards) ? data.cards : []);
      } catch {
        setLoadErr("Failed to load cards.json");
        setCards([]);
      }
    })();
    reset({ cardNumber: "" });
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!cards) return;

    const cardNum = values.cardNumber.replace(/\s+/g, "");
    const found = cards.find((c) => String(c.number) === cardNum);

    if (!found) {
      setError("cardNumber", {
        type: "validate",
        message: "Gift card not found",
      });
      return;
    }

    if ((found.balance ?? 0) < amount) {
      setError("cardNumber", {
        type: "validate",
        message: `Insufficient balance (available S$${(
          found.balance ?? 0
        ).toFixed(2)})`,
      });
      return;
    }

    const balanceBefore = Number(found.balance ?? 0);
    const chargeAmount = Number(amount ?? 0);
    const balanceAfter = Number((balanceBefore - chargeAmount).toFixed(2));

    const paymentInfo = {
      giftCardNumber: cardNum,
      balanceBefore,
      chargeAmount,
      balanceAfter,
      authAt: new Date().toISOString(),
    };

    const payload = {
      name: buyer.name,
      className: buyer.className,
      justifications: buyer.justifications.map((j) => ({
        sku: j.sku,
        text: j.text,
      })),
      items,
      itemsByStore: items.reduce<Record<string, PostedItem[]>>((acc, it) => {
        const k = it.storeName || "Store";
        (acc[k] ??= []).push(it);
        return acc;
      }, {}),
      perStoreTotals,
      overallDiscounts,
      grandTotal: amount,
      paymentInfo,
      createdAt: new Date().toISOString(),
      idemKey: crypto?.randomUUID?.() ?? String(Date.now()),
    };

    // --- Env-driven posting decision ---
    let postedOk = true;

    if (USE_PROXY) {
      // Production: same-origin proxy
      const res = await postToAppsScriptViaProxy(payload);
      postedOk = res.ok;
      if (!res.ok) console.error("[GAS] proxy failed:", res.body);
    } else {
      // Development: direct to GAS (requires CORS ok on GAS)
      const directUrl = appsScriptUrl || GAS_URL;
      if (!directUrl) {
        console.error("[GAS] Missing VITE_APPS_SCRIPT_URL or appsScriptUrl");
        postedOk = false;
      } else {
        const res = await postToAppsScript(directUrl, payload);
        postedOk = res.ok;
      }
    }

    if (!postedOk) {
      setError("cardNumber", {
        type: "validate",
        message: "Failed to record payment. Please try again.",
      });
      return;
    }

    onPaid(payload);
  });

  const prettyAmount = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "SGD",
      }).format(amount ?? 0),
    [amount]
  );

  return (
    <Dialog
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>Redeem Gift Card</DialogTitle>
      <DialogContent dividers>
        <Stack
          spacing={2}
          component="form"
          id="payment-form"
          onSubmit={onSubmit}
        >
          <Typography variant="body2" color="text.secondary">
            Amount to pay: <strong>{prettyAmount}</strong>
          </Typography>

          {loadErr && <Alert severity="error">{loadErr}</Alert>}
          {!cards && <LinearProgress />}

          <TextField
            label="Gift card number"
            placeholder="e.g. 777700000001"
            {...register("cardNumber")}
            error={!!errors.cardNumber}
            helperText={errors.cardNumber?.message || " "}
            inputMode="numeric"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="payment-form"
          variant="contained"
          disabled={isSubmitting || !cards}
        >
          {isSubmitting ? "Processing…" : "Redeem & Pay"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
