import { SLUG } from "./access.js";
import { PATIENT_ID } from "./handlers.js";

const INVALID = "<invalid>";

/** Returns the value only if it looks like a real clinic slug / patient id, so a crafted request can't put arbitrary text into logs. */
export function safeClinicId(v: unknown): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === "string" && v.length <= 40 && SLUG.test(v) ? v : INVALID;
}
export function safePatientId(v: unknown): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === "string" && PATIENT_ID.test(v) ? v : INVALID;
}
