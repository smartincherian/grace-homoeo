# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Grace" — a Create React App single-page web app for a homoeopathy clinic. It bundles several internal tools (patient records, inventory, funds) plus a "Bible-in-a-Year" reading-plan helper. Hosted on Firebase Hosting; data lives in Cloud Firestore.

## Commands

```bash
npm start                 # dev server at http://localhost:3000
npm run build             # production build to ./build
npm test                  # react-scripts test runner (interactive watch)
npm test -- --watchAll=false src/App.test.js   # run a single test, no watch
npm run release           # build + deploy hosting (firebase deploy --only hosting)
```

Firebase Functions live in `functions/` as a separate npm package with its own `package.json`. They are currently empty boilerplate. Their predeploy step runs `npm --prefix functions run lint` (ESLint, Google config).

## Architecture

- **Routing** — All routes are declared in `src/App.js` (react-router-dom v6, `BrowserRouter`). `Home.js` is a launcher of `<Link>` buttons to the three main tools. Firebase Hosting rewrites all paths to `/index.html` (`firebase.json`) so client-side routing works.
- **Feature folders** — Each tool is a folder under `src/routes/`: `patientManagement/`, `inventory/`, `fund/`, and `biy-helper/` (the Bible reading plan). There is no per-feature route nesting; everything is flat in `App.js`.
- **Firestore data layer** — `src/firestore/config.js` initializes Firebase and exports `db`, `auth`, `storage`, `functions`. Per-collection modules (`patient.js`, `consultation.js`) wrap the Firestore SDK in async functions; UI components import these, never the SDK directly. Patient docs use a numeric `ID` field for ordering/serial numbers (see `fetchPatientsHighestSerialNumber`).
- **UI stack** — MUI (`@mui/material`, icons, `x-data-grid`, `x-date-pickers`) is the primary component library, styled inline via the `sx` prop. The single shared color is `THEME.COLOR_PRIMARY` in `src/theme.js`. Tailwind is configured (`tailwind.config.js`) but the existing screens are built almost entirely with MUI.
- **Cross-cutting providers** — `SnackbarProvider` (`src/components/Snackbar`) wraps the whole app and exposes `showSnackbar(message, severity, position)` via context for global toasts. Other shared components: `Drawer`, `Carousel`, `Loader`.
- **Localization** — `src/hooks/useLocalization.js` reads key→language maps from `src/locales/english.json`, persists the choice in `localStorage` (`bible-reading-lang`), and is used by the `biy-helper` feature.

## Conventions & gotchas

- **Strip `undefined`/`null` before writing to Firestore.** Firestore rejects `undefined`; use `removeUndefined` from `src/common/helpers.js` on document data before `addDoc`/`setDoc`.
- **Collection-name mismatch in `src/firestore/consultation.js`:** `addConsultation` writes to the `consultation` collection, but `fetchPatientConsultations`/`fetchPreviousConsultations` read from `consultations` (plural). Verify the intended collection before relying on these functions.
- **`firestore.rules` denies all reads and writes (`allow ... if false`).** The deployed rules likely differ from this file; do not assume this repo's rules reflect production, and be careful before running `firebase deploy` with Firestore rules.
- **Firebase config is checked in** (`src/firestore/config.js`) — this is a public web API key, normal for client Firebase apps; access is meant to be controlled by Firestore rules, not key secrecy.
- The `misc/` folder holds standalone data-migration/scripting helpers, not part of the app bundle.
