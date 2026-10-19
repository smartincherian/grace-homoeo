// src/features/consultations/LsmcTable.tsx
import {
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { LsmcRow } from "./caseRecordSchema";
import { tableSx } from "./tableStyles";
import Cell from "./TableTextCell";
import { formatDate } from "../../lib/dates";

interface Props {
  rows: LsmcRow[];
  /** Adds a Visit column (patient page lists rows across visits). */
  showDate?: boolean;
  onSelect?: (consultationId: string) => void;
}

/** Read-only Location / Sensation / Modality / Concomitant table. */
export default function LsmcTable({ rows, showDate, onSelect }: Props) {
  if (rows.length === 0) return null;

  return (
    <Card>
      <TableContainer>
        <Table size="small" sx={tableSx(!!onSelect)}>
          <TableHead>
            <TableRow>
              {showDate && <TableCell>Visit</TableCell>}
              <TableCell>Location</TableCell>
              <TableCell>Sensation</TableCell>
              <TableCell>Modality</TableCell>
              <TableCell>Concomitant</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={r.id}
                hover={!!onSelect}
                onClick={
                  onSelect ? () => onSelect(r.consultationId) : undefined
                }
              >
                {showDate && (
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
                      {formatDate(r.date)}
                    </Typography>
                  </TableCell>
                )}
                <TableCell>
                  <Cell value={r.location} strong />
                </TableCell>
                <TableCell>
                  <Cell value={r.sensation} />
                </TableCell>
                <TableCell>
                  <Cell value={r.modality} />
                </TableCell>
                <TableCell>
                  <Cell value={r.concomitant} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}
