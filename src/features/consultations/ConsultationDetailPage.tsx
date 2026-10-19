// src/features/consultations/ConsultationDetailPage.tsx
import {
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Link, useParams } from "react-router-dom";
import { useConsultation, useConsultations } from "./useConsultations";
import ConsultationFields from "./ConsultationFields";
import ConsultationHistory from "./ConsultationHistory";
import QueryStates from "../../components/QueryStates";
import { useSetPageTitle } from "../../components/PageChrome";
import { daysAgoLabel, formatDate } from "../../lib/dates";
import { useClinicPath } from "../auth/useClinicPath";

export default function ConsultationDetailPage() {
  const cp = useClinicPath();
  const { patientId, cid } = useParams<{ patientId: string; cid: string }>();
  const { status, data: c } = useConsultation(cid);
  const { data: history } = useConsultations(patientId);
  // History is newest first, so everything after this visit is earlier.
  const all = history ?? [];
  const idx = all.findIndex((h) => h.id === cid);
  const previous = idx >= 0 ? all.slice(idx + 1) : [];
  const [showPrevious, setShowPrevious] = useState(false);
  useSetPageTitle("Consultation");

  return (
    <Box sx={{ maxWidth: 720, mx: "auto" }}>
      <QueryStates
        status={status}
        isEmpty={!c}
        emptyMessage="Consultation not found"
      >
        {c && (
          <Stack spacing={3}>
            {previous.length > 0 && (
              <Box>
                <ButtonBase
                  onClick={() => setShowPrevious((v) => !v)}
                  aria-expanded={showPrevious}
                  sx={{
                    width: "100%",
                    justifyContent: "space-between",
                    mb: 1,
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="h6">
                    Previous consultations ({previous.length})
                  </Typography>
                  <ExpandMoreIcon
                    sx={{
                      transition: "transform 0.2s",
                      transform: showPrevious ? "rotate(180deg)" : "none",
                    }}
                  />
                </ButtonBase>
                <Divider sx={{ mb: 1.5 }} />
                <Collapse in={showPrevious} unmountOnExit>
                  <ConsultationHistory
                    consultations={previous}
                    patientId={patientId ?? ""}
                  />
                </Collapse>
              </Box>
            )}
            <Card>
              <CardContent>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                >
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="h5">{formatDate(c.date)}</Typography>
                      <Chip
                        label={daysAgoLabel(c.date)}
                        size="small"
                        sx={{ bgcolor: "primary.light", color: "primary.dark" }}
                      />
                    </Stack>
                    <Typography color="text.secondary">
                      {c.patientName} · #{c.serialNo}
                    </Typography>
                    <Typography color="text.secondary">
                      ₹{c.amount} · {c.paymentMode}
                    </Typography>
                  </Box>
                  <Button
                    startIcon={<EditIcon />}
                    variant="outlined"
                    component={Link}
                    to={cp(`/patients/${patientId}/consultations/${cid}/edit`)}
                  >
                    Edit
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            <ConsultationFields c={c} />
          </Stack>
        )}
      </QueryStates>
    </Box>
  );
}
