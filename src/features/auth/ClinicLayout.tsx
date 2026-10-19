import { useEffect, useState } from "react";
import {
  Link as RouterLink,
  Navigate,
  Outlet,
  useParams,
} from "react-router-dom";
import { Box, Link, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { RESERVED_SLUGS, setActiveClinic } from "../../lib/clinic";
import { useClinic } from "../../lib/clinicQueries";
import { useMembership } from "./AuthGuard";
import HomeRedirect from "./HomeRedirect";

/** Queries that are not clinic data and survive a clinic switch. */
const GLOBAL_QUERIES = ["access", "clinics", "allowedEmails"];

/** Route element for `/:clinicSlug`: checks membership and activates the clinic. */
export default function ClinicLayout() {
  const { clinicSlug } = useParams();
  const membership = useMembership();
  const queryClient = useQueryClient();
  const clinic = useClinic(clinicSlug);
  // Reserved words (e.g. a legacy `/patients` link) are never clinic slugs.
  const reserved = !!clinicSlug && RESERVED_SLUGS.includes(clinicSlug);
  const allowed =
    !!membership &&
    !!clinicSlug &&
    !reserved &&
    (membership.superadmin || clinicSlug === membership.clinicId);
  // The clinic whose data the cache holds; children render only once it matches.
  const [readySlug, setReadySlug] = useState(allowed ? clinicSlug : undefined);

  useEffect(() => {
    if (!allowed || readySlug === clinicSlug) return;
    if (readySlug) {
      queryClient.removeQueries({
        predicate: (q) => !GLOBAL_QUERIES.includes(String(q.queryKey[0])),
      });
    }
    setReadySlug(clinicSlug);
  }, [allowed, clinicSlug, readySlug, queryClient]);

  if (!membership || !clinicSlug) return null;
  if (reserved) return <HomeRedirect />;
  if (!allowed) {
    return <Navigate to={`/${membership.clinicId}/patients`} replace />;
  }
  if (membership.superadmin && clinic.data === null) {
    return (
      <Box sx={{ textAlign: "center", mt: 8 }}>
        <Typography variant="h1" sx={{ fontSize: 22, mb: 1 }}>
          Clinic not found
        </Typography>
        <Link component={RouterLink} to="/admin">
          Back to admin
        </Link>
      </Box>
    );
  }
  if (readySlug !== clinicSlug) return null;

  // Set during render so the child's queries in this same render see the clinic.
  setActiveClinic(clinicSlug);
  return <Outlet key={clinicSlug} />;
}
