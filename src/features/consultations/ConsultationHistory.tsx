// src/features/consultations/ConsultationHistory.tsx
import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import { Link } from "react-router-dom";
import ConsultationFields from "./ConsultationFields";
import type { Consultation } from "./consultationSchema";
import { daysAgoLabel, formatDate } from "../../lib/dates";
import dayjs from "dayjs";
import type { LsmcRow } from "./caseRecordSchema";
import LsmcSummary from "./LsmcSummary";
import { clinicFeatures, type ClinicFeatures } from "../../lib/clinicType";
import { CARD_SX, PILL_SX, TOKENS } from "../../theme/theme";
import { useClinicPath } from "../auth/useClinicPath";

interface Props {
  consultations: Consultation[];
  patientId: string;
  /** When given, a row click calls this instead of opening the details drawer. */
  onSelect?: (id: string) => void;
  /** The patient's LSMC rows; each visit card shows its own. */
  lsmc?: LsmcRow[];
  features?: ClinicFeatures;
}

export default function ConsultationHistory({
  consultations,
  patientId,
  onSelect,
  lsmc,
  features = clinicFeatures("homoeo"),
}: Props) {
  const cp = useClinicPath();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = consultations.find((c) => c.id === openId);

  const lsmcByVisit = new Map<string, LsmcRow[]>();
  for (const r of features.lsmc ? (lsmc ?? []) : []) {
    lsmcByVisit.set(r.consultationId, [
      ...(lsmcByVisit.get(r.consultationId) ?? []),
      r,
    ]);
  }
  const select = (id: string) => (onSelect ? onSelect(id) : setOpenId(id));

  return (
    <>
      <Box
        component="ul"
        sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1.75 }}
      >
        {consultations.map((c, i) => {
          const latest = i === 0;
          return (
            <Box component="li" key={c.id}>
              <Box
                role="button"
                tabIndex={0}
                onClick={() => select(c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    select(c.id);
                  }
                }}
                sx={{
                  ...CARD_SX,
                  p: { xs: 2, sm: "20px 22px" },
                  display: "grid",
                  gridTemplateColumns: { xs: "56px 1fr", sm: "72px 1fr" },
                  gap: { xs: 1.75, sm: 2.5 },
                  cursor: "pointer",
                  transition: "border-color .15s",
                  "&:hover": { borderColor: TOKENS.blue200 },
                  "&:focus-visible": { outline: `2px solid ${TOKENS.blue}`, outlineOffset: 2 },
                }}
              >
                <Box
                  sx={{
                    height: { xs: 56, sm: 72 },
                    borderRadius: "16px",
                    bgcolor: latest ? TOKENS.blue : TOKENS.ground,
                    color: latest ? TOKENS.white : TOKENS.ink,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Typography sx={{ fontSize: { xs: 20, sm: 24 }, fontWeight: 800, lineHeight: 1 }}>
                    {dayjs(c.date).format("D")}
                  </Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 600 }}>
                    {dayjs(c.date).format("MMM")}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary" }}>
                      {dayjs(c.date).format("YYYY")} · {daysAgoLabel(c.date)}
                    </Typography>
                    {c.diagnosis && (
                      <Box component="span" sx={{ ...PILL_SX, bgcolor: TOKENS.ground, py: 0.375 }}>
                        {c.diagnosis}
                      </Box>
                    )}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: { xs: 15, sm: 16 },
                      lineHeight: 1.5,
                      fontWeight: 500,
                      whiteSpace: "pre-wrap",
                      color: c.complaint ? "text.primary" : "text.disabled",
                    }}
                  >
                    {c.complaint || "No complaint recorded"}
                  </Typography>
                  <LsmcSummary rows={lsmcByVisit.get(c.id) ?? []} />
                  {c.remedy && (
                    <Box sx={{ alignSelf: "flex-start", px: 1.5, py: 1, borderRadius: "12px", bgcolor: TOKENS.blue50 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 14, color: TOKENS.blue700, whiteSpace: "pre-wrap" }}>
                        {c.remedy}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>

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
                    sx={{ bgcolor: "primary.light", color: "primary.dark" }}
                  />
                </Stack>
              </Box>
              <IconButton aria-label="Close" onClick={() => setOpenId(null)}>
                <CloseIcon />
              </IconButton>
            </Stack>
            <Box sx={{ p: 2 }}>
              <ConsultationFields c={open} features={features} />
              <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
                <Button
                  variant="contained"
                  component={Link}
                  to={cp(`/patients/${patientId}/consultations/${open.id}`)}
                >
                  Open
                </Button>
                <Button
                  startIcon={<EditIcon />}
                  variant="outlined"
                  component={Link}
                  to={cp(`/patients/${patientId}/consultations/${open.id}/edit`)}
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
