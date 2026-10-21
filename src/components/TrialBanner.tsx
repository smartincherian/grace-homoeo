import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Link as MuiLink,
  Typography,
} from "@mui/material";
import { useMembership } from "../features/auth/AuthGuard";
import { useClinic } from "../lib/clinicQueries";
import { useBranding } from "../lib/useBranding";
import { displayNameOf } from "../lib/branding";
import { clinicStatus, pricingWhatsAppUrl } from "../lib/subscription";
import { onWriteDenied } from "../lib/writeDenied";
import { TOKENS } from "../theme/theme";

/** The trial countdown shows only when fewer than this many days are left. */
const TRIAL_BANNER_DAYS = 8;

export default function TrialBanner({ clinicId }: { clinicId: string }) {
  const membership = useMembership();
  const clinic = useClinic(clinicId).data;
  const branding = useBranding(clinicId).data;
  const [dialogOpen, setDialogOpen] = useState(false);

  const status =
    clinic && !membership?.superadmin
      ? clinicStatus(clinic, Date.now())
      : undefined;
  const expired = status?.kind === "expired";

  useEffect(() => {
    if (!expired) return;
    return onWriteDenied(() => setDialogOpen(true));
  }, [expired]);

  if (!clinic || !status) return null;
  if (status.kind !== "trial" && status.kind !== "expired") return null;

  const url = pricingWhatsAppUrl({
    clinicName: displayNameOf(branding, clinic.name),
    clinicId,
    email: clinic.ownerEmail ?? "",
  });

  if (status.kind === "trial") {
    // Quiet for most of the trial; only the last week shows the countdown.
    if (status.daysLeft >= TRIAL_BANNER_DAYS) return null;
    const warn = status.daysLeft <= 5;
    return (
      <Box
        role="status"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          mb: 2,
          px: 2,
          py: 0.75,
          borderRadius: "10px",
          fontSize: 13,
          fontWeight: 600,
          bgcolor: warn ? "warning.light" : TOKENS.blue50,
          color: warn ? TOKENS.warn : TOKENS.blue700,
        }}
      >
        <span>
          Free trial · {status.daysLeft}{" "}
          {status.daysLeft === 1 ? "day" : "days"} left
        </span>
        <MuiLink
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          underline="always"
          color="inherit"
        >
          Subscribe
        </MuiLink>
      </Box>
    );
  }

  return (
    <>
      <Box
        role="status"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1.5,
          mb: 2,
          px: 2,
          py: 1,
          borderRadius: "10px",
          bgcolor: "error.light",
          color: TOKENS.danger,
        }}
      >
        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
          Your free trial has ended. Your records are read-only. Subscribe to
          keep adding patients and bookings.
        </Typography>
        <Button
          variant="contained"
          size="small"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Ask pricing on WhatsApp
        </Button>
      </Box>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>Trial ended</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Subscribe to continue making changes. Your records are safe and
            still readable.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
          <Button
            variant="contained"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ask pricing on WhatsApp
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
