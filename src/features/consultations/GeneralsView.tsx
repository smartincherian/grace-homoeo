// src/features/consultations/GeneralsView.tsx
import { Box, Stack, Typography } from "@mui/material";
import { isGeneralsBlank, type Generals } from "./caseRecordSchema";
import { GENERALS_GROUPS } from "./generalsFields";
import { formatDate } from "../../lib/dates";

function display(g: Generals, key: keyof Generals): string {
  if (key === "lmp") return g.lmp == null ? "" : formatDate(g.lmp);
  return String(g[key] ?? "").trim();
}

/** Read-only generals; blank fields and empty groups are hidden. */
export default function GeneralsView({ generals }: { generals: Generals }) {
  if (isGeneralsBlank(generals)) return null;

  return (
    <Stack spacing={2}>
      {GENERALS_GROUPS.map((group, gi) => {
        const filled = group.fields
          .map((f) => ({ ...f, value: display(generals, f.key) }))
          .filter((f) => f.value);
        if (filled.length === 0) return null;
        return (
          <Box key={group.title ?? gi}>
            {group.title && (
              <Typography
                variant="subtitle2"
                color="primary"
                sx={{ fontWeight: 700, mb: 0.5 }}
              >
                {group.title}
              </Typography>
            )}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                columnGap: 2,
                rowGap: 1,
              }}
            >
              {filled.map((f) => (
                <Box key={f.key}>
                  <Typography variant="overline" color="text.secondary">
                    {f.label}
                  </Typography>
                  <Typography sx={{ whiteSpace: "pre-wrap" }}>
                    {f.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}
