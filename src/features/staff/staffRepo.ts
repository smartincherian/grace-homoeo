import {
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { clinicCollection, clinicDoc, getActiveClinic } from "../../lib/clinic";
import { db } from "../../lib/firebase";
import { monthRange } from "../../lib/zonedDates";
import { monthsSpanned } from "./payroll";
import {
  paymentId,
  type Leave,
  type LeaveFormValues,
  type SalaryPayment,
  type Staff,
  type StaffFormValues,
} from "./staffSchema";

const STAFF = "staff";
const LEAVES = "leaves";
const PAYMENTS = "salaryPayments";

type Snap =
  | QueryDocumentSnapshot<DocumentData>
  | DocumentSnapshot<DocumentData>;

function toStaff(snap: Snap): Staff {
  const d = snap.data() as DocumentData;
  return {
    id: snap.id,
    name: d.name,
    nameLower: d.nameLower,
    phone: d.phone ?? "",
    designation: d.designation ?? "",
    joinedOn: d.joinedOn,
    leftOn: d.leftOn ?? null,
    monthlySalary: d.monthlySalary,
    active: d.active,
    createdAt: d.createdAt,
  };
}

function toLeave(snap: Snap): Leave {
  const d = snap.data() as DocumentData;
  return {
    id: snap.id,
    staffId: d.staffId,
    staffName: d.staffName,
    from: d.from,
    to: d.to,
    halfDay: d.halfDay ?? false,
    type: d.type,
    note: d.note ?? "",
    createdAt: d.createdAt,
  };
}

function toPayment(snap: Snap): SalaryPayment {
  const d = snap.data() as DocumentData;
  return {
    id: snap.id,
    staffId: d.staffId,
    staffName: d.staffName,
    month: d.month,
    base: d.base,
    paidDays: d.paidDays,
    unpaidDays: d.unpaidDays,
    deduction: d.deduction,
    adjustment: d.adjustment,
    adjustmentNote: d.adjustmentNote ?? "",
    net: d.net,
    paidOn: d.paidOn,
    paymentMode: d.paymentMode,
    needsReview: d.needsReview ?? false,
  };
}

function staffPayload(v: StaffFormValues) {
  return {
    name: v.name,
    nameLower: v.name.toLowerCase(),
    phone: v.phone,
    designation: v.designation,
    joinedOn: v.joinedOn,
    leftOn: v.leftOn,
    monthlySalary: v.monthlySalary,
    active: v.leftOn === null,
  };
}

export async function listStaff(): Promise<Staff[]> {
  const snap = await getDocs(clinicCollection(STAFF));
  return snap.docs
    .map(toStaff)
    .sort((a, b) => a.nameLower.localeCompare(b.nameLower));
}

export async function getStaff(id: string): Promise<Staff | null> {
  const snap = await getDoc(clinicDoc(STAFF, id));
  return snap.exists() ? toStaff(snap) : null;
}

export async function createStaff(v: StaffFormValues): Promise<string> {
  const ref = await addDoc(clinicCollection(STAFF), {
    ...staffPayload(v),
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function updateStaff(
  id: string,
  v: StaffFormValues,
): Promise<void> {
  await updateDoc(clinicDoc(STAFF, id), staffPayload(v));
}

/** Leaves of one staff member, newest `from` first. */
export async function listLeavesForStaff(staffId: string): Promise<Leave[]> {
  const snap = await getDocs(
    query(clinicCollection(LEAVES), where("staffId", "==", staffId)),
  );
  return snap.docs.map(toLeave).sort((a, b) => b.from - a.from);
}

/**
 * Leaves touching a month. Returns every leave that starts before month end,
 * then filters `to >= start` client-side (grows slowly; fine at clinic scale;
 * avoids a composite index).
 */
export async function listLeavesForMonth(
  month: string,
  tz: string,
): Promise<Leave[]> {
  const { start, end } = monthRange(month, tz);
  const snap = await getDocs(
    query(clinicCollection(LEAVES), where("from", "<=", end)),
  );
  return snap.docs.map(toLeave).filter((l) => l.to >= start);
}

export class LeaveOverlapError extends Error {
  constructor() {
    super("This staff member already has leave on those dates.");
    this.name = "LeaveOverlapError";
  }
}

/**
 * Within `batch`, flag every existing payment doc covering the given ranges
 * so the owner re-reviews it. Months are computed per (staffId, range).
 */
async function flagPaidMonths(
  batch: ReturnType<typeof writeBatch>,
  clinicId: string,
  ranges: { staffId: string; from: number; to: number }[],
  tz: string,
): Promise<void> {
  const ids = new Set<string>();
  for (const r of ranges) {
    for (const m of monthsSpanned(r.from, r.to, tz)) {
      ids.add(paymentId(r.staffId, m));
    }
  }
  const refs = [...ids].map((id) => clinicDoc(PAYMENTS, id, clinicId));
  const snaps = await Promise.all(refs.map((r) => getDoc(r)));
  snaps.forEach((s, i) => {
    if (s.exists()) batch.update(refs[i], { needsReview: true });
  });
}

export async function saveLeave(
  values: LeaveFormValues,
  tz: string,
  previous?: Leave,
): Promise<string> {
  const clinicId = getActiveClinic();
  const existing = await listLeavesForStaff(values.staffId);
  const clash = existing.some(
    (l) => l.id !== previous?.id && l.from <= values.to && l.to >= values.from,
  );
  if (clash) throw new LeaveOverlapError();

  const batch = writeBatch(db);
  const ranges = [
    { staffId: values.staffId, from: values.from, to: values.to },
  ];
  if (previous) {
    ranges.push({
      staffId: previous.staffId,
      from: previous.from,
      to: previous.to,
    });
  }
  await flagPaidMonths(batch, clinicId, ranges, tz);

  const ref = previous
    ? clinicDoc(LEAVES, previous.id, clinicId)
    : doc(clinicCollection(LEAVES, clinicId));
  batch.set(ref, { ...values, createdAt: previous?.createdAt ?? Date.now() });
  await batch.commit();
  return ref.id;
}

export async function deleteLeave(leave: Leave, tz: string): Promise<void> {
  const clinicId = getActiveClinic();
  const batch = writeBatch(db);
  await flagPaidMonths(
    batch,
    clinicId,
    [{ staffId: leave.staffId, from: leave.from, to: leave.to }],
    tz,
  );
  batch.delete(clinicDoc(LEAVES, leave.id, clinicId));
  await batch.commit();
}

/** Payments of one staff member, newest month first. */
export async function listPaymentsForStaff(
  staffId: string,
): Promise<SalaryPayment[]> {
  const snap = await getDocs(
    query(clinicCollection(PAYMENTS), where("staffId", "==", staffId)),
  );
  return snap.docs
    .map(toPayment)
    .sort((a, b) => b.month.localeCompare(a.month));
}

export async function listPaymentsForMonth(
  month: string,
): Promise<SalaryPayment[]> {
  const snap = await getDocs(
    query(clinicCollection(PAYMENTS), where("month", "==", month)),
  );
  return snap.docs.map(toPayment);
}

/** Writes the whole payment doc, which also clears `needsReview`. */
export async function markPaid(
  p: Omit<SalaryPayment, "id" | "needsReview">,
): Promise<void> {
  await setDoc(clinicDoc(PAYMENTS, paymentId(p.staffId, p.month)), {
    ...p,
    needsReview: false,
  });
}

export async function deletePayment(
  staffId: string,
  month: string,
): Promise<void> {
  await deleteDoc(clinicDoc(PAYMENTS, paymentId(staffId, month)));
}
