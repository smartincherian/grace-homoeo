# Grace Homoeo — Full Rebuild Design

**Date:** 2026-06-17
**Status:** Approved design, pending spec review

## 1. Purpose & Goals

Rebuild the Grace Homoeo clinic app from scratch. The current Create React App
build is dated, partly mocked (Inventory, Funds), insecure (no working auth,
Firestore rules deny everything), and inconsistent in its code patterns. The
rebuild keeps the *idea and flow* of the current app but addresses all four
driving problems:

1. **Modern look & feel** — a polished, app-like UI.
2. **Complete, working features** — no stubs; full end-to-end clinical, inventory, and finance workflows.
3. **Real security** — proper authentication and locked-down data.
4. **Clean, maintainable codebase** — consistent structure, types, and patterns.

### Non-goals / out of scope
- The **Bible-in-a-Year reading helper** is *not* part of this app. It stays
  running as-is (or is split into its own small project later).
- Multi-user roles are *not built now*, but the data model and security rules
  are designed so they can be added later without a rewrite.

## 2. Constraints & Decisions

| Decision | Choice |
|---|---|
| App type | Installable **PWA** (web app), not native mobile |
| Stack | **Vite + React + TypeScript + MUI v6 + Firebase** |
| Backend | Firebase **Auth** + **Firestore** + **Hosting** — **reuses the existing `grace-homoeo` project; no new Firebase project, account, or infra**. Auth is newly wired up (was dormant); existing Firestore data stays put and can be imported later. |
| Users | **Single doctor** account now; role-extensible later |
| Primary device | **Phone-first**, but desktop is fully first-class (no feature cuts on either) |
| Existing data | New clean model; old data can be imported later but is not required |
| Data fetching | **TanStack Query** |
| Forms & validation | **react-hook-form + zod** |
| Feedback | Single global toast (no `alert()`) |
| Testing | **Vitest + React Testing Library**, TDD; Firebase emulator for data layer |

## 3. Architecture

### Project structure
```
src/
  lib/firebase.ts          # Firebase init from env vars
  lib/queryClient.ts       # TanStack Query setup
  components/              # shared UI (AppShell, Toast, FormField, DataTable, Fab, EmptyState)
  features/
    auth/                  # login screen, auth guard, useAuth
    patients/             # list, detail, add/edit form, repository, hooks, schema
    consultations/        # add/edit form, history timeline, repository, hooks, schema
    inventory/            # list, add/edit, quantity adjust, repository, hooks, schema
    funds/                # summary, income breakdown, expenses CRUD, repository, hooks, schema
  routes/                 # route definitions
  theme/                  # MUI theme
```

Each feature owns its repository (typed Firestore access), TanStack Query hooks,
zod schemas, and UI. Features never import each other's internals — only shared
`components`/`lib`.

### Adaptive layout
- **Mobile:** bottom navigation bar (Patients · Inventory · Funds), top app bar
  with clinic name + profile/logout menu, floating "+" action button per tab.
- **Desktop:** persistent left sidebar nav + wider master-detail layouts and full
  data tables. Same features, two tuned layouts.
- Installable PWA: manifest, icons, splash, full-screen app mode, offline shell.

## 4. Data Model (Firestore)

| Collection | Purpose | Key fields |
|---|---|---|
| `users` | App users (one now) | `uid`, `email`, `displayName`, `role` (`admin`) |
| `patients` | One doc per patient | `serialNo`, `name`, `nameLower`, `dob`, `gender`, `place`, `phone`, `createdAt`, `lastVisitAt` |
| `consultations` | One doc per visit (top-level) | `patientId`, `patientName`, `serialNo`, `date`, `complaint`, `generals`, `allergy`, `history`, `remedy`, `remarks`, `amount`, `paymentMode`, `createdAt` |
| `inventory` | Medicines/stock | `name`, `nameLower`, `quantity`, `unit`, `reorderLevel`, `notes`, `updatedAt` |
| `expenses` | Money out (Funds) | `date`, `category`, `amount`, `note`, `createdAt` |
| `counters/patients` | Atomic serial counter | `lastSerial` |

**Notes**
- **Age is derived from `dob`** so it never goes stale. (Forms accept DOB; UI shows computed age.)
- **`consultations` is top-level** (not nested under patients) so the Funds
  module can total income across all visits by date, while a patient's history
  is a simple `where(patientId == …)` query. `patientName`/`serialNo` are
  denormalized onto each consultation for fast display.
- **Serial numbers are assigned atomically** via a Firestore transaction on
  `counters/patients.lastSerial` — replacing today's full-collection scan for the max.
- **Income** = sum of consultation `amount`; **balance** = income − expenses.
  Payment mode is tracked so `Debt`/`No Fees` are distinguishable from cash received.

## 5. Authentication & Security

- **Firebase Auth** email/password, single doctor account. App wrapped in an
  auth guard: unauthenticated users see only the login screen.
- A `users/{uid}` doc carries a `role` field (`admin` today). UI and rules read
  this role so staff/permissions can be added later as configuration.
- **Firestore rules** replace the current deny-all with authenticated access,
  written to be role-aware, e.g.:
  ```
  function signedIn() { return request.auth != null; }
  function role() { return get(/databases/$(db)/documents/users/$(request.auth.uid)).data.role; }
  // now: any signed-in user (the doctor) may read/write all clinic data
  // later: tighten per-collection by role()
  ```
- **Firebase config moves to environment variables** (`.env`, git-ignored); no
  hardcoded keys in source.

## 6. Module Features

### Patients & Consultations (core)
- **Patient list:** searchable by name/phone; shows name, serial #, age, place,
  last-visit date. Tap/click → patient detail.
- **Patient detail:** profile card + **consultation history timeline** (newest
  first) — new capability; today there is no history view. "+" adds a consultation
  for that patient.
- **Add/Edit patient:** DOB, name, gender, place, phone; serial # assigned on save.
- **Add/Edit consultation:** complaint, generals, allergy, history, remedy,
  remarks, date, amount, payment mode (Cash/UPI/No Fees/Debt); patient pre-filled
  when opened from a patient.

### Inventory (real, persisted)
- Item list with **low-stock highlighting** (`quantity <= reorderLevel`), search,
  add/edit/delete, and quick +/− quantity adjust.

### Funds / Finance (new)
- **Period summary** (this month / custom range): total income, total expenses, balance.
- **Income breakdown by payment mode** so Debt/No-Fees are visible separately.
- **Expenses CRUD** (date, category, amount, note).

## 7. Error Handling & States

- Every data view has explicit **loading**, **empty**, and **error** states
  (via TanStack Query status), rendered through shared components.
- All mutations surface success/failure through the global toast.
- Form validation via zod schemas with inline field errors.

## 8. Testing Strategy

- **Vitest + React Testing Library**, test-first (TDD).
- Priority coverage:
  - atomic serial-counter transaction (against Firebase emulator),
  - finance aggregation (income/expense/balance, breakdown by payment mode),
  - zod validation schemas,
  - repository read/write functions (emulator).
- Component tests for key flows (login guard, patient add, consultation add,
  inventory low-stock highlight).

## 9. Implementation Roadmap

1. **Scaffold** — Vite + React + TS, MUI theme, routing, ESLint/Prettier,
   env-based Firebase config, PWA manifest, Vitest + emulator setup.
2. **Auth** — login screen, auth guard, `users` doc, role-aware Firestore rules.
3. **Data layer** — typed repositories, TanStack Query hooks, zod schemas,
   atomic serial counter, emulator-backed tests.
4. **App shell** — adaptive nav (bottom bar / sidebar), top bar, global toast,
   FAB pattern, shared loading/empty/error components.
5. **Patients & Consultations** — list → detail/history → add/edit forms.
6. **Inventory** — list, low-stock, CRUD, quantity adjust.
7. **Funds** — summary, income breakdown, expenses CRUD.
8. **Polish** — PWA install/offline shell, responsive desktop pass, states audit.
9. **Deploy** — Firebase Hosting on `grace-homoeo`; optional one-time old-data import.

## 10. Future Growth (designed-for, not built now)
- Add staff users and per-collection role restrictions via the existing
  `users.role` field and role-aware rules.
- New modules drop into `src/features/` without touching existing ones.
- Consultations can later gain attachments/images; data model leaves room.
