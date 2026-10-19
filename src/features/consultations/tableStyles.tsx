// src/features/consultations/tableStyles.tsx
// Shared look for the consultation-history and LSMC tables.
import { Typography } from "@mui/material";

// Columns hidden on phones so the table fits without sideways scrolling.
export const WIDE_ONLY = { display: { xs: "none", sm: "table-cell" } };

// Header labels match the overline labels used on the cards above.
export function tableSx(clickable: boolean) {
  return {
    "& th": {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: "text.secondary",
      bgcolor: "rgba(46,115,214,0.04)",
      py: 1.25,
    },
    "& td": { py: 1.25, verticalAlign: "top" },
    "& tbody tr:last-of-type td": { borderBottom: 0 },
    ...(clickable && {
      "& tbody tr": { cursor: "pointer" },
      "& tbody tr:hover": { bgcolor: "rgba(46,115,214,0.06) !important" },
    }),
  };
}

export function Cell({ value, strong }: { value: string; strong?: boolean }) {
  return value ? (
    <Typography
      sx={{
        fontSize: 14,
        fontWeight: strong ? 600 : 400,
        whiteSpace: "pre-wrap",
      }}
      color={strong ? "primary" : "text.primary"}
    >
      {value}
    </Typography>
  ) : (
    <Typography sx={{ fontSize: 14, color: "text.disabled" }}>—</Typography>
  );
}
