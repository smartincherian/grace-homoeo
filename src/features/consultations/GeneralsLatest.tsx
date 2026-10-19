// src/features/consultations/GeneralsLatest.tsx
import { Box, Typography } from "@mui/material";
import { fieldHistory } from "./caseRecordRepo";
import type { GeneralsRecord } from "./caseRecordSchema";
import { GENERALS_GROUPS } from "./generalsFields";
import { formatDate } from "../../lib/dates";
import { LINE, TOKENS } from "../../theme/theme";

const show = (v: string | number) =>
  typeof v === "number" ? formatDate(v) : v;

/**
 * Each general's latest value, grouped, with no per-field dates. `list` is the
 * patient's generals snapshots, newest first. Renders nothing when empty.
 */
export default function GeneralsLatest({ list }: { list: GeneralsRecord[] }) {
  const groups = GENERALS_GROUPS.map((g) => ({
    ...g,
    rows: g.fields
      .map((f) => ({ ...f, latest: fieldHistory(list, f.key)[0] }))
      .filter((f) => f.latest),
  })).filter((g) => g.rows.length > 0);
  if (groups.length === 0) return null;

  return (
    <Box>
      {groups.map((g, gi) => (
        <Box key={g.title ?? gi} sx={{ pt: gi ? 1.5 : 0 }}>
          {g.title && (
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 700,
                color: TOKENS.blue700,
                pb: 0.75,
              }}
            >
              {g.title}
            </Typography>
          )}
          <Box
            component="dl"
            sx={{
              m: 0,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "160px 1fr" },
              columnGap: 2,
            }}
          >
            {g.rows.map((f, i) => (
              <Box key={f.key} sx={{ display: "contents" }}>
                <Typography
                  component="dt"
                  sx={{
                    fontSize: 13,
                    color: "text.secondary",
                    pt: { xs: i ? 1.25 : 0, sm: 1 },
                    pb: { sm: 1 },
                    borderTop: { sm: i ? LINE : "none" },
                  }}
                >
                  {f.label}
                </Typography>
                <Typography
                  component="dd"
                  sx={{
                    m: 0,
                    fontSize: 14,
                    fontWeight: 600,
                    whiteSpace: "pre-wrap",
                    py: { sm: 1 },
                    borderTop: { sm: i ? LINE : "none" },
                  }}
                >
                  {show(f.latest.value)}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
