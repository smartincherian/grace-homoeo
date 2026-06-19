import { createTheme } from "@mui/material/styles";

// Jewel accent set used for list-card left edges and Funds stat cards.
export const JEWEL_ACCENTS = [
  "#2E73D6",
  "#16A39B",
  "#C0496B",
  "#7A52C7",
] as const;
export const accentFor = (index: number): string =>
  JEWEL_ACCENTS[
    ((index % JEWEL_ACCENTS.length) + JEWEL_ACCENTS.length) %
      JEWEL_ACCENTS.length
  ];

const APPBAR_GRADIENT =
  "radial-gradient(120% 140% at 80% -20%, #2563B6 0%, #15307A 55%, #101C57 100%)";
const SOFT_SHADOW = "0 4px 14px rgba(30,50,120,0.07)";

export const theme = createTheme({
  palette: {
    primary: { main: "#150E56" },
    secondary: { main: "#0EA5E9" },
    success: { main: "#16A34A" },
    error: { main: "#C0496B" },
    background: { default: "#F4F6FB" },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: "'Inter','Roboto','Helvetica','Arial',sans-serif",
    h5: { fontWeight: 700, letterSpacing: 0.2 },
    h6: { fontWeight: 700 },
    overline: { fontWeight: 700, letterSpacing: 1.4 },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: APPBAR_GRADIENT,
          boxShadow: "0 2px 12px rgba(16,28,87,0.25)",
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { boxShadow: SOFT_SHADOW } },
    },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 14 } } },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          "&:hover": { backgroundColor: "rgba(46,115,214,0.06)" },
        },
      },
    },
  },
});
