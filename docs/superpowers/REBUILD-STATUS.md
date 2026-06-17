# Grace Homoeo Rebuild — Status & Next-Session Handoff

_Last updated: 2026-06-17_

## Where things stand

The app is being rebuilt from Create React App → **Vite + React + TypeScript + MUI + Firebase PWA**, on the **`rebuild`** git branch (not merged to `graceh`). The rebuild is split into 4 sequential plans:

1. **Foundation — ✅ COMPLETE** (`docs/superpowers/plans/2026-06-17-grace-homoeo-foundation.md`). 11 tasks, each implemented + reviewed; whole-branch review passed ("with fixes"; fixes applied). HEAD `2213620`. `npm run lint`, `npm test` (12/12, pass with and without `.env.local`), and `npm run build` are all green.
2. **Patients & Consultations — ⬜ NEXT (Plan 2)**
3. **Inventory — ⬜ (Plan 3)**
4. **Funds — ⬜ (Plan 4)**

The authoritative design (data model, scope, decisions) is `docs/superpowers/specs/2026-06-17-grace-homoeo-rebuild-design.md`. Read it before planning a module.

## How to resume in a new session

1. The session auto-loads `CLAUDE.md` (now describes the real Vite/TS/Firebase stack).
2. Read the **design spec** (above) and this file.
3. For Plan 2, skip brainstorming (the spec already covers it) — go straight to **superpowers:writing-plans** to author `docs/superpowers/plans/2026-06-17-grace-homoeo-patients.md` from the spec, then execute with **superpowers:subagent-driven-development** (fresh implementer per task + per-task review + final whole-branch review), the same loop used for the Foundation.

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
