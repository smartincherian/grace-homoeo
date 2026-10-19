// src/features/consultations/FieldHistoryCell.tsx
import { Box, Typography } from "@mui/material";
import type { FieldEntry } from "./caseRecordRepo";
import { formatDate } from "../../lib/dates";

const show = (v: FieldEntry["value"]) =>
  typeof v === "number" ? formatDate(v) : v;

/** Present value (bold, with its date) and earlier values beneath it. */
export default function FieldHistoryCell({
  entries,
}: {
  entries: FieldEntry[];
}) {
  if (entries.length === 0) {
    return (
      <Typography sx={{ fontSize: 14, color: "text.disabled" }}>—</Typography>
    );
  }
  const [present, ...earlier] = entries;
  return (
    <Box>
      <Typography
        sx={{ fontSize: 14, fontWeight: 600, whiteSpace: "pre-wrap" }}
      >
        {show(present.value)}
      </Typography>
      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
        {formatDate(present.date)}
      </Typography>
      {earlier.map((e) => (
        <Box
          key={`${e.consultationId}-${e.date}`}
          sx={{ mt: 0.75, opacity: 0.75 }}
        >
          <Typography sx={{ fontSize: 13, whiteSpace: "pre-wrap" }}>
            {show(e.value)}
          </Typography>
          <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
            {formatDate(e.date)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
