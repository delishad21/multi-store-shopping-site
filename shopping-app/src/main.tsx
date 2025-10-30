import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import App from "./App";
import Gallery from "./pages/Gallery";
import StorePage from "./pages/StorePage";
import Checkout from "./pages/Checkout";
import Receipt from "./pages/Receipt";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Gallery /> },
      { path: "store/:id", element: <StorePage /> },
      { path: "checkout", element: <Checkout /> },
      { path: "receipt", element: <Receipt /> },
    ],
  },
]);

const theme = createTheme({
  palette: { mode: "light", primary: { main: "#1976d2" } },
  components: {
    MuiButton: { styleOverrides: { root: { borderRadius: 12 } } },
    MuiCard: { styleOverrides: { root: { borderRadius: 16 } } },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RouterProvider router={router} />
    </ThemeProvider>
  </React.StrictMode>
);
