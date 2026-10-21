import { useParams } from "react-router-dom";
import { useClinic } from "./clinicQueries";
import { clinicFeatures, type ClinicFeatures } from "./clinicType";

/** The current clinic's features; homoeo while the clinic doc is loading. */
export function useClinicFeatures(): ClinicFeatures {
  const { clinicSlug } = useParams();
  return clinicFeatures(useClinic(clinicSlug).data?.type ?? "homoeo");
}
