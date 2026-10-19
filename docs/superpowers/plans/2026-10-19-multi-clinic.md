# Multi-Clinic Tenancy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve several clinics from one app, each seeing only its own data, with clinic slugs in the URL.

**Architecture:** All clinic data moves under `clinics/{clinicId}/…` subcollections. A small `src/lib/clinic.ts` module holds the active clinic and builds Firestore refs, so repositories change their path only and hooks/pages are untouched apart from links. A `/:clinicSlug` layout route sets the active clinic; Firestore rules enforce isolation server-side from `allowedEmails/{email}.clinicId`.

**Tech Stack:** Vite, React 18, TypeScript, react-router v6, TanStack Query v5, Firebase v10 (Firestore, Auth), Vitest, `@firebase/rules-unit-testing`, `firebase-admin` (migration script only).

**Spec:** `docs/superpowers/specs/2026-10-19-multi-clinic-design.md`

## Global Constraints

- Work on branch `feature/multi-clinic` off `main`.
- Firestore root for clinic data: `clinics/{clinicId}`; subcollection names unchanged: `patients, consultations, generals, lsmc, inventory, orderItems, expenses, counters`.
- Slug regex `^[a-z0-9]+(-[a-z0-9]+)*$`, length 3–40, reserved: `login, admin, access, patients, inventory, calculator, funds, clinics`.
- First clinic slug: `grace-homoeo`, name `Grace Homoeo`.
- Superadmin email stays `smartin.cherian@gmail.com` (in `src/lib/access.ts` and `firestore.rules`).
- `npm test` must keep running without an emulator; rules tests run only via `npm run test:rules`.
- UI never calls the Firestore SDK directly; feature folders don't import each other.
- Do not deploy rules or run the migration against production — that is the user's cutover step (spec §7).

## Review Focus

1. Superadmin switches from clinic A to clinic B → B's pages must not briefly show A's cached patients (cache cleared on clinic change).
2. Allowed email whose entry has no `clinicId` (pre-migration) → treated as no access at login, not a crash or blank app.
3. Member opens `/other-clinic/patients` → redirected to own clinic; no request for the other clinic's data is made.
4. Old bookmark / installed PWA start URL `/patients/abc` → lands on `/<own clinic>/patients/abc`.
5. Creating a clinic whose slug already exists → rejected with a message, existing clinic untouched.

---

### Task 1: Active-clinic module and slug helpers

**Files:**
- Create: `src/lib/clinic.ts`
- Test: `src/lib/clinic.test.ts`

**Interfaces:**
- Produces:
  - `setActiveClinic(id: string | null): void`
  - `getActiveClinic(): string` — throws `Error("No active clinic")` when unset
  - `clinicCollection(name: string): CollectionReference` → `collection(db, "clinics", id, name)`
  - `clinicDoc(name: string, id: string): DocumentReference` → `doc(db, "clinics", activeId, name, id)`
  - `CLINICS = "clinics"`, `RESERVED_SLUGS: readonly string[]`
  - `slugify(name: string): string` — lowercase, non-alphanumerics → `-`, trim/collapse hyphens, cut to 40
  - `isValidSlug(slug: string): boolean`

- [ ] **Step 1: Write failing tests** (mock `firebase/firestore` `collection`/`doc` as `vi.fn((...a) => a)` and `./firebase` as `{ db: {} }`, like `serial.test.ts`)
  - `getActiveClinic` throws `"No active clinic"` before `setActiveClinic`, and after `setActiveClinic(null)`.
  - after `setActiveClinic("grace-homoeo")`: `clinicCollection("patients")` called `collection` with `({}, "clinics", "grace-homoeo", "patients")`; `clinicDoc("counters", "patients")` called `doc` with `({}, "clinics", "grace-homoeo", "counters", "patients")`.
  - `slugify("Grace Homoeo Clinic!")` → `"grace-homoeo-clinic"`; `slugify("  St. Mary's  ")` → `"st-mary-s"`.
  - `isValidSlug`: true for `"grace-homoeo"`, `"abc"`; false for `"ab"`, `"Grace"`, `"-x-"`, `"a--b"`, `"patients"`, `"admin"`, 41 chars.
- [ ] **Step 2:** `npm test -- clinic` → FAIL (module missing).
- [ ] **Step 3:** Implement `src/lib/clinic.ts` (module-level `let active: string | null`).
- [ ] **Step 4:** `npm test -- clinic` → PASS.
- [ ] **Step 5:** Commit `feat(clinic): active clinic module and slug helpers`.

---

### Task 2: Scope every repository to the active clinic

**Files:**
- Modify: `src/lib/serial.ts`, `src/features/patients/patientsRepo.ts`, `src/features/consultations/consultationsRepo.ts`, `src/features/consultations/caseRecordRepo.ts`, `src/features/inventory/inventoryRepo.ts`, `src/features/inventory/orderRepo.ts`, `src/features/funds/fundsRepo.ts`, `src/features/rateCalculator/calculatorRepo.ts`
- Test: the matching `*.test.ts` files (`serial`, `patientsRepo`, `consultationsRepo`, `caseRecordRepo`, `inventoryRepo`, `orderRepo`)

**Interfaces:**
- Consumes: `clinicCollection`, `clinicDoc` (Task 1).
- Produces: no signature changes — every exported repo function keeps its signature.

Mechanical rule: `collection(db, X)` → `clinicCollection(X)`; `doc(db, X, id)` → `clinicDoc(X, id)`; `doc(collection(db, X))` → `doc(clinicCollection(X))`. `writeBatch(db)` / `runTransaction(db, …)` keep `db`. `serial.ts` uses `clinicDoc("counters", "patients")`.

- [ ] **Step 1: Update tests first.** In each repo test add `vi.mock("../../lib/clinic", () => ({ clinicCollection: (n: string) => ({ path: \`clinics/c1/${n}\` }), clinicDoc: (n: string, id: string) => ({ path: \`clinics/c1/${n}/${id}\` }) }))` and add assertions:
  - `patientsRepo.test`: `listPatients` queries `{ path: "clinics/c1/patients" }`; `deletePatient("p1")` queries `clinics/c1/consultations`, `clinics/c1/generals`, `clinics/c1/lsmc` and deletes `clinics/c1/patients/p1`.
  - `serial.test`: transaction reads/sets `{ path: "clinics/c1/counters/patients" }`.
  - `inventoryRepo.test`, `orderRepo.test`, `consultationsRepo.test`, `caseRecordRepo.test`: one assertion each that the ref passed is under `clinics/c1/`.
- [ ] **Step 2:** `npm test` → those assertions FAIL.
- [ ] **Step 3:** Apply the mechanical rule to the 8 source files.
- [ ] **Step 4:** `npm test` → all PASS; `grep -rnE 'collection\(db|doc\(db' src --include=*.ts | grep -v test` shows only `src/lib/clinic.ts`, `src/lib/access.ts`, `src/features/access/*`, `src/features/auth/ensureUserDoc.ts`.
- [ ] **Step 5:** Commit `feat(clinic): scope repositories to the active clinic`.

---

### Task 3: Membership lookup and clinics repository

**Files:**
- Modify: `src/lib/access.ts`, `src/features/access/accessRepo.ts`, `src/features/access/useAllowedEmails.ts`
- Create: `src/features/access/clinicsRepo.ts`, `src/features/access/useClinics.ts`
- Test: `src/lib/access.test.ts` (create), `src/features/access/accessRepo.test.ts`, `src/features/access/clinicsRepo.test.ts` (create)

**Interfaces:**
- Produces:
  - `type Membership = { superadmin: boolean; clinicId: string | null }`
  - `getMembership(user: User): Promise<Membership | null>` — replaces `hasAccess`. Superadmin → `{ superadmin: true, clinicId: null }`. Entry with non-empty `clinicId` → `{ superadmin: false, clinicId }`. No email, no entry, entry without `clinicId`, or read error → `null`.
  - `homePath(m: Membership): string` → `"/admin"` for superadmin, else `` `/${clinicId}/patients` ``.
  - `AllowedEmail` gains `clinicId: string` (`""` when missing); `addAllowedEmail(email: string, clinicId: string, addedBy: string)`.
  - `useAddAllowedEmail` mutation variables become `{ email, clinicId, addedBy }`.
  - `interface Clinic { id: string; name: string; createdAt: number }`
  - `listClinics(): Promise<Clinic[]>` (sorted by name), `getClinic(id: string): Promise<Clinic | null>`, `createClinic(id: string, name: string): Promise<void>` — throws `Error("Clinic already exists")` if `clinics/{id}` exists.
  - Hooks: `useClinics()` key `["clinics"]`, `useClinic(id)` key `["clinics", id]`, `useCreateClinic()` invalidating `["clinics"]`.

- [ ] **Step 1: Write failing tests**
  - `access.test`: superadmin → `{superadmin:true, clinicId:null}` without calling `getDoc`; entry `{clinicId:"grace-homoeo"}` → member; entry `{}` → `null`; missing doc → `null`; `getDoc` rejects → `null`; `homePath` both branches.
  - `accessRepo.test`: `addAllowedEmail("A@x.com","c1","admin@x")` writes `{ email:"a@x.com", clinicId:"c1", addedBy:"admin@x", addedAt: <number> }`; list maps missing `clinicId` to `""`.
  - `clinicsRepo.test`: `createClinic("c1","Clinic One")` sets `clinics/c1` `{ name, createdAt }`; when `getDoc` reports exists → rejects `"Clinic already exists"` and `setDoc` not called.
- [ ] **Step 2:** `npm test -- access clinicsRepo` → FAIL.
- [ ] **Step 3:** Implement. Keep `hasAccess(user)` temporarily as `getMembership(user).then(Boolean)` so `AuthGuard`/`LoginPage` still compile; Task 4 deletes it. Update `AccessPage`'s `add.mutate` call to pass `clinicId: ""` until Task 5 adds the clinic picker.
- [ ] **Step 4:** `npm test` → PASS; `npm run build` green.
- [ ] **Step 5:** Commit `feat(access): clinic membership and clinics repository`.

---

### Task 4: Clinic-scoped routing and links

**Files:**
- Create: `src/features/auth/ClinicLayout.tsx`, `src/features/auth/useClinicPath.ts`, `src/features/auth/HomeRedirect.tsx`
- Modify: `src/App.tsx`, `src/features/auth/AuthGuard.tsx`, `src/features/auth/LoginPage.tsx`, `src/components/AppShell.tsx`, `src/lib/access.ts` (delete `hasAccess`), and every file with an app link from the earlier grep: `PatientPreview`, `PatientDetailPage`, `PatientListPage`, `PatientFormPage`, `InventoryFormPage`, `InventoryListPage`, `ConsultationHistory`, `ConsultationFormPage`, `ConsultationDetailPage`, `ExpenseFormPage`, `FundsPage`
- Test: `src/features/auth/ClinicLayout.test.tsx`, `src/features/auth/HomeRedirect.test.tsx` (create); update page tests that mount routes (`PatientDetailPage`, `PatientListPage`, `ConsultationFormPage`, `ConsultationDetailPage`, `ConsultationHistory`, `InventoryListPage`, `FundsPage`) to mount under `/:clinicSlug/...` with entries like `/c1/patients/p1`.

**Interfaces:**
- Consumes: `setActiveClinic` (Task 1); `getMembership`, `homePath`, `Membership` (Task 3); `useClinic` (Task 3).
- Produces:
  - `useMembership(): Membership | undefined` — exported from `AuthGuard.tsx`, reads query `["access", uid]` (now holding `Membership | null`).
  - `useClinicPath(): (path: string) => string` — `` p => `/${clinicSlug}${p}` `` from `useParams()`; throws if no `clinicSlug`.
  - `ClinicLayout` — route element for `/:clinicSlug`.
  - `HomeRedirect` — route element for `/` and `*`.

Behaviour:
- `AuthGuard`: query `["access", uid]` uses `getMembership`; `null` → sign out → `/login`. Wraps children unchanged otherwise.
- `LoginPage`: `getMembership`; `null` → existing "not allowed" toast + sign out; else `setQueryData(["access", uid], m)` and `navigate(homePath(m), { replace: true })`.
- `ClinicLayout`: if not superadmin and `clinicSlug !== membership.clinicId` → `<Navigate to={`/${membership.clinicId}/patients`} replace />`. Otherwise call `setActiveClinic(clinicSlug)` **during render before rendering `<Outlet />`**, and in an effect keyed on `clinicSlug` call `queryClient.removeQueries({ predicate: q => !["access","clinics","allowedEmails"].includes(String(q.queryKey[0])) })` when the slug changes from a previous non-null value. Superadmin with `useClinic(slug)` resolving `null` → "Clinic not found" + link to `/admin`. Renders `<Outlet />` with key `clinicSlug`.
- `HomeRedirect`: superadmin → `/admin`. Member: if the first path segment is one of `patients, inventory, calculator, funds` → `` `/${clinicId}${pathname}${search}` ``; else → `homePath(m)`.
- `App.tsx` routes inside `<AuthGuard><AppShell/></AuthGuard>`: `/admin` → `AccessPage`; `/:clinicSlug` element `ClinicLayout` with the existing child routes made relative (`patients`, `patients/new`, …, `funds/expenses/:id/edit`, `calculator`); `/` and `*` → `HomeRedirect`. Remove `/access` (HomeRedirect sends it to home).
- `AppShell`: NAV `to` values become relative section names; build hrefs with the active `clinicSlug` from `useParams`; hide clinic nav on `/admin`; show `useClinic(slug).data?.name` under the app title; account menu "Manage access" → "Admin" → `/admin`; superadmin's logo link goes to `/admin`.
- Every app link/`navigate` string `"/patients…"`, `"/inventory…"`, `"/funds…"` is wrapped with `cp(...)` where `const cp = useClinicPath()`. `navigate(-1)` and `/login` unchanged.

- [ ] **Step 1: Write failing tests**
  - `ClinicLayout.test`: member of `c1` at `/c2/patients` → renders the `/c1/patients` route, and `setActiveClinic` never called with `"c2"`; member at `/c1/patients` → child rendered and `getActiveClinic()` is `"c1"`; superadmin at `/c2/patients` → child rendered; superadmin switching `/c1/patients` → `/c2/patients` removes a seeded `["patients"]` query from the cache but keeps `["access", uid]`.
  - `HomeRedirect.test`: member `c1` at `/patients/abc?x=1` → `/c1/patients/abc?x=1`; at `/` → `/c1/patients`; at `/nonsense` → `/c1/patients`; superadmin at `/` → `/admin`.
  - Mock `useMembership` via `vi.mock("./AuthGuard", …)` and `useClinic` via `vi.mock("../access/useClinics", …)`.
- [ ] **Step 2:** `npm test -- ClinicLayout HomeRedirect` → FAIL.
- [ ] **Step 3:** Implement the new files, then `App.tsx`, `AuthGuard`, `LoginPage`, `AppShell`, then the link sweep; update the page tests' routes.
- [ ] **Step 4:** `npm test` → all PASS; `npm run lint` clean; `npm run build` green; `grep -rnE '"/(patients|inventory|funds|calculator)|`/(patients|inventory|funds)' src --include=*.tsx | grep -v test` returns only lines wrapped in `cp(` or inside `HomeRedirect`.
- [ ] **Step 5:** Manual check with `npm run dev` against emulators (`VITE_USE_EMULATOR=true`): seed `allowedEmails/x@y.com {clinicId:"c1"}` and `clinics/c1`, log in, confirm URL `/c1/patients`, type `/c2/patients` → back to `/c1/patients`.
- [ ] **Step 6:** Commit `feat(routing): clinic slug routes, membership guard, legacy redirects`.

---

### Task 5: Admin page — clinics and clinic-assigned emails

**Files:**
- Modify: `src/features/access/AccessPage.tsx`
- Test: `src/features/access/AccessPage.test.tsx`

**Interfaces:**
- Consumes: `useClinics`, `useCreateClinic`, `useAddAllowedEmail({email, clinicId, addedBy})` (Task 3); `slugify`, `isValidSlug` (Task 1).

Behaviour: page title "Admin". Non-superadmin → `<Navigate to="/" replace />`. Section **Clinics**: form with Name and Slug (slug auto-fills from `slugify(name)` until edited by hand); submit disabled until `isValidSlug(slug)`; helper text `"Lowercase letters, numbers and hyphens (3–40)"` when invalid; `"Clinic already exists"` error surfaced as toast; list of clinics as `ListCard` (primary name, secondary slug) linking to `/<slug>/patients`. Section **Allowed emails**: existing form plus a required Clinic `TextField select` from `useClinics`; submit error `"Choose a clinic"` when empty; list secondary text shows the clinic name (or `"No clinic"` when `clinicId` is `""`).

- [ ] **Step 1: Write failing tests** in `AccessPage.test.tsx`:
  - typing name `"Sunrise Homoeo"` fills slug `"sunrise-homoeo"`; submitting calls create with `("sunrise-homoeo","Sunrise Homoeo")`.
  - slug `"Bad Slug"` → submit disabled and helper text shown.
  - adding an email without choosing a clinic shows `"Choose a clinic"` and does not call the mutation; with clinic `c1` calls it with `{ email: "a@x.com", clinicId: "c1", addedBy: <superadmin email> }`.
  - an email with `clinicId: ""` lists `"No clinic"`.
- [ ] **Step 2:** `npm test -- AccessPage` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` PASS, `npm run lint` clean.
- [ ] **Step 5:** Commit `feat(admin): manage clinics and assign emails to clinics`.

---

### Task 6: Firestore rules and emulator rules tests

**Files:**
- Modify: `firestore.rules`, `package.json`, `vite.config.ts` (exclude `rules-tests/**` from default `test.exclude`)
- Create: `rules-tests/firestore.rules.test.ts`, `vitest.rules.config.ts`

**Interfaces:**
- Produces: `npm run test:rules` = `firebase emulators:exec --only firestore "vitest run --config vitest.rules.config.ts"`.

Rules: exactly spec §4 — keep `signedIn`, `authEmail`, `verified`, `superadmin`, `allowed`, the `allowedEmails` block; add `myClinic`, `member`, the `clinics` block and the `users` block; **delete** the catch-all.

- [ ] **Step 1:** `npm i -D @firebase/rules-unit-testing`; write tests with `initializeTestEnvironment({ projectId: "demo-grace", firestore: { rules: readFileSync("firestore.rules","utf8") } })`, seeding via `withSecurityRulesDisabled`: `allowedEmails/a@x.com {clinicId:"c1"}`, `allowedEmails/nocl@x.com {}`, `clinics/c1`, `clinics/c2`, `clinics/c1/patients/p1`, `clinics/c2/patients/p2`, `patients/legacy`. Auth tokens `{ email, email_verified: true }`. Assertions:
  - a@x.com: `assertSucceeds` read `clinics/c1/patients/p1`, write `clinics/c1/patients/new`, get `clinics/c1`; `assertFails` read `clinics/c2/patients/p2`, write `clinics/c2/patients/x`, list `clinics`, read `patients/legacy`, update `allowedEmails/a@x.com` to `{clinicId:"c2"}`.
  - nocl@x.com: `assertFails` read `clinics/c1/patients/p1`.
  - unlisted@x.com and an unverified token for a@x.com (`email_verified:false`, provider `google.com`): `assertFails` read `clinics/c1/patients/p1`.
  - smartin.cherian@gmail.com: `assertSucceeds` read `clinics/c2/patients/p2`, list `clinics`, create `clinics/c3`, write `allowedEmails/b@x.com`.
- [ ] **Step 2:** `npm run test:rules` → FAIL on current rules (e.g. `clinics/c2` read by a@x.com succeeds via catch-all).
- [ ] **Step 3:** Rewrite `firestore.rules`.
- [ ] **Step 4:** `npm run test:rules` → PASS; `npm test` still PASS without emulator.
- [ ] **Step 5:** Commit `feat(rules): per-clinic isolation rules with emulator tests`.

---

### Task 7: Migration script, docs and cutover runbook

**Files:**
- Create: `scripts/migrate-to-clinics.mjs`
- Modify: `package.json` (`firebase-admin` devDependency, script `"migrate:clinics": "node scripts/migrate-to-clinics.mjs"`), `CLAUDE.md` (Data model + Routing sections), `docs/superpowers/REBUILD-STATUS.md`

**Interfaces:**
- CLI: `npm run migrate:clinics -- --clinic grace-homoeo --name "Grace Homoeo" [--dry-run] [--project grace-homoeo]`; refuses to run if `--clinic` fails the slug regex.

Behaviour per spec §7: create clinic doc if missing; copy `patients, consultations, generals, lsmc, inventory, orderItems, expenses` preserving IDs in batches of ≤ 500; copy `counters/patients`; set `clinicId` on `allowedEmails` docs lacking one; print a table `collection | source | destination` and exit code 1 if any destination count < source count. `--dry-run` prints source counts and writes nothing. When `FIRESTORE_EMULATOR_HOST` is set, `firebase-admin` targets the emulator automatically.

- [ ] **Step 1:** Write the script.
- [ ] **Step 2: Verify against the emulator:** `npm run emulators`; in another shell seed legacy docs (2 patients, 3 consultations, 1 generals, 1 lsmc, 1 inventory, 1 orderItems, 1 expenses, `counters/patients {lastSerial:2}`, `allowedEmails/a@x.com {}`) via a throwaway snippet in the scratchpad; run with `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm run migrate:clinics -- --clinic grace-homoeo --name "Grace Homoeo" --project demo-grace`. Expected: table shows equal counts, exit 0, `allowedEmails/a@x.com.clinicId == "grace-homoeo"`. Run it a second time → same counts, exit 0.
- [ ] **Step 3:** Update `CLAUDE.md` data model (§3 of spec), routing (`/admin`, `/:clinicSlug/...`), `npm run test:rules`, `npm run migrate:clinics`, and the cutover order; add a "Multi-clinic — built, not cut over" section to `REBUILD-STATUS.md` with the spec §7 runbook and §8 deferred items.
- [ ] **Step 4:** `npm test`, `npm run lint`, `npm run build` all green.
- [ ] **Step 5:** Commit `feat(migration): copy legacy data into clinics/{id} + docs`.

---

## Cutover (user-run, after merge — not a task)

1. `gcloud auth application-default login` (or a service-account key) for the `grace-homoeo` project.
2. `npm run migrate:clinics -- --clinic grace-homoeo --name "Grace Homoeo" --dry-run`, then without `--dry-run`; confirm counts.
3. Immediately `npm run build && firebase deploy --only firestore:rules,hosting`.
4. Sign in as the doctor → lands on `/grace-homoeo/patients` with all data; sign in as superadmin → `/admin`.
5. After a few days of normal use, delete the legacy top-level collections in the Firebase console.
