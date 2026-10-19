import { Navigate, useLocation } from "react-router-dom";
import { homePath } from "../../lib/access";
import { useMembership } from "./AuthGuard";

/** Pre-multi-clinic paths that are forwarded into the member's clinic. */
const LEGACY_SECTIONS = ["patients", "inventory", "calculator", "funds"];

/** Sends `/`, unknown paths and old un-prefixed links to the right home. */
export default function HomeRedirect() {
  const membership = useMembership();
  const { pathname, search } = useLocation();
  if (!membership) return null;
  if (membership.superadmin) return <Navigate to="/admin" replace />;

  const section = pathname.split("/")[1];
  const to = LEGACY_SECTIONS.includes(section)
    ? `/${membership.clinicId}${pathname}${search}`
    : homePath(membership);
  return <Navigate to={to} replace />;
}
