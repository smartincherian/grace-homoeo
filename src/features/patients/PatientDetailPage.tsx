// src/features/patients/PatientDetailPage.tsx
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import { Link, useNavigate, useParams } from "react-router-dom";
import { usePatient } from "./usePatients";
import { useConsultations } from "../consultations/useConsultations";
import ConsultationHistory from "../consultations/ConsultationHistory";
import QueryStates from "../../components/QueryStates";
import AddButton from "../../components/AddButton";
import { useSetPageTitle } from "../../components/PageChrome";
import { calcAge, daysAgoLabel, formatDate } from "../../lib/dates";

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: patient } = usePatient(id);
  const { status, data: consultations } = useConsultations(id);
  useSetPageTitle(patient?.name ?? "Patient");
  // useConsultations returns newest first.
  const latest = consultations?.[0];

  if (!patient) {
    return (
      <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
        Loading patient…
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "60vh",
        maxWidth: 720,
        mx: "auto",
      }}
    >
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="flex-start"
          >
            <Box>
              <Typography variant="h5">
                {patient.name} · #{patient.serialNo}
              </Typography>
              <Typography color="text.secondary">
                {calcAge(patient.dob)} yrs · {patient.gender}
                {patient.place ? ` · ${patient.place}` : ""}
              </Typography>
              {patient.phone && (
                <Typography color="text.secondary">
                  📞 {patient.phone}
                </Typography>
              )}
            </Box>
            <Button
              startIcon={<EditIcon />}
              variant="outlined"
              component={Link}
              to={`/patients/${id}/edit`}
            >
              Edit
            </Button>
          </Stack>
          {latest && (
            <>
              <Divider sx={{ my: 2 }} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="overline" color="text.secondary">
                    Last consultation
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ fontWeight: 600 }}>
                      {formatDate(latest.date)}
                    </Typography>
                    <Chip
                      label={daysAgoLabel(latest.date)}
                      size="small"
                      color="secondary"
                      variant="outlined"
                    />
                  </Stack>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="overline" color="text.secondary">
                    Last prescribed
                  </Typography>
                  <Typography sx={{ fontWeight: 600 }}>
                    {latest.remedy || "—"}
                  </Typography>
                </Box>
              </Stack>
            </>
          )}
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ mb: 1 }}>
        Consultation history
      </Typography>
      <Divider sx={{ mb: 1.5 }} />
      <QueryStates
        status={status}
        isEmpty={(consultations ?? []).length === 0}
        emptyMessage="No consultations yet"
      >
        <ConsultationHistory
          consultations={consultations ?? []}
          patientId={id ?? ""}
          onSelect={(cid) => navigate(`/patients/${id}/consultations/${cid}`)}
        />
      </QueryStates>

      <AddButton
        label="Add consultation"
        to={`/patients/${id}/consultations/new`}
      />
    </Box>
  );
}
