import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: { main: "#150E56" },
    secondary: { main: "#0EA5E9" },
    background: { default: "#f6f7fb" },
  },
  shape: { borderRadius: 10 },
  typography: { fontFamily: "'Inter','Roboto','Helvetica','Arial',sans-serif" },
});
