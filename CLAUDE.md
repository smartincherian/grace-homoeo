# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"HomoeoDesk" (originally "Grace Homoeo") — an installable multi-clinic PWA for homoeopathy clinics, built with **Vite + React + TypeScript + MUI + Firebase**. Hosted on Firebase Hosting; data lives in Cloud Firestore on the **`grace-homoeo`** Firebase project.

**Status:** Auth, the adaptive app shell, multi-clinic tenancy (superadmin, owners, seats), and the Patients & Consultations, Inventory, Funds and Calculator modules are built. Each clinic can set its own name, logo, colour, scripture banner and contact details (owner Settings page). See `docs/superpowers/specs/` and `docs/superpowers/plans/`. The old Bible-in-a-Year helper is intentionally out of scope.

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
npm run icons        # regenerate PWA/brand icons (scripts/make-icons.mjs)
npm run release      # build + firebase deploy --only firestore:rules,hosting
npm run test:rules   # Firestore rules tests (needs the Firestore emulator)
npm run migrate:clinics -- --clinic grace-homoeo --name "Grace Homoeo" [--dry-run] [--resync] --project grace-homoeo  # copy legacy data into clinics/{id}
npm run backfill:seats -- --clinic grace-homoeo --owner <email> [--dry-run] --project grace-homoeo  # one-off: set clinic owner + seats (1=owner)
```

## Architecture

- **Entry & providers** — `src/main.tsx` renders the provider stack in order: `QueryClientProvider` → `ThemeProvider` + `CssBaseline` → `ToastProvider` → `BrowserRouter` → `App`. Toast sits above the router so route components can call `useToast`.
- **Routing** — `src/App.tsx` (react-router v6): `/login` is public; `/verify-email` is the verified-email gate; `/admin` is the superadmin page (clinics, owners, seats); clinic pages live under `/:clinicSlug/patients|inventory|calculator|funds…` plus owner-only `/:clinicSlug/people` (add/remove the clinic's users) and `/:clinicSlug/settings` (branding and contact details), behind `<AuthGuard>` inside `<AppShell>`. Legacy `/patients/…` paths redirect to the member's own clinic; `/` and unknown paths go to `/<own clinic>/patients` (superadmin: `/admin`). The URL is navigation only; Firestore rules enforce clinic isolation. Hosting rewrites all paths to `/index.html` (`firebase.json`).
- **Feature-folder structure** — code is organized by feature under `src/features/` (all built: `auth/`, `access/`, `patients/`, `consultations/`, `inventory/`, `funds/`, `people/`, `settings/`, `rateCalculator/`). Shared building blocks live in `src/components/`, `src/lib/`, and `src/theme/`. Features must not import each other's internals — only shared modules.
- **Firebase layer** — `src/lib/firebase.ts` initializes Firebase from `import.meta.env.VITE_FIREBASE_*` and exports `auth` and `db`. It connects to local emulators when `VITE_USE_EMULATOR=true`. Feature data access goes through typed per-collection repositories + TanStack Query hooks + zod schemas (the established pattern); UI never calls the Firestore SDK directly.
- **Auth** — Firebase Auth via Google or email/password; a verified email is required (unverified password users are sent to `/verify-email`). Access comes from the allow list + seats; roles are superadmin/owner/member. `useAuth()` exposes `{ user, loading }`; `AuthGuard` shows a spinner while resolving, then renders children or redirects to `/login`. `ensureUserDoc` creates `users/{uid}` (`uid, email, displayName, role`) on first login, with `role: "superadmin"` for the superadmin email, else `"admin"`; `users.role` is self-written and never grants permission.
- **UI stack** — MUI v6 styled via the `sx` prop; theme in `src/theme/theme.ts`, built per clinic from the brand colour (default `#2f6bff`, see Theming). `AppShell` is adaptive: a bottom navigation bar on mobile, a permanent left sidebar on desktop — same features on both. Global feedback goes through `ToastProvider` / `useToast` (in `src/components/useToast.ts`) — never `alert()`. `QueryStates` (`src/components/QueryStates.tsx`) renders loading/empty/error/`children` for every list view.
- **Theming** — the accent `TOKENS` (`blue`, `blue50`…) are CSS variables (`--brand`, `--brand-hover`, `--brand-50…700`, `--brand-rgb`) set per clinic by `BrandScope` from the clinic's `primaryColor`, passed through `ensureContrast` (4.5:1 on white). Use `TOKENS`/`GRADIENT`, never a raw accent hex. Only the Settings preview uses literal hex.
- **PWA** — `vite-plugin-pwa` (config in `vite.config.ts`) emits the manifest + service worker; icons in `public/`. The app is installable to a phone home screen.

## Data model (Firestore)

**Roles:** superadmin (`smartin.cherian@gmail.com`, manages clinics/owners, belongs to no clinic), owner (one per clinic, `clinics/{id}.ownerEmail`, manages `/people`), member. Max 3 users per clinic, enforced by `clinics/{id}/seats/{1|2|3}` = `{ email }`; each `allowedEmails/{email}` carries `clinicId` + `seat` (owner = seat 1).

**Multi-clinic:** all clinic data lives under `clinics/{clinicId}/…` (`patients, consultations, generals, lsmc, inventory, orderItems, expenses, counters/patients`); `clinics/{clinicId}` holds `{ name, createdAt, ownerEmail, timeZone }` (`timeZone` is `Asia/Kolkata`) plus a `seats` subcollection and the slug is the doc ID. `allowedEmails/{email}` carries `clinicId` + `seat` (one clinic per email); `users/{uid}` stays top-level. Collection descriptions below are per clinic. See `docs/superpowers/specs/2026-10-19-multi-clinic-design.md`. Cutover order: `npm run migrate:clinics` (dry run, then real) -> verify (every source doc ID must exist at the destination; re-run only with `--resync`, only BEFORE deploying, never after) -> `npm run backfill:seats` (dry run, then real; after any final resync) -> `firebase deploy --only firestore:rules,hosting` immediately -> close and reopen the app on every device (the first open may still run the old cached PWA, which reads legacy collections the new rules deny) -> tell existing password users they must verify their email once -> do not create a second clinic until the rules deploy is confirmed (hosting with the old catch-all rules would let any allow-listed member read every clinic) -> delete legacy top-level collections later.

Target collections (see the design spec for full field lists):

- `settings/branding` (per clinic, `clinics/{id}/settings/branding`) — `displayName` (≤60), `logoDataUrl` (`""` or `data:image/(png|webp|jpeg);base64,…`, ≤200000 chars; logo resized client-side to ≤256px, no Storage), `primaryColor` (`#rrggbb`), `showScripture`, `contact{doctorName, qualifications, registrationNo, address, phone, email}` (each ≤120), `updatedAt`, `updatedBy`. Owner/superadmin write; rules validate the shape and limits; all members read. Accessed via `useBranding`/`useSaveBranding` (`src/lib/`), cached in localStorage. `"settings"` is a reserved slug.
- `users` — `{ uid, email, displayName, role }` (`ensureUserDoc` writes `role: "superadmin"` for the superadmin email, else `"admin"`; self-written and never grants permission).
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
- **Firestore rules** (`firestore.rules`) require a signed-in user with a **verified email** (everyone, incl. superadmin) and allow only listed clinic subcollections (patients, consultations, generals, lsmc, inventory, orderItems, expenses, counters; anything else is denied). Existing password users must verify their email once after the rules deploy. Previously they only required sign-in; they are structured to be role-aware for future tightening. Be careful before deploying rules.
- **Rules tests / emulator.** `npm run test:rules` needs the Firestore emulator, and the firebase CLI (15.x) needs JDK 21+. On Java 17 use `npx -y firebase-tools@13.35.1 emulators:start --only firestore --project demo-grace` (or `emulators:exec`) instead.
- **Hosting** — `firebase.json` serves `./dist` with an SPA rewrite to `/index.html`, on the `grace-homoeo` project.
