// src/features/patients/PatientDetailPage.tsx
import {
  Box, Button, Card, CardContent, Divider, Fab, Stack, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import { Link, useNavigate, useParams } from "react-router-dom";
import { usePatient } from "./usePatients";
import { useConsultations } from "../consultations/useConsultations";
import ConsultationTimeline from "../consultations/ConsultationTimeline";
import QueryStates from "../../components/QueryStates";
import { calcAge } from "../../lib/dates";

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: patient } = usePatient(id);
  const { status, data: consultations } = useConsultations(id);

  if (!patient) {
    return <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>Loading patient…</Typography>;
  }

  return (
    <Box sx={{ position: "relative", minHeight: "60vh", maxWidth: 720, mx: "auto" }}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h5">{patient.name} · #{patient.serialNo}</Typography>
              <Typography color="text.secondary">
                {calcAge(patient.dob)} yrs · {patient.gender}
                {patient.place ? ` · ${patient.place}` : ""}
              </Typography>
              {patient.phone && <Typography color="text.secondary">📞 {patient.phone}</Typography>}
            </Box>
            <Button startIcon={<EditIcon />} component={Link} to={`/patients/${id}/edit`}>Edit</Button>
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ mb: 1 }}>Consultation history</Typography>
      <Divider sx={{ mb: 1 }} />
      <QueryStates status={status} isEmpty={(consultations ?? []).length === 0} emptyMessage="No consultations yet">
        <ConsultationTimeline
          consultations={consultations ?? []}
          onSelect={(cid) => navigate(`/patients/${id}/consultations/${cid}/edit`)}
        />
      </QueryStates>

      <Fab color="primary" aria-label="Add consultation" component={Link} to={`/patients/${id}/consultations/new`}
        sx={{ position: "fixed", bottom: { xs: 72, md: 24 }, right: 24 }}>
        <AddIcon />
      </Fab>
    </Box>
  );
}
