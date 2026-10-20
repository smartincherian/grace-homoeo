import {
  collection,
  doc,
  getDocs,
  updateDoc,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";
import { ALLOWED_EMAILS, SUPERADMIN_EMAIL, normalizeEmail } from "./access";
import { CLINICS } from "./clinic";

export type SeatId = "1" | "2" | "3";
export const SEAT_IDS: readonly SeatId[] = ["1", "2", "3"];

export interface Seat {
  seat: SeatId;
  email: string;
}

export type SeatErrorCode =
  | "full"
  | "duplicate"
  | "superadmin"
  | "invalid"
  | "unavailable"
  | "owner";

export class SeatError extends Error {
  code: SeatErrorCode;
  constructor(code: SeatErrorCode) {
    super(code);
    this.name = "SeatError";
    this.code = code;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEATS = "seats";

/** A clinic's occupied seats, sorted by seat id. */
export async function listSeats(clinicId: string): Promise<Seat[]> {
  const snap = await getDocs(collection(db, CLINICS, clinicId, SEATS));
  return snap.docs
    .map((d) => ({
      seat: d.id as SeatId,
      email: ((d.data() as DocumentData).email as string) ?? "",
    }))
    .sort((a, b) => a.seat.localeCompare(b.seat));
}

/**
 * Gives `email` the lowest free seat: one batch writing the seat doc and the
 * allow-list entry. `seats` is the clinic's current occupied seats.
 */
export async function addUser(
  clinicId: string,
  email: string,
  addedBy: string,
  seats: Seat[],
): Promise<Seat> {
  const id = normalizeEmail(email);
  if (!EMAIL_RE.test(id)) throw new SeatError("invalid");
  if (id === SUPERADMIN_EMAIL) throw new SeatError("superadmin");
  if (seats.some((s) => s.email === id)) throw new SeatError("duplicate");
  const free = SEAT_IDS.find((s) => !seats.some((t) => t.seat === s));
  if (!free) throw new SeatError("full");

  const batch = writeBatch(db);
  batch.set(doc(db, CLINICS, clinicId, SEATS, free), { email: id });
  batch.set(doc(db, ALLOWED_EMAILS, id), {
    email: id,
    clinicId,
    seat: free,
    addedAt: Date.now(),
    addedBy,
  });
  try {
    await batch.commit();
  } catch (e) {
    // Rules reject the write when the clinic is full or the email is taken elsewhere.
    if ((e as { code?: string }).code === "permission-denied") {
      throw new SeatError("unavailable");
    }
    throw e;
  }
  return { seat: free, email: id };
}

/** Frees a seat: one batch deleting the seat doc and the allow-list entry. */
export async function removeUser(
  clinicId: string,
  seat: Seat,
  ownerEmail: string | undefined,
): Promise<void> {
  if (ownerEmail && seat.email === normalizeEmail(ownerEmail)) {
    throw new SeatError("owner");
  }
  const batch = writeBatch(db);
  batch.delete(doc(db, CLINICS, clinicId, SEATS, seat.seat));
  batch.delete(doc(db, ALLOWED_EMAILS, seat.email));
  await batch.commit();
}

export async function setOwner(clinicId: string, email: string): Promise<void> {
  await updateDoc(doc(db, CLINICS, clinicId), {
    ownerEmail: normalizeEmail(email),
  });
}
