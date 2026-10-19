// src/features/consultations/TableTextCell.tsx
import { Typography } from "@mui/material";

/** Table cell text; blank shows a light "—". */
export default function TableTextCell({
  value,
  strong,
}: {
  value: string;
  strong?: boolean;
}) {
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
