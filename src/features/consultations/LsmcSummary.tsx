// src/features/consultations/LsmcSummary.tsx
import { Box, Typography } from "@mui/material";
import type { LsmcRow } from "./caseRecordSchema";
import { LINE, TOKENS } from "../../theme/theme";

type Row = Pick<LsmcRow, "location" | "sensation" | "modality" | "concomitant">;

const PARTS = [
  { key: "location", label: "Location" },
  { key: "sensation", label: "Sensation" },
  { key: "modality", label: "Modality" },
  { key: "concomitant", label: "Concomitant" },
] as const;

/**
 * Read-only LSMC. `boxes`: four tinted tiles per row (visit cards);
 * `lines`: label + value lines (narrow side panels, blank parts skipped).
 */
export default function LsmcSummary({
  rows,
  variant = "boxes",
}: {
  rows: Row[];
  variant?: "boxes" | "lines";
}) {
  if (rows.length === 0) return null;
  if (variant === "lines") {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {rows.map((r, i) => (
          <Box
            key={i}
            sx={{ display: "flex", flexDirection: "column", gap: 1, pt: i ? 1.5 : 0, borderTop: i ? LINE : "none" }}
          >
            {PARTS.filter((p) => r[p.key]).map((p) => (
              <Box key={p.key} sx={{ display: "flex", gap: 1.25, fontSize: 13 }}>
                <Box component="span" sx={{ width: 84, flex: "none", fontWeight: 700, color: TOKENS.blue700 }}>
                  {p.label}
                </Box>
                <Box component="span" sx={{ whiteSpace: "pre-wrap" }}>
                  {r[p.key]}
                </Box>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    );
  }
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {rows.map((r, i) => (
        <Box
          key={i}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "repeat(2, minmax(0,1fr))", sm: "repeat(4, minmax(0,1fr))" },
            gap: 1,
          }}
        >
          {PARTS.map((p) => (
            <Box
              key={p.key}
              sx={{ bgcolor: TOKENS.ground, borderRadius: "12px", px: 1.5, py: 1.25, display: "flex", flexDirection: "column", gap: 0.375 }}
            >
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: TOKENS.blue700 }}>{p.label}</Typography>
              <Typography
                sx={{ fontSize: 13, lineHeight: 1.4, whiteSpace: "pre-wrap", color: r[p.key] ? "text.primary" : "text.disabled" }}
              >
                {r[p.key] || "—"}
              </Typography>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
