import { useEffect, useMemo } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
  LinearProgress,
} from "@mui/material";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

async function postToAppsScript(url: string, payload: unknown) {
  const body = JSON.stringify(payload);
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 15000);

  console.log("[GAS] POST →", url, payload);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
      signal: ac.signal,
    });
    const text = await res.text().catch(() => "<no text>");
    console.log("[GAS] status:", res.status, "ok:", res.ok, "body:", text);
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { ok: res.ok, status: res.status, text, json };
  } catch (err) {
    console.error("[GAS] network error:", err);
    return { ok: false, status: 0, text: String(err), json: null };
  } finally {
    clearTimeout(timeout);
  }
}

type JustEntry = { sku: string; text: string };

export type CheckoutFormValues = {
  name: string;
  className: string;
  justifications: JustEntry[]; // ≤ 3
};

export type CheckoutItem = {
  sku: string;
  name: string;
  img?: string;
  storeName?: string;
  qty?: number;
  unitPrice?: number;
  lineTotal?: number;
};

const baseSchema = z.object({
  name: z.string().min(1, "Required"),
  className: z.string().min(1, "Required"),
  justifications: z.array(
    z.object({
      sku: z.string().min(1, "Pick a product"),
      text: z.string().min(1, "Tell us why"),
    })
  ),
});

export default function CheckoutFormDialog({
  open,
  onClose,
  onSubmit,
  items,
  classes,
  appsScriptUrl,
  grandTotal,
  perStoreTotals,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CheckoutFormValues) => void;
  items: CheckoutItem[];
  classes: string[];
  appsScriptUrl?: string;
  grandTotal?: number;
  perStoreTotals?: Array<{
    storeId: string;
    storeName?: string;
    itemsSubtotal: number;
    itemsDiscount: number;
    shippingNet: number;
    gst: number;
    storeTotal: number;
  }>;
}) {
  const uniqueSkus = useMemo(
    () =>
      Array.from(
        new Set(items.filter((i) => (i.qty ?? 0) > 0).map((i) => i.sku))
      ),
    [items]
  );
  const justifyCount = Math.min(3, uniqueSkus.length);

  const schema = useMemo(
    () =>
      baseSchema.extend({
        justifications: baseSchema.shape.justifications
          .min(justifyCount > 0 ? 1 : 0, "Pick at least one item to justify")
          .max(3, "At most 3 justifications"),
      }),
    [justifyCount]
  );

  const defaultJustifications = useMemo<JustEntry[]>(
    () =>
      Array.from({ length: justifyCount }).map((_, i) => ({
        sku: uniqueSkus[i] ?? "",
        text: "",
      })),
    [uniqueSkus, justifyCount]
  );

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      className: "",
      justifications: defaultJustifications,
    },
    values: open
      ? {
          name: "",
          className: "",
          justifications: defaultJustifications,
        }
      : undefined,
  });

  useEffect(() => {
    if (open) {
      reset({
        name: "",
        className: "",
        justifications: defaultJustifications,
      });
    }
  }, [open, reset, defaultJustifications]);

  const chosenSkus = watch("justifications").map((j) => j.sku);
  const optionDisabled = (sku: string, idx: number) =>
    sku !== "" && chosenSkus.some((s, i) => i !== idx && s === sku);

  const bySku = useMemo(
    () => Object.fromEntries(items.map((i) => [i.sku, i] as const)),
    [items]
  );

  const MenuProps = useMemo(
    () => ({
      PaperProps: { style: { maxHeight: 360 } },
      MenuListProps: { dense: true },
      keepMounted: true,
      autoFocus: false,
    }),
    []
  );

  const renderOptionRow = (opt: CheckoutItem) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
      <Box
        component="img"
        src={opt.img}
        alt={opt.name}
        loading="lazy"
        referrerPolicy="no-referrer"
        sx={{
          width: 36,
          height: 36,
          borderRadius: 0.75,
          objectFit: "cover",
          flexShrink: 0,
          bgcolor: "action.hover",
        }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Typography noWrap fontWeight={600} title={opt.name}>
          {opt.name}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          title={opt.storeName}
        >
          ({opt.storeName || "Store"})
        </Typography>
      </Box>
      <Box sx={{ ml: "auto", pl: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {(opt.qty ?? 0) + "×"}
        </Typography>
      </Box>
    </Box>
  );

  const computeItemsByStore = (list: CheckoutItem[]) => {
    const out: Record<string, CheckoutItem[]> = {};
    for (const i of list) {
      const k = i.storeName || "Store";
      (out[k] ??= []).push(i);
    }
    return out;
  };

  const submitHandler = handleSubmit(async (values) => {
    const justifications = values.justifications
      .filter((j) => j.sku && j.text.trim())
      .slice(0, 3);

    const payload = {
      name: values.name,
      className: values.className,
      justifications,
      items,
      itemsByStore: computeItemsByStore(items),
      perStoreTotals, // ✅ now included
      grandTotal,
      createdAt: new Date().toISOString(),
      // Optional: idempotency key to dedupe retries server-side
      idemKey: crypto?.randomUUID?.() ?? String(Date.now()),
    };

    if (appsScriptUrl && !isSubmitting) {
      const result = await postToAppsScript(appsScriptUrl, payload);
      if (!result.ok) {
        alert(
          `Failed to submit to Google (status ${result.status}). Check console for details.`
        );
      }
    }

    onSubmit({ ...values, justifications });
  });

  return (
    <Dialog
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>
        Checkout details
        {isSubmitting && <LinearProgress sx={{ mt: 1 }} />}
      </DialogTitle>

      <DialogContent dividers>
        <Stack
          component="form"
          id="checkout-form"
          spacing={2}
          onSubmit={submitHandler}
          sx={{
            mt: 1,
            opacity: isSubmitting ? 0.6 : 1,
            pointerEvents: isSubmitting ? "none" : "auto",
          }}
        >
          <TextField
            label="Name"
            {...register("name")}
            error={!!errors.name}
            helperText={errors.name?.message}
            fullWidth
          />

          <TextField
            label="Class"
            select
            {...register("className")}
            error={!!errors.className}
            helperText={errors.className?.message}
            fullWidth
          >
            {classes.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </TextField>

          <Divider textAlign="left">
            Justify {justifyCount === 0 ? 0 : justifyCount} chosen product
            {justifyCount > 1 ? "s" : ""}
          </Divider>

          {Array.from({ length: justifyCount }).map((_, idx) => (
            <Box key={idx} sx={{ display: "grid", gap: 1 }}>
              <Controller
                control={control}
                name={`justifications.${idx}.sku`}
                render={({ field }) => (
                  <TextField
                    select
                    label={`Product #${idx + 1}`}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    error={!!errors.justifications?.[idx]?.sku}
                    helperText={errors.justifications?.[idx]?.sku?.message}
                    fullWidth
                    SelectProps={{
                      MenuProps,
                      renderValue: (sku) => {
                        const opt = bySku[sku as string];
                        if (!opt) return <em>Select a product…</em>;
                        return renderOptionRow(opt);
                      },
                    }}
                  >
                    <MenuItem value="">
                      <em>Select a product…</em>
                    </MenuItem>
                    {items.map((opt) => (
                      <MenuItem
                        key={opt.sku}
                        value={opt.sku}
                        disabled={optionDisabled(opt.sku, idx)}
                      >
                        {renderOptionRow(opt)}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />

              <TextField
                label="Why did you pick this?"
                {...register(`justifications.${idx}.text` as const)}
                error={!!errors.justifications?.[idx]?.text}
                helperText={errors.justifications?.[idx]?.text?.message}
                multiline
                minRows={2}
                fullWidth
              />
            </Box>
          ))}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          Back
        </Button>
        <Button
          type="submit"
          form="checkout-form"
          variant="contained"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting…" : "Submit Order"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
