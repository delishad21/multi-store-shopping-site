import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Tabs,
  Tab,
  Badge,
} from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { useStoresList } from "./lib/useStores";
import { useCartTotals } from "./lib/useCart";

export default function App() {
  const { stores, siteTitle } = useStoresList();
  const { totalQty } = useCartTotals();
  const nav = useNavigate();
  const loc = useLocation();

  const currentStoreId = loc.pathname.startsWith("/store/")
    ? loc.pathname.split("/").at(-1)
    : null;

  const tabValue = stores.some((s) => s.id === currentStoreId)
    ? currentStoreId
    : false;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppBar position="sticky">
        <Toolbar>
          <Typography
            variant="h6"
            sx={{ flexGrow: 1 }}
            component={Link}
            to="/"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            {siteTitle}
          </Typography>
          <IconButton
            color="inherit"
            onClick={() => nav("/checkout")}
            aria-label="Checkout"
          >
            <Badge badgeContent={totalQty} color="secondary">
              <ShoppingCartIcon />
            </Badge>
          </IconButton>
        </Toolbar>

        <Tabs
          value={tabValue}
          onChange={(e, v) => nav(`/store/${v}`)}
          variant="scrollable"
          scrollButtons
          allowScrollButtonsMobile
          textColor="inherit"
          sx={{
            px: 1,
            "& .MuiTab-root": {
              color: "rgba(255,255,255,0.75)",
              textTransform: "none",
              minHeight: 48,
            },
            "& .Mui-selected": {
              color: "#fff",
            },
          }}
        >
          {stores.map((s) => (
            <Tab key={s.id} label={s.name} value={s.id} disableRipple />
          ))}
        </Tabs>
      </AppBar>

      <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 } }}>
        <Outlet />
      </Box>
    </Box>
  );
}
