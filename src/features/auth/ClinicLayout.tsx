import { useEffect, useReducer } from "react";
import {
  Link as RouterLink,
  Navigate,
  Outlet,
  useParams,
} from "react-router-dom";
import { Box, Link, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import {
  RESERVED_SLUGS,
  peekActiveClinic,
  setActiveClinic,
} from "../../lib/clinic";
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
  // The module-level active clinic survives leaving clinic routes (e.g. via /admin),
  // so it tells us whose data the cache holds. Children wait until it is cleared.
  const previous = peekActiveClinic();
  const switching = allowed && previous !== null && previous !== clinicSlug;
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!switching) return;
    queryClient.removeQueries({
      predicate: (q) => !GLOBAL_QUERIES.includes(String(q.queryKey[0])),
    });
    setActiveClinic(clinicSlug!);
    rerender();
  }, [switching, clinicSlug, queryClient]);

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
  if (switching) return null;

  // Set during render so the child's queries in this same render see the clinic.
  setActiveClinic(clinicSlug);
  return <Outlet key={clinicSlug} />;
}
