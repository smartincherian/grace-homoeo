import { useCallback } from "react";
import { useParams } from "react-router-dom";

/** Prefixes an app path with the current clinic slug: `/patients` → `/c1/patients`. */
export function useClinicPath(): (path: string) => string {
  const { clinicSlug } = useParams();
  if (!clinicSlug) throw new Error("useClinicPath used outside a clinic route");
  return useCallback((path: string) => `/${clinicSlug}${path}`, [clinicSlug]);
}
