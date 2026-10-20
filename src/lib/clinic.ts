import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
} from "firebase/firestore";
import { db } from "./firebase";

export const CLINICS = "clinics";

export const RESERVED_SLUGS: readonly string[] = [
  "login",
  "admin",
  "access",
  "patients",
  "inventory",
  "calculator",
  "funds",
  "clinics",
  "people",
  "settings",
  "verify-email",
];

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_MAX = 40;
const SLUG_MIN = 3;

let active: string | null = null;

export function setActiveClinic(id: string | null): void {
  active = id;
}

export function getActiveClinic(): string {
  if (!active) throw new Error("No active clinic");
  return active;
}

/** The active clinic, or null when none is set (never throws). */
export function peekActiveClinic(): string | null {
  return active;
}

/** Pass `clinicId` to pin a multi-step operation to one clinic across awaits. */
export function clinicCollection(
  name: string,
  clinicId: string = getActiveClinic(),
): CollectionReference {
  return collection(db, CLINICS, clinicId, name);
}

export function clinicDoc(
  name: string,
  id: string,
  clinicId: string = getActiveClinic(),
): DocumentReference {
  return doc(db, CLINICS, clinicId, name, id);
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return (
    slug.length >= SLUG_MIN &&
    slug.length <= SLUG_MAX &&
    SLUG_RE.test(slug) &&
    !RESERVED_SLUGS.includes(slug)
  );
}
