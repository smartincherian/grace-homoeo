# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Grace Homoeo" — an installable PWA for a single-doctor homoeopathy clinic, built with **Vite + React + TypeScript + MUI + Firebase**. It is a ground-up rebuild of an earlier Create React App version. Hosted on Firebase Hosting; data lives in Cloud Firestore on the **`grace-homoeo`** Firebase project (reused, no new project).

**Status:** The **Foundation is complete** on the `rebuild` branch — auth, adaptive app shell, providers, and the data-layer core. The three feature modules — **Patients & Consultations, Inventory, Funds** — are designed but not yet built; their routes currently render placeholder pages. See `docs/superpowers/specs/` (design) and `docs/superpowers/plans/` (the Foundation plan; Plans 2–4 to follow). The old Bible-in-a-Year helper is intentionally out of scope.

## Commands

```bash
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # tsc -b && vite build -> ./dist
npm run preview      # serve the production build locally
npm test             # vitest run (one-shot)
npm run test:watch   # vitest watch mode
npm test -- serial   # run a single test file by name fragment
npm run lint         # eslint . --ext ts,tsx
npm run format       # prettier --write .
npm run emulators    # firebase emulators:start --only firestore,auth
npm run release      # build + firebase deploy --only hosting
npm run test:rules   # Firestore rules tests (needs the Firestore emulator)
npm run migrate:clinics -- --clinic grace-homoeo --name "Grace Homoeo" [--dry-run] [--project ...]  # copy legacy data into clinics/{id}
```

## Architecture

- **Entry & providers** — `src/main.tsx` renders the provider stack in order: `QueryClientProvider` → `ThemeProvider` + `CssBaseline` → `ToastProvider` → `BrowserRouter` → `App`. Toast sits above the router so route components can call `useToast`.
- **Routing** — `src/App.tsx` (react-router v6): `/login` is public; `/admin` is the superadmin page (clinics + allowed emails); clinic pages live under `/:clinicSlug/patients|inventory|calculator|funds…`, behind `<AuthGuard>` inside `<AppShell>`. Legacy `/patients/…` paths redirect to the member's own clinic; `/` and unknown paths go to `/<own clinic>/patients` (superadmin: `/admin`). The URL is navigation only; Firestore rules enforce clinic isolation. Hosting rewrites all paths to `/index.html` (`firebase.json`).
- **Feature-folder structure** — code is organized by feature under `src/features/` (`auth/` is built; `patients/`, `consultations/`, `inventory/`, `funds/` are planned). Shared building blocks live in `src/components/`, `src/lib/`, and `src/theme/`. Features must not import each other's internals — only shared modules.
- **Firebase layer** — `src/lib/firebase.ts` initializes Firebase from `import.meta.env.VITE_FIREBASE_*` and exports `auth` and `db`. It connects to local emulators when `VITE_USE_EMULATOR=true`. Feature data access goes through typed per-collection repositories + TanStack Query hooks + zod schemas (the established pattern); UI never calls the Firestore SDK directly.
- **Auth** — single doctor, Firebase Auth email/password. `useAuth()` exposes `{ user, loading }`; `AuthGuard` shows a spinner while resolving, then renders children or redirects to `/login`. `ensureUserDoc` creates `users/{uid}` with `role: "admin"` on first login.
- **UI stack** — MUI v6 styled via the `sx` prop; theme in `src/theme/theme.ts` (primary `#150E56`). `AppShell` is adaptive: a bottom navigation bar on mobile, a permanent left sidebar on desktop — same features on both. Global feedback goes through `ToastProvider` / `useToast` (in `src/components/useToast.ts`) — never `alert()`. `QueryStates` (`src/components/QueryStates.tsx`) renders loading/empty/error/`children` for every list view.
- **PWA** — `vite-plugin-pwa` (config in `vite.config.ts`) emits the manifest + service worker; icons in `public/`. The app is installable to a phone home screen.

## Data model (Firestore)

**Multi-clinic:** all clinic data lives under `clinics/{clinicId}/…` (`patients, consultations, generals, lsmc, inventory, orderItems, expenses, counters/patients`); `clinics/{clinicId}` holds `{ name, createdAt }` and the slug is the doc ID. `allowedEmails/{email}` carries `clinicId` (one clinic per email); `users/{uid}` stays top-level. Collection descriptions below are per clinic. See `docs/superpowers/specs/2026-10-19-multi-clinic-design.md`. Cutover order: `npm run migrate:clinics` (dry run, then real) -> verify counts -> `firebase deploy --only firestore:rules,hosting` immediately -> delete legacy top-level collections later.

Target collections (see the design spec for full field lists):

- `users` — `{ uid, email, displayName, role }` (`role: "admin"` today).
- `patients` — `serialNo`, `name`, `nameLower`, `dob`, `gender`, `place`, `phone`, `createdAt`, `lastVisitAt`.
- `consultations` — **top-level** (not nested), with `patientId` + denormalized `patientName`/`serialNo` so Funds can total income across all visits while a patient's history stays a simple query.
- `inventory` — `name`, `nameLower`, `quantity`, `unit`, `reorderLevel`, `notes`, `updatedAt`.
- `expenses` — `date`, `category`, `amount`, `note` (income comes from consultation `amount`; balance = income − expenses).
- `counters/patients` — `lastSerial`; patient serial numbers are assigned atomically via `nextPatientSerial()` in `src/lib/serial.ts` (a Firestore transaction), not by scanning all patients.

## Conventions & gotchas

- **Firebase config is env-only.** Real values live in `.env.local` (git-ignored); never hardcode keys in source. `.env.example` documents the variable names.
- **Tests must pass in a clean checkout.** A committed `.env.test` holds dummy Firebase values so Vitest (which runs in `test` mode) initializes the SDK without the developer's `.env.local`. Without it, `getAuth()` throws `auth/invalid-api-key`. Don't delete `.env.test`.
- **Testing** — Vitest + React Testing Library, TDD. Unit tests **mock** `firebase/firestore` (e.g. `serial.test.ts`, `ensureUserDoc.test.ts`), so `npm test` needs no emulator; the emulator config exists for manual/integration use.
- **Storage formats** — dates as **epoch milliseconds** (number); money as **rupee numbers** (displayed with `₹`).
- **Firestore rules** (`firestore.rules`) gate all access on `request.auth != null` (signed-in doctor) and are structured to be role-aware for future tightening. Be careful before deploying rules.
- **Rules tests / emulator.** `npm run test:rules` needs the Firestore emulator, and the firebase CLI (15.x) needs JDK 21+. On Java 17 use `npx -y firebase-tools@13.35.1 emulators:start --only firestore --project demo-grace` (or `emulators:exec`) instead.
- **Hosting** — `firebase.json` serves `./dist` with an SPA rewrite to `/index.html`, on the `grace-homoeo` project.
