// src/features/patients/PatientDetailPage.tsx
import { Box, Button, ButtonBase, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import dayjs from "dayjs";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDeletePatient, usePatient } from "./usePatients";
import { useConsultations } from "../consultations/useConsultations";
import ConsultationHistory from "../consultations/ConsultationHistory";
import GeneralsLatest from "../consultations/GeneralsLatest";
import { hasShownGenerals } from "../consultations/generalsFields";
import { useClinicFeatures } from "../../lib/useClinicFeatures";
import {
  usePatientGenerals,
  usePatientLsmc,
} from "../consultations/useCaseRecord";
import PatientSummaryCard from "./PatientSummaryCard";
import { latestVisitAt } from "./latestVisitAt";
import QueryStates from "../../components/QueryStates";
import AvatarTile from "../../components/AvatarTile";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useToast } from "../../components/useToast";
import { useSetPageTitle } from "../../components/PageChrome";
import { ageLabel, daysAgoLabel, formatDate } from "../../lib/dates";
import { CARD_SX, GRADIENT, LINE, PILL_SX, TOKENS } from "../../theme/theme";
import { useClinicPath } from "../auth/useClinicPath";

function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 2,
        mb: 1.75,
      }}
    >
      <Typography sx={{ fontSize: 18, fontWeight: 800 }}>{title}</Typography>
      {note && (
        <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
          {note}
        </Typography>
      )}
    </Box>
  );
}

export default function PatientDetailPage() {
  const cp = useClinicPath();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: patient } = usePatient(id);
  const { status, data: consultations } = useConsultations(id);
  useSetPageTitle(patient?.name ?? "Patient");
  // useConsultations returns newest first.
  const visits = consultations ?? [];
  const latest = visits[0];
  const { data: generalsList } = usePatientGenerals(id);
  const { data: lsmc } = usePatientLsmc(id);
  const features = useClinicFeatures();
  const showGenerals = (generalsList ?? []).some((g) =>
    hasShownGenerals(g, features.homoeoGenerals),
  );
  const openVisit = (cid: string) =>
    navigate(cp(`/patients/${id}/consultations/${cid}`));
  const course = visits.filter((v) => v.remedy);
  const deletePatient = useDeletePatient();
  const { showToast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const removePatient = () => {
    if (!id) return;
    setConfirmDelete(false);
    deletePatient.mutate(id, {
      onSuccess: () => {
        showToast("Patient deleted", "success");
        navigate(cp("/patients"), { replace: true });
      },
      onError: () =>
        showToast("Could not delete patient. Please try again.", "error"),
    });
  };

  if (!patient) {
    return (
      <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
        Loading patient…
      </Typography>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          ...CARD_SX,
          px: { xs: 2, sm: 3 },
          py: { xs: 2, sm: 2.5 },
          mb: 2.25,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: { xs: 1.75, sm: 2.5 },
        }}
      >
        <AvatarTile name={patient.name} size={64} solid />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="h1"
            sx={{ fontSize: { xs: 22, sm: 26 }, mb: 0.75 }}
          >
            {patient.name}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {[
              `#${patient.serialNo}`,
              [ageLabel(patient.dob, " yrs"), patient.gender]
                .filter(Boolean)
                .join(" · "),
              patient.place,
              patient.phone,
            ]
              .filter(Boolean)
              .map((t) => (
                <Box
                  key={t}
                  component="span"
                  sx={{
                    ...PILL_SX,
                    bgcolor: TOKENS.ground,
                    color: "text.secondary",
                  }}
                >
                  {t}
                </Box>
              ))}
          </Box>
        </Box>
        <Box
          sx={{ display: "flex", gap: 1.25, width: { xs: "100%", sm: "auto" } }}
        >
          <Button
            variant="outlined"
            component={Link}
            to={cp(`/patients/${id}/edit`)}
            sx={{ height: 46 }}
          >
            Edit
          </Button>
          <Button
            variant="outlined"
            color="error"
            disabled={deletePatient.isPending}
            onClick={() => setConfirmDelete(true)}
            sx={{ height: 46 }}
          >
            Delete
          </Button>
          <Button
            variant="contained"
            component={Link}
            to={cp(`/patients/${id}/consultations/new`)}
            startIcon={<AddIcon />}
            sx={{ height: 46, flex: { xs: 1, sm: "none" } }}
          >
            New consultation
          </Button>
        </Box>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 320px" },
          gap: 2.5,
          alignItems: "start",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <PatientSummaryCard
            patientId={id ?? ""}
            latestVisitAt={latestVisitAt(visits)}
          />
          <SectionTitle
            title="Consultation history"
            note={`${visits.length} visit${visits.length === 1 ? "" : "s"} · newest first`}
          />
          <QueryStates
            status={status}
            isEmpty={visits.length === 0}
            emptyMessage="No consultations yet"
          >
            <ConsultationHistory
              consultations={visits}
              patientId={id ?? ""}
              lsmc={lsmc ?? []}
              features={features}
              onSelect={openVisit}
            />
          </QueryStates>

          {showGenerals && (
            <Box sx={{ mt: 3.5 }}>
              <SectionTitle title={features.generalsTitle} />
              <Box sx={{ ...CARD_SX, px: { xs: 2, sm: 2.75 }, py: 2.25 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1.5,
                    flexWrap: "wrap",
                    pb: 1.75,
                    mb: 1.75,
                    borderBottom: LINE,
                  }}
                >
                  <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                    Last updated{" "}
                    <Box
                      component="span"
                      sx={{ fontWeight: 700, color: "text.primary" }}
                    >
                      {formatDate((generalsList ?? [])[0].date)}
                    </Box>
                  </Typography>
                  <Button
                    component={Link}
                    to={cp(`/patients/${id}/generals`)}
                    size="small"
                    sx={{
                      minHeight: 32,
                      borderRadius: "99px",
                      px: 1.75,
                      fontSize: 12,
                      color: TOKENS.blue700,
                      bgcolor: TOKENS.blue50,
                      "&:hover": { bgcolor: TOKENS.blue100 },
                    }}
                  >
                    View past history
                  </Button>
                </Box>
                <GeneralsLatest list={generalsList ?? []} features={features} />
              </Box>
            </Box>
          )}
        </Box>

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1.75,
            position: { md: "sticky" },
            top: { md: 28 },
          }}
        >
          <Box
            sx={{
              borderRadius: "20px",
              background: GRADIENT,
              color: "#fff",
              p: 2.5,
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
            }}
          >
            <Typography sx={{ fontSize: 13, opacity: 0.85 }}>
              Last consultation
            </Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 800 }}>
              {latest ? formatDate(latest.date) : "—"}
            </Typography>
            <Typography sx={{ fontSize: 13, opacity: 0.9 }}>
              {latest ? daysAgoLabel(latest.date) : "No visits yet"}
            </Typography>
          </Box>
          {course.length > 0 && (
            <Box
              sx={{
                ...CARD_SX,
                px: 2.5,
                py: 2.25,
                display: { xs: "none", md: "block" },
              }}
            >
              <Typography sx={{ fontSize: 14, fontWeight: 800, mb: 0.75 }}>
                Remedy course
              </Typography>
              {course.map((v, i) => (
                <ButtonBase
                  key={v.id}
                  onClick={() => openVisit(v.id)}
                  sx={{
                    width: "100%",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1.5,
                    py: 1,
                    borderTop: LINE,
                    textAlign: "left",
                    fontSize: 14,
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      mt: 0.75,
                      flex: "none",
                      borderRadius: "50%",
                      bgcolor: i === 0 ? TOKENS.blue : "#c3c9d8",
                    }}
                  />
                  <Typography
                    sx={{
                      fontWeight: 600,
                      fontSize: 14,
                      whiteSpace: "pre-wrap",
                      flex: 1,
                    }}
                  >
                    {v.remedy}
                  </Typography>
                  <Typography
                    sx={{ fontSize: 12, color: "text.secondary", flex: "none" }}
                  >
                    {dayjs(v.date).format("D MMM")}
                  </Typography>
                </ButtonBase>
              ))}
            </Box>
          )}
        </Box>
      </Box>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete patient?"
        message={`Delete "${patient.name}" (#${patient.serialNo})${
          visits.length
            ? ` and all ${visits.length} consultation${visits.length === 1 ? "" : "s"}, including their fees in Funds`
            : ""
        }? This cannot be undone.`}
        onConfirm={removePatient}
        onClose={() => setConfirmDelete(false)}
      />
    </Box>
  );
}
