import {
  Box,
  Button,
  CircularProgress,
  Link as MuiLink,
  List,
  ListItem,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { Link, useParams } from "react-router-dom";
import { useToast } from "../../components/useToast";
import { canManageClinic } from "../../lib/access";
import {
  aiErrorMessage,
  usePatientSummary,
  useAiStatus,
  useSummarizePatient,
} from "../../lib/aiSummary";
import { useClinic } from "../../lib/clinicQueries";
import { clinicStatus } from "../../lib/subscription";
import { CARD_SX } from "../../theme/theme";
import { useMembership } from "../auth/AuthGuard";

export default function PatientSummaryCard({
  patientId,
  latestVisitAt,
}: {
  patientId: string;
  latestVisitAt: number | null;
}) {
  const { clinicSlug } = useParams<{ clinicSlug: string }>();
  const { showToast } = useToast();
  const membership = useMembership();
  const isOwner = canManageClinic(membership, clinicSlug);
  const clinic = useClinic(clinicSlug).data;
  const expired =
    !!clinic &&
    !membership?.superadmin &&
    clinicStatus(clinic, Date.now()).kind === "expired";
  const aiStatus = useAiStatus(clinicSlug);
  const configured = !!aiStatus.data?.configured;
  const summaryQuery = usePatientSummary(patientId);
  const summary = summaryQuery.data ?? null;
  const loading = aiStatus.isLoading || summaryQuery.isLoading;
  const summarize = useSummarizePatient(patientId);

  const run = () =>
    summarize.mutate(undefined, {
      onError: (err) => showToast(aiErrorMessage(err), "error"),
    });
  const pending = summarize.isPending;
  const stale =
    !!summary &&
    latestVisitAt !== null &&
    latestVisitAt > (summary.lastConsultationAt ?? 0);

  const button = (label: string) => (
    <Button
      variant="outlined"
      size="small"
      onClick={run}
      disabled={pending || expired}
      startIcon={pending ? <CircularProgress size={14} /> : undefined}
    >
      {pending ? `${label}…` : label}
    </Button>
  );

  return (
    <Box sx={{ ...CARD_SX, px: { xs: 2, sm: 2.75 }, py: 2.25, mb: 3.5 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
          mb: summary || !configured ? 1.25 : 0,
        }}
      >
        <Typography sx={{ fontSize: 18, fontWeight: 800 }}>
          AI summary
        </Typography>
        {!loading &&
          configured &&
          (summary ? button("Re-run") : button("Summarize"))}
      </Box>

      {summary && (
        <>
          <List
            sx={{ listStyle: "disc", pl: 2.5, py: 0 }}
            aria-label="Summary points"
          >
            {summary.bullets.map((b, i) => (
              <ListItem
                key={i}
                sx={{ display: "list-item", p: 0, py: 0.25, fontSize: 14 }}
              >
                {b}
              </ListItem>
            ))}
          </List>
          <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 1.25 }}>
            {`Generated ${dayjs(summary.generatedAt).format("D MMM YYYY, HH:mm")} by ${summary.generatedByName}`}
          </Typography>
          {stale && (
            <Typography sx={{ fontSize: 12, fontWeight: 600, mt: 0.5 }}>
              New visits since this summary. Re-run to include them.
            </Typography>
          )}
          <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.5 }}>
            AI-generated from the record. Check before relying on it.
          </Typography>
        </>
      )}

      {!loading && !configured && (
        <Typography
          sx={{ fontSize: 14, color: "text.secondary", mt: summary ? 1.25 : 0 }}
        >
          AI summary is off. The clinic owner can add a Gemini key in{" "}
          {isOwner ? (
            <MuiLink component={Link} to={`/${clinicSlug}/settings`}>
              Settings
            </MuiLink>
          ) : (
            "Settings"
          )}
          .
        </Typography>
      )}
    </Box>
  );
}
