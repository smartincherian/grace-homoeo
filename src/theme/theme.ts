import { createTheme, type Theme } from "@mui/material/styles";
import { DEFAULT_BRAND, brandCssVars, derivePalette } from "./brand";

// Design tokens from the Claude Design mockups: soft grey ground, white
// rounded cards with hairline borders, one bright blue accent.
export const TOKENS = {
  blue: "var(--brand)",
  blueHover: "var(--brand-hover)",
  blue50: "var(--brand-50)",
  blue100: "var(--brand-100)",
  blue200: "var(--brand-200)",
  blue700: "var(--brand-700)",
  ink: "#141a2e",
  muted: "#5b6480",
  faint: "#8a92a8",
  line: "#e6e9f2",
  ground: "#f5f7fc",
  white: "#ffffff",
  warnBg: "#fff3df",
  warn: "#8a5300",
  okBg: "#e6f7ef",
  ok: "#11714a",
  dangerBg: "#ffe8ec",
  danger: "#a8243c",
} as const;

export const LINE = `1px solid ${TOKENS.line}`;
export const BLUE_SHADOW = "0 6px 16px rgba(var(--brand-rgb), .28)";
export const GRADIENT =
  "linear-gradient(160deg, var(--brand), var(--brand-300))";

/** White rounded card with a hairline border — the main surface. */
export const CARD_SX = {
  bgcolor: TOKENS.white,
  border: LINE,
  borderRadius: "20px",
} as const;

/** Small muted caption above a value or a block. */
export const CAPTION_SX = {
  fontSize: 12,
  fontWeight: 600,
  color: TOKENS.muted,
} as const;

/** Rounded pill (filters, tags). */
export const PILL_SX = {
  display: "inline-flex",
  alignItems: "center",
  fontSize: 12,
  fontWeight: 600,
  px: 1.25,
  py: 0.5,
  borderRadius: "99px",
} as const;

// Avatar tile colours, picked by patient serial so a patient keeps theirs.
const AVATARS: [string, string][] = [
  [TOKENS.blue100, TOKENS.blue700],
  [TOKENS.okBg, TOKENS.ok],
  [TOKENS.warnBg, TOKENS.warn],
  ["#f3e8ff", "#6b2fb3"],
  [TOKENS.dangerBg, TOKENS.danger],
];
export const avatarColors = (n: number): [string, string] =>
  AVATARS[((n % AVATARS.length) + AVATARS.length) % AVATARS.length];

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || name.slice(0, 1).toUpperCase();

// Accent set for the few places that colour-code rows or stats.
export const JEWEL_ACCENTS = [
  TOKENS.blue,
  TOKENS.ok,
  TOKENS.warn,
  TOKENS.danger,
] as const;
export const accentFor = (index: number): string =>
  JEWEL_ACCENTS[
    ((index % JEWEL_ACCENTS.length) + JEWEL_ACCENTS.length) %
      JEWEL_ACCENTS.length
  ];

const HEADING = { fontWeight: 800, letterSpacing: "-0.02em" };

export function buildTheme(hex: string = DEFAULT_BRAND): Theme {
  const brand = derivePalette(hex);
  return createTheme({
    palette: {
      primary: {
        main: brand.main,
        dark: brand.hover,
        light: brand.s100,
        contrastText: TOKENS.white,
      },
      secondary: { main: TOKENS.ink },
      success: { main: TOKENS.ok, light: TOKENS.okBg },
      warning: { main: "#c77800", light: TOKENS.warnBg },
      error: { main: "#d02f4f", light: TOKENS.dangerBg },
      text: {
        primary: TOKENS.ink,
        secondary: TOKENS.muted,
        disabled: TOKENS.faint,
      },
      divider: TOKENS.line,
      background: { default: TOKENS.ground, paper: TOKENS.white },
      action: { hover: "#f7f9ff" },
    },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily: "'Archivo', system-ui, -apple-system, 'Segoe UI', sans-serif",
      fontSize: 14,
      h1: { ...HEADING, fontSize: 30 },
      h2: { ...HEADING, fontSize: 26 },
      h3: { ...HEADING, fontSize: 22 },
      h4: { ...HEADING, fontSize: 20 },
      h5: { ...HEADING, fontSize: 20 },
      h6: { ...HEADING, fontSize: 18 },
      subtitle1: { fontWeight: 700 },
      subtitle2: { fontWeight: 700 },
      overline: {
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0,
        textTransform: "none",
      },
      button: { fontWeight: 700, textTransform: "none", letterSpacing: 0 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ":root": brandCssVars(brand),
          body: { backgroundColor: TOKENS.ground },
          "::selection": { background: TOKENS.blue200 },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 14,
            minHeight: 42,
            paddingInline: 18,
            fontSize: 14,
          },
          sizeLarge: { minHeight: 48 },
          containedPrimary: {
            boxShadow: BLUE_SHADOW,
            "&:hover": {
              backgroundColor: TOKENS.blueHover,
              boxShadow: BLUE_SHADOW,
            },
          },
          outlined: {
            borderColor: TOKENS.line,
            backgroundColor: TOKENS.white,
            color: TOKENS.ink,
            "&:hover": {
              borderColor: TOKENS.line,
              backgroundColor: TOKENS.ground,
            },
          },
          text: {
            color: TOKENS.muted,
            "&:hover": { backgroundColor: TOKENS.ground },
          },
        },
      },
      MuiIconButton: { styleOverrides: { root: { borderRadius: 12 } } },
      MuiFab: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            boxShadow: BLUE_SHADOW,
            textTransform: "none",
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { rounded: { borderRadius: 20 } },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { borderRadius: 20, border: LINE } },
      },
      MuiCardContent: {
        styleOverrides: {
          root: { padding: 24, "&:last-child": { paddingBottom: 24 } },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 14,
            border: LINE,
            boxShadow: "0 12px 32px rgba(20,26,46,.12)",
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 24,
            boxShadow: "0 24px 60px rgba(20,26,46,.25)",
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundColor: TOKENS.ground,
            "& .MuiOutlinedInput-notchedOutline": { borderColor: TOKENS.line },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: TOKENS.blue200,
            },
            "&.Mui-focused": {
              backgroundColor: TOKENS.white,
              boxShadow: `0 0 0 4px ${TOKENS.blue100}`,
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: TOKENS.blue,
              borderWidth: 2,
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: { "&.Mui-focused": { color: TOKENS.blue700 } },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 99, fontWeight: 600 },
          sizeSmall: { fontSize: 12 },
        },
      },
      MuiAlert: { styleOverrides: { root: { borderRadius: 14 } } },
      MuiToggleButtonGroup: {
        styleOverrides: {
          root: {
            backgroundColor: TOKENS.ground,
            borderRadius: 14,
            padding: 4,
            gap: 4,
          },
          grouped: {
            border: 0,
            borderRadius: "10px !important",
            margin: 0,
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            fontWeight: 600,
            fontSize: 14,
            color: TOKENS.muted,
            border: 0,
            "&.Mui-selected, &.Mui-selected:hover": {
              backgroundColor: TOKENS.white,
              color: TOKENS.blue700,
              fontWeight: 700,
              boxShadow: "0 1px 3px rgba(20,26,46,.12)",
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottom: LINE },
          head: { fontSize: 12, fontWeight: 600, color: TOKENS.muted },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            "&:hover": { backgroundColor: TOKENS.ground },
          },
        },
      },
      MuiBottomNavigation: {
        styleOverrides: {
          root: { backgroundColor: TOKENS.white, borderTop: LINE, height: 64 },
        },
      },
      MuiBottomNavigationAction: {
        styleOverrides: {
          root: {
            color: TOKENS.muted,
            "&.Mui-selected": { color: TOKENS.blue700 },
            "&.Mui-selected .MuiSvgIcon-root": {
              backgroundColor: TOKENS.blue50,
              borderRadius: 99,
              padding: "2px 10px",
              boxSizing: "content-box",
            },
          },
          label: {
            fontWeight: 600,
            "&.Mui-selected": { fontSize: 12, fontWeight: 700 },
          },
        },
      },
      MuiSnackbarContent: { styleOverrides: { root: { borderRadius: 14 } } },
    },
  });
}

export const theme = buildTheme();
