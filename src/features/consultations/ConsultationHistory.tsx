// src/features/consultations/ConsultationHistory.tsx
import { useState } from "react";
import {
  Box,
  Button,
  Card,
  Chip,
  Drawer,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import { Link } from "react-router-dom";
import ConsultationFields from "./ConsultationFields";
import type { Consultation } from "./consultationSchema";
import { daysAgoLabel, formatDate } from "../../lib/dates";
import { accentFor } from "../../theme/theme";

interface Props {
  consultations: Consultation[];
  patientId: string;
  /** When given, a row click calls this instead of opening the details drawer. */
  onSelect?: (id: string) => void;
}

// Columns hidden on phones so the table fits without sideways scrolling.
const WIDE_ONLY = { display: { xs: "none", sm: "table-cell" } };

// Header labels match the overline labels used on the cards above.
const TABLE_SX = {
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
  "& tbody tr": { cursor: "pointer" },
  "& tbody tr:hover": { bgcolor: "rgba(46,115,214,0.06) !important" },
  "& tbody tr:last-of-type td": { borderBottom: 0 },
};

function Cell({ value, strong }: { value: string; strong?: boolean }) {
  return value ? (
    <Typography
      sx={{ fontSize: 14, fontWeight: strong ? 600 : 400 }}
      color={strong ? "primary" : "text.primary"}
    >
      {value}
    </Typography>
  ) : (
    <Typography sx={{ fontSize: 14, color: "text.disabled" }}>—</Typography>
  );
}

export default function ConsultationHistory({
  consultations,
  patientId,
  onSelect,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = consultations.find((c) => c.id === openId);

  return (
    <>
      <Card>
        <TableContainer>
          <Table size="small" sx={TABLE_SX}>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell sx={WIDE_ONLY}>Complaint</TableCell>
                <TableCell>Diagnosis</TableCell>
                <TableCell>Prescription</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {consultations.map((c, i) => (
                <TableRow
                  key={c.id}
                  hover
                  onClick={() => (onSelect ? onSelect(c.id) : setOpenId(c.id))}
                >
                  <TableCell
                    sx={{
                      whiteSpace: "nowrap",
                      borderLeft: `3px solid ${accentFor(i)}`,
                    }}
                  >
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
                      {formatDate(c.date)}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                      {daysAgoLabel(c.date)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={WIDE_ONLY}>
                    <Cell value={c.complaint} />
                  </TableCell>
                  <TableCell>
                    <Cell value={c.diagnosis} />
                  </TableCell>
                  <TableCell>
                    <Cell value={c.remedy} strong />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Drawer
        anchor="right"
        open={!!open}
        onClose={() => setOpenId(null)}
        // Above the fixed AppBar (zIndex.drawer + 1), which otherwise hides the header.
        sx={{ zIndex: (t) => t.zIndex.modal }}
        PaperProps={{ sx: { width: { xs: "100%", sm: 440 } } }}
      >
        {open && (
          <Box role="dialog" aria-label="Consultation details">
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="flex-start"
              sx={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                bgcolor: "background.paper",
                borderBottom: 1,
                borderColor: "divider",
                p: 2,
              }}
            >
              <Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="h6">{formatDate(open.date)}</Typography>
                  <Chip
                    label={daysAgoLabel(open.date)}
                    size="small"
                    color="secondary"
                    variant="outlined"
                  />
                </Stack>
              </Box>
              <IconButton aria-label="Close" onClick={() => setOpenId(null)}>
                <CloseIcon />
              </IconButton>
            </Stack>
            <Box sx={{ p: 2 }}>
              <ConsultationFields c={open} />
              <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
                <Button
                  variant="contained"
                  component={Link}
                  to={`/patients/${patientId}/consultations/${open.id}`}
                >
                  Open
                </Button>
                <Button
                  startIcon={<EditIcon />}
                  variant="outlined"
                  component={Link}
                  to={`/patients/${patientId}/consultations/${open.id}/edit`}
                >
                  Edit
                </Button>
              </Stack>
            </Box>
          </Box>
        )}
      </Drawer>
    </>
  );
}
