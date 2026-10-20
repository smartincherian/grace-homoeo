import {
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type DocumentSnapshot,
} from "firebase/firestore";
import { clinicCollection, clinicDoc } from "../../lib/clinic";
import type { Expense, ExpenseFormValues, IncomeRecord } from "./fundsSchema";

const EXPENSES = "expenses";
// Read-only access to consultations for income totals. Funds owns this query
// (rather than importing the consultations feature) to respect feature boundaries.
const CONSULTATIONS = "consultations";

// Read-only salary payments total (owner/superadmin only by rules; members must
// never call this).
const SALARY_PAYMENTS = "salaryPayments";

function toExpense(
  snap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>,
): Expense {
  const d = snap.data() as DocumentData;
  return {
    id: snap.id,
    date: d.date,
    category: d.category,
    amount: d.amount,
    note: d.note ?? "",
    createdAt: d.createdAt,
  };
}

/** Expenses with `date` within [startMs, endMs], newest first. */
export async function listExpenses(
  startMs: number,
  endMs: number,
): Promise<Expense[]> {
  const snap = await getDocs(
    query(
      clinicCollection(EXPENSES),
      where("date", ">=", startMs),
      where("date", "<=", endMs),
    ),
  );
  return snap.docs.map(toExpense).sort((a, b) => b.date - a.date);
}

/** Consultation amounts within [startMs, endMs], reduced to income records. */
export async function listIncome(
  startMs: number,
  endMs: number,
): Promise<IncomeRecord[]> {
  const snap = await getDocs(
    query(
      clinicCollection(CONSULTATIONS),
      where("date", ">=", startMs),
      where("date", "<=", endMs),
    ),
  );
  return snap.docs.map((d) => {
    const data = d.data() as DocumentData;
    return {
      amount: data.amount ?? 0,
      paymentMode: data.paymentMode ?? "Unknown",
      date: data.date,
    };
  });
}

/** Salary payments with `paidOn` within [startMs, endMs]: sum of `net` and count. */
export async function listSalaryTotals(
  startMs: number,
  endMs: number,
): Promise<{ total: number; count: number }> {
  const snap = await getDocs(
    query(
      clinicCollection(SALARY_PAYMENTS),
      where("paidOn", ">=", startMs),
      where("paidOn", "<=", endMs),
    ),
  );
  return {
    total: snap.docs.reduce((sum, d) => sum + (d.data().net ?? 0), 0),
    count: snap.size,
  };
}

export async function getExpense(id: string): Promise<Expense | null> {
  const snap = await getDoc(clinicDoc(EXPENSES, id));
  return snap.exists() ? toExpense(snap) : null;
}

export async function createExpense(
  values: ExpenseFormValues,
): Promise<string> {
  const ref = await addDoc(clinicCollection(EXPENSES), {
    ...values,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function updateExpense(
  id: string,
  values: ExpenseFormValues,
): Promise<void> {
  await updateDoc(clinicDoc(EXPENSES, id), { ...values });
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(clinicDoc(EXPENSES, id));
}
