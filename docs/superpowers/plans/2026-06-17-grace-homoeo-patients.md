# Grace Homoeo — Patients & Consultations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core clinical module — a searchable patient list, a patient detail view with a consultation-history timeline, and add/edit forms for patients and consultations — on top of the completed Foundation.

**Architecture:** Each feature (`patients`, `consultations`) owns a zod schema, a typed Firestore repository (no Firestore SDK calls outside repos), TanStack Query hooks (fetching + cache invalidation), and route-page UI. Dates are epoch-millisecond numbers; money is rupee numbers. Consultations are top-level docs carrying `patientId` plus denormalized `patientName`/`serialNo`; creating one also stamps the patient's `lastVisitAt` in a single batched write. Forms use react-hook-form + zod and full-page routes (phone-first). Every list view renders through the shared `QueryStates`; every mutation reports through `useToast`.

**Tech Stack:** React 18 + TypeScript (strict), MUI v6, Firebase v10 Firestore, TanStack Query v5, react-hook-form + `@hookform/resolvers/zod` + zod, dayjs, Vitest + React Testing Library.

## Global Constraints

- Firebase project is **`grace-homoeo`** — reuse it; never create a new project.
- **UI never calls the Firestore SDK directly** — all access goes through per-collection repositories in `src/features/<feature>/`.
- **Features must not import each other's internals** — only shared `src/components/`, `src/lib/`, `src/theme/`. (Writing to another collection by path inside a repo is allowed; importing another feature's module is not.)
- **TypeScript strict mode**; no `any` in committed code.
- Money is stored and computed in **rupees as numbers**; display with `₹`.
- Dates are stored as **epoch milliseconds (number)** in Firestore.
- Every data view exposes explicit **loading / empty / error** states via `QueryStates`.
- All mutation success/failure surfaces through `useToast` — never `alert()`.
- Relative imports only (no `@/` alias).
- Tests **mock `firebase/firestore`** (and `firebase/auth` where relevant) — `npm test` needs no emulator. Do not delete `.env.test`.
- Commit after every passing step.

---

## Foundation interfaces this plan consumes (already built — verify before use)

- `src/lib/firebase.ts` → `db`, `auth`.
- `src/lib/serial.ts` → `nextPatientSerial(): Promise<number>` (atomic).
- `src/components/QueryStates.tsx` → default export `QueryStates`, props `{ status: "pending"|"error"|"success"; isEmpty: boolean; emptyMessage: string; children }`.
- `src/components/useToast.ts` → `useToast(): { showToast(message: string, severity?: "success"|"error"|"info"|"warning"): void }`.
- `src/components/AppShell.tsx` → adaptive shell rendering `<Outlet />`; currently a top `AppBar` with only the title (no profile menu yet).
- `src/App.tsx` → routes; `/patients`,`/inventory`,`/funds` rendered inside `<AuthGuard><AppShell/></AuthGuard>`; `/patients` currently maps to `PatientsPlaceholder`.
- Provider stack in `src/main.tsx`: `QueryClientProvider` → `ThemeProvider`+`CssBaseline` → `ToastProvider` → `BrowserRouter` → `App`.

---

## File Structure

```
src/lib/dates.ts                                  # age + date formatting/parse helpers (shared)
src/lib/dates.test.ts

src/features/patients/patientSchema.ts            # zod schema + Patient/PatientFormValues types
src/features/patients/patientSchema.test.ts
src/features/patients/patientsRepo.ts             # typed Firestore access for patients
src/features/patients/patientsRepo.test.ts
src/features/patients/usePatients.ts              # TanStack Query hooks
src/features/patients/usePatients.test.tsx
src/features/patients/PatientListPage.tsx         # searchable list + FAB
src/features/patients/PatientListPage.test.tsx
src/features/patients/PatientDetailPage.tsx       # profile + history + FAB
src/features/patients/PatientDetailPage.test.tsx
src/features/patients/PatientFormPage.tsx         # add/edit patient
src/features/patients/PatientFormPage.test.tsx

src/features/consultations/consultationSchema.ts  # zod schema + Consultation/ConsultationFormValues
src/features/consultations/consultationSchema.test.ts
src/features/consultations/consultationsRepo.ts   # typed Firestore access for consultations
src/features/consultations/consultationsRepo.test.ts
src/features/consultations/useConsultations.ts    # TanStack Query hooks
src/features/consultations/useConsultations.test.tsx
src/features/consultations/ConsultationTimeline.tsx       # presentational history list
src/features/consultations/ConsultationFormPage.tsx       # add/edit consultation
src/features/consultations/ConsultationFormPage.test.tsx

src/App.tsx                                        # MODIFY: add patient/consultation routes
src/components/AppShell.tsx                        # MODIFY: profile/logout menu
src/components/AppShell.test.tsx                   # MODIFY: cover logout menu
src/routes/PatientsPlaceholder.tsx                # DELETE (replaced by PatientListPage)
```

---

### Task 1: Shared date & age utilities (`src/lib/dates.ts`)

**Files:**
- Create: `src/lib/dates.ts`
- Test: `src/lib/dates.test.ts`

**Interfaces:**
- Consumes: `dayjs` (already a dependency).
- Produces:
  - `calcAge(dobMs: number, nowMs?: number): number` — whole years, never negative.
  - `formatDate(ms: number): string` — e.g. `"17 Jun 2026"`.
  - `msToDateInput(ms: number): string` — `"YYYY-MM-DD"` for `<input type="date">`.
  - `dateInputToMs(value: string): number` — parses `"YYYY-MM-DD"` to local-midnight epoch ms.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/dates.test.ts
import { describe, expect, it } from "vitest";
import { calcAge, formatDate, msToDateInput, dateInputToMs } from "./dates";

const ms = (s: string) => dateInputToMs(s);

describe("calcAge", () => {
  it("returns whole years between dob and now", () => {
    expect(calcAge(ms("2000-01-01"), ms("2026-01-01"))).toBe(26);
  });
  it("does not count an unreached birthday this year", () => {
    expect(calcAge(ms("2000-12-31"), ms("2026-06-17"))).toBe(25);
  });
  it("never returns negative for a future dob", () => {
    expect(calcAge(ms("2030-01-01"), ms("2026-01-01"))).toBe(0);
  });
});

describe("formatDate", () => {
  it("formats epoch ms as D MMM YYYY", () => {
    expect(formatDate(ms("2026-06-17"))).toBe("17 Jun 2026");
  });
});

describe("date <-> input round trip", () => {
  it("msToDateInput then dateInputToMs is stable", () => {
    const start = ms("2024-02-29");
    expect(dateInputToMs(msToDateInput(start))).toBe(start);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- dates`
Expected: FAIL — cannot resolve `./dates`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/dates.ts
import dayjs from "dayjs";

export function calcAge(dobMs: number, nowMs: number = Date.now()): number {
  return Math.max(0, dayjs(nowMs).diff(dayjs(dobMs), "year"));
}

export function formatDate(ms: number): string {
  return dayjs(ms).format("D MMM YYYY");
}

export function msToDateInput(ms: number): string {
  return dayjs(ms).format("YYYY-MM-DD");
}

export function dateInputToMs(value: string): number {
  return dayjs(value).valueOf();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- dates`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.ts src/lib/dates.test.ts
git commit -m "feat: add shared date and age utilities"
```

---

### Task 2: Patient schema + repository

**Files:**
- Create: `src/features/patients/patientSchema.ts`, `src/features/patients/patientsRepo.ts`
- Test: `src/features/patients/patientSchema.test.ts`, `src/features/patients/patientsRepo.test.ts`

**Interfaces:**
- Consumes: `nextPatientSerial` from `../../lib/serial`; `db` from `../../lib/firebase`.
- Produces:
  - `GENDERS = ["Male","Female","Other"] as const`; `type Gender`.
  - `patientFormSchema` (zod); `type PatientFormValues = { name: string; dob: number; gender: Gender; place: string; phone: string }`.
  - `interface Patient extends PatientFormValues { id: string; serialNo: number; nameLower: string; createdAt: number; lastVisitAt: number | null }`.
  - `listPatients(): Promise<Patient[]>` (ordered by `nameLower` ascending).
  - `getPatient(id: string): Promise<Patient | null>`.
  - `createPatient(values: PatientFormValues): Promise<string>` (assigns serial, writes `nameLower`, `createdAt`, `lastVisitAt: null`; returns new id).
  - `updatePatient(id: string, values: PatientFormValues): Promise<void>` (rewrites `nameLower`).

- [ ] **Step 1: Write the failing schema test**

```ts
// src/features/patients/patientSchema.test.ts
import { describe, expect, it } from "vitest";
import { patientFormSchema } from "./patientSchema";

describe("patientFormSchema", () => {
  it("accepts a valid patient", () => {
    const parsed = patientFormSchema.parse({
      name: "  Asha  ", dob: 946684800000, gender: "Female", place: "Kochi", phone: "9999",
    });
    expect(parsed.name).toBe("Asha"); // trimmed
    expect(parsed.gender).toBe("Female");
  });
  it("rejects an empty name", () => {
    expect(() => patientFormSchema.parse({ name: "   ", dob: 1, gender: "Male" })).toThrow();
  });
  it("rejects a missing dob", () => {
    expect(() => patientFormSchema.parse({ name: "A", gender: "Male" })).toThrow();
  });
  it("rejects an unknown gender", () => {
    expect(() => patientFormSchema.parse({ name: "A", dob: 1, gender: "X" })).toThrow();
  });
  it("defaults place and phone to empty strings", () => {
    const parsed = patientFormSchema.parse({ name: "A", dob: 1, gender: "Male" });
    expect(parsed.place).toBe("");
    expect(parsed.phone).toBe("");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- patientSchema`
Expected: FAIL — cannot resolve `./patientSchema`.

- [ ] **Step 3: Write the schema**

```ts
// src/features/patients/patientSchema.ts
import { z } from "zod";

export const GENDERS = ["Male", "Female", "Other"] as const;
export type Gender = (typeof GENDERS)[number];

export const patientFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  dob: z.number({
    required_error: "Date of birth is required",
    invalid_type_error: "Date of birth is required",
  }).int().nonnegative(),
  gender: z.enum(GENDERS, { required_error: "Gender is required" }),
  place: z.string().trim().default(""),
  phone: z.string().trim().default(""),
});

export type PatientFormValues = z.infer<typeof patientFormSchema>;

export interface Patient extends PatientFormValues {
  id: string;
  serialNo: number;
  nameLower: string;
  createdAt: number;
  lastVisitAt: number | null;
}
```

- [ ] **Step 4: Run to verify schema test passes**

Run: `npm test -- patientSchema`
Expected: PASS.

- [ ] **Step 5: Write the failing repository test**

```ts
// src/features/patients/patientsRepo.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const addDoc = vi.fn();
const getDocs = vi.fn();
const updateDoc = vi.fn();
const collection = vi.fn((..._a: unknown[]) => ({ path: "patients" }));
const doc = vi.fn((..._a: unknown[]) => ({ id: "doc-ref" }));
const query = vi.fn((...a: unknown[]) => a);
const orderBy = vi.fn((...a: unknown[]) => ({ orderBy: a }));

vi.mock("firebase/firestore", () => ({
  addDoc: (...a: unknown[]) => addDoc(...a),
  getDocs: (...a: unknown[]) => getDocs(...a),
  getDoc: vi.fn(),
  updateDoc: (...a: unknown[]) => updateDoc(...a),
  collection: (...a: unknown[]) => collection(...a),
  doc: (...a: unknown[]) => doc(...a),
  query: (...a: unknown[]) => query(...a),
  orderBy: (...a: unknown[]) => orderBy(...a),
}));
vi.mock("../../lib/firebase", () => ({ db: {} }));
const nextPatientSerial = vi.fn();
vi.mock("../../lib/serial", () => ({ nextPatientSerial: () => nextPatientSerial() }));

import { createPatient, listPatients, updatePatient } from "./patientsRepo";

beforeEach(() => {
  addDoc.mockReset(); getDocs.mockReset(); updateDoc.mockReset(); nextPatientSerial.mockReset();
});

describe("createPatient", () => {
  it("assigns a serial and writes derived fields", async () => {
    nextPatientSerial.mockResolvedValue(7);
    addDoc.mockResolvedValue({ id: "new-id" });
    const id = await createPatient({ name: "Asha", dob: 100, gender: "Female", place: "Kochi", phone: "9" });
    expect(id).toBe("new-id");
    const payload = addDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.serialNo).toBe(7);
    expect(payload.nameLower).toBe("asha");
    expect(payload.lastVisitAt).toBeNull();
    expect(typeof payload.createdAt).toBe("number");
  });
});

describe("listPatients", () => {
  it("maps Firestore docs to Patient objects", async () => {
    getDocs.mockResolvedValue({
      docs: [{
        id: "p1",
        data: () => ({ name: "Asha", nameLower: "asha", dob: 1, gender: "Female", place: "Kochi", phone: "9", serialNo: 1, createdAt: 2, lastVisitAt: 3 }),
      }],
    });
    const list = await listPatients();
    expect(list).toEqual([{
      id: "p1", name: "Asha", nameLower: "asha", dob: 1, gender: "Female", place: "Kochi", phone: "9", serialNo: 1, createdAt: 2, lastVisitAt: 3,
    }]);
  });
});

describe("updatePatient", () => {
  it("rewrites nameLower from the new name", async () => {
    updateDoc.mockResolvedValue(undefined);
    await updatePatient("p1", { name: "New Name", dob: 1, gender: "Male", place: "", phone: "" });
    const payload = updateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.nameLower).toBe("new name");
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npm test -- patientsRepo`
Expected: FAIL — cannot resolve `./patientsRepo`.

- [ ] **Step 7: Write the repository**

```ts
// src/features/patients/patientsRepo.ts
import {
  addDoc, collection, doc, getDoc, getDocs, orderBy, query, updateDoc,
  type DocumentData, type QueryDocumentSnapshot, type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { nextPatientSerial } from "../../lib/serial";
import type { Patient, PatientFormValues } from "./patientSchema";

const COLLECTION = "patients";

function toPatient(snap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>): Patient {
  const d = snap.data() as DocumentData;
  return {
    id: snap.id,
    name: d.name,
    nameLower: d.nameLower,
    dob: d.dob,
    gender: d.gender,
    place: d.place ?? "",
    phone: d.phone ?? "",
    serialNo: d.serialNo,
    createdAt: d.createdAt,
    lastVisitAt: d.lastVisitAt ?? null,
  };
}

export async function listPatients(): Promise<Patient[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), orderBy("nameLower")));
  return snap.docs.map(toPatient);
}

export async function getPatient(id: string): Promise<Patient | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? toPatient(snap) : null;
}

export async function createPatient(values: PatientFormValues): Promise<string> {
  const serialNo = await nextPatientSerial();
  const ref = await addDoc(collection(db, COLLECTION), {
    ...values,
    nameLower: values.name.toLowerCase(),
    serialNo,
    createdAt: Date.now(),
    lastVisitAt: null,
  });
  return ref.id;
}

export async function updatePatient(id: string, values: PatientFormValues): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    ...values,
    nameLower: values.name.toLowerCase(),
  });
}
```

- [ ] **Step 8: Run to verify all tests pass**

Run: `npm test -- patientSchema patientsRepo`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/patients/patientSchema.ts src/features/patients/patientSchema.test.ts \
  src/features/patients/patientsRepo.ts src/features/patients/patientsRepo.test.ts
git commit -m "feat: add patient schema and Firestore repository"
```

---

### Task 3: Patient query hooks (`usePatients.ts`)

**Files:**
- Create: `src/features/patients/usePatients.ts`
- Test: `src/features/patients/usePatients.test.tsx`

**Interfaces:**
- Consumes: repo functions from `./patientsRepo`; `PatientFormValues` from `./patientSchema`.
- Produces:
  - `usePatients()` → query, key `["patients"]`.
  - `usePatient(id: string | undefined)` → query, key `["patients", id]`, disabled when no id.
  - `useCreatePatient()` → mutation `(values: PatientFormValues) => Promise<string>`; invalidates `["patients"]`.
  - `useUpdatePatient(id: string)` → mutation `(values: PatientFormValues) => Promise<void>`; invalidates `["patients"]` and `["patients", id]`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/patients/usePatients.test.tsx
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("./patientsRepo", () => ({
  listPatients: vi.fn().mockResolvedValue([{ id: "p1", name: "Asha" }]),
  getPatient: vi.fn(),
  createPatient: vi.fn(),
  updatePatient: vi.fn(),
}));

import { usePatients } from "./usePatients";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("usePatients", () => {
  it("returns the patient list from the repository", async () => {
    const { result } = renderHook(() => usePatients(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "p1", name: "Asha" }]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- usePatients`
Expected: FAIL — cannot resolve `./usePatients`.

- [ ] **Step 3: Write the hooks**

```ts
// src/features/patients/usePatients.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPatient, getPatient, listPatients, updatePatient } from "./patientsRepo";
import type { PatientFormValues } from "./patientSchema";

export function usePatients() {
  return useQuery({ queryKey: ["patients"], queryFn: listPatients });
}

export function usePatient(id: string | undefined) {
  return useQuery({
    queryKey: ["patients", id],
    queryFn: () => getPatient(id as string),
    enabled: !!id,
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: PatientFormValues) => createPatient(values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

export function useUpdatePatient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: PatientFormValues) => updatePatient(id, values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patients"] });
      void qc.invalidateQueries({ queryKey: ["patients", id] });
    },
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- usePatients`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/patients/usePatients.ts src/features/patients/usePatients.test.tsx
git commit -m "feat: add patient query hooks"
```

---

### Task 4: Consultation schema + repository

**Files:**
- Create: `src/features/consultations/consultationSchema.ts`, `src/features/consultations/consultationsRepo.ts`
- Test: `src/features/consultations/consultationSchema.test.ts`, `src/features/consultations/consultationsRepo.test.ts`

**Interfaces:**
- Consumes: `db` from `../../lib/firebase`.
- Produces:
  - `PAYMENT_MODES = ["Cash","UPI","No Fees","Debt"] as const`; `type PaymentMode`.
  - `consultationFormSchema` (zod); `type ConsultationFormValues = { date: number; complaint: string; generals: string; allergy: string; history: string; remedy: string; remarks: string; amount: number; paymentMode: PaymentMode }`.
  - `interface Consultation extends ConsultationFormValues { id: string; patientId: string; patientName: string; serialNo: number; createdAt: number }`.
  - `type ConsultationPatientRef = { id: string; name: string; serialNo: number }`.
  - `listConsultationsByPatient(patientId: string): Promise<Consultation[]>` (newest `date` first; sorted client-side — no composite index needed).
  - `getConsultation(id: string): Promise<Consultation | null>`.
  - `createConsultation(patient: ConsultationPatientRef, values: ConsultationFormValues): Promise<string>` — batched: writes the consultation (with denormalized `patientName`/`serialNo`) **and** sets the patient's `lastVisitAt = values.date`.
  - `updateConsultation(id: string, values: ConsultationFormValues): Promise<void>`.

- [ ] **Step 1: Write the failing schema test**

```ts
// src/features/consultations/consultationSchema.test.ts
import { describe, expect, it } from "vitest";
import { consultationFormSchema } from "./consultationSchema";

describe("consultationFormSchema", () => {
  it("accepts a valid consultation", () => {
    const parsed = consultationFormSchema.parse({
      date: 100, complaint: "fever", amount: 200, paymentMode: "Cash",
    });
    expect(parsed.amount).toBe(200);
    expect(parsed.generals).toBe(""); // defaulted
  });
  it("rejects a negative amount", () => {
    expect(() => consultationFormSchema.parse({ date: 1, amount: -5, paymentMode: "Cash" })).toThrow();
  });
  it("rejects an unknown payment mode", () => {
    expect(() => consultationFormSchema.parse({ date: 1, amount: 0, paymentMode: "Card" })).toThrow();
  });
  it("requires a date", () => {
    expect(() => consultationFormSchema.parse({ amount: 0, paymentMode: "Cash" })).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- consultationSchema`
Expected: FAIL — cannot resolve `./consultationSchema`.

- [ ] **Step 3: Write the schema**

```ts
// src/features/consultations/consultationSchema.ts
import { z } from "zod";

export const PAYMENT_MODES = ["Cash", "UPI", "No Fees", "Debt"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const consultationFormSchema = z.object({
  date: z.number({
    required_error: "Date is required",
    invalid_type_error: "Date is required",
  }).int().nonnegative(),
  complaint: z.string().trim().default(""),
  generals: z.string().trim().default(""),
  allergy: z.string().trim().default(""),
  history: z.string().trim().default(""),
  remedy: z.string().trim().default(""),
  remarks: z.string().trim().default(""),
  amount: z.number({ invalid_type_error: "Amount must be a number" }).nonnegative("Amount cannot be negative"),
  paymentMode: z.enum(PAYMENT_MODES, { required_error: "Payment mode is required" }),
});

export type ConsultationFormValues = z.infer<typeof consultationFormSchema>;

export interface Consultation extends ConsultationFormValues {
  id: string;
  patientId: string;
  patientName: string;
  serialNo: number;
  createdAt: number;
}

export type ConsultationPatientRef = { id: string; name: string; serialNo: number };
```

- [ ] **Step 4: Run to verify schema test passes**

Run: `npm test -- consultationSchema`
Expected: PASS.

- [ ] **Step 5: Write the failing repository test**

```ts
// src/features/consultations/consultationsRepo.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const getDocs = vi.fn();
const updateDoc = vi.fn();
const batchSet = vi.fn();
const batchUpdate = vi.fn();
const batchCommit = vi.fn();
const writeBatch = vi.fn(() => ({ set: batchSet, update: batchUpdate, commit: batchCommit }));
const collection = vi.fn((..._a: unknown[]) => ({ path: "consultations" }));
const doc = vi.fn((..._a: unknown[]) => ({ id: "generated-id" }));
const query = vi.fn((...a: unknown[]) => a);
const where = vi.fn((...a: unknown[]) => ({ where: a }));

vi.mock("firebase/firestore", () => ({
  getDocs: (...a: unknown[]) => getDocs(...a),
  getDoc: vi.fn(),
  updateDoc: (...a: unknown[]) => updateDoc(...a),
  writeBatch: (...a: unknown[]) => writeBatch(...a),
  collection: (...a: unknown[]) => collection(...a),
  doc: (...a: unknown[]) => doc(...a),
  query: (...a: unknown[]) => query(...a),
  where: (...a: unknown[]) => where(...a),
}));
vi.mock("../../lib/firebase", () => ({ db: {} }));

import { createConsultation, listConsultationsByPatient } from "./consultationsRepo";

const values = {
  date: 500, complaint: "fever", generals: "", allergy: "", history: "",
  remedy: "Bryonia", remarks: "", amount: 200, paymentMode: "Cash" as const,
};

beforeEach(() => {
  getDocs.mockReset(); batchSet.mockReset(); batchUpdate.mockReset(); batchCommit.mockReset();
});

describe("createConsultation", () => {
  it("batches the consultation write with a patient lastVisit update", async () => {
    batchCommit.mockResolvedValue(undefined);
    const id = await createConsultation({ id: "p1", name: "Asha", serialNo: 7 }, values);
    expect(id).toBe("generated-id");
    const payload = batchSet.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.patientId).toBe("p1");
    expect(payload.patientName).toBe("Asha");
    expect(payload.serialNo).toBe(7);
    expect(payload.remedy).toBe("Bryonia");
    expect(typeof payload.createdAt).toBe("number");
    const visit = batchUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(visit.lastVisitAt).toBe(500);
    expect(batchCommit).toHaveBeenCalledOnce();
  });
});

describe("listConsultationsByPatient", () => {
  it("returns consultations sorted by date descending", async () => {
    getDocs.mockResolvedValue({
      docs: [
        { id: "c1", data: () => ({ ...values, date: 100, patientId: "p1", patientName: "Asha", serialNo: 7, createdAt: 1 }) },
        { id: "c2", data: () => ({ ...values, date: 900, patientId: "p1", patientName: "Asha", serialNo: 7, createdAt: 2 }) },
      ],
    });
    const list = await listConsultationsByPatient("p1");
    expect(list.map((c) => c.id)).toEqual(["c2", "c1"]);
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npm test -- consultationsRepo`
Expected: FAIL — cannot resolve `./consultationsRepo`.

- [ ] **Step 7: Write the repository**

```ts
// src/features/consultations/consultationsRepo.ts
import {
  collection, doc, getDoc, getDocs, query, updateDoc, where, writeBatch,
  type DocumentData, type QueryDocumentSnapshot, type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { Consultation, ConsultationFormValues, ConsultationPatientRef } from "./consultationSchema";

const COLLECTION = "consultations";
const PATIENTS = "patients";

function toConsultation(
  snap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>,
): Consultation {
  const d = snap.data() as DocumentData;
  return {
    id: snap.id,
    patientId: d.patientId,
    patientName: d.patientName,
    serialNo: d.serialNo,
    date: d.date,
    complaint: d.complaint ?? "",
    generals: d.generals ?? "",
    allergy: d.allergy ?? "",
    history: d.history ?? "",
    remedy: d.remedy ?? "",
    remarks: d.remarks ?? "",
    amount: d.amount,
    paymentMode: d.paymentMode,
    createdAt: d.createdAt,
  };
}

export async function listConsultationsByPatient(patientId: string): Promise<Consultation[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), where("patientId", "==", patientId)));
  return snap.docs.map(toConsultation).sort((a, b) => b.date - a.date);
}

export async function getConsultation(id: string): Promise<Consultation | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? toConsultation(snap) : null;
}

export async function createConsultation(
  patient: ConsultationPatientRef,
  values: ConsultationFormValues,
): Promise<string> {
  const batch = writeBatch(db);
  const ref = doc(collection(db, COLLECTION));
  batch.set(ref, {
    ...values,
    patientId: patient.id,
    patientName: patient.name,
    serialNo: patient.serialNo,
    createdAt: Date.now(),
  });
  // Stamp the patient's last visit in the same atomic batch (write by path,
  // not by importing the patients feature, to respect feature boundaries).
  batch.update(doc(db, PATIENTS, patient.id), { lastVisitAt: values.date });
  await batch.commit();
  return ref.id;
}

export async function updateConsultation(id: string, values: ConsultationFormValues): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { ...values });
}
```

- [ ] **Step 8: Run to verify all tests pass**

Run: `npm test -- consultationSchema consultationsRepo`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/consultations/consultationSchema.ts src/features/consultations/consultationSchema.test.ts \
  src/features/consultations/consultationsRepo.ts src/features/consultations/consultationsRepo.test.ts
git commit -m "feat: add consultation schema and Firestore repository"
```

---

### Task 5: Consultation query hooks (`useConsultations.ts`)

**Files:**
- Create: `src/features/consultations/useConsultations.ts`
- Test: `src/features/consultations/useConsultations.test.tsx`

**Interfaces:**
- Consumes: repo functions from `./consultationsRepo`; `ConsultationFormValues`, `ConsultationPatientRef` from `./consultationSchema`.
- Produces:
  - `useConsultations(patientId: string | undefined)` → query, key `["consultations", patientId]`, disabled when no id.
  - `useConsultation(id: string | undefined)` → query, key `["consultations", "one", id]`, disabled when no id.
  - `useCreateConsultation(patientId: string)` → mutation `({ patient, values }: { patient: ConsultationPatientRef; values: ConsultationFormValues }) => Promise<string>`; invalidates `["consultations", patientId]`, `["patients"]`, `["patients", patientId]`.
  - `useUpdateConsultation(patientId: string)` → mutation `({ id, values }: { id: string; values: ConsultationFormValues }) => Promise<void>`; invalidates `["consultations", patientId]` and `["consultations", "one", id]`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/consultations/useConsultations.test.tsx
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("./consultationsRepo", () => ({
  listConsultationsByPatient: vi.fn().mockResolvedValue([{ id: "c1", date: 1 }]),
  getConsultation: vi.fn(),
  createConsultation: vi.fn(),
  updateConsultation: vi.fn(),
}));

import { useConsultations } from "./useConsultations";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useConsultations", () => {
  it("returns the patient's consultations", async () => {
    const { result } = renderHook(() => useConsultations("p1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "c1", date: 1 }]);
  });

  it("stays disabled when no patientId is given", () => {
    const { result } = renderHook(() => useConsultations(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- useConsultations`
Expected: FAIL — cannot resolve `./useConsultations`.

- [ ] **Step 3: Write the hooks**

```ts
// src/features/consultations/useConsultations.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createConsultation, getConsultation, listConsultationsByPatient, updateConsultation,
} from "./consultationsRepo";
import type { ConsultationFormValues, ConsultationPatientRef } from "./consultationSchema";

export function useConsultations(patientId: string | undefined) {
  return useQuery({
    queryKey: ["consultations", patientId],
    queryFn: () => listConsultationsByPatient(patientId as string),
    enabled: !!patientId,
  });
}

export function useConsultation(id: string | undefined) {
  return useQuery({
    queryKey: ["consultations", "one", id],
    queryFn: () => getConsultation(id as string),
    enabled: !!id,
  });
}

export function useCreateConsultation(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { patient: ConsultationPatientRef; values: ConsultationFormValues }) =>
      createConsultation(vars.patient, vars.values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["consultations", patientId] });
      void qc.invalidateQueries({ queryKey: ["patients"] });
      void qc.invalidateQueries({ queryKey: ["patients", patientId] });
    },
  });
}

export function useUpdateConsultation(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; values: ConsultationFormValues }) =>
      updateConsultation(vars.id, vars.values),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["consultations", patientId] });
      void qc.invalidateQueries({ queryKey: ["consultations", "one", vars.id] });
    },
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- useConsultations`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/consultations/useConsultations.ts src/features/consultations/useConsultations.test.tsx
git commit -m "feat: add consultation query hooks"
```

---

### Task 6: Patient add/edit form page (`PatientFormPage.tsx`)

**Files:**
- Create: `src/features/patients/PatientFormPage.tsx`
- Test: `src/features/patients/PatientFormPage.test.tsx`

**Interfaces:**
- Consumes: `usePatient`, `useCreatePatient`, `useUpdatePatient` from `./usePatients`; `patientFormSchema`, `GENDERS`, `PatientFormValues` from `./patientSchema`; `msToDateInput`, `dateInputToMs` from `../../lib/dates`; `useToast` from `../../components/useToast`.
- Produces: default-exported `PatientFormPage` route component. Edit mode when route param `id` is present (`/patients/:id/edit`); otherwise create mode (`/patients/new`). On success: toast + navigate (`create` → `/patients/${newId}`, `edit` → `/patients/${id}`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/patients/PatientFormPage.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const mutateAsync = vi.fn().mockResolvedValue("new-id");
vi.mock("./usePatients", () => ({
  usePatient: () => ({ data: undefined, isLoading: false }),
  useCreatePatient: () => ({ mutateAsync, isPending: false }),
  useUpdatePatient: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
const showToast = vi.fn();
vi.mock("../../components/useToast", () => ({ useToast: () => ({ showToast }) }));

import PatientFormPage from "./PatientFormPage";

function renderCreate() {
  return render(
    <MemoryRouter initialEntries={["/patients/new"]}>
      <Routes>
        <Route path="/patients/new" element={<PatientFormPage />} />
        <Route path="/patients/:id" element={<div>detail</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PatientFormPage (create)", () => {
  it("submits a valid new patient", async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.type(screen.getByLabelText(/name/i), "Asha");
    await user.type(screen.getByLabelText(/date of birth/i), "2000-01-01");
    // gender defaults to Female; place/phone optional
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    const arg = mutateAsync.mock.calls[0][0];
    expect(arg.name).toBe("Asha");
    expect(typeof arg.dob).toBe("number");
  });

  it("shows a validation error when name is empty", async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.type(screen.getByLabelText(/date of birth/i), "2000-01-01");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- PatientFormPage`
Expected: FAIL — cannot resolve `./PatientFormPage`.

- [ ] **Step 3: Write the component**

```tsx
// src/features/patients/PatientFormPage.tsx
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { patientFormSchema, GENDERS, type PatientFormValues } from "./patientSchema";
import { usePatient, useCreatePatient, useUpdatePatient } from "./usePatients";
import { msToDateInput, dateInputToMs } from "../../lib/dates";
import { useToast } from "../../components/useToast";

const DEFAULTS: Partial<PatientFormValues> = { name: "", gender: "Female", place: "", phone: "" };

export default function PatientFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: existing } = usePatient(id);
  const create = useCreatePatient();
  const update = useUpdatePatient(id ?? "");

  const { control, handleSubmit, reset, register, formState: { errors } } =
    useForm<PatientFormValues>({
      resolver: zodResolver(patientFormSchema),
      defaultValues: DEFAULTS as PatientFormValues,
    });

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name, dob: existing.dob, gender: existing.gender,
        place: existing.place, phone: existing.phone,
      });
    }
  }, [existing, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit) {
        await update.mutateAsync(values);
        showToast("Patient updated", "success");
        navigate(`/patients/${id}`);
      } else {
        const newId = await create.mutateAsync(values);
        showToast("Patient added", "success");
        navigate(`/patients/${newId}`);
      }
    } catch {
      showToast("Could not save patient. Please try again.", "error");
    }
  });

  const busy = create.isPending || update.isPending;

  return (
    <Box component="form" onSubmit={onSubmit} sx={{ maxWidth: 480, mx: "auto" }}>
      <Typography variant="h5" sx={{ mb: 3 }}>{isEdit ? "Edit patient" : "Add patient"}</Typography>
      <Stack spacing={2}>
        <TextField label="Name" fullWidth required
          {...register("name")} error={!!errors.name} helperText={errors.name?.message} />

        <Controller name="dob" control={control} render={({ field }) => (
          <TextField label="Date of birth" type="date" fullWidth required
            InputLabelProps={{ shrink: true }}
            value={field.value ? msToDateInput(field.value) : ""}
            onChange={(e) => field.onChange(e.target.value ? dateInputToMs(e.target.value) : undefined)}
            error={!!errors.dob} helperText={errors.dob?.message} />
        )} />

        <Controller name="gender" control={control} render={({ field }) => (
          <TextField label="Gender" select fullWidth required {...field}
            error={!!errors.gender} helperText={errors.gender?.message}>
            {GENDERS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
          </TextField>
        )} />

        <TextField label="Place" fullWidth {...register("place")} />
        <TextField label="Phone" fullWidth {...register("phone")} />

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button onClick={() => navigate(-1)} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- PatientFormPage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/patients/PatientFormPage.tsx src/features/patients/PatientFormPage.test.tsx
git commit -m "feat: add patient add/edit form page"
```

---

### Task 7: Consultation timeline + add/edit form page

**Files:**
- Create: `src/features/consultations/ConsultationTimeline.tsx`, `src/features/consultations/ConsultationFormPage.tsx`
- Test: `src/features/consultations/ConsultationFormPage.test.tsx`

**Interfaces:**
- Consumes: `usePatient` from `../patients/usePatients` **— exception:** the consultation form needs the patient's `name`/`serialNo` to denormalize. `usePatients` is the patients feature's public hook surface (not internal Firestore plumbing), and patient↔consultation is an inherent coupling; importing the hook is acceptable. Do **not** import `patientsRepo` directly. Also consumes `useConsultation`, `useCreateConsultation`, `useUpdateConsultation` from `./useConsultations`; `consultationFormSchema`, `PAYMENT_MODES`, `ConsultationFormValues` from `./consultationSchema`; `msToDateInput`, `dateInputToMs`, `formatDate` from `../../lib/dates`; `useToast`.
- Produces:
  - `ConsultationTimeline` (named or default export — default): props `{ consultations: Consultation[]; onSelect(id: string): void }`. Renders a newest-first list; each row shows `formatDate(date)`, complaint, remedy, and `₹{amount}` · paymentMode.
  - `ConsultationFormPage` default export. Route params: `patientId` (required) and optional `cid` (edit mode). On success: toast + navigate to `/patients/${patientId}`.

- [ ] **Step 1: Write the failing form test**

```tsx
// src/features/consultations/ConsultationFormPage.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const mutateAsync = vi.fn().mockResolvedValue("c-new");
vi.mock("../patients/usePatients", () => ({
  usePatient: () => ({ data: { id: "p1", name: "Asha", serialNo: 7 }, isLoading: false }),
}));
vi.mock("./useConsultations", () => ({
  useConsultation: () => ({ data: undefined, isLoading: false }),
  useCreateConsultation: () => ({ mutateAsync, isPending: false }),
  useUpdateConsultation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
const showToast = vi.fn();
vi.mock("../../components/useToast", () => ({ useToast: () => ({ showToast }) }));

import ConsultationFormPage from "./ConsultationFormPage";

describe("ConsultationFormPage (create)", () => {
  it("submits a new consultation with the patient ref", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/patients/p1/consultations/new"]}>
        <Routes>
          <Route path="/patients/:patientId/consultations/new" element={<ConsultationFormPage />} />
          <Route path="/patients/:id" element={<div>detail</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText(/date/i), "2026-06-17");
    await user.type(screen.getByLabelText(/complaint/i), "fever");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    const arg = mutateAsync.mock.calls[0][0];
    expect(arg.patient).toEqual({ id: "p1", name: "Asha", serialNo: 7 });
    expect(arg.values.complaint).toBe("fever");
    expect(arg.values.paymentMode).toBe("Cash");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- ConsultationFormPage`
Expected: FAIL — cannot resolve `./ConsultationFormPage`.

- [ ] **Step 3: Write the timeline component**

```tsx
// src/features/consultations/ConsultationTimeline.tsx
import { List, ListItemButton, ListItemText, Typography } from "@mui/material";
import { formatDate } from "../../lib/dates";
import type { Consultation } from "./consultationSchema";

interface Props {
  consultations: Consultation[];
  onSelect: (id: string) => void;
}

export default function ConsultationTimeline({ consultations, onSelect }: Props) {
  return (
    <List disablePadding>
      {consultations.map((c) => (
        <ListItemButton key={c.id} onClick={() => onSelect(c.id)} divider>
          <ListItemText
            primary={
              <Typography component="span" sx={{ fontWeight: 600 }}>
                {formatDate(c.date)} — {c.complaint || "Consultation"}
              </Typography>
            }
            secondary={
              <>
                {c.remedy && <span>Remedy: {c.remedy} · </span>}
                <span>₹{c.amount} · {c.paymentMode}</span>
              </>
            }
          />
        </ListItemButton>
      ))}
    </List>
  );
}
```

- [ ] **Step 4: Write the form component**

```tsx
// src/features/consultations/ConsultationFormPage.tsx
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import {
  consultationFormSchema, PAYMENT_MODES, type ConsultationFormValues,
} from "./consultationSchema";
import { useConsultation, useCreateConsultation, useUpdateConsultation } from "./useConsultations";
import { usePatient } from "../patients/usePatients";
import { msToDateInput, dateInputToMs } from "../../lib/dates";
import { useToast } from "../../components/useToast";

const DEFAULTS: Partial<ConsultationFormValues> = {
  complaint: "", generals: "", allergy: "", history: "", remedy: "", remarks: "",
  amount: 0, paymentMode: "Cash",
};

const TEXT_FIELDS: { name: keyof ConsultationFormValues; label: string }[] = [
  { name: "complaint", label: "Complaint" },
  { name: "generals", label: "Generals" },
  { name: "allergy", label: "Allergy" },
  { name: "history", label: "History" },
  { name: "remedy", label: "Remedy" },
  { name: "remarks", label: "Remarks" },
];

export default function ConsultationFormPage() {
  const { patientId, cid } = useParams<{ patientId: string; cid: string }>();
  const isEdit = !!cid;
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: patient } = usePatient(patientId);
  const { data: existing } = useConsultation(cid);
  const create = useCreateConsultation(patientId ?? "");
  const update = useUpdateConsultation(patientId ?? "");

  const { control, handleSubmit, reset, register, formState: { errors } } =
    useForm<ConsultationFormValues>({
      resolver: zodResolver(consultationFormSchema),
      defaultValues: { ...DEFAULTS, date: Date.now() } as ConsultationFormValues,
    });

  useEffect(() => {
    if (existing) {
      reset({
        date: existing.date, complaint: existing.complaint, generals: existing.generals,
        allergy: existing.allergy, history: existing.history, remedy: existing.remedy,
        remarks: existing.remarks, amount: existing.amount, paymentMode: existing.paymentMode,
      });
    }
  }, [existing, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit && cid) {
        await update.mutateAsync({ id: cid, values });
        showToast("Consultation updated", "success");
      } else if (patient) {
        await create.mutateAsync({
          patient: { id: patient.id, name: patient.name, serialNo: patient.serialNo },
          values,
        });
        showToast("Consultation added", "success");
      } else {
        return; // patient not loaded yet
      }
      navigate(`/patients/${patientId}`);
    } catch {
      showToast("Could not save consultation. Please try again.", "error");
    }
  });

  const busy = create.isPending || update.isPending;

  return (
    <Box component="form" onSubmit={onSubmit} sx={{ maxWidth: 560, mx: "auto" }}>
      <Typography variant="h5" sx={{ mb: 1 }}>{isEdit ? "Edit consultation" : "Add consultation"}</Typography>
      {patient && <Typography color="text.secondary" sx={{ mb: 2 }}>{patient.name} · #{patient.serialNo}</Typography>}
      <Stack spacing={2}>
        <Controller name="date" control={control} render={({ field }) => (
          <TextField label="Date" type="date" fullWidth required
            InputLabelProps={{ shrink: true }}
            value={field.value ? msToDateInput(field.value) : ""}
            onChange={(e) => field.onChange(e.target.value ? dateInputToMs(e.target.value) : undefined)}
            error={!!errors.date} helperText={errors.date?.message} />
        )} />

        {TEXT_FIELDS.map((f) => (
          <TextField key={f.name} label={f.label} fullWidth multiline minRows={1} {...register(f.name)} />
        ))}

        <Controller name="amount" control={control} render={({ field }) => (
          <TextField label="Amount (₹)" type="number" fullWidth
            value={Number.isFinite(field.value) ? field.value : ""}
            onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
            error={!!errors.amount} helperText={errors.amount?.message} />
        )} />

        <Controller name="paymentMode" control={control} render={({ field }) => (
          <TextField label="Payment mode" select fullWidth required {...field}
            error={!!errors.paymentMode} helperText={errors.paymentMode?.message}>
            {PAYMENT_MODES.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>
        )} />

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button onClick={() => navigate(-1)} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? "Saving..." : "Save"}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- ConsultationFormPage`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/consultations/ConsultationTimeline.tsx \
  src/features/consultations/ConsultationFormPage.tsx \
  src/features/consultations/ConsultationFormPage.test.tsx
git commit -m "feat: add consultation timeline and add/edit form page"
```

---

### Task 8: Patient list page (`PatientListPage.tsx`)

**Files:**
- Create: `src/features/patients/PatientListPage.tsx`
- Test: `src/features/patients/PatientListPage.test.tsx`

**Interfaces:**
- Consumes: `usePatients` from `./usePatients`; `QueryStates` from `../../components/QueryStates`; `calcAge`, `formatDate` from `../../lib/dates`.
- Produces: default-exported `PatientListPage`. Renders a search box filtering by name (case-insensitive substring on `nameLower`) **or** phone substring; a list of patients (name, `#serialNo`, age, place, last visit); a `Fab` ("+") linking to `/patients/new`. Clicking a row navigates to `/patients/${id}`. Wraps the list in `QueryStates` (empty message `"No patients yet"`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/patients/PatientListPage.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const data = [
  { id: "p1", name: "Asha", nameLower: "asha", dob: 946684800000, gender: "Female", place: "Kochi", phone: "111", serialNo: 1, createdAt: 1, lastVisitAt: 946684800000 },
  { id: "p2", name: "Biju", nameLower: "biju", dob: 946684800000, gender: "Male", place: "Aluva", phone: "222", serialNo: 2, createdAt: 1, lastVisitAt: null },
];
vi.mock("./usePatients", () => ({
  usePatients: () => ({ status: "success", data }),
}));

import PatientListPage from "./PatientListPage";

const renderPage = () =>
  render(<MemoryRouter><PatientListPage /></MemoryRouter>);

describe("PatientListPage", () => {
  it("lists patients", () => {
    renderPage();
    expect(screen.getByText("Asha")).toBeInTheDocument();
    expect(screen.getByText("Biju")).toBeInTheDocument();
  });

  it("filters by name", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/search/i), "biju");
    expect(screen.queryByText("Asha")).not.toBeInTheDocument();
    expect(screen.getByText("Biju")).toBeInTheDocument();
  });

  it("filters by phone", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/search/i), "111");
    expect(screen.getByText("Asha")).toBeInTheDocument();
    expect(screen.queryByText("Biju")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- PatientListPage`
Expected: FAIL — cannot resolve `./PatientListPage`.

- [ ] **Step 3: Write the component**

```tsx
// src/features/patients/PatientListPage.tsx
import { useMemo, useState } from "react";
import {
  Box, Fab, List, ListItemButton, ListItemText, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { Link, useNavigate } from "react-router-dom";
import { usePatients } from "./usePatients";
import QueryStates from "../../components/QueryStates";
import { calcAge, formatDate } from "../../lib/dates";

export default function PatientListPage() {
  const { status, data } = usePatients();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data ?? [];
    if (!q) return list;
    return list.filter((p) => p.nameLower.includes(q) || p.phone.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <Box sx={{ position: "relative", minHeight: "60vh" }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Patients</Typography>
      <TextField
        label="Search by name or phone"
        fullWidth size="small" sx={{ mb: 2 }}
        value={search} onChange={(e) => setSearch(e.target.value)}
      />
      <QueryStates status={status} isEmpty={filtered.length === 0} emptyMessage="No patients yet">
        <List>
          {filtered.map((p) => (
            <ListItemButton key={p.id} onClick={() => navigate(`/patients/${p.id}`)} divider>
              <ListItemText
                primary={`${p.name} · #${p.serialNo}`}
                secondary={
                  `${calcAge(p.dob)} yrs` +
                  (p.place ? ` · ${p.place}` : "") +
                  (p.lastVisitAt ? ` · Last visit ${formatDate(p.lastVisitAt)}` : "")
                }
              />
            </ListItemButton>
          ))}
        </List>
      </QueryStates>
      <Fab color="primary" aria-label="Add patient" component={Link} to="/patients/new"
        sx={{ position: "fixed", bottom: { xs: 72, md: 24 }, right: 24 }}>
        <AddIcon />
      </Fab>
    </Box>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- PatientListPage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/patients/PatientListPage.tsx src/features/patients/PatientListPage.test.tsx
git commit -m "feat: add searchable patient list page"
```

---

### Task 9: Patient detail page (`PatientDetailPage.tsx`)

**Files:**
- Create: `src/features/patients/PatientDetailPage.tsx`
- Test: `src/features/patients/PatientDetailPage.test.tsx`

**Interfaces:**
- Consumes: `usePatient` from `./usePatients`; `useConsultations` from `../consultations/useConsultations`; `ConsultationTimeline` from `../consultations/ConsultationTimeline`; `calcAge` from `../../lib/dates`; `QueryStates`.
- Produces: default-exported `PatientDetailPage`. Reads route param `id`. Shows a profile card (name, `#serialNo`, age, gender, place, phone) with an "Edit" button → `/patients/${id}/edit`; a consultations section wrapped in `QueryStates` (empty `"No consultations yet"`) rendering `ConsultationTimeline` (tap a row → `/patients/${id}/consultations/${cid}/edit`); a `Fab` ("+") → `/patients/${id}/consultations/new`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/patients/PatientDetailPage.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("./usePatients", () => ({
  usePatient: () => ({
    data: { id: "p1", name: "Asha", serialNo: 7, dob: 946684800000, gender: "Female", place: "Kochi", phone: "111", lastVisitAt: null, createdAt: 1, nameLower: "asha" },
    isLoading: false,
  }),
}));
vi.mock("../consultations/useConsultations", () => ({
  useConsultations: () => ({
    status: "success",
    data: [{ id: "c1", patientId: "p1", patientName: "Asha", serialNo: 7, date: 946684800000, complaint: "fever", generals: "", allergy: "", history: "", remedy: "Bryonia", remarks: "", amount: 200, paymentMode: "Cash", createdAt: 1 }],
  }),
}));

import PatientDetailPage from "./PatientDetailPage";

describe("PatientDetailPage", () => {
  it("shows the patient profile and their consultation history", () => {
    render(
      <MemoryRouter initialEntries={["/patients/p1"]}>
        <Routes>
          <Route path="/patients/:id" element={<PatientDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/Asha/)).toBeInTheDocument();
    expect(screen.getByText(/#7/)).toBeInTheDocument();
    expect(screen.getByText(/fever/i)).toBeInTheDocument();
    expect(screen.getByText(/Bryonia/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- PatientDetailPage`
Expected: FAIL — cannot resolve `./PatientDetailPage`.

- [ ] **Step 3: Write the component**

```tsx
// src/features/patients/PatientDetailPage.tsx
import {
  Box, Button, Card, CardContent, Divider, Fab, Stack, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import { Link, useNavigate, useParams } from "react-router-dom";
import { usePatient } from "./usePatients";
import { useConsultations } from "../consultations/useConsultations";
import ConsultationTimeline from "../consultations/ConsultationTimeline";
import QueryStates from "../../components/QueryStates";
import { calcAge } from "../../lib/dates";

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: patient } = usePatient(id);
  const { status, data: consultations } = useConsultations(id);

  if (!patient) {
    return <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>Loading patient…</Typography>;
  }

  return (
    <Box sx={{ position: "relative", minHeight: "60vh", maxWidth: 720, mx: "auto" }}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h5">{patient.name} · #{patient.serialNo}</Typography>
              <Typography color="text.secondary">
                {calcAge(patient.dob)} yrs · {patient.gender}
                {patient.place ? ` · ${patient.place}` : ""}
              </Typography>
              {patient.phone && <Typography color="text.secondary">📞 {patient.phone}</Typography>}
            </Box>
            <Button startIcon={<EditIcon />} component={Link} to={`/patients/${id}/edit`}>Edit</Button>
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ mb: 1 }}>Consultation history</Typography>
      <Divider sx={{ mb: 1 }} />
      <QueryStates status={status} isEmpty={(consultations ?? []).length === 0} emptyMessage="No consultations yet">
        <ConsultationTimeline
          consultations={consultations ?? []}
          onSelect={(cid) => navigate(`/patients/${id}/consultations/${cid}/edit`)}
        />
      </QueryStates>

      <Fab color="primary" aria-label="Add consultation" component={Link} to={`/patients/${id}/consultations/new`}
        sx={{ position: "fixed", bottom: { xs: 72, md: 24 }, right: 24 }}>
        <AddIcon />
      </Fab>
    </Box>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- PatientDetailPage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/patients/PatientDetailPage.tsx src/features/patients/PatientDetailPage.test.tsx
git commit -m "feat: add patient detail page with consultation history"
```

---

### Task 10: Wire routes + AppShell profile/logout menu

**Files:**
- Modify: `src/App.tsx`, `src/components/AppShell.tsx`, `src/components/AppShell.test.tsx`
- Delete: `src/routes/PatientsPlaceholder.tsx`

**Interfaces:**
- Consumes: all page components above; `signOut` from `firebase/auth`; `auth` from `../lib/firebase`; `useAuth` from `../features/auth/useAuth`.
- Produces: the full patient/consultation route tree; an `AppShell` top-bar account menu (avatar `IconButton` → MUI `Menu` showing the signed-in email and a "Sign out" item that calls `signOut(auth)` then navigates to `/login`).

- [ ] **Step 1: Update the routes in `src/App.tsx`**

Replace the body so the protected block reads:

```tsx
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import AuthGuard from "./features/auth/AuthGuard";
import LoginPage from "./features/auth/LoginPage";
import PatientListPage from "./features/patients/PatientListPage";
import PatientDetailPage from "./features/patients/PatientDetailPage";
import PatientFormPage from "./features/patients/PatientFormPage";
import ConsultationFormPage from "./features/consultations/ConsultationFormPage";
import InventoryPlaceholder from "./routes/InventoryPlaceholder";
import FundsPlaceholder from "./routes/FundsPlaceholder";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <AuthGuard>
            <AppShell />
          </AuthGuard>
        }
      >
        <Route path="/patients" element={<PatientListPage />} />
        <Route path="/patients/new" element={<PatientFormPage />} />
        <Route path="/patients/:id" element={<PatientDetailPage />} />
        <Route path="/patients/:id/edit" element={<PatientFormPage />} />
        <Route path="/patients/:patientId/consultations/new" element={<ConsultationFormPage />} />
        <Route path="/patients/:patientId/consultations/:cid/edit" element={<ConsultationFormPage />} />
        <Route path="/inventory" element={<InventoryPlaceholder />} />
        <Route path="/funds" element={<FundsPlaceholder />} />
      </Route>
      <Route path="*" element={<Navigate to="/patients" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 2: Delete the obsolete placeholder**

```bash
git rm src/routes/PatientsPlaceholder.tsx
```

- [ ] **Step 3: Write the failing AppShell logout test**

Add to `src/components/AppShell.test.tsx` (keep existing tests). It must mock `firebase/auth` and `../lib/firebase`:

```tsx
import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const signOut = vi.fn().mockResolvedValue(undefined);
vi.mock("firebase/auth", () => ({ signOut: (...a: unknown[]) => signOut(...a) }));
vi.mock("../lib/firebase", () => ({ auth: {} }));
vi.mock("../features/auth/useAuth", () => ({
  useAuth: () => ({ user: { email: "doc@example.com" }, loading: false }),
}));

import AppShell from "./AppShell";

test("account menu signs the user out", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter><AppShell><div /></AppShell></MemoryRouter>);
  await user.click(screen.getByRole("button", { name: /account/i }));
  await user.click(screen.getByRole("menuitem", { name: /sign out/i }));
  expect(signOut).toHaveBeenCalledTimes(1);
});
```

> If the existing `AppShell.test.tsx` already renders without a router, wrap those renders in `<MemoryRouter>` too, since `AppShell` now uses `useNavigate`.

- [ ] **Step 4: Run to verify it fails**

Run: `npm test -- AppShell`
Expected: FAIL — no "account" button / no "Sign out" menu item yet.

- [ ] **Step 5: Add the account menu to `src/components/AppShell.tsx`**

Add imports:

```tsx
import { useState, type MouseEvent } from "react";
import { IconButton, Menu, MenuItem, ListItemText as MenuItemText } from "@mui/material";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../features/auth/useAuth";
```

Inside the component, before `return`:

```tsx
  const navigate = useNavigate();
  const { user } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = (e: MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const closeMenu = () => setAnchorEl(null);
  const handleSignOut = async () => {
    closeMenu();
    await signOut(auth);
    navigate("/login", { replace: true });
  };
```

In the `<Toolbar>`, after the title `Typography`, add:

```tsx
          <IconButton color="inherit" aria-label="account" onClick={openMenu}>
            <AccountCircleIcon />
          </IconButton>
          <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={closeMenu}>
            {user?.email && (
              <MenuItem disabled>
                <MenuItemText primary={user.email} />
              </MenuItem>
            )}
            <MenuItem onClick={handleSignOut}>Sign out</MenuItem>
          </Menu>
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm test -- AppShell`
Expected: PASS (existing shell tests + new logout test).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/AppShell.tsx src/components/AppShell.test.tsx
git commit -m "feat: wire patient/consultation routes and add account/logout menu"
```

---

### Task 11: Full verification gate

**Files:** none (verification only).

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: no errors. (No `any`; unused imports removed.)

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all suites pass (Foundation 12 + new patient/consultation suites).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: `tsc -b` clean, `vite build` writes `dist/` with no type errors.

- [ ] **Step 4: Manual smoke (optional, needs `.env.local` + a Firebase Auth user)**

Run: `npm run dev`, sign in, then verify: add a patient (serial assigned) → opens detail → add a consultation → appears in timeline, `lastVisitAt` shows in the list → edit patient and consultation → search by name and phone → sign out from the account menu.

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "chore: Plan 2 verification fixes" --allow-empty
```

---

## Self-Review (against the spec §6 "Patients & Consultations" and handoff)

- **Patient list — searchable by name/phone; name, serial #, age, place, last visit; tap → detail.** → Task 8. ✓
- **Patient detail — profile + consultation history timeline (newest first) + "+" add consultation.** → Tasks 7 (timeline) + 9. ✓
- **Add/Edit patient — dob/name/gender/place/phone; serial via `nextPatientSerial()`; writes `nameLower`.** → Tasks 2 (repo) + 6 (form). ✓
- **Add/Edit consultation — complaint, generals, allergy, history, remedy, remarks, date, amount, paymentMode (Cash/UPI/No Fees/Debt); top-level doc with `patientId` + denormalized `patientName`/`serialNo`; updates patient `lastVisitAt`.** → Tasks 4 (repo, batched lastVisit) + 7 (form). ✓
- **Repositories + TanStack Query hooks + zod schemas under `patients/` and `consultations/`.** → Tasks 2–5. ✓
- **Age derived from `dob`.** → Task 1 `calcAge`, used in list + detail. ✓
- **Dates epoch ms; money rupee numbers; `QueryStates` on every list; `useToast` on mutations.** → enforced across tasks. ✓
- **Carried-over: Logout/profile menu in AppShell; FAB pattern.** → Task 10 (menu); FABs in Tasks 8 & 9. ✓
- **Firestore rules:** existing `/{document=**}` rule already covers `patients` and `consultations` for signed-in users — **no rules change needed.** ✓
- **No composite index needed:** consultations queried by `patientId` only, sorted client-side by date. ✓

**Deferred (not in this plan, by design):** the optional removal of `AppShell`'s test-only `children` prop (kept so existing/added AppShell tests can inject children); patient/consultation delete (spec lists add/edit only).
