// src/features/consultations/GeneralsHistoryTable.tsx
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { fieldHistory } from "./caseRecordRepo";
import type { GeneralsRecord } from "./caseRecordSchema";
import { generalsGroupsFor } from "./generalsFields";
import { clinicFeatures, type ClinicFeatures } from "../../lib/clinicType";
import { GROUP_ROW_SX, tableSx } from "./tableStyles";
import { formatDate } from "../../lib/dates";
import { CARD_SX, TOKENS } from "../../theme/theme";

const show = (v: unknown) =>
  typeof v === "number" ? formatDate(v) : String(v ?? "").trim();

// First column stays put while the visit columns scroll sideways.
const STICKY = {
  position: "sticky",
  left: 0,
  zIndex: 1,
  bgcolor: TOKENS.white,
  minWidth: 140,
} as const;

/**
 * Generals compared across visits: one row per recorded field, one column per
 * visit (newest first). A value that changed at that visit is bold; one
 * carried over unchanged is muted; nothing entered shows a dash.
 */
export default function GeneralsHistoryTable({
  list,
  features = clinicFeatures("homoeo"),
}: {
  list: GeneralsRecord[];
  features?: ClinicFeatures;
}) {
  const groups = generalsGroupsFor(features.homoeoGenerals)
    .map((g) => ({
      ...g,
      rows: g.fields
        .map((f) => ({
          ...f,
          changedAt: new Set(
            fieldHistory(list, f.key).map((e) => e.consultationId),
          ),
        }))
        .filter((f) => f.changedAt.size > 0),
    }))
    .filter((g) => g.rows.length > 0);
  if (groups.length === 0) return null;

  return (
    <Box sx={{ ...CARD_SX, overflow: "hidden" }}>
      <TableContainer>
        <Table size="small" sx={tableSx(false)}>
          <TableHead>
            <TableRow>
              <TableCell sx={STICKY}>Field</TableCell>
              {list.map((r, i) => (
                <TableCell
                  key={r.id}
                  sx={{
                    whiteSpace: "nowrap",
                    minWidth: 150,
                    color: i === 0 ? `${TOKENS.blue700} !important` : undefined,
                  }}
                >
                  {formatDate(r.date)}
                  {i === 0 ? " · latest" : ""}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {groups.flatMap((g, gi) => [
              ...(g.title
                ? [
                    <TableRow key={`group-${gi}`}>
                      <TableCell
                        sx={{
                          ...GROUP_ROW_SX,
                          ...STICKY,
                          bgcolor: TOKENS.blue50,
                        }}
                      >
                        {g.title}
                      </TableCell>
                      <TableCell colSpan={list.length} sx={GROUP_ROW_SX} />
                    </TableRow>,
                  ]
                : []),
              ...g.rows.map((f) => (
                <TableRow key={f.key}>
                  <TableCell sx={{ ...STICKY, fontWeight: 600, fontSize: 14 }}>
                    {f.label}
                  </TableCell>
                  {list.map((r) => {
                    const value = show(r[f.key]);
                    const changed = f.changedAt.has(r.consultationId);
                    return (
                      <TableCell
                        key={r.id}
                        sx={{
                          fontSize: 14,
                          whiteSpace: "pre-wrap",
                          fontWeight: changed ? 600 : 400,
                          color: value
                            ? changed
                              ? "text.primary"
                              : "text.secondary"
                            : "text.disabled",
                          bgcolor: changed ? TOKENS.blue50 : undefined,
                        }}
                      >
                        {value || "—"}
                      </TableCell>
                    );
                  })}
                </TableRow>
              )),
            ])}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
