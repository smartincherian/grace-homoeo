# HomoeoDesk Phase 1: Roles & People Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every clinic one owner who manages up to 3 users (enforced by Firestore rules), require verified emails for everyone, and turn the clinic catch-all rule into an allow-list.

**Architecture:** Users occupy fixed seat docs `clinics/{c}/seats/{1|2|3}` mirrored by `allowedEmails/{email}.{clinicId, seat}`; every add/remove is a batch of both docs, cross-checked in rules with `getAfter`/`existsAfter`. `clinics/{c}.ownerEmail` marks the owner. A shared `src/lib/seats.ts` repository serves both the owner's People page and the superadmin's `/admin` page.

**Tech Stack:** Vite + React + TS, MUI v6, TanStack Query, Firebase v10 (Auth, Firestore), Vitest + RTL, `@firebase/rules-unit-testing`.

**Spec:** `docs/superpowers/specs/2026-10-20-homoeodesk-roles-branding-staff-booking-design.md` (sections "Cross-cutting technical decisions" and "Phase 1").

## Global Constraints

- Max 3 users per clinic, owner included; seat IDs exactly `"1"`, `"2"`, `"3"`.
- Superadmin email `smartin.cherian@gmail.com` (`SUPERADMIN_EMAIL`) can never hold a seat or be an owner.
- Emails stored lowercased/trimmed (`normalizeEmail`).
- `verified()` requires `email_verified == true` for every provider; no password exemption.
- New clinics get `timeZone: "Asia/Kolkata"`.
- Feedback via `useToast`, never `alert()`; repositories only, no Firestore calls in UI; dates epoch ms.
- A failed add because the email belongs to another clinic shows exactly: "This email can't be added." (never name the other clinic) — for owners. The superadmin may see which clinic.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Removed user still signed in**: after an owner removes them, their next Firestore read is denied; the app must not spin forever or show raw errors. Expected: on a `permission-denied` from the membership re-check they are signed out to `/login`. (Test in Task 3.)
- **Adding an email that's already a user of this clinic** (any casing/spaces): friendly "Already a user of this clinic", no write. (Task 2.)
- **Adding the superadmin email or an invalid email**: rejected client-side with a message, no write. (Task 2.)
- **Clinic not yet backfilled** (no `ownerEmail`, no seats): app works as before for members; nobody is owner; People page unreachable; `/admin` shows "No owner set" with a way to set one. (Tasks 3, 6.)
- **Unverified password user signs in**: lands on the verify-email screen, not a "not allowed" toast/sign-out loop. (Task 4.)

---

### Task 1: Firestore rules: verification, seats, owner, allow-list

**Files:**
- Modify: `firestore.rules`
- Modify: `rules-tests/firestore.rules.test.ts`

**Interfaces:**
- Produces: data shapes every later task writes:
  - `clinics/{c}`: `{ name, createdAt, ownerEmail?, timeZone? }`
  - `clinics/{c}/seats/{s}`: `{ email }`
  - `allowedEmails/{e}`: `{ email, clinicId, seat, addedAt, addedBy }`

- [ ] **Step 1: Update the test seed and write failing rules tests**

Seed (rules disabled): `clinics/c1 {name:"One", ownerEmail:"o@x.com"}`, `clinics/c2 {name:"Two", ownerEmail:"t@x.com"}`; `allowedEmails/o@x.com {email, clinicId:"c1", seat:"1"}`, `allowedEmails/a@x.com {…c1, seat:"2"}`, `allowedEmails/t@x.com {…c2, seat:"1"}`; seats `c1/1 {email:"o@x.com"}`, `c1/2 {email:"a@x.com"}`, `c2/1 {email:"t@x.com"}`; keep the existing patient/legacy seeds. Keep existing tests passing (adjust any that relied on the password exemption).

Add tests (helper `addUser(db, clinic, seat, email)` = `writeBatch` with `set(seats/seat, {email})` + `set(allowedEmails/email, {email, clinicId, seat, addedAt:1, addedBy:"x"})`; `removeUser` = batch of the two deletes):

| Test | Expect |
|---|---|
| owner adds a user to free seat 3 | succeeds |
| owner adds to seat `"4"` | fails |
| owner adds when seats 1–3 full (seed seat 3 first) | fails |
| member `a@x.com` adds a user | fails |
| owner writes only the seat doc (half batch) | fails |
| owner writes only the allowedEmails doc (half batch) | fails |
| owner c1 adds `t@x.com` (belongs to c2) | fails (doc exists → update denied) |
| owner adds `smartin.cherian@gmail.com` | fails |
| owner removes `a@x.com` | succeeds |
| owner removes themselves (`o@x.com`) | fails |
| owner updates `clinics/c1` (any field) | fails |
| superadmin sets `clinics/c1.ownerEmail = "a@x.com"` | succeeds |
| superadmin sets `ownerEmail = "t@x.com"` (not in c1) | fails |
| superadmin creates clinic `c3` + seat 1 + allowedEmails for `n@x.com` in one batch | succeeds |
| password account with `email_verified:false` reads `clinics/c1/patients/p1` | fails |
| member writes `clinics/c1/unknownSub/x` | fails |
| member writes `clinics/c1/expenses/e1` and `counters/patients` | succeeds |
| member reads `clinics/c1/seats/1` | succeeds; member of c2 reads it | fails |

- [ ] **Step 2: Run rules tests to verify the new ones fail**

Run: `npm run test:rules` (Java 17: `npx -y firebase-tools@13.35.1 emulators:exec --only firestore --project demo-grace "npx vitest run --config vitest.rules.config.ts"`)
Expected: new tests FAIL, existing ones pass.

- [ ] **Step 3: Rewrite `firestore.rules`**

The rules are the algorithm here, so the shape is fixed:

```
function verified() { return request.auth.token.get('email_verified', false) == true; }
function SUPER() { return 'smartin.cherian@gmail.com'; }  // superadmin() uses it
function docs() { return /databases/$(database)/documents; }
function clinicData(c) { return get(/databases/$(database)/documents/clinics/$(c)).data; }
function owner(c) { return member(c) && clinicData(c).get('ownerEmail', '') == authEmail(); }
function manager(c) { return superadmin() || owner(c); }
function seatAfterIs(c, s, e) {
  return existsAfter(/databases/$(database)/documents/clinics/$(c)/seats/$(s))
    && getAfter(/databases/$(database)/documents/clinics/$(c)/seats/$(s)).data.email == e;
}
function entryAfterIs(e, c, s) {
  return existsAfter(/databases/$(database)/documents/allowedEmails/$(e))
    && getAfter(/databases/$(database)/documents/allowedEmails/$(e)).data.clinicId == c
    && getAfter(/databases/$(database)/documents/allowedEmails/$(e)).data.seat == s;
}
function memberSubs() {
  return ['patients','consultations','generals','lsmc','inventory','orderItems','expenses','counters'];
}

match /allowedEmails/{email} {
  allow get: if signedIn() && verified() && email == authEmail();
  allow list: if superadmin();
  allow create: if manager(request.resource.data.clinicId)
    && email != SUPER()
    && request.resource.data.keys().hasOnly(['email','clinicId','seat','addedAt','addedBy'])
    && request.resource.data.email == email
    && request.resource.data.seat in ['1','2','3']
    && seatAfterIs(request.resource.data.clinicId, request.resource.data.seat, email);
  allow update: if false;
  allow delete: if manager(resource.data.clinicId)
    && !seatAfterIs(resource.data.clinicId, resource.data.get('seat', '0'), email);
}

match /clinics/{clinicId} {
  allow get: if member(clinicId);
  allow list: if superadmin();
  allow create, update: if superadmin()
    && (!('ownerEmail' in request.resource.data)
        || entryAfterIs(request.resource.data.ownerEmail, clinicId,
             getAfter(/databases/$(database)/documents/allowedEmails/$(request.resource.data.ownerEmail)).data.seat));
  allow delete: if superadmin();

  match /seats/{seatId} {
    allow read: if member(clinicId);
    allow create: if manager(clinicId)
      && seatId in ['1','2','3']
      && request.resource.data.keys().hasOnly(['email'])
      && request.resource.data.email != SUPER()
      && entryAfterIs(request.resource.data.email, clinicId, seatId);
    allow update: if false;
    allow delete: if manager(clinicId)
      && resource.data.email != getAfter(/databases/$(database)/documents/clinics/$(clinicId)).data.get('ownerEmail', '')
      && !entryAfterIs(resource.data.email, clinicId, seatId);
  }

  match /{sub}/{document=**} {
    allow read, write: if sub in memberSubs() && member(clinicId);
  }
}
```

Keep `users/{uid}` as is. Remove the old comment about password accounts being trusted. (The `ownerEmail` check may be simplified to `existsAfter(entry) && getAfter(entry).data.clinicId == clinicId` if the rules compiler rejects the nested form — same meaning.)

- [ ] **Step 4: Run rules tests**

Run: same as Step 2. Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules rules-tests/firestore.rules.test.ts
git commit -m "feat(rules): seats-based 3-user cap, clinic owner, verified email, subcollection allow-list"
```

---

### Task 2: Seats repository (`src/lib/seats.ts`)

**Files:**
- Create: `src/lib/seats.ts`, `src/lib/seats.test.ts`, `src/lib/useSeats.ts`
- Modify: `src/features/access/clinicsRepo.ts` (createClinic gains owner), `src/features/access/clinicsRepo.test.ts`
- Delete: `addAllowedEmail` / `removeAllowedEmail` from `src/features/access/accessRepo.ts` (keep `listAllowedEmails`, extend `AllowedEmail` with `seat: string`) and their hooks in `useAllowedEmails.ts` once Task 6 stops using them (do the deletion in Task 6).

**Interfaces:**
- Produces:
  - `type SeatId = "1" | "2" | "3"`; `const SEAT_IDS: readonly SeatId[]`
  - `interface Seat { seat: SeatId; email: string }`
  - `class SeatError extends Error { code: "full" | "duplicate" | "superadmin" | "invalid" | "unavailable" | "owner" }`
  - `listSeats(clinicId: string): Promise<Seat[]>` (sorted by seat)
  - `addUser(clinicId: string, email: string, addedBy: string, seats: Seat[]): Promise<Seat>`
  - `removeUser(clinicId: string, seat: Seat, ownerEmail: string | undefined): Promise<void>`
  - `setOwner(clinicId: string, email: string): Promise<void>`
  - `createClinic(id: string, name: string, ownerEmail: string, addedBy: string): Promise<void>` (moved semantics; stays in `clinicsRepo.ts`)
  - Hooks in `useSeats.ts`: `useSeats(clinicId)`, `useAddUser(clinicId)`, `useRemoveUser(clinicId)`, `useSetOwner()`; all invalidate `["seats", clinicId]`, `["allowedEmails"]`, `["clinics"]`.

- [ ] **Step 1: Write failing tests (`seats.test.ts`, mocking `firebase/firestore` like `serial.test.ts`)**

- `addUser` normalizes `"  New@X.com "` → writes batch `set(seats/<first free>, {email:"new@x.com"})` and `set(allowedEmails/new@x.com, {email, clinicId, seat, addedAt: number, addedBy})`, returns the seat.
- picks the lowest free seat (`seats` holds 1 and 3 → uses `"2"`).
- throws `SeatError("full")` when 3 seats are taken, without committing.
- throws `"duplicate"` when the normalized email already holds a seat.
- throws `"superadmin"` for `SUPERADMIN_EMAIL`; `"invalid"` for `"not-an-email"`.
- maps a commit rejected with `FirebaseError("permission-denied")` to `SeatError("unavailable")`.
- `removeUser` throws `"owner"` when `seat.email === ownerEmail`; otherwise batch-deletes both docs.
- `setOwner` calls `updateDoc(clinics/c, { ownerEmail: normalized })`.
- `clinicsRepo.createClinic("c3","Three","N@x.com","sa")` batch-writes clinic `{name, createdAt, ownerEmail:"n@x.com", timeZone:"Asia/Kolkata"}`, seat `"1"`, and the allowedEmails entry; still throws "Clinic already exists" if the doc exists.

- [ ] **Step 2: Run** `npm test -- seats clinicsRepo` → FAIL.

- [ ] **Step 3: Implement** with `writeBatch`. Email check: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` after normalizing.

- [ ] **Step 4: Run** `npm test -- seats clinicsRepo` → PASS.

- [ ] **Step 5: Commit** `feat(seats): seat repository and hooks for clinic users`

---

### Task 3: Owner-aware membership and owner-only routes

**Files:**
- Modify: `src/lib/access.ts`, `src/lib/access.test.ts`, `src/features/auth/AuthGuard.tsx`
- Create: `src/features/auth/OwnerOnly.tsx`, `src/features/auth/OwnerOnly.test.tsx`

**Interfaces:**
- Produces:
  - `type Membership = { superadmin: boolean; clinicId: string | null; owner: boolean }` (superadmin: `owner: false`)
  - `canManageClinic(m: Membership | undefined, clinicId: string | undefined): boolean` → `superadmin || (owner && clinicId === m.clinicId)`
  - `<OwnerOnly>{children}</OwnerOnly>`: renders children when `canManageClinic(useMembership(), clinicSlug)`, else `<Navigate to="/<clinicSlug>/patients" replace />`.

- [ ] **Step 1: Failing tests**
  - `getMembership` returns `owner: true` when `clinics/{clinicId}.ownerEmail` equals the user's normalized email; `false` when different or missing; still `null` when the allow-list read throws.
  - If the clinic doc read throws, returns `{ …, owner: false }` (not null).
  - `canManageClinic` truth table: superadmin any clinic → true; owner own clinic → true; owner other clinic → false; member → false; undefined → false.
  - `OwnerOnly` renders children for owner, redirects a member to `/c1/patients`.
  - `AuthGuard`: when the membership query resolves `null` after previously resolving a membership (removed user), the user is signed out and sent to `/login` (existing behaviour; add a test if missing). Also set `refetchOnWindowFocus: true` on the membership query so a removed user is caught on return to the app.

- [ ] **Step 2: Run** `npm test -- access OwnerOnly AuthGuard` → FAIL.
- [ ] **Step 3: Implement.** `getMembership` reads `doc(db, CLINICS, clinicId)` after the allow-list entry.
- [ ] **Step 4: Run** → PASS; also `npm test` (other tests construct `Membership` objects: add `owner` where TypeScript requires it).
- [ ] **Step 5: Commit** `feat(access): clinic owner role and owner-only route guard`

---

### Task 4: Email verification and account creation

**Files:**
- Create: `src/features/auth/VerifyEmailPage.tsx`, `src/features/auth/VerifyEmailPage.test.tsx`
- Modify: `src/features/auth/LoginPage.tsx`, `src/features/auth/LoginPage.test.tsx`, `src/features/auth/AuthGuard.tsx`, `src/App.tsx`

**Interfaces:**
- Consumes: `getMembership`, `homePath` (Task 3).
- Produces: route `/verify-email` (outside `AuthGuard`, requires a signed-in user, else `/login`).

- [ ] **Step 1: Failing tests**
  - `AuthGuard`: signed-in user with `emailVerified: false` → `<Navigate to="/verify-email">`; the membership query is not run (`enabled: !!user && user.emailVerified`).
  - `LoginPage`: password sign-in of an unverified user navigates to `/verify-email` (no "not allowed" toast, no sign-out).
  - `LoginPage`: a "Create account" toggle switches the submit button to "Create account"; submitting calls `createUserWithEmailAndPassword(auth, email, password)` then `sendEmailVerification(user)` and navigates to `/verify-email`. `auth/email-already-in-use` → toast "An account already exists for this email. Sign in or reset your password."; `auth/weak-password` → "Password must be at least 6 characters."
  - `VerifyEmailPage`: shows the user's email; "Resend email" calls `sendEmailVerification` (toast success; `auth/too-many-requests` → "Please wait a minute before resending."); "I've verified" calls `user.reload()` then `user.getIdToken(true)`, and when `emailVerified` is now true navigates to `/`; otherwise toast "Not verified yet. Check your inbox and spam folder."; "Use a different account" signs out to `/login`.

- [ ] **Step 2: Run** `npm test -- VerifyEmailPage LoginPage AuthGuard` → FAIL.
- [ ] **Step 3: Implement.** Reuse the login page's card look (`TOKENS`, `CARD_SX`). Google sign-in users are always verified, so only the password path branches.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(auth): require verified email, add create-account and verify-email screen`

---

### Task 5: People page (owner)

**Files:**
- Create: `src/features/people/PeoplePage.tsx`, `src/features/people/PeoplePage.test.tsx`
- Modify: `src/App.tsx` (route `people` under `/:clinicSlug`, wrapped in `<OwnerOnly>`), `src/components/AppShell.tsx` (+ test), `src/lib/clinic.ts` (add `"people"`, `"verify-email"` to `RESERVED_SLUGS`; mirror in `scripts/migrate-to-clinics.mjs`).

**Interfaces:**
- Consumes: `useSeats`, `useAddUser`, `useRemoveUser`, `SeatError` (Task 2); `canManageClinic`, `OwnerOnly` (Task 3); `useClinic` for `ownerEmail` (extend `Clinic` in `src/lib/clinicQueries.ts` with `ownerEmail?: string`).

- [ ] **Step 1: Failing tests**
  - Lists seats with email and a chip: "Owner" for `ownerEmail`, "Member" otherwise; shows "2 of 3 users".
  - Add form (email field + "Add user") calls `addUser`; at 3 users the button is disabled with helper text "This clinic has the maximum of 3 users."
  - `SeatError` codes map to toasts: duplicate → "Already a user of this clinic."; superadmin/invalid → "Enter a valid email address."; unavailable → "This email can't be added."; full → the max-3 text.
  - Remove (not shown for the owner row) opens `ConfirmDialog` ("Remove <email>? They will lose access immediately.", confirm label "Remove") and calls `removeUser`.
  - Helper text under the list: "Added users sign in with Google, or create a password on the login page and verify their email."
  - `AppShell`: account menu shows "People" only when `canManageClinic(membership, clinicSlug)`; navigates to `/<clinic>/people`.

- [ ] **Step 2: Run** `npm test -- PeoplePage AppShell` → FAIL.
- [ ] **Step 3: Implement** with `QueryStates` for the list and `useSetPageTitle("People")`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(people): owner page to add and remove clinic users`

---

### Task 6: Superadmin `/admin` on seats

**Files:**
- Modify: `src/features/access/AccessPage.tsx`, `src/features/access/AccessPage.test.tsx`, `src/features/access/accessRepo.ts` (+ test), `src/features/access/useAllowedEmails.ts`, `src/features/access/useClinics.ts`, `src/lib/clinicQueries.ts` (`listClinics`/`getClinic` map `ownerEmail`).

**Interfaces:**
- Consumes: Task 2 repo/hooks, `createClinic(id, name, ownerEmail, addedBy)`.

- [ ] **Step 1: Failing tests**
  - Create-clinic form requires an owner email (button disabled until valid) and calls `createClinic(slug, name, owner, superadminEmail)`.
  - Each clinic shows its users (from `listAllowedEmails` grouped by `clinicId`) with seat, an "Owner" chip, a "Make owner" action on non-owners (calls `setOwner`), and "Remove" (disabled for the owner with tooltip "Make someone else owner first").
  - A clinic with no `ownerEmail` shows "No owner set".
  - Add user per clinic uses `addUser`; when the email already belongs to another clinic the superadmin sees "Already assigned to <clinic name>. Remove it there first." (check `listAllowedEmails` data before writing).
  - Remove `addAllowedEmail`/`removeAllowedEmail` and their hooks; no remaining imports (`npm run build` proves it).

- [ ] **Step 2: Run** `npm test -- AccessPage accessRepo` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` and `npm run build` → PASS.
- [ ] **Step 5: Commit** `feat(admin): manage clinic owners and seats`

---

### Task 7: Seat backfill script, docs

**Files:**
- Create: `scripts/backfill-seats.mjs`
- Modify: `package.json` (`"backfill:seats": "node scripts/backfill-seats.mjs"`), `CLAUDE.md`, `docs/superpowers/specs/2026-10-19-multi-clinic-design.md` (cutover runbook)

**Interfaces:**
- CLI: `npm run backfill:seats -- --clinic <id> --owner <email> --project <id> [--dry-run]`. Same Admin SDK init and arg parsing as `scripts/migrate-to-clinics.mjs` (explicit `--project` required).

- [ ] **Step 1: Implement the script.** For the clinic: read `allowedEmails` where `clinicId == <id>`; abort (exit 1, list emails) if more than 3, if `--owner` isn't among them, if the superadmin email is among them, or if `clinics/<id>/seats` already has docs. Assign seat `"1"` to the owner, `"2"`/`"3"` to the rest (alphabetical). Write in one batch: seat docs, `seat` field on each allowedEmails entry, `ownerEmail` + `timeZone: "Asia/Kolkata"` on the clinic. `--dry-run` prints the planned table and writes nothing.
- [ ] **Step 2: Verify manually against the emulator**: seed `clinics/demo` + 2 allowedEmails, run with `FIRESTORE_EMULATOR_HOST=localhost:8080 … --project demo-grace`, then rerun → aborts "seats already exist"; with 4 entries → aborts listing them.
- [ ] **Step 3: Update docs.** CLAUDE.md: data model (`ownerEmail`, `timeZone`, `seats`, `allowedEmails.seat`), roles (owner/member/superadmin, 3-user cap), new routes (`/verify-email`, `/:clinicSlug/people`), verified-email rule, `backfill:seats` command. Cutover runbook: `migrate:clinics` → `backfill:seats` (dry run, then real) → deploy rules + hosting together → reopen app on every device → tell existing password users they'll verify their email once.
- [ ] **Step 4: Run** `npm test && npm run lint && npm run build` → all pass (lint: no new errors).
- [ ] **Step 5: Commit** `feat(scripts): backfill clinic owner and seats; docs for roles`
