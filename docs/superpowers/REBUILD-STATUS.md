# Grace Homoeo Rebuild — Status & Next-Session Handoff

_Last updated: 2026-06-19 (UI Polish pass — "Stained Glass" theme — COMPLETE)_

## Where things stand

The app is being rebuilt from Create React App → **Vite + React + TypeScript + MUI + Firebase PWA**, on the **`rebuild`** git branch (not merged to `graceh`). The rebuild is split into 4 sequential plans:

1. **Foundation — ✅ COMPLETE** (`docs/superpowers/plans/2026-06-17-grace-homoeo-foundation.md`). 11 tasks, each implemented + reviewed; whole-branch review passed ("with fixes"; fixes applied).
2. **Patients & Consultations — ✅ COMPLETE** (`docs/superpowers/plans/2026-06-17-grace-homoeo-patients.md`). 10 tasks, each implemented + per-task reviewed; whole-branch review (opus) passed "Ready to merge — Yes", no Critical/Important. HEAD `66da6ca`. `npm run lint` clean, `npm test` (42/42), and `npm run build` (PWA generated) all green. Delivers: searchable patient list, patient detail + consultation-history timeline, add/edit patient & consultation forms, top-level `consultations` with atomic `lastVisitAt` batch, and the AppShell account/logout menu + FAB pattern.
3. **Inventory — ✅ COMPLETE (Plan 3)** (`docs/superpowers/plans/2026-06-18-grace-homoeo-inventory.md`). All 5 tasks done. HEAD `cd703eb`. `npm run lint` clean, `npm test` (60/60), `npm run build` (PWA generated) all green. Delivers: searchable inventory list with low-stock highlighting + quick ± quantity adjust, add/edit/delete form page, live `/inventory` + `/inventory/new` + `/inventory/:id/edit` routes; placeholder removed. **Note:** per a user directive partway through, Tasks 3–5 (the two UI pages + routing) were built without component tests — schema/repo/hooks (Tasks 1–2) retain their unit tests. The UI pages have no test coverage; backfill if that policy changes.
4. **Funds — ✅ COMPLETE (Plan 4)** — no separate plan file; built directly from the design spec §6 "Funds / Finance". HEAD `2bae321`. `npm run lint` clean, `npm test` (60/60), `npm run build` (PWA generated) all green. Delivers: `expenses` collection CRUD (date/category/amount/note); a date-range period summary (total income, total expenses, balance) with income broken down by payment mode (Debt/No Fees visible separately); live `/funds`, `/funds/expenses/new`, `/funds/expenses/:id/edit` routes; placeholder removed. **Design notes:** (a) income = sum of consultation `amount` and balance = income − expenses, exactly per spec §4 — Debt/No-Fees consultations count toward income and are surfaced via the breakdown rather than excluded; (b) to respect feature boundaries, Funds reads the `consultations` collection through its **own** `fundsRepo.listIncome` (read-only) instead of importing the consultations feature; (c) built without tests and without the SDD loop / whole-branch review, per the same conserve-tokens user directive as Plan 3. No Firestore rules change needed — the catch-all `match /{document=**}` already covers `expenses`.

The authoritative design (data model, scope, decisions) is `docs/superpowers/specs/2026-06-17-grace-homoeo-rebuild-design.md`. Read it before planning a module.

## UI Polish — "Stained Glass" theme — ✅ COMPLETE (2026-06-19)

A cross-cutting visual + UX polish pass on top of the four feature plans. Spec: `docs/superpowers/specs/2026-06-19-ui-polish-stained-glass-design.md`; plan: `docs/superpowers/plans/2026-06-19-ui-polish-stained-glass.md`. HEAD `6bc90a5`. `npm run lint` clean (2 benign react-refresh warnings in `PageChrome.tsx`), `npm test` 72/72, `npm run build` green.

**Direction:** user chose Theme B "Stained Glass" from three mandala/zentangle mockups built via the brainstorming visual companion (mockups persist in `.superpowers/brainstorm/`, git-ignored). Subtle Christian rose-window motif; crisp white, jewel-tone gradient app bar, jewel accent edges on cards.

**Delivered (all 14 plan tasks):**
- **Theme** (`src/theme/theme.ts`): jewel palette + `JEWEL_ACCENTS`/`accentFor()`, soft shadow, gradient `MuiAppBar`, Inter font (linked in `index.html`).
- **New shared components** (`src/components/`): `Mandala` (decorative SVG), `ListCard` (avatar/edge/trailing/menu row), `RowMenu` (⋮ overflow Edit/Delete), `ConfirmDialog`, `PageChrome` (`PageChromeProvider`/`usePageTitle`/`useSetPageTitle` — contextual app-bar title), plus an upgraded `QueryStates` empty state (mandala) and `AddButton` (labeled extended FAB). **`PageHeader` was created then removed** — the app-bar title made an in-body page heading redundant (and caused a duplicate-heading smoke-test failure), so list screens have no in-body title.
- **AppShell**: contextual title + **back button on non-root routes** (`navigate(-1)`), themed sidebar/nav, app-bar mandala watermark.
- **Screens**: themed login; Patients/Inventory/Funds lists use `ListCard` + labeled add buttons; patient detail + `ConsultationTimeline` restyled; all four form pages card-wrapped with contextual titles.
- **CRUD made visible**: inventory items and expenses now have ⋮ → **Delete** behind `ConfirmDialog` (wires the previously-unused `useDeleteItem` / `useDeleteExpense` hooks). **Patients & consultations remain edit-only** (no delete) — per user decision, to protect clinical history. (Note: inventory/expense *form* pages also still have their original `window.confirm` Delete button.)

**Testing note (departure from Plans 3–4):** this pass *did* add component tests (`Mandala`, `AddButton`, `RowMenu`, `ConfirmDialog`, `PageChrome`, `InventoryListPage`, `FundsPage`, plus AppShell back-button tests) — TDD per the plan. Executed **inline** (not the SDD subagent loop) since the user said "implement" without requesting subagents.

### Plan 2 follow-ups deferred to a future cleanup (whole-branch review Minors — none blocking)

- Denormalized consultation `patientName`/`serialNo` are **point-in-time snapshots**, not live mirrors — they do not update when a patient is renamed. Acceptable for a single-doctor clinic; `patients` is the source of truth for names. Worth a one-line note where the data model is documented.
- `PatientDetailPage` shows "Loading patient…" for both in-flight and not-found ids (no distinct "not found").
- Test gaps to backfill: `getConsultation`/`updateConsultation` repo fns, consultation mutation-invalidation hooks, consultation edit-mode page, and the AppShell logout `navigate('/login')` assertion.
- Cosmetic: literal 📞 emoji vs a MUI `PhoneIcon`; `ConsultationTimeline` has no defensive sort (relies on the repo's client-side date-desc sort).

## Plan 3 (Inventory) — COMPLETE

**State:** branch `rebuild`, HEAD `cd703eb`, working tree clean, `npm test` 60/60, lint clean, build green. All 5 tasks delivered:
- **Task 1 — schema + repository** (`src/features/inventory/inventorySchema.ts`, `inventoryRepo.ts` + tests). Commits `79630b9` + `3ef7e0b`.
- **Task 2 — query hooks** (`src/features/inventory/useInventory.ts` + test). Commit `afff735`.
- **Tasks 3–5 — list page, form page, routes** (`InventoryListPage.tsx`, `InventoryFormPage.tsx`, `src/App.tsx`; `src/routes/InventoryPlaceholder.tsx` deleted). Commit `cd703eb`. Built without component tests per a mid-session user directive (see item 3 above) and without the subagent-driven-development loop / whole-branch review (user asked to conserve tokens).

## How to resume in a new session

1. The session auto-loads `CLAUDE.md` (describes the real Vite/TS/Firebase stack).
2. Read the **design spec** (above) and this file.
3. For Plan 3 (Inventory), skip brainstorming (the spec already covers it) — go straight to **superpowers:writing-plans** to author `docs/superpowers/plans/<date>-grace-homoeo-inventory.md` from the spec, then execute with **superpowers:subagent-driven-development** (fresh implementer per task + per-task review + final whole-branch review), the same loop used for Foundation and Plan 2. Build on the Plan 2 patterns: per-feature zod schema + typed repo + TanStack Query hooks + `QueryStates` list views + `useToast` mutations + FAB add action.

## Foundation interfaces Plan 2 builds on (verify before use)

- `src/lib/firebase.ts` → exports `auth`, `db`.
- `src/features/auth/useAuth.ts` → `useAuth(): { user, loading }`; `AuthGuard` already gates routes.
- `src/components/useToast.ts` → `useToast(): { showToast(message, severity?) }` (no `alert()`).
- `src/components/QueryStates.tsx` → `<QueryStates status isEmpty emptyMessage>` (props: `status: "pending"|"error"|"success"`, `isEmpty`, `emptyMessage`, `children`). Use for every list view.
- `src/lib/serial.ts` → `nextPatientSerial(): Promise<number>` (atomic). Use when creating a patient.
- `src/theme/theme.ts` → `theme`; `src/components/AppShell.tsx` → adaptive shell with routes `/patients`, `/inventory`, `/funds` (currently placeholder pages in `src/routes/`).
- Stack conventions: TanStack Query for fetching; react-hook-form + zod for forms; relative imports (no `@/`); dates as epoch ms; money as rupee numbers; no `any`; tests mock `firebase/firestore` (no emulator needed); `.env.test` (committed, dummy) keeps tests green in clean checkouts — don't delete it.

## Plan 2 scope (from the spec — confirm/refine when planning)

- **Patient list** — searchable by name/phone; columns name, serial #, age (from `dob`), place, last-visit; tap → patient detail.
- **Patient detail** — profile + **consultation history timeline** (newest first) + a "+" to add a consultation.
- **Add/Edit patient** — `dob`, name, gender, place, phone; serial # via `nextPatientSerial()` on create; write `nameLower` for search.
- **Add/Edit consultation** — complaint, generals, allergy, history, remedy, remarks, date, amount, paymentMode (Cash/UPI/No Fees/Debt); top-level `consultations` doc with `patientId` + denormalized `patientName`/`serialNo`; update patient `lastVisitAt`.
- Repositories + TanStack Query hooks + zod schemas under `src/features/patients/` and `src/features/consultations/`.

## Carried-over items to fold into Plan 2 (shell build-out)

- **Logout / profile menu** in the `AppShell` top bar (spec §3) — wire `signOut`. Not built in the Foundation.
- **FAB ("+") pattern** for the primary add action per tab (roadmap step 4).
- (Optional) the `AppShell` `children` prop is test-only; can be removed when the shell is fleshed out.

## Operational notes

- No doctor login account exists yet — create one in the Firebase console (Authentication → Email/Password) to actually sign in.
- A per-task progress ledger from the Foundation lives at `.git/sdd/progress.md` (git metadata, not committed).
