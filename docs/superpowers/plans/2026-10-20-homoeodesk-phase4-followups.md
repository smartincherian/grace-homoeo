# HomoeoDesk Phase 4 — deferred follow-ups

Minor items from the per-task and final reviews of the slot-booking branch, all triaged "can wait" by the final review. Parked items carry the ruling that parked them.

## Parked (with rulings)
- R6 — final #6 (cancel from stale row may drop links / delete a done appt) parked — low impact, trusted members, needs transactional close — cost if wrong: occasional lost link in history.
- R7 — final #7 (stale "Register patient" URL can create a duplicate patient) parked — rare, user-visible and recoverable — cost if wrong: duplicate patient record to clean up.
- R10 — residual: consultation retry rebuilds LSMC rows with new random IDs (dup rows only if first commit actually landed but reported failure) — parked, very rare — cost if wrong: duplicate LSMC rows on one visit.

## Deferred minors
- Task 1: minor (deferred): prettier reformatted untouched lines in zonedDates.ts/test
- Task 1: minor (deferred): no test for 101 holidays / slotMinutes 15.5
- Task 1: minor (deferred): zonedDates.test.ts redeclares TZ in new describe
- Task 2: minor (deferred): history create doesn't verify a matching appointment existed before batch (fabricated history / createdAt collision possible by trusted members)
- Task 2: minor (deferred): validSchedule weekly day values not checked `is list`; sessions/holidays entries not shape-checked
- Task 2: minor (deferred): no rules tests for changing end/createdBy on update
- Task 3: minor (deferred): listDayHistory duplicates toAppointment mapping + force-cast
- Task 3: minor (deferred): patientChoices key lacks clinicId (plan-mandated key)
- Task 3: minor (deferred): BookingFormValues hand-written beside zod schema
- Task 3: minor (deferred): saveSchedule check+set not atomic (inherent; add comment)
- Task 3: minor (deferred): no test for createdAt on booking
- Task 4: minor (deferred): any numeric-path zod issue shows "End must be after start." (cleared time input misleading)
- Task 4: minor (deferred): past holiday date accepted silently then vanishes; holidayError not cleared on change
- Task 4: minor (deferred): offGrid/dayErrors alerts stay stale after edits until next Save
- Task 4: minor (deferred): no tests for session cap, holiday dedupe, overlap
- Task 4: minor (deferred): × glyph instead of MUI icon for remove buttons
- Task 4: minor (deferred): SettingsPage.test.tsx 6 pre-existing act() warnings
- Task 5: minor (deferred): BookDialog Autocomplete clear ("clear" reason) doesn't clear patientName
- Task 5: minor (deferred): unlinking a picked patient leaves their phone filled
- Task 5: minor (deferred): ?day=2026-02-31 rolls over (no round-trip check)
- Task 5: minor (deferred): holiday "still booked" count includes done appointments
- Task 5: minor (deferred): past appointments still offer Arrived/Cancel/No-show (arguably intended)
- Task 5: minor (deferred): actionsFor called twice; RowMenu key by label; "Today" drops other params
- Task 5: minor (deferred): test gaps — date input onChange, markArrived error toast, running-slot bookable at page level
- Task 5: minor (deferred): BookingsPage tests had no RED run (process)
- Task 6: minor (deferred): ConsultationFormPage "edit never passes appointment" test trivially true (no ?appointment in edit URL)
- Task 6: minor (deferred): PatientFormPage button variant + no-appointment start-consultation nav untested
- Task 6: minor (deferred): consultationsRepo lacks "appointment done" test; clinic mocks ignore clinic arg
- Task 6: minor (deferred): appointment/day not encodeURIComponent'd in PatientFormPage nav
- Task 6: minor (deferred): pre-existing React Router future-flag warnings in test output
- Task 7: minor (deferred): today memoised on tz only — stale across midnight if tab open
- Task 7: minor (deferred): component test uses pre-sorted data (ordering lives in repo)
