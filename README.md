# Grace Homoeo

Installable PWA for a single-doctor homoeopathy clinic — patients & consultations,
inventory, and funds. Built with Vite + React + TypeScript + MUI + Firebase
(Firestore + Auth), hosted on Firebase Hosting (project `grace-homoeo`).

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the VITE_FIREBASE_* values
```

## Scripts

```bash
npm run dev        # dev server at http://localhost:5173
npm test           # unit tests (Vitest)
npm run lint       # ESLint
npm run build      # type-check + production build -> ./dist
npm run preview    # serve the production build locally
npm run release    # build + deploy hosting to Firebase
npm run emulators  # local Firestore + Auth emulators
```

See `CLAUDE.md` for architecture and conventions.
