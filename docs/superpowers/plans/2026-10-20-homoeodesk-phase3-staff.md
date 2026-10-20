# HomoeoDesk Phase 3 — Staff Leave & Salary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An owner-only Staff module (staff records, leaves, a monthly payroll with "Mark paid") whose salary payments also show up as a "Salaries" line in the owner's Funds view.

**Architecture:** New feature folder `src/features/staff/` (schema, repo, hooks, pure payroll math, pages) on the existing repository + zod + TanStack Query pattern. All day and month math runs in the clinic's time zone through a new shared `src/lib/zonedDates.ts` (dayjs `utc` + `timezone` plugins). Firestore rules add explicit `manager(clinicId)` matches for `staff`, `leaves` and `salaryPayments`. These are not in `memberSubs()`, so members stay denied. Funds keeps its own read-only query on `salaryPayments`, the same way it already reads `consultations`.

**Tech Stack:** Vite + React + TypeScript, MUI v6 (`sx`), TanStack Query, react-router v6, Firebase v10 Firestore, zod, dayjs (utc/timezone plugins ship with dayjs), Vitest + RTL, `@firebase/rules-unit-testing`.

**Spec:** `docs/superpowers/specs/2026-10-20-homoeodesk-roles-branding-staff-booking-design.md`, section "Phase 3: Staff leave & salary (owner-only)" plus "Cross-cutting technical decisions" (time zone).

## Global Constraints

- Data (owner/superadmin only, by rules):
  - `staff/{id}`: `name, nameLower, phone, designation, joinedOn, leftOn?, monthlySalary, active, createdAt`
  - `leaves/{id}`: `staffId, staffName, from, to` (day starts in the clinic zone, inclusive), `halfDay` (only when from == to), `type`, `note, createdAt`
  - `salaryPayments/{staffId}_{YYYY-MM}`: `staffId, staffName, month, base, paidDays, unpaidDays, deduction, adjustment, adjustmentNote, net, paidOn, paymentMode` (Cash/UPI/Bank), `needsReview` (bool)
- Payroll math:
  - `base = monthlySalary × daysEmployedInMonth ÷ daysInMonth`, prorated by `joinedOn` and `leftOn`.
  - `deduction = round(monthlySalary ÷ daysInMonth × unpaidDays)`. A half day counts 0.5. A leave that spans months is split per month.
  - `net = base − deduction + adjustment`.
- Leaves for a month are fetched by querying `from <= monthEnd`, then filtering `to >= monthStart` on the client. No composite index.
- Adding, editing or deleting a leave that overlaps an already-paid month sets that payment's `needsReview = true` in the same batch.
- Salaries stay out of `expenses`. The owner's Funds view adds a "Salaries" line from `salaryPayments` into the period's expenses and balance. Members' Funds view is unchanged.
- Day starts and months (`YYYY-MM`) use the clinic time zone (`clinics/{id}.timeZone`, default `"Asia/Kolkata"`), never the device zone. Storage is epoch ms. Money is rupee numbers, shown with `₹`.
- The Staff nav item is owner-only. Routes sit behind `<OwnerOnly>`, and rules are the real gate.
- CLAUDE.md conventions apply:
  - No Firestore SDK calls in UI.
  - `useToast`, never `alert()`.
  - `QueryStates` for lists.
  - MUI `sx`.
  - TDD with mocked Firestore.
  - Emulator rules tests for every rules change.
  - Features don't import each other's internals; reading `useMembership`/`useClinicPath` from `features/auth` is the existing precedent.
- Rules tests on Java 17: `npx -y firebase-tools@13.35.1 emulators:exec --only firestore --project demo-grace "npx vitest run --config vitest.rules.config.ts"`.
- Commits end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01T6MiZBEjXNRm2VKXiQfA6E
  ```

**Decisions this plan makes (the spec leaves them open):**
- Leave `type` ∈ `"Casual" | "Sick" | "Unpaid"`. Only `Unpaid` counts toward `unpaidDays`.
- `base` is rounded with `Math.round` so every stored amount is a whole rupee.
- `paidDays = daysEmployed − unpaidDays`.
- Unpaid days are clipped to the employment range, so leave before `joinedOn` or after `leftOn` is ignored.
- `active` is stored as `leftOn === null`. Someone with a future `leftOn` is still employed until then; the list shows "Leaving <date>" when `leftOn` is in the future (clinic zone) and "Left <date>" otherwise.
- Overlapping leaves for the same staff member are rejected, so unpaid days can't be double-counted.
- A payment can be undone ("Undo payment", with confirm), which deletes the payment doc.
- Payroll recomputes from the *current* `monthlySalary`, so "Now ₹…" on a paid row appears only when `needsReview` is true (a later raise must not flag every past month).
- The Funds expense category `"Salary"` stays (non-staff salary costs), but ExpenseFormPage shows this helper when it's picked: "Staff salaries marked paid in Payroll are added to Funds automatically — don't enter them here."
- Staff are never deleted; set `leftOn` instead.
- Payroll lists every staff member employed for at least one day of the month, plus anyone who already has a payment for that month.
- "Mark paid" writes the whole payment doc with `setDoc`, which clears `needsReview`. Paying again after a review overwrites the same doc.
- Funds counts a payment in a period by `paidOn`.

## Review Focus

1. **Leave across a month or year boundary.** For example Jan 30 – Feb 2: Jan counts 2 days and Feb counts 2. Yearly totals split the same way across Dec/Jan. Pinned in Task 3.
2. **Device zone ≠ clinic zone.** A date typed as `2026-02-01` must store the Asia/Kolkata day start, even when tests or the device run in UTC. Month ranges must be Kolkata months. Pinned in Tasks 1 and 3 with absolute epoch values.
3. **Editing a leave so it moves out of a paid month.** The old month's payment must be flagged too (old range ∪ new range), not just the new one. Deleting a leave flags its months. Pinned in Task 4.
4. **Mid-month joiner or leaver, with leave outside employment.** Base is prorated, unpaid days are clipped to employment, and a month with zero employed days gives no payroll line. Pinned in Tasks 3 and 7.
5. **A member reaching staff data.** A member who opens `/:clinic/staff…` URLs is redirected, and direct Firestore reads and writes to `staff`, `leaves` and `salaryPayments` are denied. A member's Funds view never queries `salaryPayments`, because that would surface a permission error. Pinned in Tasks 2, 5 and 8.

---

### Task 1: Clinic-zone dates and the clinic's time zone

**Files:**
- Create: `src/lib/zonedDates.ts`, `src/lib/zonedDates.test.ts`
- Modify: `src/lib/clinicQueries.ts` (add `timeZone` to `Clinic`, add `DEFAULT_TIME_ZONE` and `useClinicTimeZone`), `src/lib/clinicQueries.test.ts`

**Interfaces:**
- Produces, in `src/lib/zonedDates.ts`, which calls `dayjs.extend(utc)` and `dayjs.extend(timezone)` once:
  - `dayStartInZone(ms: number, tz: string): number`
  - `monthKeyOf(ms: number, tz: string): string`, e.g. `"2026-02"`
  - `monthRange(month: string, tz: string): { start: number; end: number; days: number }`. `start` is the first ms of the month in tz, `end` is the next month's start − 1, `days` is the day count.
  - `addDaysInZone(dayStartMs: number, n: number, tz: string): number`
  - `daysBetweenInclusive(fromDayStart: number, toDayStart: number, tz: string): number`. Returns 0 when to < from.
  - `dateInputToZonedMs(value: string, tz: string): number`. Turns `"YYYY-MM-DD"` into that day's start in tz.
  - `zonedMsToDateInput(ms: number, tz: string): string`
  - `formatZonedDate(ms: number, tz: string): string`. Format `"D MMM YYYY"`, matching `formatDate` in `lib/dates.ts`.
  - `formatMonth(month: string): string`, e.g. `"Feb 2026"`.
- Produces, in `src/lib/clinicQueries.ts`:
  - `DEFAULT_TIME_ZONE = "Asia/Kolkata"`.
  - `Clinic.timeZone?: string` (optional, so `features/access/clinicsRepo.ts` `listClinics` and its exact-`toEqual` tests stay untouched). `getClinic` sets it only when the stored field is a string.
  - `useClinicTimeZone(clinicId: string | undefined): string` returns `useClinic(clinicId).data?.timeZone ?? DEFAULT_TIME_ZONE`.

- [ ] **Step 1: Write failing tests** in `zonedDates.test.ts`. Use `const TZ = "Asia/Kolkata"` (UTC+5:30) and exact epochs:

```ts
test("dateInputToZonedMs gives the clinic-zone day start", () => {
  expect(dateInputToZonedMs("2026-02-01", TZ)).toBe(Date.UTC(2026, 0, 31, 18, 30));
  expect(zonedMsToDateInput(Date.UTC(2026, 0, 31, 18, 30), TZ)).toBe("2026-02-01");
});
test("monthRange is the Kolkata month", () => {
  expect(monthRange("2026-02", TZ)).toEqual({
    start: Date.UTC(2026, 0, 31, 18, 30),
    end: Date.UTC(2026, 1, 28, 18, 30) - 1,
    days: 28,
  });
  expect(monthRange("2024-02", TZ).days).toBe(29);
});
test("monthKeyOf uses the zone, not UTC", () => {
  // 2026-01-31 20:00 UTC is already 1 Feb in Kolkata
  expect(monthKeyOf(Date.UTC(2026, 0, 31, 20, 0), TZ)).toBe("2026-02");
});
test("dayStartInZone, addDaysInZone, daysBetweenInclusive", () => {
  const d = dateInputToZonedMs("2026-01-30", TZ);
  expect(dayStartInZone(d + 5 * 3600_000, TZ)).toBe(d);
  expect(addDaysInZone(d, 3, TZ)).toBe(dateInputToZonedMs("2026-02-02", TZ));
  expect(daysBetweenInclusive(d, addDaysInZone(d, 3, TZ), TZ)).toBe(4);
  expect(daysBetweenInclusive(addDaysInZone(d, 1, TZ), d, TZ)).toBe(0);
});
test("formatMonth", () => expect(formatMonth("2026-02")).toBe("Feb 2026"));
```

  In `clinicQueries.test.ts`, add: `getClinic` returns the stored `timeZone` when present and `undefined` when absent. Follow the existing mocking in that file.

- [ ] **Step 2: Run** `npm test -- zonedDates clinicQueries`. Expected: FAIL (module or exports missing).
- [ ] **Step 3: Implement** the functions listed under Interfaces. Use `dayjs.tz(value, tz)` for parsing and `dayjs(ms).tz(tz)` for reading.
- [ ] **Step 4: Run** `npm test -- zonedDates clinicQueries`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(dates): clinic time-zone date helpers and clinic timeZone`

---

### Task 2: Owner-only rules for staff, leaves, salaryPayments

**Files:**
- Modify: `firestore.rules` (inside `match /clinics/{clinicId}`, before the catch-all), `rules-tests/firestore.rules.test.ts`, `src/lib/clinic.ts` (`RESERVED_SLUGS` += `"staff"`), `scripts/migrate-to-clinics.mjs` (same reserved list), and `src/lib/clinic.test.ts` if it asserts the list.

**Interfaces:**
- Produces these rules:
  - `match /staff/{id}` and `match /leaves/{id}`: `allow read, write: if manager(clinicId);`
  - `match /salaryPayments/{paymentId}`:
    - `allow read, delete: if manager(clinicId);`
    - `allow create, update: if manager(clinicId) && request.resource.data.month.matches('^[0-9]{4}-(0[1-9]|1[0-2])$') && paymentId == request.resource.data.staffId + '_' + request.resource.data.month && request.resource.data.needsReview is bool;`

- [ ] **Step 1: Write failing tests.** Add a new `describe("staff, leaves and salary payments")` that uses the existing fixtures: owner `o@x.com` and member `a@x.com` in c1, owner `t@x.com` in c2. In `beforeEach` of the describe, seed with rules disabled: `clinics/c1/staff/s1`, `clinics/c1/leaves/l1`, `clinics/c1/salaryPayments/s1_2026-02` = `{ staffId: "s1", month: "2026-02", needsReview: false, net: 1 }`. Tests:
  - The owner reads and writes all three. For example `setDoc(clinics/c1/salaryPayments/s1_2026-03, { staffId: "s1", month: "2026-03", needsReview: false, net: 1 })` succeeds.
  - The member is denied `getDoc`, `getDocs` and `setDoc` on each of the three.
  - The c2 owner (`t@x.com`) is denied on c1's three collections.
  - The superadmin reads and writes all three.
  - The owner is denied a payment whose id doesn't match: id `s1_2026-04` with data `month: "2026-03"`. Also denied: id `s1_bad`, `month: "bad"`.
  - The owner's `updateDoc(clinics/c1/salaryPayments/s1_2026-02, { needsReview: true })` succeeds (the repo flags payments this way); the member's same update fails; month `"2026-13"` is denied.
- [ ] **Step 2: Run** the rules-test command from Global Constraints. Expected: the new owner and superadmin cases FAIL; the member and other-clinic denials already pass.
- [ ] **Step 3: Implement** the rules from Interfaces, and add `"staff"` to both reserved-slug lists.
- [ ] **Step 4: Run** the rules tests and `npm test -- clinic`. Expected: all PASS.
- [ ] **Step 5: Commit**: `feat(rules): owner-only staff, leaves and salary payments`

---

### Task 3: Pure payroll math

**Files:**
- Create: `src/features/staff/staffSchema.ts` (types and zod only, used by Tasks 3–8), `src/features/staff/payroll.ts`, `src/features/staff/payroll.test.ts`, `src/features/staff/staffSchema.test.ts`

**Interfaces:**
- Consumes: Task 1 `monthRange`, `addDaysInZone`, `daysBetweenInclusive`, `dayStartInZone`, `dateInputToZonedMs`.
- Produces, in `staffSchema.ts`:
  - `LEAVE_TYPES = ["Casual", "Sick", "Unpaid"] as const`, with type `LeaveType`.
  - `PAYMENT_MODES = ["Cash", "UPI", "Bank"] as const`, with type `PaymentMode`.
  - `staffFormSchema` (zod): `name` (trimmed, min 1, "Name is required"), `phone` (trimmed string, default ""), `designation` (trimmed string, default ""), `joinedOn` (int ms, "Joining date is required"), `leftOn` (int ms | null, default null), `monthlySalary` (number ≥ 0). Refine: `leftOn` null or ≥ `joinedOn`, with message "Leaving date can't be before joining date" on path `leftOn`.
  - `StaffFormValues`.
  - `interface Staff extends StaffFormValues { id; nameLower; active: boolean; createdAt: number }`.
  - `leaveFormSchema`: `staffId` (min 1), `staffName`, `from`, `to` (int ms), `halfDay` (bool, default false), `type` (enum `LEAVE_TYPES`), `note` (trimmed, default ""). Refines:
    - `to >= from`, message "End date can't be before start date" on path `to`.
    - `!halfDay || from === to`, message "Half day only for a single day" on path `halfDay`.
  - `LeaveFormValues`, and `interface Leave extends LeaveFormValues { id; createdAt }`.
  - `interface SalaryPayment { id; staffId; staffName; month; base; paidDays; unpaidDays; deduction; adjustment; adjustmentNote; net; paidOn; paymentMode: PaymentMode; needsReview: boolean }`.
  - `paymentId(staffId: string, month: string): string`, giving `${staffId}_${month}`.
- Produces, in `payroll.ts`:
  - `employedDaysInMonth(staff: Pick<Staff,"joinedOn"|"leftOn">, month: string, tz: string): number`
  - `leaveDaysInRange(leave: Pick<Leave,"from"|"to"|"halfDay">, rangeFrom: number, rangeTo: number, tz: string): number`. Both range bounds are day starts, inclusive. The result is the clipped overlap, and `0.5` when `halfDay` and the overlap is 1.
  - `interface PayrollLine { month; base; paidDays; unpaidDays; deduction; adjustment; net; employedDays; daysInMonth }`
  - `computePayroll(staff: Pick<Staff,"joinedOn"|"leftOn"|"monthlySalary">, leaves: Pick<Leave,"from"|"to"|"halfDay"|"type">[], month: string, tz: string, adjustment = 0): PayrollLine`
  - `monthsSpanned(from: number, to: number, tz: string): string[]`, giving ascending `YYYY-MM` keys.
  - `leaveTotalsForYear(leaves: Pick<Leave,"from"|"to"|"halfDay"|"type">[], year: number, tz: string): Record<LeaveType, number>`

Algorithm for `computePayroll`, which the signature alone doesn't settle:

```ts
const { start, end, days } = monthRange(month, tz);
const lastDay = dayStartInZone(end, tz);
const lo = Math.max(start, dayStartInZone(staff.joinedOn, tz));
const hi = Math.min(lastDay, staff.leftOn == null ? lastDay : dayStartInZone(staff.leftOn, tz));
const employedDays = daysBetweenInclusive(lo, hi, tz);           // 0 if hi < lo
const unpaidDays = Math.min(employedDays, sum over type==="Unpaid" of leaveDaysInRange(l, lo, hi, tz));
const base = Math.round(staff.monthlySalary * employedDays / days);
const deduction = Math.round(staff.monthlySalary / days * unpaidDays);
net = base - deduction + adjustment; paidDays = employedDays - unpaidDays;
```

- [ ] **Step 1: Write failing tests** in `payroll.test.ts`, using `const TZ = "Asia/Kolkata"` and `const d = (s: string) => dateInputToZonedMs(s, TZ)`.

```ts
test("full month, no leave", () => {
  expect(computePayroll({ joinedOn: d("2025-01-01"), leftOn: null, monthlySalary: 30000 }, [], "2026-02", TZ))
    .toMatchObject({ base: 30000, unpaidDays: 0, deduction: 0, net: 30000, paidDays: 28, employedDays: 28, daysInMonth: 28 });
});
test("mid-month joiner with unpaid and half-day leave plus adjustment", () => {
  const leaves = [
    { from: d("2026-02-20"), to: d("2026-02-21"), halfDay: false, type: "Unpaid" as const },
    { from: d("2026-02-25"), to: d("2026-02-25"), halfDay: true, type: "Unpaid" as const },
    { from: d("2026-02-26"), to: d("2026-02-26"), halfDay: false, type: "Casual" as const },
  ];
  expect(computePayroll({ joinedOn: d("2026-02-15"), leftOn: null, monthlySalary: 30000 }, leaves, "2026-02", TZ, 500))
    .toMatchObject({ employedDays: 14, base: 15000, unpaidDays: 2.5, deduction: 2679, paidDays: 11.5, adjustment: 500, net: 12821 });
});
test("leave spanning months is split per month", () => {
  const s = { joinedOn: d("2025-01-01"), leftOn: null, monthlySalary: 31000 };
  const l = [{ from: d("2026-01-30"), to: d("2026-02-02"), halfDay: false, type: "Unpaid" as const }];
  expect(computePayroll(s, l, "2026-01", TZ)).toMatchObject({ unpaidDays: 2, deduction: 2000 });
  expect(computePayroll(s, l, "2026-02", TZ)).toMatchObject({ unpaidDays: 2, deduction: 2214 });
});
test("leave outside employment is ignored; leaver is prorated", () => {
  const l = [{ from: d("2026-02-10"), to: d("2026-02-16"), halfDay: false, type: "Unpaid" as const }];
  expect(computePayroll({ joinedOn: d("2026-02-15"), leftOn: null, monthlySalary: 28000 }, l, "2026-02", TZ).unpaidDays).toBe(2);
  expect(computePayroll({ joinedOn: d("2025-01-01"), leftOn: d("2026-02-07"), monthlySalary: 28000 }, [], "2026-02", TZ))
    .toMatchObject({ employedDays: 7, base: 7000 });
});
test("no employed days gives a zero line", () => {
  expect(computePayroll({ joinedOn: d("2026-03-01"), leftOn: null, monthlySalary: 28000 }, [], "2026-02", TZ))
    .toMatchObject({ employedDays: 0, base: 0, net: 0 });
});
test("monthsSpanned", () => {
  expect(monthsSpanned(d("2025-12-30"), d("2026-02-02"), TZ)).toEqual(["2025-12", "2026-01", "2026-02"]);
});
test("yearly leave totals split at the year boundary", () => {
  const l = [
    { from: d("2025-12-30"), to: d("2026-01-02"), halfDay: false, type: "Casual" as const },
    { from: d("2026-03-05"), to: d("2026-03-05"), halfDay: true, type: "Sick" as const },
  ];
  expect(leaveTotalsForYear(l, 2026, TZ)).toEqual({ Casual: 2, Sick: 0.5, Unpaid: 0 });
  expect(leaveTotalsForYear(l, 2025, TZ)).toEqual({ Casual: 2, Sick: 0, Unpaid: 0 });
});
```

  In `staffSchema.test.ts`, test that:
  - `leaveFormSchema` rejects `to < from`;
  - it rejects `halfDay: true` with from ≠ to, on path `halfDay`;
  - `staffFormSchema` rejects `leftOn < joinedOn`;
  - `paymentId("s1","2026-02") === "s1_2026-02"`.
- [ ] **Step 2: Run** `npm test -- payroll staffSchema`. Expected: FAIL.
- [ ] **Step 3: Implement** `staffSchema.ts` and `payroll.ts` to match the Interfaces.
- [ ] **Step 4: Run** `npm test -- payroll staffSchema`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(staff): schemas and clinic-zone payroll math`

---

### Task 4: Staff repository and hooks (leaves flag paid months)

**Files:**
- Create: `src/features/staff/staffRepo.ts`, `src/features/staff/staffRepo.test.ts`, `src/features/staff/useStaff.ts`

**Interfaces:**
- Consumes:
  - Task 3 types, `paymentId`, `monthsSpanned`.
  - Task 1 `monthRange`.
  - `clinicCollection`, `clinicDoc` and `getActiveClinic` from `src/lib/clinic.ts`. Pin `clinicId = getActiveClinic()` at the start of multi-step functions.
- Produces, in `staffRepo.ts` (collections `"staff"`, `"leaves"`, `"salaryPayments"`):
  - `listStaff(): Promise<Staff[]>`, sorted by `nameLower`.
  - `getStaff(id: string): Promise<Staff | null>`
  - `createStaff(v: StaffFormValues): Promise<string>`. Writes `nameLower`, `active: v.leftOn === null` and `createdAt: Date.now()`.
  - `updateStaff(id: string, v: StaffFormValues): Promise<void>`. Rewrites `nameLower` and `active`.
  - `listLeavesForStaff(staffId: string): Promise<Leave[]>`. Uses `where("staffId","==",staffId)`; returns newest `from` first.
  - `listLeavesForMonth(month: string, tz: string): Promise<Leave[]>`. Queries `where("from","<=", monthRange(month,tz).end)`, then keeps `to >= start` on the client.
  - `class LeaveOverlapError extends Error {}`.
  - `saveLeave(values: LeaveFormValues, tz: string, previous?: Leave): Promise<string>`. Creates the leave when `previous` is absent and updates it otherwise. It first loads `listLeavesForStaff(values.staffId)`; if any leave other than `previous` has `from <= values.to && to >= values.from`, it throws `LeaveOverlapError` and writes nothing.
  - `deleteLeave(leave: Leave, tz: string): Promise<void>`
  - `listPaymentsForStaff(staffId: string): Promise<SalaryPayment[]>`, newest `month` first.
  - `listPaymentsForMonth(month: string): Promise<SalaryPayment[]>`, using `where("month","==",month)`.
  - `markPaid(p: Omit<SalaryPayment,"id"|"needsReview">): Promise<void>`. Calls `setDoc(clinicDoc("salaryPayments", paymentId(p.staffId,p.month)), { ...p, needsReview: false })`.
  - `deletePayment(staffId: string, month: string): Promise<void>`. Calls `deleteDoc` on that payment.
  - `listLeavesForMonth` carries a comment: it returns every leave that starts before month end (grows slowly; fine at clinic scale; avoids a composite index).
  - `saveLeave` and `deleteLeave` share one rule:
    - Compute the months `monthsSpanned` of the new range ∪ the previous (or deleted) range.
    - `getDoc` each `salaryPayments/{staffId}_{month}`. Use `previous.staffId` for the previous range; staff can't change on edit.
    - In one `writeBatch`, write or delete the leave, and add `batch.update(ref, { needsReview: true })` for each payment doc that exists.
    - New leaves use `doc(clinicCollection("leaves"))` for the id and set `createdAt: Date.now()`.
- Produces, in `useStaff.ts`:
  - Queries:
    - `useStaffList()` → `["staff","list"]`
    - `useStaffMember(id?)` → `["staff","one",id]`, enabled when `id` is set
    - `useStaffLeaves(staffId?)` → `["staff","leaves",staffId]`
    - `useMonthLeaves(month, tz)` → `["staff","monthLeaves",month,tz]`
    - `useStaffPayments(staffId?)` → `["staff","payments",staffId]`
    - `useMonthPayments(month)` → `["staff","monthPayments",month]`
  - Mutations:
    - `useCreateStaff()` and `useUpdateStaff(id)` invalidate `["staff"]`.
    - `useSaveLeave(tz)` takes `{ values, previous? }`; `useDeleteLeave(tz)` takes a `Leave`. Both invalidate `["staff"]` and `["funds"]`.
    - `useMarkPaid()` and `useDeletePayment()` (takes `{ staffId, month }`) invalidate `["staff"]` and `["funds"]`.

- [ ] **Step 1: Write failing tests** in `staffRepo.test.ts`. Mock `firebase/firestore` and `../../lib/clinic` the way `src/lib/seats.test.ts` does, with a fake batch that records `set`, `update` and `delete` calls. Test that:
  - `listLeavesForMonth("2026-02", "Asia/Kolkata")` queries `where("from","<=", Date.UTC(2026,1,28,18,30)-1)` and drops a returned leave whose `to` is before `Date.UTC(2026,0,31,18,30)`.
  - `saveLeave` (new) of Jan 30–Feb 2:
    - calls `getDoc` for `s1_2026-01` and `s1_2026-02`;
    - when only `s1_2026-01` exists, the batch has one `set` (the leave) and one `update` (`s1_2026-01`, `{ needsReview: true }`);
    - the batch is committed once.
  - `saveLeave` edit moving a leave from Jan 10 to Mar 10, with both `s1_2026-01` and `s1_2026-03` paid, updates both payments. This pins Review Focus 3.
  - `deleteLeave` of a Feb leave with Feb paid deletes the leave and flags `s1_2026-02` in one batch.
  - `markPaid` calls `setDoc` on id `s1_2026-02` with `needsReview: false`; `deletePayment("s1","2026-02")` deletes that id.
  - `saveLeave` throws `LeaveOverlapError` (and commits no batch) when an existing leave of the staff overlaps; editing a leave over its own previous range does not throw.
  - Mock note: `doc(collectionRef)` with no id must return a ref with a generated id (e.g. `{ id: "gen1" }`); `seats.test.ts` doesn't cover that call shape.
  - `createStaff` writes `nameLower` lowercase, `active: true` when `leftOn` is null, and `active: false` when it is set.
- [ ] **Step 2: Run** `npm test -- staffRepo`. Expected: FAIL.
- [ ] **Step 3: Implement** `staffRepo.ts` and `useStaff.ts`.
- [ ] **Step 4: Run** `npm test -- staffRepo`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(staff): repository and hooks; leave edits flag paid months`

---

### Task 5: Staff list, staff form, routes and owner-only nav

**Files:**
- Create: `src/features/staff/StaffListPage.tsx` and `.test.tsx`, `src/features/staff/StaffFormPage.tsx` and `.test.tsx`
- Modify:
  - `src/App.tsx`: add the routes, each wrapped in `<OwnerOnly>`.
  - `src/components/AppShell.tsx`: keep `NAV` for everyone and add `STAFF_NAV = { to: "staff", label: "Staff", icon: <BadgeIcon /> }`. Inside the component, build `navItems = [...NAV, ...(canManageClinic(membership, clinicSlug) ? [STAFF_NAV] : [])]` and use `navItems` everywhere `NAV` is used today (bottom nav, sidebar, `current`, `isRoot`).
  - `src/components/AppShell.test.tsx`.

**Interfaces:**
- Consumes:
  - Task 4 hooks.
  - Task 1 `useClinicTimeZone`, `dateInputToZonedMs`, `zonedMsToDateInput`, `formatZonedDate`.
  - Existing `PageHeader`, `ListCard`, `AddButton`, `QueryStates`, `useSetPageTitle`, `useClinicPath`, `useToast`. Use `FundsPage`/`ExpenseFormPage` as the layout and form pattern.
- Produces these routes under `/:clinicSlug`:
  - `staff` → StaffListPage
  - `staff/new` and `staff/:id/edit` → StaffFormPage
  - `staff/payroll` → PayrollPage (Task 7)
  - `staff/:id` → StaffDetailPage (Task 6)
  - `staff/:id/leaves/new` and `staff/:id/leaves/:leaveId/edit` → LeaveFormPage (Task 6)

  Task 5 registers only its own routes. Tasks 6 and 7 add theirs.
- StaffListPage:
  - `PageHeader` title "Staff", subtitle "Leave and salary — visible only to you".
  - A "Payroll" button linking to `staff/payroll`.
  - Cards: primary is the name; secondary is `designation · ₹<salary>/month`, plus `· Left <date>` or `· Leaving <date>` (see Decisions) when `leftOn` is set.
  - Active staff first, then those who left.
  - `AddButton` label "Add staff".
- StaffFormPage:
  - Fields: Name, Phone, Designation, Joined on (date), Left on (date, optional, with a clear option), Monthly salary (₹).
  - Dates convert through the clinic zone.
  - Submit button: "Save".
  - On success, toast "Staff saved" and go to `staff/:id`.
  - Show zod messages on the fields.

- [ ] **Step 1: Write failing tests**, mocking `./useStaff` and `useClinicTimeZone`:
  - StaffListPage shows "Ravi" with "Assistant · ₹12,000/month" and links to the add page via the "Add staff" link.
  - The form submits `{ name: "Ravi", joinedOn: dateInputToZonedMs("2026-02-01","Asia/Kolkata"), leftOn: null, monthlySalary: 12000, phone: "", designation: "" }` to the create mutation.
  - The form shows "Leaving date can't be before joining date" when left < joined, and doesn't submit.
  - AppShell shows a "Staff" nav link for the owner membership and none for a member, and at `/c1/staff` the Staff item is the selected one. Use the existing AppShell test membership mocks.
- [ ] **Step 2: Run** `npm test -- StaffListPage StaffFormPage AppShell`. Expected: FAIL.
- [ ] **Step 3: Implement** the pages, routes and nav.
- [ ] **Step 4: Run** `npm test -- StaffListPage StaffFormPage AppShell OwnerOnly`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(staff): staff list and form behind owner-only nav`

---

### Task 6: Staff detail and leave form

**Files:**
- Create: `src/features/staff/StaffDetailPage.tsx` and `.test.tsx`, `src/features/staff/LeaveFormPage.tsx` and `.test.tsx`
- Modify: `src/App.tsx` (routes `staff/:id`, `staff/:id/leaves/new`, `staff/:id/leaves/:leaveId/edit`, each inside `<OwnerOnly>`)

**Interfaces:**
- Consumes:
  - Task 4 `useStaffMember`, `useStaffLeaves`, `useStaffPayments`, `useSaveLeave`, `useDeleteLeave`.
  - Task 3 `leaveTotalsForYear`, `LEAVE_TYPES`.
  - Task 1 date helpers and `useClinicTimeZone`.
  - `ConfirmDialog` and `RowMenu`.
- StaffDetailPage:
  - Header: name, designation, salary, joined/left dates, and an Edit link.
  - A year selector, defaulting to the current year in the clinic zone, with "Leave in <year>" chips: `Casual 2 · Sick 0.5 · Unpaid 0`.
  - A "Leaves" list (`QueryStates`, empty text "No leave recorded"). Each row reads `<from> – <to>` (or the single date plus "(half day)"), with type and note. The RowMenu edits, or deletes after a ConfirmDialog; a successful delete toasts "Leave deleted".
  - "Add leave" button.
  - A "Payments" list (empty text "No payments yet"): `formatMonth(month)`, `₹net`, `paidOn · mode`, and a warning chip "Needs review" when `needsReview`.
- LeaveFormPage:
  - Fields: From, To, Half day (checkbox, disabled and cleared unless From == To), Type (select `LEAVE_TYPES`, default "Casual"), Note.
  - `staffId` and `staffName` come from the loaded staff member.
  - On edit, it loads the leave from `useStaffLeaves(staffId)` by `leaveId` and passes it as `previous`.
  - On success, toast "Leave saved" and go back to `staff/:id`. On `LeaveOverlapError`, show "This overlaps another leave" on the From field (no toast).

- [ ] **Step 1: Write failing tests**, mocking the hooks:
  - Detail shows "Casual 2" for the year containing a 2-day Casual leave.
  - Detail shows the "Needs review" chip for a payment with `needsReview: true`.
  - Deleting a leave through the menu and confirm calls the delete mutation with that leave.
  - On the leave form, the Half day checkbox is disabled when From ≠ To.
  - Submitting a single-day half-day Unpaid leave calls the save mutation with `{ values: { staffId: "s1", staffName: "Ravi", from: X, to: X, halfDay: true, type: "Unpaid", note: "" }, previous: undefined }`, where `X = dateInputToZonedMs("2026-02-25","Asia/Kolkata")`.
  - Editing passes `previous` as the loaded leave.
  - When the save mutation rejects with `LeaveOverlapError`, "This overlaps another leave" is shown.
- [ ] **Step 2: Run** `npm test -- StaffDetailPage LeaveFormPage`. Expected: FAIL.
- [ ] **Step 3: Implement** both pages and their routes.
- [ ] **Step 4: Run** `npm test -- StaffDetailPage LeaveFormPage`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(staff): staff detail with leave history and leave form`

---

### Task 7: Monthly payroll

**Files:**
- Create: `src/features/staff/PayrollPage.tsx` and `.test.tsx`, `src/features/staff/MarkPaidDialog.tsx`
- Modify: `src/App.tsx` (route `staff/payroll` inside `<OwnerOnly>`)

**Interfaces:**
- Consumes:
  - Task 4 `useStaffList`, `useMonthLeaves`, `useMonthPayments`, `useMarkPaid`, `useDeletePayment`.
  - Task 3 `computePayroll` and `PAYMENT_MODES`.
  - Task 1 `monthKeyOf`, `monthRange`, `formatMonth`, `dateInputToZonedMs`, `zonedMsToDateInput`, `dayStartInZone`, `useClinicTimeZone`.
- PayrollPage:
  - Month picker (`<input type="month">`), defaulting to `monthKeyOf(Date.now(), tz)`.
  - Rows: staff with `computePayroll(...).employedDays > 0`, plus anyone with a payment this month. Each row shows the name, `Base ₹…`, `Unpaid <n> days (−₹…)`, and `Net ₹…`.
  - An unpaid row has a "Mark paid" button.
  - A paid row shows a "Paid ₹<stored net> on <date> · <mode>" chip, a "Pay again" button, and an "Undo payment" button (ConfirmDialog → `useDeletePayment`, toast "Payment undone").
  - When `needsReview` is true, a warning chip reads "Leave changed — review", and when the recomputed net differs from the stored one, the row also shows "Now ₹<recomputed>" (only when `needsReview`).
  - A total row: `Total net ₹…` over the computed lines.
- MarkPaidDialog:
  - Shows the base and deduction.
  - Fields: Adjustment (₹, may be negative, default 0), Adjustment note, Paid on (date, default today in the zone), Mode (`PAYMENT_MODES`, default "Cash").
  - Shows the live `Net ₹…`.
  - The confirm button "Mark paid" calls `markPaid` with `{ staffId, staffName, month, base, paidDays, unpaidDays, deduction, adjustment, adjustmentNote, net, paidOn, paymentMode }` from `computePayroll(staff, monthLeaves filtered to staffId, month, tz, adjustment)`.
  - On success, toast "Salary marked paid".

- [ ] **Step 1: Write failing tests**, mocking the hooks with tz `"Asia/Kolkata"`, month `"2026-02"`, and two staff:
  - Ravi: ₹28,000, joined 2025, with a 2-day Unpaid leave in Feb.
  - Mini: joined 2026-03-01, so she is not employed in Feb.

  Assert that:
  - only Ravi is listed;
  - his row shows "Net ₹26,000";
  - with adjustment 500, Paid on 2026-02-28 and mode UPI, the dialog calls `markPaid` with `{ staffId: "r1", month: "2026-02", base: 28000, unpaidDays: 2, deduction: 2000, adjustment: 500, net: 26500, paymentMode: "UPI", paidOn: dateInputToZonedMs("2026-02-28","Asia/Kolkata") }`, using `expect.objectContaining`;
  - a paid month with `needsReview: true` shows "Leave changed — review" and "Pay again"; "Undo payment" → confirm calls the delete mutation with `{ staffId: "r1", month: "2026-02" }`.
- [ ] **Step 2: Run** `npm test -- PayrollPage`. Expected: FAIL.
- [ ] **Step 3: Implement** the page, the dialog and the route.
- [ ] **Step 4: Run** `npm test -- PayrollPage`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(staff): monthly payroll with mark paid and review flags`

---

### Task 8: Owner's Funds "Salaries" line, docs, and full verification

**Files:**
- Modify:
  - `src/features/funds/fundsSchema.ts`: `summarizePeriod` gains a `salaries` parameter.
  - `src/features/funds/fundsRepo.ts`: `listSalaryTotals`.
  - `src/features/funds/useFunds.ts`: `useSalaries`.
  - `src/features/funds/FundsPage.tsx` and `FundsPage.test.tsx`.
  - `src/features/funds/ExpenseFormPage.tsx` (+ test): picking category "Salary" shows the helper text from Decisions.
  - `src/features/funds/fundsSchema.test.ts`, if it exists; otherwise create it.
  - `CLAUDE.md`.
  - Memory file `homoeodesk.md`: this one is for the controller, not the implementer.

**Interfaces:**
- Produces:
  - `summarizePeriod(income, expenses, salaries = 0)`, which returns `PeriodSummary` plus `totalSalaries`. `totalExpenses` now includes `salaries`, and `balance = totalIncome − totalExpenses`.
  - `listSalaryTotals(startMs: number, endMs: number): Promise<{ total: number; count: number }>`. Funds' own read-only query on `salaryPayments`: `paidOn` between start and end, summing `net`.
  - `useSalaries(startMs, endMs, enabled: boolean)` with key `["funds","salaries",startMs,endMs]`.
- FundsPage:
  - `const isOwner = canManageClinic(useMembership(), clinicSlug)`, where `clinicSlug` comes from `useParams`.
  - Calls `useSalaries(startMs, endMs, isOwner)` and passes `salaries.data?.total ?? 0` into `summarizePeriod`.
  - When `isOwner`, the salaries query counts toward `summaryLoading` and `summaryError`.
  - When `isOwner` and the count is > 0, a non-clickable `ListCard` appears above the expense list: primary "Salaries", secondary "<count> payment(s) · from Payroll", trailing `₹total` in danger colour.
  - Members never enable the query.

- [ ] **Step 1: Write failing tests**:
  - `summarizePeriod([{amount:1000,paymentMode:"Cash"}], [{amount:200}], 300)` → `{ totalIncome: 1000, totalExpenses: 500, totalSalaries: 300, balance: 500 }` (via `toMatchObject`).
  - In `FundsPage.test.tsx`, mock `../auth/AuthGuard` `useMembership` and add `useSalaries` to the `./useFunds` mock, recording the `enabled` argument.
    - Owner: the "Salaries" card shows "₹3,000", and the Expenses stat includes it (5,000 + 3,000 = "₹8,000").
    - Member: `useSalaries` is called with `enabled === false`, and no "Salaries" text appears.
- [ ] **Step 2: Run** `npm test -- fundsSchema FundsPage`. Expected: FAIL.
- [ ] **Step 3: Implement** the changes, and update `CLAUDE.md`:
  - routes `/:clinicSlug/staff…` (owner-only);
  - the data model for `staff`, `leaves` and `salaryPayments`;
  - rules now owner-only for these collections;
  - `src/lib/zonedDates.ts` as the place for clinic-zone dates;
  - the Funds Salaries line;
  - Phase 3 ships as its own release (rules + hosting deploy); Funds periods still use the device zone while `paidOn` is a clinic-zone day start (harmless for India).
- [ ] **Step 4: Run full verification**:
  - `npm test`, then `npm run lint`, then `npm run build`. Expected: all pass, no type errors.
  - The rules-test command. Expected: all pass.
- [ ] **Step 5: Commit**: `feat(funds): owner sees salary payments in Funds; docs for staff module`
