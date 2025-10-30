import {
  Card,
  CardMedia,
  CardContent,
  Typography,
  CardActions,
  Button,
  Box,
  IconButton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import DeleteIcon from "@mui/icons-material/Delete";
import type { Product, Store } from "../lib/types";
import { useCart, useCartForStore } from "../lib/useCart";
import { money } from "../lib/format";

export default function ProductCard({
  product,
  store,
}: {
  product: Product;
  store: Store;
}) {
  const { lines } = useCartForStore(store.id);
  const qty = lines[product.sku] || 0;
  const maxQ = store.constraints.maxQtyPerItem;
  const add = useCart((s: any) => s.add);
  const setQty = useCart((s: any) => s.setQty);
  const remove = useCart((s: any) => s.remove);

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          bgcolor: "background.default",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 1,
        }}
      >
        <CardMedia
          component="img"
          image={product.img}
          alt={product.name}
          loading="lazy"
          sx={{
            maxWidth: "100%",
            maxHeight: "100%",
            width: "auto",
            height: "auto",
            objectFit: "contain",
            display: "block",
          }}
          onError={(e: any) => {
            e.currentTarget.src = "/img/placeholder.png";
          }}
        />
      </Box>

      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="subtitle1" fontWeight={600} noWrap>
          {product.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {money(product.price)}
        </Typography>
      </CardContent>

      <CardActions sx={{ justifyContent: "space-between" }}>
        {qty === 0 ? (
          <Button
            variant="contained"
            onClick={() => add(store.id, product.sku, 1)}
          >
            Add
          </Button>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton
              size="small"
              onClick={() => setQty(store.id, product.sku, qty - 1)}
              aria-label="Decrease"
            >
              <RemoveIcon />
            </IconButton>
            <Typography>{qty}</Typography>
            <IconButton
              size="small"
              onClick={() =>
                setQty(store.id, product.sku, Math.min(maxQ, qty + 1))
              }
              aria-label="Increase"
            >
              <AddIcon />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={() => remove(store.id, product.sku)}
              aria-label="Remove"
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        )}
      </CardActions>
    </Card>
  );
}
