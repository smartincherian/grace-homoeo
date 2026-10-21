# Self-signup & 21-day Free Trial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doctors create their own clinic with a 21-day free trial; after it the clinic is read-only until the superadmin authorizes it; a WhatsApp link (9036209639) asks for pricing.

**Architecture:** Trial state lives on `clinics/{id}` (`trialEndsAt`, `authorized`, `authorizedAt`, `selfSignup`). Firestore rules gate every clinic write on `trialOk(c)` and allow a tightly validated self-signup batch. The client routes users with no allow-list entry to `/setup`, shows a `TrialBanner` in the shell, and turns denied writes in an expired clinic into a "Trial ended" dialog via a global `MutationCache` hook. `/admin` shows status and an authorize toggle.

**Tech Stack:** Vite + React + TypeScript, MUI v6, TanStack Query, Firebase Auth + Firestore, Vitest + RTL, `@firebase/rules-unit-testing`.

**Spec:** `docs/superpowers/specs/2026-10-21-self-signup-trial-design.md`

## Global Constraints

- Trial length `TRIAL_DAYS = 21`, `TRIAL_MS = 1814400000` (21 × 86 400 000).
- WhatsApp number `919036209639`; link `https://wa.me/919036209639?text=<encodeURIComponent(msg)>`.
- Pre-filled message exactly: `Hi, I'd like to know the Homoeo Desk subscription pricing. Clinic: <clinic name> (<slug>), email: <owner email>.`
- Trial OK = `authorized === true` OR `trialEndsAt` absent OR `now < trialEndsAt`. Otherwise expired.
- Expired = read-only: reads unchanged, every write under `clinics/{id}/…` and owner `allowedEmails` writes denied (superadmin exempt).
- Every newly created clinic (self-signup or `/admin`) gets `trialEndsAt = createdAt + TRIAL_MS`.
- Self-signup `createdAt` must be within ±10 minutes (600000 ms) of `request.time`.
- Reserved slugs gain `setup` and `signup`; the rules mirror the full list.
- Product name in copy is "Homoeo Desk" (with a space). Use `TOKENS`/`GRADIENT`, never raw accent hex; `useToast`, never `alert()`.
- Features must not import each other's internals; shared code goes in `src/lib/` or `src/components/`.
- Do not deploy. Release (`npm run release`) is the user's call after the plan is done.

## Fit with the existing "inactive" feature (added after the spec)

Commits `3d2dc84`..`194b9d5` added a superadmin **inactive** switch: `clinics/{id}.active` and
`allowedEmails/{email}.active` (`false` = fully blocked, reads too), rules `clinicActive(c)` /
`entryActive()` folded into `member()`, `Membership.inactive?: "user" | "clinic"` with an
"inactive" screen in `AuthGuard`, `Clinic.active`, `clinicAdminRepo.ts` (`setClinicActive`,
`setUserActive`, `deleteClinic`), and a clinics **table** on `/admin` (`ClinicRow` with a menu,
"Active/Inactive" chip). Build on it; do not change its behaviour:

- **Naming:** the spec's rules `active(c)` is called **`trialOk(c)`** here, and the TS
  helper is **`trialOk(status)`**, so they never clash with the existing `active` field. Trial
  fields never use the name `active`.
- Inactive (blocked) and trial-ended (read-only) are independent; inactive wins on screen
  (AuthGuard already shows its screen before the shell renders).
- `clinics/{id}` `get` rule already lets a clinic's own users read it; Task 2 only **adds**
  the `resource == null` branch.
- `deleteClinic` (superadmin) must keep working on expired clinics — superadmin is exempt.
- Task 6 adds the trial status chip next to the existing Active/Inactive chip in `ClinicRow`
  and "Authorize" / "Remove authorization" as items in that row's existing menu.

## Review Focus

1. **Legacy clinics at deploy** — `grace-homoeo`/`grace`/`test` have no trial fields; every write family must still succeed (rules test in Task 2).
2. **Unassigned allow-list entry** (`clinicId: ""`) — must get the old "not allowed" sign-out, never `/setup` (test in Task 3).
3. **Superadmin visiting an expired clinic** — superadmin writes still succeed and no "Trial ended" dialog for superadmin (rules test Task 2; banner test Task 5).
4. **Authorization while the app is open** — after the superadmin authorizes, the clinic's banner disappears on next window focus without sign-out (`useClinic` refetches on focus; test in Task 5 asserts the banner is driven by the `useClinic` data, not cached membership).
5. **Slug collisions at setup** — an existing slug shows "taken" before submit and never overwrites (rules test Task 2; UI test Task 4).

---

### Task 1: Subscription helpers and clinic trial fields

**Files:**
- Create: `src/lib/subscription.ts`, `src/lib/subscription.test.ts`
- Modify: `src/lib/clinicQueries.ts` (`Clinic` + `getClinic`), `src/features/access/clinicsRepo.ts` (`listClinics` mapping), `src/lib/clinic.ts` (`RESERVED_SLUGS`)

**Interfaces:**
- Produces:
  - `Clinic` gains `authorized?: boolean; authorizedAt?: number | null; trialEndsAt?: number; selfSignup?: boolean` (read with type guards; absent → `undefined`).
  - `TRIAL_DAYS = 21`, `TRIAL_MS = 1814400000`, `WHATSAPP_NUMBER = "919036209639"`.
  - `type ClinicStatus = { kind: "authorized" } | { kind: "legacy" } | { kind: "trial"; daysLeft: number } | { kind: "expired" }`
  - `clinicStatus(c: Pick<Clinic, "authorized" | "trialEndsAt">, now: number): ClinicStatus` — authorized wins; no `trialEndsAt` → legacy; `now < trialEndsAt` → trial with `daysLeft = Math.ceil((trialEndsAt - now) / 86400000)`; else expired.
  - `trialOk(s: ClinicStatus): boolean` (`kind !== "expired"`).
  - `pricingWhatsAppUrl(p: { clinicName: string; clinicId: string; email: string }): string`
  - `RESERVED_SLUGS` includes `"setup"` and `"signup"`.

- [ ] **Step 1: Write failing tests** in `subscription.test.ts`:
  - `clinicStatus({ authorized: true, trialEndsAt: 0 }, 5)` → `{ kind: "authorized" }`
  - `clinicStatus({}, 5)` → `{ kind: "legacy" }`
  - `clinicStatus({ trialEndsAt: 1000 + TRIAL_MS }, 1000)` → `{ kind: "trial", daysLeft: 21 }`
  - `clinicStatus({ trialEndsAt: 1000 }, 1000 - 1)` → `{ kind: "trial", daysLeft: 1 }`
  - `clinicStatus({ trialEndsAt: 1000 }, 1000)` → `{ kind: "expired" }`
  - `pricingWhatsAppUrl({ clinicName: "Sun Clinic", clinicId: "sun", email: "a@b.com" })` equals `"https://wa.me/919036209639?text=" + encodeURIComponent("Hi, I'd like to know the Homoeo Desk subscription pricing. Clinic: Sun Clinic (sun), email: a@b.com.")`
  - In `src/lib/clinic.test.ts` (existing or new): `isValidSlug("setup")` and `isValidSlug("signup")` are false.
  - In the existing clinicQueries/clinicsRepo tests (mocked Firestore): a doc with `authorized: true, trialEndsAt: 9, selfSignup: true, authorizedAt: 3` maps those fields; a doc without them maps to `undefined`.
- [ ] **Step 2: Run** `npm test -- subscription clinic` — expect FAIL.
- [ ] **Step 3: Implement** the interfaces above.
- [ ] **Step 4: Run** `npm test` — expect all PASS.
- [ ] **Step 5: Commit** `feat(trial): subscription helpers and clinic trial fields`

### Task 2: Firestore rules — active gating and self-signup

**Files:**
- Modify: `firestore.rules`, `rules-tests/firestore.rules.test.ts`

**Interfaces:**
- Produces (rules functions): `trialOk(c)`, `canWrite(c)` = `superadmin() || trialOk(c)`, `reservedSlugs()` list, `selfSignupClinic(clinicId)`.
- Consumes: `TRIAL_MS` value `1814400000`, reserved list from Task 1.

Rules changes:
- `trialOk(c)`: `clinicData(c).get('authorized', false) == true || !('trialEndsAt' in clinicData(c)) || request.time.toMillis() < clinicData(c).trialEndsAt`.
- Add `&& canWrite(clinicId)` to every write under `clinics/{clinicId}`: seats create/delete, settings create/update/delete, appointments create/update/delete, appointmentHistory create, staff/leaves/salaryPayments writes, catch-all `{sub}/{document=**}`. Split `allow read, write` lines into separate `read` and `write`.
- `allowedEmails` create/delete via `manager(...)` additionally require `canWrite(<clinicId>)` (use `request.resource.data.clinicId` on create, `resource.data.clinicId` on delete).
- `clinics/{clinicId}` **get**: keep the existing branches and also allow when `signedIn() && verified() && resource == null`.
- `clinics/{clinicId}` **create** self-signup branch (keep the superadmin branch): verified, not superadmin, `!exists(allowedEmails/$(authEmail()))`, `clinicId.matches('^[a-z0-9]+(-[a-z0-9]+)*$')`, `clinicId.size()` 3–40, `!(clinicId in reservedSlugs())`, keys `hasOnly`+`hasAll` `['name','createdAt','ownerEmail','timeZone','trialEndsAt','authorized','authorizedAt','selfSignup']`, `name is string` size 1–60, `ownerEmail == authEmail()`, `authorized == false`, `authorizedAt == null`, `selfSignup == true`, `timeZone == 'Asia/Kolkata'`, `createdAt is int` and `abs(createdAt - request.time.toMillis()) <= 600000` (write as two comparisons), `trialEndsAt == createdAt + 1814400000`, `entryAfterIs(authEmail(), clinicId, '1')`, `seatAfterIs(clinicId, '1', authEmail())`.
- `seats/{seatId}` create self-signup branch: `seatId == '1'`, data keys only `email`, `email == authEmail()`, `!exists(clinics/$(clinicId))`, `getAfter(clinics/$(clinicId)).data.ownerEmail == authEmail()`, `getAfter(...).data.get('selfSignup', false) == true`, `entryAfterIs(authEmail(), clinicId, '1')`.
- `allowedEmails/{email}` create self-signup branch: `email == authEmail()`, keys only `['email','clinicId','seat','addedAt','addedBy']`, `seat == '1'`, `addedBy == authEmail()`, clinic `!exists` before and `getAfter(...).data.ownerEmail == email` and `selfSignup == true` after, `seatAfterIs(clinicId, '1', email)`.
- Superadmin clinic update stays as is (works for `authorized`/`authorizedAt`/`trialEndsAt` updates).

- [ ] **Step 1: Write failing rules tests** in a new `describe("trial & self-signup")`. Seed in `beforeEach`: `clinics/legacy` (no trial fields, owner `l@x.com` seat 1), `clinics/live` (`trialEndsAt: Date.now() + 86400000`, `authorized: false`, owner `v@x.com`), `clinics/expired` (`trialEndsAt: Date.now() - 1`, `authorized: false`, owner `e@x.com`, member `m@x.com` seat 2, one `patients/p1`), `clinics/paid` (`trialEndsAt: 1`, `authorized: true`, owner `p@x.com`). Helper `signupBatch(db, slug, email, overrides = {})` writing the three docs with `createdAt: Date.now()`. Tests:
  - expired: member `getDoc patients/p1` succeeds; `setDoc patients/p2`, `setDoc settings/branding` (valid), appointment create, `staff/s1` write by owner, owner adding `n@x.com` seat 3 — all FAIL.
  - expired: superadmin `setDoc patients/p2` succeeds.
  - legacy, live, paid: member `setDoc patients/p2` succeeds.
  - signup happy path: `new@x.com` (no entry) `signupBatch("sun-clinic")` succeeds; then `getDoc clinics/sun-clinic` succeeds for them.
  - signup FAILS for: `authorized: true`; `trialEndsAt: createdAt + TRIAL_MS + 1`; `ownerEmail: "other@x.com"`; slug `"live"` (exists); slug `"setup"`; slug `"ab"`; caller already allow-listed (`m@x.com`); `email_verified: false`; `createdAt: Date.now() - 700000`.
  - `new@x.com` `getDoc clinics/nope` succeeds; `getDoc clinics/live` FAILS.
  - superadmin `updateDoc clinics/expired { authorized: true, authorizedAt: 1 }` succeeds; owner `e@x.com` same update FAILS.
- [ ] **Step 2: Run** `npm run test:rules` (emulator; see CLAUDE.md for Java 17 fallback) — expect the new tests FAIL.
- [ ] **Step 3: Implement** the rules above.
- [ ] **Step 4: Run** `npm run test:rules` — expect all PASS (old tests included).
- [ ] **Step 5: Commit** `feat(rules): trial gating and self-serve clinic signup`

### Task 3: Access resolution routes unregistered users to /setup

**Files:**
- Modify: `src/lib/access.ts` (+ its test), `src/features/auth/AuthGuard.tsx` (+ test), `src/features/auth/LoginPage.tsx` (+ test), `src/features/auth/VerifyEmailPage.tsx` (+ test)

**Interfaces:**
- Produces:
  - `type Access = Membership | "signup" | null` — `"signup"` when the verified user has **no** `allowedEmails` doc; `null` for unassigned entry (`clinicId` empty/non-string), denied, or no email.
  - `getAccess(user: User): Promise<Access>` (the current `getMembership` body, returning `"signup"` for a missing doc). Keep `getMembership(user)` as a wrapper returning `Membership | null` (`"signup"` → `null`) for existing callers.
  - `useMembership()` keeps returning `Membership | undefined` (non-object → `undefined`). Query key stays `["access", uid]`, now holding `Access`.
- Behaviour: AuthGuard — data `"signup"` → `<Navigate to="/setup" replace />` (no sign-out); `null` → sign out as today. LoginPage `signIn` and VerifyEmailPage `check` — `"signup"` → `navigate("/setup", { replace: true })` without `ensureUserDoc`; `null` → today's toast + sign-out.

- [ ] **Step 1: Write failing tests:**
  - access: missing allow-list doc → `getAccess` resolves `"signup"`; doc with `clinicId: ""` → `null`; `getMembership` with missing doc → `null`.
  - AuthGuard: membership query data `"signup"` renders a route at `/setup` and does not call `signOut`.
  - LoginPage: Google sign-in where `getAccess` resolves `"signup"` navigates to `/setup`, `ensureUserDoc` not called, no "not allowed" toast. Same for `null` still shows the "not allowed" toast.
  - VerifyEmailPage: verified check with `"signup"` → navigates to `/setup`.
- [ ] **Step 2: Run** `npm test -- access AuthGuard LoginPage VerifyEmail` — expect FAIL.
- [ ] **Step 3: Implement.** LoginPage/VerifyEmailPage switch from `getMembership` to `getAccess` and `setQueryData(["access", uid], access)` in both branches.
- [ ] **Step 4: Run** `npm test` — all PASS.
- [ ] **Step 5: Commit** `feat(auth): send users without a clinic to setup`

### Task 4: /setup page and self-signup repository

**Files:**
- Create: `src/features/signup/signupRepo.ts`, `signupRepo.test.ts`, `SetupPage.tsx`, `SetupPage.test.tsx`
- Modify: `src/App.tsx` (route `/setup` outside `AuthGuard`, next to `/verify-email`), `src/lib/clinic.ts` only if needed

**Interfaces:**
- Consumes: `TRIAL_MS`, `pricingWhatsAppUrl` (Task 1); `getAccess`, `Access` (Task 3); `isValidSlug`, `slugify`, `CLINICS`; `ALLOWED_EMAILS`, `normalizeEmail`; `ensureUserDoc`; `ProductMark`, `BottomDock`.
- Produces:
  - `isSlugTaken(slug: string): Promise<boolean>` — `getDoc(clinics/slug)`: not exists → `false`; `permission-denied` → `true`; other errors rethrown.
  - `createOwnClinic(slug: string, name: string, email: string, now = Date.now()): Promise<void>` — one `writeBatch` with the three docs exactly as the rules require (`email` normalized, `trialEndsAt: now + TRIAL_MS`, `authorized: false`, `authorizedAt: null`, `selfSignup: true`, `timeZone: "Asia/Kolkata"`, allow-list `addedAt: now, addedBy: email`).

SetupPage behaviour:
- No user → `<Navigate to="/login" replace />`; unverified → `/verify-email`; access query is an object Membership → `<Navigate to={homePath(m)} />`.
- Copy: heading "Start your clinic on Homoeo Desk"; warning (MUI `Alert severity="info"`): "Joining a clinic that already uses Homoeo Desk? Don't create one — ask its owner to add <email> on their People page, then sign in again."; fields "Clinic name" (≤60, required) and "Web address" (auto `slugify(name)` until edited, helper `homoeodesk.web.app/<slug>`, invalid → "3–40 letters, numbers or dashes"); note "21-day free trial, no payment needed."; button "Start free trial"; links "Sign out" and "Pricing? Ask on WhatsApp" (`pricingWhatsAppUrl` with the typed name/slug and user email, `target="_blank" rel="noopener"`); `<BottomDock pinned={false} showScripture={false} />`.
- Submit: `isSlugTaken` → true shows field error "That web address is taken, try another"; else `createOwnClinic`; on denied commit toast "Couldn't create the clinic. Check your phone's date and time, then try again." (log with `console.error`). On success: `await getAccess(user)` → `setQueryData(["access", uid], it)`, `await ensureUserDoc(user)`, `navigate("/<slug>/settings", { replace: true })`.

- [ ] **Step 1: Write failing tests:**
  - signupRepo (mock `firebase/firestore`): `createOwnClinic("sun", "Sun", "A@B.com", 1000)` calls `batch.set` with clinic `{ name: "Sun", createdAt: 1000, ownerEmail: "a@b.com", timeZone: "Asia/Kolkata", trialEndsAt: 1000 + 1814400000, authorized: false, authorizedAt: null, selfSignup: true }`, seat `{ email: "a@b.com" }`, entry `{ email: "a@b.com", clinicId: "sun", seat: "1", addedAt: 1000, addedBy: "a@b.com" }`, then `commit`. `isSlugTaken`: not-exists → false; permission-denied → true; unavailable → rejects.
  - SetupPage: typing "Sun Clinic" fills web address `sun-clinic`; "Start free trial" disabled while name empty; taken slug shows "That web address is taken, try another" and `createOwnClinic` not called; success calls `createOwnClinic("sun-clinic", "Sun Clinic", email)`, then `ensureUserDoc`, and lands on `/sun-clinic/settings`; WhatsApp link `href` starts with `https://wa.me/919036209639?text=`; info warning text present.
- [ ] **Step 2: Run** `npm test -- signup Setup` — FAIL.
- [ ] **Step 3: Implement** repo, page and route.
- [ ] **Step 4: Run** `npm test` — PASS.
- [ ] **Step 5: Commit** `feat(signup): self-serve clinic setup with free trial`

### Task 5: Trial banner and "Trial ended" dialog

**Files:**
- Create: `src/components/TrialBanner.tsx`, `TrialBanner.test.tsx`, `src/lib/writeDenied.ts`
- Modify: `src/lib/queryClient.ts` (add `mutationCache`), `src/components/AppShell.tsx` (render `<TrialBanner clinicId=… />` above `{children ?? <Outlet />}` in both layouts, only when inside a readable clinic)

**Interfaces:**
- Consumes: `useClinic` (`src/lib/clinicQueries.ts`, now with trial fields), `clinicStatus`, `pricingWhatsAppUrl` (Task 1), `useMembership` (Task 3), `useBranding`/`displayNameOf` for the clinic name.
- Produces:
  - `src/lib/writeDenied.ts`: `WRITE_DENIED_EVENT = "homoeodesk:write-denied"`, `notifyWriteDenied(): void` (dispatches a `window` `Event`), `onWriteDenied(cb: () => void): () => void`.
  - `queryClient` gets `mutationCache: new MutationCache({ onError: (err) => { if (err instanceof FirebaseError && err.code === "permission-denied") notifyWriteDenied(); } })`.
  - `<TrialBanner clinicId: string />`.

TrialBanner behaviour (status from `clinicStatus(useClinic(clinicId).data, Date.now())`; nothing while loading):
- `authorized` / `legacy`, or viewer is superadmin → renders nothing and never opens the dialog.
- `trial`: slim bar "Free trial · N days left" (`1 day left` singular) + "Subscribe" link (WhatsApp, owner email from `clinic.ownerEmail`); warning tone when `daysLeft <= 5`.
- `expired`: bar "Your free trial has ended. Your records are read-only. Subscribe to keep adding patients and bookings." + button "Ask pricing on WhatsApp".
- On `onWriteDenied` while `expired`: open MUI `Dialog` titled "Trial ended" with body "Subscribe to continue making changes. Your records are safe and still readable." and the WhatsApp button + "Close".

- [ ] **Step 1: Write failing tests** (mock `useClinic`, `useMembership`, `useBranding`):
  - trial with `trialEndsAt = now + 3 days` → "Free trial · 3 days left"; link `href` starts `https://wa.me/919036209639`.
  - `trialEndsAt = now + 1h` → "1 day left".
  - expired → "Your free trial has ended" text; `notifyWriteDenied()` opens dialog "Trial ended".
  - authorized and legacy → renders nothing; `notifyWriteDenied()` opens nothing.
  - superadmin membership on expired clinic → nothing.
  - re-render with `useClinic` returning `authorized: true` after expired → banner gone (Review Focus 4).
  - `queryClient` test: a mutation rejecting with `new FirebaseError("permission-denied", "x")` triggers an `onWriteDenied` listener; one rejecting with another code does not.
- [ ] **Step 2: Run** `npm test -- TrialBanner queryClient` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` — PASS (AppShell tests may need `useClinic` mocked to legacy).
- [ ] **Step 5: Commit** `feat(trial): trial banner and trial-ended dialog`

### Task 6: Superadmin status, authorize toggle, trial on admin-created clinics

**Files:**
- Modify: `src/features/access/clinicsRepo.ts` (+ test), `src/features/access/useClinics.ts`, `src/features/access/AccessPage.tsx` (+ test)

**Interfaces:**
- Consumes: `Clinic` trial fields, `clinicStatus`, `TRIAL_MS` (Task 1); `ConfirmDialog`.
- Produces:
  - `createClinic(id, name, ownerEmail, addedBy, authorized = false, now = Date.now())` — clinic doc adds `trialEndsAt: now + TRIAL_MS`, `authorized`, `authorizedAt: authorized ? now : null`, `selfSignup: false` (`createdAt: now`).
  - `setClinicAuthorized(clinic: Clinic, authorized: boolean, now = Date.now()): Promise<void>` — `updateDoc` `{ authorized, authorizedAt: authorized ? now : null }`, plus `trialEndsAt: now` when un-authorizing a clinic with no `trialEndsAt`.
  - `useSetClinicAuthorized()` mutation (invalidates `["clinics"]`).
  - `listClinics` sort: expired first, then trial by `daysLeft` ascending, then authorized/legacy by name.

AccessPage behaviour:
- Each clinic header shows owner email, created date (`dd MMM yyyy`, existing date helper if any), chip "Self signup" when `selfSignup`, status chip: "Authorized" (success), "Trial · N days left" (warning when ≤5, else default), "Trial ended" (error), "Legacy" (default).
- Button "Authorize" / "Remove authorization" → `ConfirmDialog`; the remove dialog for a legacy clinic says "This clinic has no trial, so it becomes read-only immediately."; for a clinic whose trial is still running, "It goes back to its free trial (N days left)."; otherwise "It becomes read-only."
- Create form: checkbox "Authorized (no trial)" passed to `createClinic`.

- [ ] **Step 1: Write failing tests:**
  - repo: `createClinic("c","C","o@x.com","s",false,1000)` writes `trialEndsAt: 1000 + 1814400000, authorized: false, authorizedAt: null, selfSignup: false`; with `true` → `authorized: true, authorizedAt: 1000`.
  - repo: `setClinicAuthorized({ id: "c", ...no trialEndsAt }, false, 5)` updates `{ authorized: false, authorizedAt: null, trialEndsAt: 5 }`; with a `trialEndsAt` present, no `trialEndsAt` key; `true` → `{ authorized: true, authorizedAt: 5 }`.
  - repo: `listClinics` order for [authorized "A", trial 10 days "B", expired "C", trial 2 days "D"] → C, D, B, A.
  - AccessPage: chips render "Trial ended", "Trial · 2 days left", "Authorized", "Legacy", "Self signup"; clicking "Authorize" then confirming calls the mutation with `true`; legacy remove dialog shows "becomes read-only immediately".
- [ ] **Step 2: Run** `npm test -- clinicsRepo AccessPage` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` — PASS.
- [ ] **Step 5: Commit** `feat(admin): clinic trial status and authorization`

### Task 7: Docs and final verification

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**: Status mentions self-signup + trial; Routing adds `/setup` (verified users with no allow-list entry); Data model: `clinics/{id}` trial fields and the `trialOk` rule, self-signup batch, `"setup"`/`"signup"` reserved; Conventions: rules `trialOk()` write gating, superadmin exempt; post-deploy step "authorize `grace-homoeo` on `/admin`"; `src/lib/subscription.ts` holds trial length and WhatsApp number.
- [ ] **Step 2: Run** `npm run build && npm test && npm run lint && npm run test:rules` — expect build OK, all tests PASS, 0 lint errors.
- [ ] **Step 3: Commit** `docs: self-signup and free trial in CLAUDE.md`
- [ ] **Step 4:** Report to the user that release (`npm run release`) and authorizing `grace-homoeo` afterwards are pending their go-ahead.
