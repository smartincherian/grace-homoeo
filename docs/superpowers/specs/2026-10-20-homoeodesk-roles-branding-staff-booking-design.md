# HomoeoDesk: clinic roles, white-labelling, staff, and slot booking

Date: 2026-10-20. Builds on the multi-clinic work (`docs/superpowers/specs/2026-10-19-multi-clinic-design.md`, branch `feature/multi-clinic`). Reviewed by a builder check and a security/data review; their fixes are folded in.

## Why

The app is turning from one clinic's tool ("Grace Homoeo") into a product many homoeopathy clinics use. Each clinic must run itself: its owner manages who can use the app, makes it look like their own clinic, manages staff leave and salary, and books patient appointments, without the superadmin. Outside a clinic, the app carries a neutral product brand.

## Decisions (from the user)

- Product name **HomoeoDesk**, tagline **"Homoeo Clinic Manager"**: login page, browser tab, PWA manifest/install name. No "Grace" anywhere outside clinic data.
- Each clinic has one **owner** (an email). Only the owner changes clinic settings and manages users.
- **At most 3 users per clinic in total** (owner + 2), **enforced in Firestore rules**.
- **Superadmin keeps full power**: creates clinics, sets/changes the owner, adds/removes any user, edits any clinic's settings. The superadmin email can never be a clinic owner or member.
- **Members** use Patients, Consultations, Inventory, Calculator, Funds and Bookings. **Settings, People and Staff (leave & salary) are owner-only.**
- **Branding per clinic** (owner): display name, logo, main colour (presets + custom picker, auto contrast correction), contact details, **show scripture banner** toggle.
- **"Developed by" footer always shown**, every page including login. **Scripture banner shown on the login page.**
- **Sign-in for added users**: Google, or their own password **with email verification required** before access (closes the self-registration gap; existing password users verify once).
- **Staff** are a separate list who don't log in.
- **Leave** recorded by the owner. Types Casual, Sick, Unpaid; only Unpaid reduces pay, by **calendar days** (`monthly ÷ days in month × unpaid days`).
- **Salary** fixed monthly; **part months prorated automatically** (join/leave date). If leave changes after a month is marked paid, the payment is **flagged "needs review"**, never changed automatically.
- **Salary privacy**: salaries visible only to the owner. The owner's Funds balance includes them; members' Funds does not.
- **Booking** by clinic users on behalf of patients. **No public booking link and no WhatsApp/SMS reminders** for now. Owner sets hours, slot length, holidays. **No double-booking.** **Cancelled/no-show appointments kept as history; a cancelled slot becomes free again.**
- **Release order**: the not-yet-live multi-clinic work + Phase 1 + Phase 2 ship together in one cutover; Phase 3 and Phase 4 each ship as a separate release.

## Non-goals

Public/self booking, reminders, online payments, multiple doctors/calendars, staff self-service, attendance, statutory payroll (PF/ESI/TDS), payslips, printing, per-clinic PWA name/icon, custom domains.

## Anti-goals

- A member escalating themselves, adding a 4th user, changing branding, or reading salaries by calling Firestore directly.
- One clinic seeing or affecting another clinic's data or users (including taking over another clinic's user).
- An unreadable colour choice.
- Breaking existing data or the current Grace clinic during rollout.

## Cross-cutting technical decisions

- **Rules become an allow-list.** The catch-all `match /{sub}/{document=**} allow read, write: if member(clinicId)` is replaced by an explicit list of member-writable subcollections (`patients, consultations, generals, lsmc, inventory, orderItems, counters, calculator…` — the builder enumerates every subcollection the app writes today). `expenses`, `appointments`, `appointmentHistory`, `settings`, `seats`, `staff`, `leaves`, `salaryPayments` get explicit matches. Any unlisted subcollection is denied.
- **Time zone**: every clinic has `timeZone` (default `"Asia/Kolkata"`). Day starts, months (`YYYY-MM`), and slot times are computed in that zone, never the device zone. Storage stays epoch ms (CLAUDE.md convention).
- **`users/{uid}.role` is self-writable and must never grant permission.** Roles come only from clinic data.
- **Email verification**: `verified()` in rules requires `email_verified == true` for every provider (drop the password-provider exemption). The login page gains "Create account" (email + password → `sendEmailVerification`) and a "Verify your email" screen (resend, "I've verified" → reload token). Existing password accounts see that screen once.

---

## Phase 1: Roles & people

### Data

- `clinics/{clinicId}`: add `ownerEmail` (lowercased), `timeZone`.
- `clinics/{clinicId}/seats/{seatId}` with `seatId ∈ {"1","2","3"}`: `{ email }`. **The cap is structural**: rules only allow those three IDs.
- `allowedEmails/{email}`: `{ email, clinicId, seat, addedAt, addedBy }` (adds `seat`).
- Invariant: `seats/{s}.email == e` **iff** `allowedEmails/{e}` has `clinicId == c` and `seat == s`. The owner holds a seat. Every add/remove/move is a **batched write** of the seat doc + the allow-list doc (a move between clinics also touches the old clinic's seat). Rules cross-check each half with `getAfter`/`existsAfter`, so neither half can be written alone.
- `Membership` gains `role: "owner" | "member"` (derived from `ownerEmail`); missing `ownerEmail` → everyone is a member (safe fallback before backfill).

### Rules

- Seat create: owner/superadmin of that clinic; `seatId in ['1','2','3']`; `existsAfter(allowedEmails/<email>)` with matching `clinicId`/`seat`; email ≠ superadmin email.
- Seat delete: owner/superadmin; the seat's email ≠ `ownerEmail`; `!existsAfter(allowedEmails/<email>)` or that entry now points elsewhere (superadmin move).
- `allowedEmails` create by owner: `clinicId == myClinic()`, seat doc in `getAfter` has this email; **create only** (an existing entry can't be taken over). Delete by owner: entry of own clinic, not the owner, and the seat is freed in the same batch.
- Clinic doc: owner can't write it; superadmin can set `ownerEmail` only to an email holding a seat in that clinic.
- Superadmin goes through the same consistency checks. `accessRepo.addAllowedEmail`/`removeAllowedEmail` are rewritten as batches.
- Taking an email used by another clinic surfaces as permission-denied → show a neutral "This email can't be added" (never reveal the other clinic).
- Emulator rules tests: 4th user denied; member can't add/remove; owner can't remove themselves; no takeover of another clinic's email; half-batches denied; superadmin can change owner and move users; unverified password account denied; non-allow-listed subcollection denied.

### UI

- **People** (owner-only, `/:clinicSlug/people`): users with role chips, "Add user" (disabled at 3 with explanation), remove with confirm.
- **/admin**: creating a clinic requires an owner email (takes seat 1); per clinic, show seats, "Make owner", add/remove within the cap.
- Owner-only routes redirect members to Patients; rules are the real gate.

### Migration (in the single cutover)

`migrate:clinics` (or a companion step run with it) writes `ownerEmail`, `timeZone` and seat docs from `allowedEmails`, taking `--owner <email>`; refuses if a clinic has more than 3 allowed emails; `--dry-run` supported. Runs before the one rules + hosting deploy.

---

## Phase 2: White-labelling

### Generic brand

- `index.html` title, manifest `name`/`short_name` "HomoeoDesk", description "Homoeo Clinic Manager", new neutral icons/favicon. Grace logo (`src/assets/logo.png`) no longer used.
- Login: "HomoeoDesk" + tagline, neutral mark, scripture banner, footer.
- `SiteFooter` is currently rendered inside `ScriptureBanner`; split it out so the footer always renders.

### Branding (`clinics/{clinicId}/settings/branding`)

| Field | Notes |
|---|---|
| `displayName` | sidebar, mobile header, tab title `<displayName> · HomoeoDesk`; fallback `clinics/{id}.name` |
| `logoDataUrl` | optional; resized client-side (≤256 px) to a data URL ≤150 KB; rules require `data:image/(png|webp|jpeg)` prefix and a size cap. Fallback: initial-letter tile in brand colour. No Firebase Storage. |
| `primaryColor` | hex, rules check `^#[0-9a-fA-F]{6}$` |
| `showScripture` | bool, default true |
| `contact` | `{ doctorName, qualifications, registrationNo, address, phone, email }`, stored for future printing |
| `updatedAt`, `updatedBy` | |

- Rules: members read; owner/superadmin write.
- **Theming**: accent tokens (`TOKENS.blue*`, `GRADIENT`, `BLUE_SHADOW`, and raw `#2f6bff`/`rgba(47,107,255,…)` uses) derive from `primaryColor`: MUI theme built per clinic from the real hex; shades exposed as CSS variables that `TOKENS` references so existing `sx` code keeps working. Neutral tokens stay fixed.
- **Contrast**: darken until white text passes WCAG 4.5:1; Settings shows the corrected swatch.
- **No flash**: last branding cached per clinic in `localStorage` (try/catch).
- **Settings page** (owner-only, `/:clinicSlug/settings`): live preview + fields + Save.

---

## Phase 3: Staff leave & salary (owner-only)

### Data (rules: owner/superadmin only)

- `staff/{id}`: `name`, `nameLower`, `phone`, `designation`, `joinedOn`, `leftOn?`, `monthlySalary`, `active`, `createdAt`.
- `leaves/{id}`: `staffId`, `staffName`, `from`, `to` (day starts in clinic zone, inclusive), `halfDay` (only when from == to), `type`, `note`, `createdAt`.
- `salaryPayments/{staffId}_{YYYY-MM}`: `staffId`, `staffName`, `month`, `base`, `paidDays`, `unpaidDays`, `deduction`, `adjustment`, `adjustmentNote`, `net`, `paidOn`, `paymentMode` (Cash/UPI/Bank), `needsReview` (bool).

### Behaviour

- `base` = `monthlySalary × daysEmployedInMonth ÷ daysInMonth` (prorated by `joinedOn`/`leftOn`). `deduction` = `round(monthlySalary ÷ daysInMonth × unpaidDays)`; half day = 0.5; leave spanning months split per month. `net = base − deduction + adjustment`.
- Leaves for a month are fetched by querying `from <= monthEnd` and filtering `to >= monthStart` on the client (no composite index needed).
- Adding/editing/deleting a leave that overlaps an already-paid month sets that payment's `needsReview = true` (same batch).
- **Salaries stay out of `expenses`.** Funds: the owner's view adds a "Salaries" line from `salaryPayments` into the period's expenses and balance; members' Funds is unchanged (they can't read `salaryPayments`).
- Screens: Staff list, staff detail (leave + payment history, yearly leave totals), leave form, monthly **Payroll** (computed net per active staff, "Mark paid", review flags).

---

## Phase 4: Slot booking

### Data

- `settings/schedule` (owner writes, members read): `slotMinutes` (default 15), `weekly` per weekday: sessions `[{ start: "09:30", end: "13:00" }]`, `holidays: [{ date, note }]`.
- `appointments/{startEpochMs}`: rules enforce `apptId == string(start)`. Fields: `date`, `start`, `end`, `patientId?`, `patientName`, `phone`, `serialNo?`, `status: "booked" | "arrived" | "done"`, `note`, `createdBy`, `createdAt`, `consultationId?`. Rules: create only if absent; updates can't change `start`/`end`/`date`.
- `appointmentHistory/{id}`: cancelled and no-show records (copy of the appointment + `status: "cancelled" | "no-show"`, `closedAt`, `closedBy`).

### Behaviour

- **Booking** is a transaction: read `appointments/{start}`; if present → "Slot just taken".
- **Cancel / no-show**: one batch writes the history record and deletes the appointment, freeing the slot. The day view shows history entries alongside.
- **Slot length / hours changes are blocked while future appointments exist** that would fall off the new grid (Settings explains and lists them), so overlapping bookings can't arise.
- Slots generated in the clinic time zone; closed days/holidays have none; past slots not bookable.
- Book an existing patient (search) or name + phone; later "Register patient" prefilled, linking `patientId`.
- Day view (default today), status actions, "Start consultation" (registers first if needed, stores `consultationId`).
- "Today's appointments" strip on Patients. Nav "Bookings" for everyone. Schedule edited in Settings → Clinic hours.

---

## Constraints & conventions

CLAUDE.md applies: feature folders (`people/`, `settings/`, `staff/`, `bookings/`), repositories + zod + TanStack Query, no Firestore in UI, epoch ms, rupee numbers, `useToast`, `QueryStates`, MUI `sx`, TDD with mocked Firestore, emulator tests for every rules change. Update CLAUDE.md (data model, rules, routes) as each phase lands.

## Left to the builder

Page layouts, nav placement within the owner-only rule, preset colours, HomoeoDesk icon artwork, shade derivation, list pagination.
