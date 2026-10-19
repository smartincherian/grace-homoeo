// src/features/patients/PatientPreview.tsx
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import type { Patient } from "./patientSchema";
import { useConsultations } from "../consultations/useConsultations";
import AvatarTile from "../../components/AvatarTile";
import { calcAge, daysAgoLabel } from "../../lib/dates";
import { CAPTION_SX, CARD_SX, LINE, TOKENS } from "../../theme/theme";
import { useClinicPath } from "../auth/useClinicPath";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        bgcolor: TOKENS.white,
        border: LINE,
        borderRadius: "14px",
        px: 1.75,
        py: 1.5,
      }}
    >
      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 800 }}>{value}</Typography>
    </Box>
  );
}

/** Summary card of the selected patient beside the desktop list. */
export default function PatientPreview({ patient }: { patient: Patient }) {
  const cp = useClinicPath();
  const { status, data } = useConsultations(patient.id);
  const visits = data ?? [];
  const latest = visits[0];

  return (
    <Box
      sx={{
        ...CARD_SX,
        position: "sticky",
        top: 28,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        maxHeight: "calc(100vh - 80px - var(--scripture-h, 0px))",
      }}
    >
      <Box
        sx={{
          p: 3,
          display: "flex",
          flexDirection: "column",
          gap: 1.75,
          background: `linear-gradient(180deg,${TOKENS.blue50},#fff)`,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
          <AvatarTile name={patient.name} size={56} solid />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em" }}
            >
              {patient.name}
            </Typography>
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
              {[
                `#${patient.serialNo}`,
                `${calcAge(patient.dob)} yrs`,
                patient.gender,
                patient.place,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25 }}
        >
          <Stat
            label="Visits"
            value={status === "success" ? String(visits.length) : "…"}
          />
          <Stat
            label="Last visit"
            value={
              patient.lastVisitAt ? daysAgoLabel(patient.lastVisitAt) : "—"
            }
          />
        </Box>
      </Box>

      <Box sx={{ overflowY: "auto", flex: 1 }}>
        {status === "pending" ? (
          <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={24} />
          </Box>
        ) : latest ? (
          <>
            <Box
              sx={{
                px: 3,
                pt: 0.75,
                pb: 2.25,
                display: "flex",
                flexDirection: "column",
                gap: 1.25,
              }}
            >
              <Typography sx={CAPTION_SX}>
                Last visit · {daysAgoLabel(latest.date)}
              </Typography>
              <Typography
                sx={{ fontSize: 15, lineHeight: 1.5, whiteSpace: "pre-wrap" }}
              >
                {latest.complaint || "No complaint recorded"}
              </Typography>
              {latest.diagnosis && (
                <Box
                  component="span"
                  sx={{
                    alignSelf: "flex-start",
                    fontSize: 12,
                    fontWeight: 600,
                    px: 1.25,
                    py: 0.625,
                    borderRadius: "8px",
                    bgcolor: TOKENS.ground,
                  }}
                >
                  {latest.diagnosis}
                </Box>
              )}
            </Box>
            {latest.remedy && (
              <Box
                sx={{
                  px: 3,
                  pb: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                }}
              >
                <Typography sx={CAPTION_SX}>Prescription</Typography>
                <Box
                  sx={{
                    px: 1.75,
                    py: 1.5,
                    borderRadius: "12px",
                    bgcolor: TOKENS.blue50,
                  }}
                >
                  <Typography
                    sx={{
                      fontWeight: 700,
                      color: TOKENS.blue700,
                      whiteSpace: "pre-wrap",
                      fontSize: 14,
                    }}
                  >
                    {latest.remedy}
                  </Typography>
                </Box>
              </Box>
            )}
          </>
        ) : (
          <Typography
            sx={{ px: 3, py: 1, fontSize: 14, color: "text.secondary" }}
          >
            No consultations yet
          </Typography>
        )}
      </Box>

      <Box sx={{ px: 3, py: 2.5, display: "flex", gap: 1.25 }}>
        <Button
          variant="contained"
          component={Link}
          to={cp(`/patients/${patient.id}/consultations/new`)}
          sx={{ flex: 1, height: 46 }}
        >
          Start consultation
        </Button>
        <Button
          variant="outlined"
          component={Link}
          to={cp(`/patients/${patient.id}`)}
          sx={{ height: 46 }}
        >
          Open record
        </Button>
      </Box>
    </Box>
  );
}
