# HomoeoDesk Phase 4 — Slot Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clinic users book patients into fixed time slots (one appointment per slot) from a day view, using clinic hours, slot length and holidays that the owner sets in Settings. Cancelled and no-show appointments stay as history, appointments link to patient registration and consultations, and Patients shows a "Today's appointments" strip.

**Architecture:** Shared data that more than one feature reads lives in `src/lib/`, the same way `branding.ts` does:
- `src/lib/schedule.ts`: the schedule type and zod schema, pure slot math, and repo + hooks.
- `src/lib/appointments.ts`: appointment types, read queries and hooks.

The new `src/features/bookings/` folder holds the booking writes, the day view and the book dialog. Settings gets a Clinic hours section. The patients and consultations repos link an appointment by writing its path in their existing writes (the precedent: `createConsultation` already writes `patients/{id}.lastVisitAt` by path). They never import bookings. Rules add explicit matches for `settings/schedule`, `appointments` and `appointmentHistory`.

**Tech Stack:** Vite + React + TypeScript, MUI v6 (`sx`), TanStack Query, react-router v6, Firebase v10 Firestore (transactions, batches), zod, dayjs utc/timezone (through `src/lib/zonedDates.ts`), Vitest + RTL, `@firebase/rules-unit-testing`.

**Spec:** `docs/superpowers/specs/2026-10-20-homoeodesk-roles-branding-staff-booking-design.md`, "Phase 4: Slot booking" plus "Cross-cutting technical decisions".

## Global Constraints

- Data:
  - `clinics/{id}/settings/schedule` (manager writes, members read): `{ slotMinutes, weekly: { mon…sun: [{ start: "HH:mm", end: "HH:mm" }] }, holidays: [{ date, note }], updatedAt, updatedBy }`. Default `slotMinutes` is 15.
  - `clinics/{id}/appointments/{startEpochMs}`: rules enforce `apptId == string(start)`. Fields: `date` (clinic-zone day start), `start`, `end`, `patientId` (string | null), `patientName`, `phone`, `serialNo` (number | null), `status: "booked" | "arrived" | "done"`, `note`, `createdBy`, `createdAt`, `consultationId` (string | null). Creates only happen when the doc is absent. Updates can't change `start`, `end`, `date`, `createdAt` or `createdBy`.
  - `clinics/{id}/appointmentHistory/{start}_{createdAt}`: a copy of the appointment with `status: "cancelled" | "no-show"`, plus `closedAt` and `closedBy`. Create-only, never updated or deleted.
- Booking is a transaction: if `appointments/{start}` exists, the error is "Slot just taken".
- Cancel and no-show are one batch: write the history doc and delete the appointment. The rules only allow the delete when that history doc exists after the batch.
- Changing slot length or hours is blocked while future appointments (`start >= now`) would fall off the new grid. Settings explains this and lists them.
- Slots are computed in the clinic time zone (`useClinicTimeZone`, `src/lib/zonedDates.ts`), never the device zone. Storage is epoch ms.
- No composite indexes: queries are `date ==` or `start >=` only, and sorting happens on the client.
- The "Bookings" nav item is for everyone. The schedule is edited in Settings → Clinic hours, which is owner-only like the rest of Settings.
- `"bookings"` becomes a reserved slug (`src/lib/clinic.ts` and `scripts/migrate-to-clinics.mjs`).
- CLAUDE.md conventions apply:
  - No Firestore SDK in UI.
  - Repos + zod + TanStack Query.
  - `useToast`, not `alert()`.
  - `QueryStates` for lists.
  - MUI `sx`.
  - `TOKENS`, not raw accent hex.
  - TDD with mocked `firebase/firestore`.
  - Emulator tests for every rules change.
  - Features don't import each other's internals. Reading `useMembership`/`useAuth`/`useClinicPath` from `features/auth` is the existing precedent.
- Rules tests on Java 17: `npx -y firebase-tools@13.35.1 emulators:exec --only firestore --project demo-grace "npx vitest run --config vitest.rules.config.ts"`.
- Phase 4 ships as its own release (`firebase deploy --only firestore:rules,hosting`); the rules must go live with the hosting.
- Commits end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01BvvBCQgQMJWY2s7RgcUjiS
  ```

**Decisions (from the user, 2026-10-20):**
- Saving a consultation started from an appointment stores its `consultationId` and sets `status: "done"` in the same batch. Leaving the form without saving changes nothing.
- No hours set (every weekday empty) means no slots. Bookings shows "Clinic hours not set", and the owner also sees a "Set clinic hours" link to Settings.
- **Adding a holiday on a day with bookings is allowed.** The bookings stay, and the day view shows a warning so staff can cancel or keep them. Only hours and slot-length changes are blocked.
- No rescheduling in v1. To move an appointment, cancel it and book the new slot.

**Decisions this plan makes (the spec leaves them open):**
- `weekly` is a map keyed `mon tue wed thu fri sat sun`, because Firestore can't store nested arrays. Each day has at most 3 sessions, kept sorted and non-overlapping, with `start < end`.
- Slot lengths offered in the UI are 10, 15, 20, 30, 45 and 60 minutes. Rules accept any int from 5 to 120.
- `holidays[].date` is a clinic-zone day start (epoch ms), with `note` ≤ 60 characters. Saving drops holidays before today. Rules cap the list at 100.
- A slot is bookable while `now < slot.end`, so the slot that is running now can still take a walk-in. Rules enforce `end > request.time`. Past free slots aren't shown. Rows that have an appointment or a history entry are always shown.
- The last slot of a session must end by the session's `end`, so a leftover shorter than a slot is dropped.
- History id `${start}_${createdAt}`: each rebooking of a slot has a new `createdAt`, so ids never collide, and the rules can check that the history doc exists before allowing the delete.
- The book form needs `patientName` (1–80 characters). `phone` (≤ 20) is required only when no existing patient is picked. `note` is ≤ 200.
- Status actions:
  - `booked` → "Arrived".
  - `booked` or `arrived` → "Start consultation", "Register patient" (only without a `patientId`), "Cancel" and "No-show" (both confirm first).
  - `done` → "View consultation".
- Bookings' patient picker reads `patients` with its own minimal query (`["bookings","patientChoices"]`), not through the patients feature.
- Route `/:clinicSlug/bookings?day=YYYY-MM-DD` defaults to today in the clinic zone. The nav order is Patients, Bookings, Inventory, Calculator, Funds (+ Staff). MUI's `BottomNavigationAction` `minWidth: 80` already overflows 360px with 5 items. So Task 5 makes the bottom bar items compact:
- `minWidth: 0`, `px: 0.5` and `flex: 1` on each action.
- Narrower selected-icon pill padding in `theme.ts` (16px → 10px each side).
- Label font 11px.
All 6 items fit at 360px.
- Linking an appointment from patient or consultation saves is **best-effort**. The repo first `getDoc`s the appointment and adds its update to the batch only if it exists and isn't `done`, so a cancelled appointment never blocks saving a patient or consultation. Linked values are clamped to the rules limits: `patientName.slice(0, 80)`, `phone.slice(0, 20)`, and `serialNo` stays as is when `Number.isInteger`, otherwise `null`.
- Every appointment read takes an explicit `clinicId` (no active-clinic fallback), so a superadmin saving one clinic's hours can't be checked against another clinic's bookings.

## Review Focus

1. **Device zone ≠ clinic zone.** For a clinic in Asia/Kolkata, `09:30` on 2026-11-02 must be `Date.UTC(2026,10,2,4,0)` even when tests run in UTC. The weekday comes from the clinic zone, so 2026-11-01 19:00 UTC is a Monday in Kolkata. Pinned in Task 1.
2. **Two users booking the same slot.** The second user gets "Slot just taken", nothing is overwritten, and the day view refreshes. Pinned in Task 3 (transaction) and Task 2 (rules: `setDoc` over an existing appointment that changes `start`/`createdAt` is denied).
3. **Changing hours or slot length with future bookings.** Changing 15 → 20 minutes with a 10:15 booking must be refused, and that booking listed. A booking that still fits after an hours-only change (for example Monday 09:30–13:00 extended to 14:00) must not block. Any slot-length change moves every booking's `end`, so all future bookings block it. Adding a holiday must never block. Pinned in Tasks 1, 3 and 4.
4. **Cancel, then rebook the same slot.** The slot is free again and both the old history entry and the new appointment show. The rules deny deleting an appointment without its history doc, and deny touching history afterwards. Pinned in Tasks 2, 3 and 5.
5. **Registering from an appointment, then consulting.** The new patient's id and serial get onto the appointment. The consultation saved from it sets `done` + `consultationId` atomically. Editing an existing consultation never touches appointments. Pinned in Task 6.

---

### Task 1: Clinic-zone time helpers, schedule model and slot math

**Files:**
- Modify: `src/lib/zonedDates.ts`, `src/lib/zonedDates.test.ts`
- Create: `src/lib/schedule.ts`, `src/lib/schedule.test.ts` (pure parts only. Task 3 adds the repo and hooks to the same file.)

**Interfaces:**
- Produces, in `zonedDates.ts`:
  - `zonedTimeToMs(dayStartMs: number, hhmm: string, tz: string): number`. This is that time-of-day on that clinic-zone day. Use `dayjs.tz(\`${zonedMsToDateInput(dayStartMs, tz)} ${hhmm}\`, "YYYY-MM-DD HH:mm", tz)` with the `customParseFormat` plugin extended in `zonedDates.ts`.
  - `weekdayKeyOf(ms: number, tz: string): Weekday`
  - `formatZonedTime(ms: number, tz: string): string`, as `"h:mm A"`
- Produces, in `schedule.ts`:
  - `WEEKDAYS = ["mon","tue","wed","thu","fri","sat","sun"] as const` and `type Weekday`.
  - `interface Session { start: string; end: string }`, `interface Holiday { date: number; note: string }` and `interface Schedule { slotMinutes: number; weekly: Record<Weekday, Session[]>; holidays: Holiday[] }`.
  - `SLOT_CHOICES = [10, 15, 20, 30, 45, 60]` and `DEFAULT_SCHEDULE` (15 minutes, every day `[]`, no holidays).
  - `scheduleSchema` (zod):
    - `HH:mm` regex `^([01]\d|2[0-3]):[0-5]\d$`.
    - Each session has `start < end`.
    - Each day has ≤ 3 sessions, with no overlaps once sorted.
    - `slotMinutes` is an int from 5 to 120.
    - `holidays` has at most 100 entries, each `date` is an int, and `note` is ≤ 60 characters.
  - `hasHours(s: Schedule): boolean`
  - `holidayOn(dayStart: number, s: Schedule): Holiday | undefined`
  - `slotsForDay(dayStart: number, s: Schedule, tz: string, opts?: { ignoreHolidays?: boolean }): { start: number; end: number }[]`
  - `offGridAppointments<T extends { start: number; end: number }>(appts: T[], s: Schedule, tz: string): T[]`. An appointment is on the grid when `slotsForDay(dayStartInZone(a.start), s, tz, { ignoreHolidays: true })` has a slot with the same start and end. Holidays never make an appointment off-grid.
  - `parseSchedule(data: unknown): Schedule`. This merges stored data over `DEFAULT_SCHEDULE` and tolerates missing keys, like `branding.ts` `merge`.

- [ ] **Step 1: Write failing tests**, with `TZ = "Asia/Kolkata"` and `const day = dateInputToZonedMs("2026-11-02", TZ)` (a Monday):

```ts
test("zonedTimeToMs and weekdayKeyOf use the clinic zone", () => {
  expect(zonedTimeToMs(day, "09:30", TZ)).toBe(Date.UTC(2026, 10, 2, 4, 0));
  expect(weekdayKeyOf(Date.UTC(2026, 10, 1, 19, 0), TZ)).toBe("mon");
  expect(formatZonedTime(Date.UTC(2026, 10, 2, 4, 0), TZ)).toBe("9:30 AM");
});
const s = { ...DEFAULT_SCHEDULE, slotMinutes: 15,
  weekly: { ...DEFAULT_SCHEDULE.weekly, mon: [{ start: "09:30", end: "10:10" }, { start: "16:00", end: "16:30" }] } };
test("slotsForDay steps by slotMinutes and drops a short tail", () => {
  expect(slotsForDay(day, s, TZ).map((x) => formatZonedTime(x.start, TZ)))
    .toEqual(["9:30 AM", "9:45 AM", "4:00 PM", "4:15 PM"]);
  expect(slotsForDay(addDaysInZone(day, 1, TZ), s, TZ)).toEqual([]); // Tuesday closed
});
test("holidays close the day unless ignored", () => {
  const h = { ...s, holidays: [{ date: day, note: "Diwali" }] };
  expect(slotsForDay(day, h, TZ)).toEqual([]);
  expect(slotsForDay(day, h, TZ, { ignoreHolidays: true })).toHaveLength(4);
  expect(holidayOn(day, h)?.note).toBe("Diwali");
});
test("offGridAppointments", () => {
  const at = (hhmm: string, min: number) => {
    const start = zonedTimeToMs(day, hhmm, TZ);
    return { start, end: start + min * 60_000 };
  };
  const twenty = { ...s, slotMinutes: 20 };
  expect(offGridAppointments([at("09:30", 15), at("09:45", 15)], s, TZ)).toEqual([]);
  expect(offGridAppointments([at("09:30", 15)], twenty, TZ)).toEqual([at("09:30", 15)]); // end differs
  expect(offGridAppointments([at("09:45", 15)], { ...s, holidays: [{ date: day, note: "" }] }, TZ)).toEqual([]);
});
test("scheduleSchema rejects bad sessions", () => {
  const bad = (mon: Session[]) => scheduleSchema.safeParse({ ...s, weekly: { ...s.weekly, mon } }).success;
  expect(bad([{ start: "10:00", end: "09:00" }])).toBe(false);
  expect(bad([{ start: "09:00", end: "11:00" }, { start: "10:00", end: "12:00" }])).toBe(false);
  expect(bad([{ start: "9:00", end: "11:00" }])).toBe(false);
  expect(scheduleSchema.safeParse(s).success).toBe(true);
});
test("parseSchedule fills defaults; hasHours", () => {
  expect(parseSchedule(undefined)).toEqual(DEFAULT_SCHEDULE);
  expect(hasHours(DEFAULT_SCHEDULE)).toBe(false);
  expect(hasHours(s)).toBe(true);
});
```

- [ ] **Step 2: Run** `npm test -- zonedDates schedule`. Expected: FAIL (missing exports or module).
- [ ] **Step 3: Implement** the functions listed under Interfaces.
- [ ] **Step 4: Run** `npm test -- zonedDates schedule`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(booking): clinic-zone slot math and schedule model`

---

### Task 2: Rules for schedule, appointments and appointment history

**Files:**
- Modify: `firestore.rules`, `rules-tests/firestore.rules.test.ts`, `src/lib/clinic.ts` (`RESERVED_SLUGS` += `"bookings"`), `scripts/migrate-to-clinics.mjs` (same list), and `src/lib/clinic.test.ts` if it asserts the list.

**Interfaces:**
- Produces:
  - `settings/{docId}` create/update: `manager(clinicId) && ((docId == 'branding' && validBranding(d)) || (docId == 'schedule' && validSchedule(d)))`. Delete is allowed for either id.
  - `validSchedule(d)` checks:
    - Keys are exactly `slotMinutes, weekly, holidays, updatedAt, updatedBy`.
    - `slotMinutes` is an int from 5 to 120.
    - `weekly` is a map whose keys are only the 7 weekday keys, and each `weekly.get(k, [])` has size ≤ 3.
    - `holidays` is a list with size ≤ 100.
    - `updatedAt is number` and `updatedBy == authEmail()`.
  - `validAppt(d)` checks:
    - Keys are exactly the 12 appointment fields.
    - `start`, `end` and `date` are ints, with `end > start` and `date <= start`.
    - `patientName` is a string of 1–80 characters, `phone` a string ≤ 20 and `note` a string ≤ 200.
    - `status` is in `['booked','arrived','done']`.
    - `patientId` and `consultationId` are each a string or null, and `serialNo` an int or null.
  - `match /appointments/{apptId}`:
    - read: `member`.
    - create: `member && validAppt && apptId == string(d.start) && d.status == 'booked' && d.createdBy == authEmail() && d.end > request.time.toMillis()`.
    - update: `member && validAppt`, with `start, end, date, createdAt, createdBy` equal to `resource.data`.
    - delete: `member && existsAfter(.../appointmentHistory/$(apptId + '_' + string(resource.data.createdAt)))`.
  - `match /appointmentHistory/{id}`:
    - read: `member`.
    - create: `member && d.status in ['cancelled','no-show'] && d.closedBy == authEmail() && d.closedAt is int && id == string(d.start) + '_' + string(d.createdAt) && !existsAfter(.../appointments/$(string(d.start)))`.
    - On create, `validClosed(d)` also applies: keys are only the appointment's 11 non-id fields plus `closedAt` and `closedBy`, with the same type and size caps as `validAppt`. The history and the delete therefore have to happen in one batch.
    - update, delete: `false`.
  - Neither collection is added to `memberSubs()`.

- [ ] **Step 1: Write failing tests** in a new `describe("bookings")`. Use the existing fixtures: member `a@x.com` and owner `o@x.com` in c1, owner `t@x.com` in c2. Use a future `start = Date.now() + 86_400_000`, plus a helper `appt(start, patch?)` that builds a valid 12-field doc (`createdBy: "a@x.com"`, `createdAt: 1`). Tests:
  1. The member creates `appointments/${start}`, and so does the superadmin (with `createdBy` set to the superadmin email).
     - A different id is denied.
     - `status: "done"` on create is denied.
     - `createdBy` set to another email is denied.
     - A past slot is denied. Use a past `start` with `end = start + 900_000 < Date.now()` and id `String(start)`, so only the `request.time` check can fail. Next to it, put a positive control: the same shape in the future succeeds.
  2. With an appointment seeded: an update setting `status: "arrived"` succeeds. Updates that change `start`, `date` or `createdAt` are each denied. A `setDoc` that replaces it with a different `createdAt` is denied.
  3. A batch writing history `${start}_1` (`status: "cancelled"`, `closedBy: "a@x.com"`, `closedAt`) and deleting the appointment succeeds. A delete without the history doc is denied. Updating or deleting the history doc afterwards is denied. History with `status: "done"` is denied. History with an extra key is denied. Creating history alone, without deleting the appointment, is denied.
  4. `t@x.com` (c2) can't read or create c1 appointments or history.
  5. Schedule: the owner writes a valid `settings/schedule` (`updatedBy: "o@x.com"`). The member's write is denied and the member's read succeeds. `slotMinutes: 3`, an extra key, a weekday key `"xyz"`, or 4 sessions on `mon` are each denied.
  6. `settings/other` is still denied for the owner.

- [ ] **Step 2: Run the rules tests** (Java 17 command above). Expected: the new tests FAIL and the existing tests PASS.
- [ ] **Step 3: Implement** the rules listed under Interfaces, and add `"bookings"` to both reserved-slug lists.
- [ ] **Step 4: Run** the rules tests and `npm test -- clinic`. Expected: all PASS.
- [ ] **Step 5: Commit**: `feat(rules): schedule, appointments and appointment history`

---

### Task 3: Data layer — schedule repo, appointment reads, booking writes

**Files:**
- Modify: `src/lib/schedule.ts`, `src/lib/schedule.test.ts`
- Create: `src/lib/appointments.ts`, `src/lib/appointments.test.ts`, `src/features/bookings/bookingSchema.ts`, `src/features/bookings/bookingSchema.test.ts`, `src/features/bookings/bookingsRepo.ts`, `src/features/bookings/bookingsRepo.test.ts`, `src/features/bookings/useBookings.ts`

**Interfaces:**
- Consumes: Task 1 (`parseSchedule`, `offGridAppointments`, `Schedule`).
- Produces, in `src/lib/appointments.ts`:
  - `APPOINTMENTS = "appointments"` and `APPOINTMENT_HISTORY = "appointmentHistory"`.
  - `type AppointmentStatus = "booked" | "arrived" | "done"`.
  - `interface Appointment { id; date; start; end; patientId: string | null; patientName; phone; serialNo: number | null; status: AppointmentStatus; note; createdBy; createdAt; consultationId: string | null }`.
  - `interface ClosedAppointment extends Omit<Appointment, "status"> { status: "cancelled" | "no-show"; closedAt: number; closedBy: string }`.
  - `historyId(a: { start: number; createdAt: number }): string`, which returns `` `${a.start}_${a.createdAt}` ``.
  - `listAppointmentsForDay(clinicId: string, dayStart: number): Promise<Appointment[]>` (`where("date","==",dayStart)`, sorted by `start`).
  - `listFutureAppointments(clinicId: string, now: number): Promise<Appointment[]>`. It queries `where("start", ">=", now - 2 * 3600_000)` and then filters to `end > now`, so the appointment running now is included.
  - `useDayAppointments(clinicId: string, dayStart: number)`, with key `["appointments", "day", clinicId, dayStart]`.
- Produces, in `src/lib/schedule.ts`:
  - `getSchedule(clinicId): Promise<Schedule>`
  - `class OffGridError extends Error { appointments: Appointment[] }`
  - `saveSchedule(clinicId, s: Schedule, by: string, tz: string, now?: number): Promise<void>`. It drops holidays before `dayStartInZone(now)`, then runs `offGridAppointments(await listFutureAppointments(clinicId, now), s, tz)`. If that finds any, it throws `OffGridError`; otherwise it `setDoc`s `settings/schedule` with `updatedAt` and `updatedBy`.
  - `useSchedule(clinicId)` (key `["schedule", clinicId]`) and `useSaveSchedule(clinicId)` (invalidates that key).
- Produces, in `bookingSchema.ts`: `bookingFormSchema` and `type BookingFormValues = { patientId: string | null; patientName: string; phone: string; serialNo: number | null; note: string }`. Phone is required when `patientId` is null.
- Produces, in `bookingsRepo.ts`:
  - `class SlotTakenError extends Error`
  - `bookAppointment(slot: { start: number; end: number }, values: BookingFormValues, by: string, tz: string): Promise<void>`. It runs `runTransaction`, `tx.get`s the appointment doc, throws `SlotTakenError` if it exists, and otherwise `tx.set`s with `date: dayStartInZone(start, tz)`, `status: "booked"`, `createdAt: Date.now()` and `consultationId: null`. The clinic is pinned via `getActiveClinic()`.
  - `closeAppointment(a: Appointment, status: "cancelled" | "no-show", by: string): Promise<void>`, one `writeBatch`: set history `historyId(a)` and delete the appointment. The history doc is the appointment without `id`, plus `status`, `closedAt` and `closedBy`.
  - `markArrived(id: string): Promise<void>`
  - `listDayHistory(dayStart: number): Promise<ClosedAppointment[]>`, sorted by `start`.
  - `interface PatientChoice { id; name; serialNo; phone }` and `listPatientChoices(): Promise<PatientChoice[]>` (`orderBy("nameLower")`).
- Produces, in `useBookings.ts`:
  - `useDayHistory(dayStart)` (key `["appointments","history",dayStart]`) and `usePatientChoices()`.
  - `useBookAppointment()` (vars `{ slot, values, by, tz }`), `useCloseAppointment()` (vars `{ appointment, status, by }`) and `useMarkArrived()` (vars `id`). Each invalidates `["appointments"]`.
- `by` arguments are `normalizeEmail(user.email)`, matching `authEmail()` in rules.

- [ ] **Step 1: Write failing tests**, mocking `firebase/firestore` the way `staffRepo.test.ts` and `serial.test.ts` do:
  - `bookAppointment`: when `tx.get` returns `exists() → true`, it rejects with `SlotTakenError` and `tx.set` is not called. When absent, `tx.set` gets a doc ref whose id is `String(start)`, with `{ date: <Kolkata day start>, status: "booked", createdBy: "a@x.com", consultationId: null, patientId: null, serialNo: null }` (use `expect.objectContaining`).
  - `closeAppointment`: the batch `set` targets id `"<start>_<createdAt>"` with `status: "no-show"`, `closedBy` and a numeric `closedAt`. The appointment is deleted and `commit` is called once.
  - `listAppointmentsForDay` returns docs sorted by `start` even when the mock returns them unsorted.
  - `saveSchedule`:
    - It throws `OffGridError` listing a future 09:45 booking when slot length changes 15 → 20 on a `09:30–10:10` Monday, and `setDoc` isn't called.
    - It saves when only a holiday is added on that booked day.
    - It drops a holiday dated before today.
    - It blocks on an appointment that started 10 minutes ago and is still running.
    - It queries the `clinicId` it's given, not the active clinic.
  - `closeAppointment`: the history payload has no `id` key.
  - `bookingFormSchema`: name-only with `patientId: null` fails (phone required). The same with a `patientId` passes. `note` of 201 characters fails.
- [ ] **Step 2: Run** `npm test -- schedule appointments bookingSchema bookingsRepo`. Expected: FAIL.
- [ ] **Step 3: Implement** the modules listed under Interfaces.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(booking): schedule repo, appointment reads and booking writes`

---

### Task 4: Settings → Clinic hours

**Files:**
- Create: `src/features/settings/ClinicHoursSection.tsx`, `src/features/settings/ClinicHoursSection.test.tsx`
- Modify: `src/features/settings/SettingsPage.tsx` (render `<ClinicHoursSection clinicId={clinicSlug} />` after the branding sections; it keeps its own Save button), `SettingsPage.test.tsx` (mock the schedule hooks)

**Interfaces:**
- Consumes: `useSchedule`, `useSaveSchedule`, `OffGridError`, `scheduleSchema`, `SLOT_CHOICES` and `WEEKDAYS` (Task 1/3), `useClinicTimeZone`, `useAuth`, and `formatZonedDate`/`formatZonedTime`/`dateInputToZonedMs`.

**Behaviour:**
- Section title "Clinic hours" with `id="clinic-hours"`.
- A slot length select (`SLOT_CHOICES`, label "Slot length").
- One row per weekday (Mon…Sun). Each session has two `type="time"` inputs, "Start" and "End". There's an "Add session" button (up to 3) and a remove button per session, and a day without sessions reads "Closed".
- Holidays: a date input, a note and "Add holiday". It lists holidays from today on, each with a remove button.
- "Save hours" validates with `scheduleSchema`, showing an error under the field. On success it shows the toast "Clinic hours saved".
- On `OffGridError` it shows an `Alert severity="warning"`: "These future bookings don't fit the new hours or slot length. Cancel them in Bookings first, then save." Below that it lists each booking as `formatZonedDate · formatZonedTime — patientName`. Nothing is saved.

- [ ] **Step 1: Write failing tests** (mock `../../lib/schedule` hooks, `useClinicTimeZone` → `"Asia/Kolkata"`, `useAuth`):
  - With a schedule that has Monday 09:30–13:00, the Monday start input shows `09:30` and Tuesday reads "Closed".
  - Changing the slot length to 20 and saving calls the save mutation with `slotMinutes: 20` and shows "Clinic hours saved".
  - When the save mutation rejects with `new OffGridError([appt 10:15 "Ravi"])`, the warning text and `"Ravi"` appear, and no success toast.
  - Setting End before Start on Monday and saving shows a validation error and doesn't call save.
  - Adding a holiday puts it in the list, and the saved payload includes it.
- [ ] **Step 2: Run** `npm test -- ClinicHoursSection SettingsPage`. Expected: FAIL.
- [ ] **Step 3: Implement** the section and wire it into `SettingsPage`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(settings): clinic hours, slot length and holidays`

---

### Task 5: Bookings day view, book dialog and nav

**Files:**
- Create: `src/features/bookings/dayRows.ts`, `dayRows.test.ts`, `BookingsPage.tsx`, `BookingsPage.test.tsx`, `BookDialog.tsx`, `BookDialog.test.tsx`
- Modify:
  - `src/App.tsx` (route `bookings`)
  - `src/components/AppShell.tsx`:
    - `NAV` gains `{ to: "bookings", label: "Bookings", icon: <EventIcon /> }` after Patients.
    - The bottom-bar actions get the compact `sx` from the header.
  - `src/theme/theme.ts` (pill padding)
  - `src/components/RowMenu.tsx` + `RowMenu.test.tsx`: add `actions?: { label: string; icon?: ReactNode; onClick: () => void }[]`, rendered before Edit/Delete, so existing callers are unchanged.
  - `AppShell.test.tsx` and `BottomDock.test.tsx` if they count items

**Interfaces:**
- Consumes: Tasks 1 and 3 hooks and helpers, `useMembership` + `canManageClinic` (owner link), `useClinicPath`, `RowMenu`, `ConfirmDialog` and `QueryStates`.
- Produces:
  - `interface DayRow { start: number; end: number; appointment?: Appointment; history: ClosedAppointment[] }`.
  - `dayRows(slots, appointments, history, now): DayRow[]`. It takes the union of slot times, appointment times and history times, sorted by `start`. It drops free rows (no appointment, no history) whose `end <= now`. Each history entry attaches to the row with its `start`.
  - Navigation targets that Task 6 implements (with `cp = useClinicPath()`):
    - Register patient: `cp(\`/patients/new?appointment=${id}&name=${enc(name)}&phone=${enc(phone)}&day=${YYYY-MM-DD}\`)`.
    - Start consultation without a patient: the same URL with `&then=consultation`.
    - Start consultation with a patient: `cp(\`/patients/${patientId}/consultations/new?appointment=${id}\`)`.
    - View consultation: `cp(\`/patients/${patientId}/consultations/${consultationId}\`)`.

**Behaviour:**
- `?day=YYYY-MM-DD`, defaulting to today in the clinic zone. Prev/next day buttons, a date input and "Today" all update the param.
- Banners:
  - No hours: "Clinic hours not set". The owner also gets the "Set clinic hours" link to `cp("/settings#clinic-hours")`.
  - Holiday: "Holiday — {note}. Clinic closed." If the day still has appointments, a warning is added: "{n} appointment(s) are still booked on this day. Cancel them or keep them."
  - Closed weekday: "Closed on {Weekday}s."
- Rows:
  - A free row shows the time and a "Book" button, which opens `BookDialog`.
  - A booked row shows the time, `patientName` (with `#serialNo` when there is one), phone, a status chip and a `RowMenu` with the status actions from the plan header. Cancel and No-show go through `ConfirmDialog`.
  - History entries show greyed-out under their row, as "Cancelled" or "No-show" with the name.
- `BookDialog`:
  - An Autocomplete over `usePatientChoices()`, matching name, `#serial` or phone, and picking a patient fills name and phone. You can also type a new name and phone.
  - A note field.
  - Submitting calls `useBookAppointment`. Success shows the toast "Booked {h:mm A}". A `SlotTakenError` shows the error toast "Slot just taken", closes the dialog and invalidates the day.
- Uses `QueryStates` for the day's appointments.

- [ ] **Step 1: Write failing tests:**
  - `dayRows`: past free slots are dropped, a past booked slot is kept, an appointment off the slot grid (holiday) still gets a row, and history attaches to the matching row (including on a free slot after a cancel).
  - `BookingsPage` (mock hooks, `useClinicTimeZone`, and `vi.useFakeTimers` with a fixed `now` on Monday 2026-11-02 08:00 Kolkata):
    - It lists the slots "9:30 AM" and "9:45 AM".
    - A booked row shows its name and the "Booked" chip.
    - A cancelled history entry shows "Cancelled".
    - With an empty schedule it shows "Clinic hours not set", and the owner (not a member) sees "Set clinic hours".
    - A holiday with a booking shows both the holiday banner and the "still booked" warning.
    - Choosing "Arrived" calls `markArrived`.
    - Confirming "Cancel" calls `closeAppointment` with `"cancelled"`.
    - "Start consultation" on an appointment without `patientId` navigates to the patients/new URL with `then=consultation`.
  - `BookDialog`: picking an existing patient submits with their `patientId`/`serialNo`. A new name without a phone shows a validation error. A rejected `SlotTakenError` shows "Slot just taken".
  - `AppShell`: "Bookings" shows for members. The owner's mobile bottom bar renders 6 actions with `min-width: 0`.
  - `RowMenu`: custom `actions` render and fire `onClick`. Existing edit/delete tests are unchanged.
- [ ] **Step 2: Run** `npm test -- dayRows BookingsPage BookDialog AppShell BottomDock`. Expected: FAIL.
- [ ] **Step 3: Implement** the page, dialog, route, nav item, compact bottom bar and `RowMenu` actions.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(booking): day view, book dialog and Bookings nav`

---

### Task 6: Link appointments to patient registration and consultations

**Files:**
- Modify:
  - `src/features/patients/patientsRepo.ts` + test
  - `src/features/patients/usePatients.ts` + `usePatients.test.tsx`
  - `src/features/patients/PatientFormPage.tsx` + test
  - `src/features/consultations/consultationsRepo.ts` + test
  - `src/features/consultations/useConsultations.ts` + `useConsultations.test.tsx`
  - `src/features/consultations/ConsultationFormPage.tsx` + test

**Interfaces:**
- Produces:
  - `createPatient(values: PatientFormValues, appointmentId?: string): Promise<string>`.
    - With `appointmentId`, it uses a `writeBatch`. The patient goes in via `doc(clinicCollection(...))` + `set`. In the same batch, `update(clinicDoc("appointments", appointmentId, clinic), { patientId, serialNo, patientName, phone })` runs, but only when the appointment exists and isn't done; the values are clamped as in the header.
    - Without it, behaviour is unchanged.
    - The `"appointments"` path is a local const, the same way `consultationsRepo` uses `PATIENTS`.
  - `useCreatePatient` mutation vars become `{ values, appointmentId? }`. Update existing call sites. On success it also invalidates `["appointments"]`.
  - `createConsultation(patient, values, record, appointmentId?: string)`. With an id, and when that appointment exists and isn't done, the same batch does `update(appointments/{id}, { status: "done", consultationId: ref.id, patientId: patient.id, serialNo, patientName })`, with the values clamped as in the header. `useCreateConsultation` takes `appointmentId?` in its vars and invalidates `["appointments"]`. `updateConsultation` is untouched.
- `PatientFormPage` (create mode only):
  - Reads `appointment`, `name`, `phone`, `day` and `then` from `useSearchParams`, and prefills `name`/`phone`.
  - Both existing buttons pass `appointmentId`. With `appointment` set:
    - "Save & start consultation" goes to `cp(\`/patients/${newId}/consultations/new?appointment=${appointment}\`)`.
    - Plain "Save" goes to `cp(\`/bookings?day=${day}\`)`.
    - `then=consultation` makes "Save & start consultation" the primary (contained) button.
  - With no `appointment`, the existing navigation stays.
- `ConsultationFormPage` (create mode only) reads `appointment` from the search params and passes it to the create mutation.

- [ ] **Step 1: Write failing tests:**
  - `patientsRepo`: `createPatient(values, "123")` commits one batch that sets the patient (with `serialNo`) and updates `appointments/123` with `{ patientId: <new id>, serialNo, patientName, phone }`. Without an id, the existing assertions still hold.
  - `consultationsRepo`: `createConsultation(p, v, r, "123")` adds `update(appointments/123, { status: "done", consultationId: <ref id>, ... })` to the same batch. Without an id, no appointments write happens.
  - Both repos:
    - When the appointment `getDoc` says it doesn't exist (cancelled meanwhile), the patient or consultation still commits and the appointment isn't updated.
    - A 100-character patient name is written to the appointment as 80 characters.
    - A non-integer `serialNo` is written as `null`.
  - `PatientFormPage` at `/c1/patients/new?appointment=123&name=Ravi&phone=98&day=2026-11-02&then=consultation`: the name and phone fields are prefilled. "Save & start consultation" calls create with `appointmentId: "123"` and navigates to `/c1/patients/<newId>/consultations/new?appointment=123`. Plain "Save" navigates to `/c1/bookings?day=2026-11-02`.
  - `ConsultationFormPage` at `.../consultations/new?appointment=123`: saving passes `appointmentId: "123"`. Edit mode never passes one.
- [ ] **Step 2: Run** `npm test -- patientsRepo consultationsRepo PatientFormPage ConsultationFormPage`. Expected: FAIL.
- [ ] **Step 3: Implement** the changes listed under Interfaces.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(booking): link appointments to patient registration and consultations`

---

### Task 7: "Today's appointments" strip on Patients

**Files:**
- Create: `src/components/TodayAppointments.tsx`, `src/components/TodayAppointments.test.tsx`
- Modify: `src/features/patients/PatientListPage.tsx` (render it above the list) + test (mock the component or the hook)

**Interfaces:**
- Consumes: `useDayAppointments(clinicId, dayStart)`, `useClinicTimeZone`, `dayStartInZone`, `formatZonedTime` and `useClinicPath`.
- Produces: `TodayAppointments({ clinicId }: { clinicId: string })`.
  - It shows the heading "Today's appointments", then one chip or row per appointment (`h:mm A · patientName · status`).
  - Each item, and a "View all" link, goes to `cp("/bookings")`.
  - It renders nothing while loading, on error, or when there are no appointments today.

- [ ] **Step 1: Write failing tests:**
  - With two appointments (09:30 "Ravi" booked, 09:45 "Mini" arrived), it shows both, in time order, with their statuses.
  - "View all" links to `/c1/bookings`.
  - With an empty list it renders nothing.
  - `PatientListPage` renders the strip.
- [ ] **Step 2: Run** `npm test -- TodayAppointments PatientListPage`. Expected: FAIL.
- [ ] **Step 3: Implement** the component and render it on Patients.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(patients): today's appointments strip`

---

### Task 8: Docs and full verification

**Files:**
- Modify: `CLAUDE.md` and the spec's status line if one exists.
- `CLAUDE.md` changes:
  - Routes gain `/:clinicSlug/bookings`.
  - The feature list gains `bookings/`.
  - The data model gains `settings/schedule`, `appointments` and `appointmentHistory`.
  - Rules gain those matches.
  - `"bookings"` is a reserved slug.
  - Add a line saying the Phase 4 release ships rules and hosting together.

- [ ] **Step 1:** Update `CLAUDE.md` with the changes listed above.
- [ ] **Step 2: Run** `npm run lint && npm test && npm run build`. Expected: all pass, with no type errors.
- [ ] **Step 3: Run** the rules tests (Java 17 command). Expected: all PASS.
- [ ] **Step 4: Commit**: `docs: booking module in CLAUDE.md`
