/** What kind of practice a clinic is; decides which case-taking parts show. */
export type ClinicType = "homoeo" | "general";

export const CLINIC_TYPES: readonly { value: ClinicType; label: string }[] = [
  { value: "homoeo", label: "Homoeopathy" },
  { value: "general", label: "General practice" },
];

/** Missing or unknown types are homoeo, so clinics made before types keep working. */
export function parseClinicType(v: unknown): ClinicType {
  return v === "general" ? "general" : "homoeo";
}

export function clinicTypeLabel(type: ClinicType): string {
  return CLINIC_TYPES.find((t) => t.value === type)?.label ?? type;
}

export interface ClinicFeatures {
  type: ClinicType;
  lsmc: boolean;
  differentialRemedy: boolean;
  /** Mentals, perspiration and the "Sleep & dreams" wording in Generals. */
  homoeoGenerals: boolean;
  generalsTitle: "Generals" | "Case history";
}

export function clinicFeatures(type: ClinicType): ClinicFeatures {
  const homoeo = type === "homoeo";
  return {
    type,
    lsmc: homoeo,
    differentialRemedy: homoeo,
    homoeoGenerals: homoeo,
    generalsTitle: homoeo ? "Generals" : "Case history",
  };
}
