import { ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { canManageClinic } from "../../lib/access";
import { useMembership } from "./AuthGuard";

/** Renders children only for the clinic owner (or superadmin); others go to the clinic's patients page. */
export default function OwnerOnly({ children }: { children: ReactNode }) {
  const { clinicSlug } = useParams();
  const membership = useMembership();
  if (canManageClinic(membership, clinicSlug)) return <>{children}</>;
  return <Navigate to={`/${clinicSlug}/patients`} replace />;
}
