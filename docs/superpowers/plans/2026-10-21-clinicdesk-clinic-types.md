# ClinicDesk rename + clinic types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename "Homoeo Desk" to "ClinicDesk" and add a per-clinic type (`homoeo` | `general`) that hides homoeo-only UI for general clinics.

**Architecture:** `src/lib/clinicType.ts` owns the type list, parsing (missing = homoeo) and a `clinicFeatures(type)` flag object; `useClinicFeatures()` reads the current clinic via `useClinic(clinicSlug)`. Components read flags; data and stored fields are untouched. Rules accept `type` on create/update.

**Tech Stack:** Vite + React + TS + MUI v6 + TanStack Query + zod + Firestore rules; Vitest + RTL; rules tests on the emulator.

**Spec:** `docs/superpowers/specs/2026-10-21-clinicdesk-clinic-types-design.md`

## Global Constraints

- Types: `"homoeo"` (label "Homoeopathy"), `"general"` (label "General practice"). Missing/unknown → `"homoeo"`.
- Product name copy: exactly `ClinicDesk` (one word, capital C and D).
- Hidden UI must not drop form values: hidden LSMC rows / Generals / differential remedy are still submitted as loaded.
- No stored field is renamed; `RESERVED_SLUGS` and `reservedSlugs()` unchanged.
- Features must not import each other's internals; `clinicType.ts` lives in `src/lib/`.

## Review Focus

- Editing an existing visit in a `general` clinic that has LSMC rows → rows survive the save (Task 3 test).
- Clinic doc with `type: "dental"` or a non-string → treated as homoeo, no crash (Task 1 test).
- An order item stored in a homoeo-only category inside a general clinic → still listed (Task 4 test).
- Self-signup without `type`, or with `type: "x"` → rules deny (Task 2 rules test).
- Clinic still loading (`useClinic` data undefined) → homoeo flags, no flicker-crash (Task 1 hook test).

---

### Task 1: Clinic type model

**Files:**
- Create: `src/lib/clinicType.ts`, `src/lib/clinicType.test.ts`
- Modify: `src/lib/clinicQueries.ts` (`Clinic.type`, `getClinic` sets it), `src/features/access/clinicsRepo.ts` (`listClinics` sets it)

**Interfaces:**
- Produces:
  - `type ClinicType = "homoeo" | "general"`
  - `CLINIC_TYPES: readonly { value: ClinicType; label: string }[]` (homoeo first)
  - `parseClinicType(v: unknown): ClinicType`
  - `interface ClinicFeatures { lsmc: boolean; differentialRemedy: boolean; homoeoGenerals: boolean; generalsTitle: "Generals" | "Case history"; type: ClinicType }`
  - `clinicFeatures(type: ClinicType): ClinicFeatures`
  - `useClinicFeatures(): ClinicFeatures` — `useParams().clinicSlug` → `useClinic` → `clinicFeatures(parseClinicType(data?.type))`
  - `Clinic.type: ClinicType` (always set by `getClinic` / `listClinics`)

- [ ] **Step 1: Write failing tests** — `parseClinicType(undefined|"dental"|3)` → `"homoeo"`, `parseClinicType("general")` → `"general"`; `clinicFeatures("homoeo")` all flags true, title "Generals"; `clinicFeatures("general")` all false, title "Case history"; `useClinicFeatures` with mocked `useClinic` returning `{data: undefined}` → homoeo flags; `getClinic` with `type: "general"` → `type: "general"`, without → `"homoeo"` (extend `clinicQueries.test.ts`).
- [ ] **Step 2: Run** `npm test -- clinicType clinicQueries` — FAIL.
- [ ] **Step 3: Implement** the interfaces above.
- [ ] **Step 4: Run** `npm test -- clinicType clinicQueries clinicsRepo` — PASS.
- [ ] **Step 5: Commit** `feat(clinic): clinic type model and feature flags`

### Task 2: Type at signup, on admin create, and change on /admin (+ rules)

**Files:**
- Modify: `src/features/signup/signupRepo.ts`, `src/features/signup/SetupPage.tsx`, `src/features/access/clinicsRepo.ts`, `src/features/access/clinicAdminRepo.ts`, `src/features/access/AccessPage.tsx`, `firestore.rules`, rules tests under `tests/` (find with `grep -rl selfSignup tests`), matching unit tests.

**Interfaces:**
- Consumes: `ClinicType`, `CLINIC_TYPES`, `Clinic.type` (Task 1).
- Produces:
  - `createOwnClinic(slug, name, email, type: ClinicType, now?)` — writes `type`.
  - `createClinic(id, name, ownerEmail, addedBy, authorized?, now?, type: ClinicType = "homoeo")` — writes `type`.
  - `setClinicType(id: string, type: ClinicType): Promise<void>` in `clinicAdminRepo.ts` — `updateDoc` of `type` only.

- [ ] **Step 1: Failing unit tests** — both create functions put `type` in the clinic doc; `setClinicType("c1","general")` calls `updateDoc` with `{ type: "general" }`; SetupPage shows a "Clinic type" select defaulting to Homoeopathy and passes the chosen type; AccessPage create dialog has the same select; row menu "Change type" opens a dialog with the select and calls `setClinicType`.
- [ ] **Step 2: Failing rules tests** — self-signup with `type: "general"` allowed; missing `type` denied; `type: "x"` denied; superadmin update `{type: "general"}` allowed, `{type: 5}` denied; superadmin update without `type` still allowed (existing clinics).
- [ ] **Step 3: Run** `npm test -- signup clinicsRepo clinicAdminRepo AccessPage` and `npm run test:rules` — FAIL.
- [ ] **Step 4: Implement.** Rules: self-signup key lists (`hasOnly`/`hasAll`) add `'type'` and `request.resource.data.type in ['homoeo', 'general']`; superadmin create/update adds `(!('type' in request.resource.data) || request.resource.data.type in ['homoeo', 'general'])`. Show a type chip next to status chips on `/admin` (label from `CLINIC_TYPES`).
- [ ] **Step 5: Run** same commands — PASS.
- [ ] **Step 6: Commit** `feat(clinic): choose clinic type at signup and on admin`

### Task 3: Hide homoeo-only consultation UI

**Files:**
- Modify: `src/features/consultations/generalsFields.ts`, `GeneralsFormSection.tsx`, `GeneralsView.tsx`, `GeneralsLatest.tsx`, `GeneralsHistoryTable.tsx`, `ConsultationFormPage.tsx`, `ConsultationFields.tsx`, `ConsultationHistory.tsx`, `src/features/patients/PatientDetailPage.tsx`, `src/features/patients/GeneralsHistoryPage.tsx`; their tests.

**Interfaces:**
- Consumes: `useClinicFeatures()` (Task 1).
- Produces: `generalsGroupsFor(homoeo: boolean): GeneralsGroup[]` in `generalsFields.ts`. Field entries gain optional `homoeo?: true` (mentals) and `generalLabel?: string` (sleepDreams → "Sleep"); groups gain `homoeo?: true` (Perspiration). `GENERALS_GROUPS` stays exported (= `generalsGroupsFor(true)`).

- [ ] **Step 1: Failing tests**
  - `generalsGroupsFor(false)` has no Perspiration group, no `mentals`, sleepDreams label "Sleep"; `generalsGroupsFor(true)` deep-equals today's groups.
  - ConsultationFormPage in a general clinic (mock `useClinicFeatures`): no "Differential remedy" field, no LSMC editor or "last LSMC", heading "Case history".
  - **Data-safety:** edit an existing visit in a general clinic with 2 LSMC rows and `mentals: "anxious"`; submit; the update call receives both LSMC rows (ids kept) and `mentals: "anxious"` and the loaded `differentialRemedy`.
  - ConsultationFields / ConsultationHistory in a general clinic: no LSMC table/summary, no differential remedy.
  - Homoeo clinic: existing tests stay green unchanged.
- [ ] **Step 2: Run** `npm test -- consultations patients` — FAIL.
- [ ] **Step 3: Implement.** Components call `useClinicFeatures()` and swap `GENERALS_GROUPS` for `generalsGroupsFor(f.homoeoGenerals)`; filter `differentialRemedy` out of the field lists when `!f.differentialRemedy`; render LSMC parts only when `f.lsmc`; headings/titles use `f.generalsTitle` (history page: `` `${f.generalsTitle} history` ``). Keep loading LSMC/visit data into form state regardless of flags.
- [ ] **Step 4: Run** `npm test` — PASS.
- [ ] **Step 5: Commit** `feat(consultations): hide homoeo-only case taking for general clinics`

### Task 4: Order categories per type

**Files:**
- Modify: `src/features/inventory/orderSchema.ts`, `OrderListSection.tsx`, `orderSchema.test.ts`, `OrderListSection.test.tsx`

**Interfaces:**
- Consumes: `ClinicType`, `useClinicFeatures().type` (Task 1).
- Produces: each `ORDER_CATEGORIES` entry gains `types: readonly ClinicType[]`; `categoriesFor(type: ClinicType)` returns them in order.

- [ ] **Step 1: Failing tests** — `categoriesFor("homoeo")` keys = today's 8 in order; `categoriesFor("general")` keys = `generalMedicine, syrups, injections, syringes, dressings, gloves`; `generalMedicine` variant `{label:"Strength", options:["250 mg","500 mg","650 mg"]}`, `syringes` variant `{label:"Size", options:["2 ml","5 ml","10 ml"]}`, `injections` `needsName: true`, `dressings`/`gloves` `needsName: false`; `orderFormSchema` still parses a `biochemic` item. OrderListSection in a general clinic: category picker offers only the general list; an existing `biochemic` item is still listed under "Biochemic remedies".
- [ ] **Step 2: Run** `npm test -- order` — FAIL.
- [ ] **Step 3: Implement.** Add the new categories (labels: "Medicines", "Injections", "Syringes", "Dressings", "Gloves"), `types` on all; `OrderListSection` uses `categoriesFor` for the picker and, for the grouped list, the clinic's categories plus any other category that has items.
- [ ] **Step 4: Run** `npm test -- order` — PASS.
- [ ] **Step 5: Commit** `feat(inventory): order categories per clinic type`

### Task 5: Rename to ClinicDesk

**Files:**
- Modify: `index.html`, `vite.config.ts`, `src/features/auth/LoginPage.tsx`, `src/features/auth/VerifyEmailPage.tsx`, `src/features/signup/SetupPage.tsx`, `src/components/AppShell.tsx`, `src/components/BrandScope.tsx`, `src/components/ProductMark.tsx` (comment), `src/lib/branding.ts`, `src/lib/subscription.ts`, `scripts/make-icons.mjs` (comment), `firebase.json` (third site `clinicdesk`, same config), `CLAUDE.md`, tests asserting the old name.

- [ ] **Step 1: Update tests** that assert "Homoeo Desk" (`grep -rl "Homoeo Desk" src`) to "ClinicDesk" — run, FAIL.
- [ ] **Step 2: Replace** every user-visible "Homoeo Desk" with "ClinicDesk"; `grep -rn "Homoeo Desk\|HomoeoDesk" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=docs .` returns nothing. Any "homoeopathy clinics" marketing copy becomes "clinics".
- [ ] **Step 3: CLAUDE.md** — product name, `type` field on `clinics/{id}`, `clinicType.ts`, third hosting site, release note (rules + hosting together; `clinicdesk` site must exist first).
- [ ] **Step 4: Verify** `npm test && npm run lint && npm run build` — all pass.
- [ ] **Step 5: Commit** `feat: rename product to ClinicDesk`

### Release (user-run, not part of execution)

1. `firebase hosting:sites:create clinicdesk --project grace-homoeo`; add `clinicdesk.web.app` to Auth → Authorized domains.
2. `npm run release` (rules + hosting together).
