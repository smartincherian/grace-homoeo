# Grace Homoeo Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a deployable, login-protected, installable PWA with an adaptive app shell and a tested data-layer core, ready for the Patients/Consultations, Inventory, and Funds feature modules to plug into.

**Architecture:** Replace the Create React App project with a Vite + React + TypeScript app on the same `grace-homoeo` Firebase project. Firebase (Auth + Firestore) is initialized from environment variables. Data access goes through typed repository modules wrapped in TanStack Query hooks; forms use react-hook-form + zod. The shell renders a bottom navigation bar on mobile and a left sidebar on desktop, gated behind a Firebase Auth guard.

**Tech Stack:** Vite, React 18, TypeScript (strict), MUI v6, Firebase v10 (Auth + Firestore + Hosting), TanStack Query v5, react-hook-form + zod, vite-plugin-pwa, Vitest + React Testing Library, Firebase Emulator Suite.

## Global Constraints

- Firebase project is **`grace-homoeo`** — reuse it; do not create a new project.
- Firebase config values come from **environment variables** (`import.meta.env.VITE_FIREBASE_*`); never hardcode keys in source. `.env*.local` is git-ignored.
- **Single doctor user**; a `users/{uid}` doc carries `role: "admin"`. Rules are role-aware but currently allow any signed-in user full access.
- **TypeScript strict mode** on; no `any` in committed code.
- Money is stored and computed in **rupees as numbers**; display with `₹`.
- Dates are stored as **epoch milliseconds (number)** in Firestore.
- Every data view exposes explicit **loading / empty / error** states.
- Commit after every passing step.

---

## File Structure

```
.env.example                 # documents required VITE_FIREBASE_* vars
.env.local                   # real values, git-ignored
index.html                   # Vite entry
vite.config.ts               # Vite + PWA + Vitest config
tsconfig.json                # strict TS
.eslintrc.cjs / .prettierrc  # lint/format
firebase.json                # hosting -> dist, SPA rewrite, emulators
firestore.rules              # role-aware auth rules
src/
  main.tsx                   # React root + providers
  App.tsx                    # routes
  vite-env.d.ts              # typed import.meta.env
  test/setup.ts              # Vitest + RTL setup
  lib/
    firebase.ts              # initializes app, exports auth + db
    queryClient.ts           # TanStack QueryClient
    serial.ts                # atomic patient serial counter
  theme/theme.ts             # MUI theme
  components/
    AppShell.tsx             # adaptive nav (bottom bar / sidebar) + top bar
    ToastProvider.tsx        # global toast (context + hook useToast)
    QueryStates.tsx          # <QueryStates> loading/empty/error wrapper
  features/
    auth/
      useAuth.ts             # auth state hook
      AuthGuard.tsx          # redirects unauthenticated -> /login
      LoginPage.tsx          # email/password login form
      ensureUserDoc.ts       # creates users/{uid} with role admin on first login
  routes/                    # placeholder route pages used until modules land
    PatientsPlaceholder.tsx
    InventoryPlaceholder.tsx
    FundsPlaceholder.tsx
```

---

### Task 1: Replace CRA with a Vite + React + TS scaffold

**Files:**
- Delete: CRA artifacts (`src/`, `public/`, `tailwind.config.js`, old `package.json` scripts/deps)
- Create: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a running Vite dev server and a `dist/` production build. `src/App.tsx` exports default `App` component.

- [ ] **Step 1: Remove old source and CRA config**

```bash
git rm -r src public tailwind.config.js
git rm -f src 2>/dev/null || true
```
(`docs/`, `functions/`, `misc/`, `firebase.json`, `firestore.*`, `.firebaserc`, `README.md` are kept.)

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "grace-homoeo",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "emulators": "firebase emulators:start --only firestore,auth",
    "release": "npm run build && firebase deploy --only hosting"
  },
  "dependencies": {
    "@emotion/react": "^11.13.0",
    "@emotion/styled": "^11.13.0",
    "@mui/icons-material": "^6.1.0",
    "@mui/material": "^6.1.0",
    "@mui/x-data-grid": "^7.18.0",
    "@mui/x-date-pickers": "^7.18.0",
    "@tanstack/react-query": "^5.59.0",
    "dayjs": "^1.11.13",
    "firebase": "^10.14.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.53.0",
    "react-router-dom": "^6.27.0",
    "zod": "^3.23.8",
    "@hookform/resolvers": "^3.9.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.10",
    "@types/react-dom": "^18.3.0",
    "@typescript-eslint/eslint-plugin": "^8.8.0",
    "@typescript-eslint/parser": "^8.8.0",
    "@vitejs/plugin-react": "^4.3.2",
    "eslint": "^8.57.1",
    "eslint-plugin-react-hooks": "^4.6.2",
    "eslint-plugin-react-refresh": "^0.4.12",
    "jsdom": "^25.0.1",
    "prettier": "^3.3.3",
    "typescript": "^5.6.2",
    "vite": "^5.4.8",
    "vite-plugin-pwa": "^0.20.5",
    "vitest": "^2.1.2"
  }
}
```

- [ ] **Step 3: Write `index.html`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `src/vite-env.d.ts`**

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Grace Homoeo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

`vite.config.ts` (PWA added in Task 10; minimal now):
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
```

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 4: Write minimal `src/main.tsx` and `src/App.tsx`**

`src/App.tsx`:
```tsx
export default function App() {
  return <h1>Grace Homoeo</h1>;
}
```

`src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 5: Append Vite/env ignores to `.gitignore`**

Add:
```
node_modules
dist
.env
.env.local
.env.*.local
*.log
```

- [ ] **Step 6: Install and verify build**

Run: `npm install && npm run build`
Expected: `dist/` produced, exits 0 (TypeScript compiles, Vite bundles).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Scaffold Vite + React + TS, remove CRA"
```

---

### Task 2: Tooling + Vitest harness + folder skeleton

**Files:**
- Create: `.eslintrc.cjs`, `.prettierrc`, `src/test/setup.ts`, `src/test/smoke.test.tsx`
- Create empty-but-tracked dirs via `.gitkeep`: `src/lib/`, `src/features/auth/`, `src/components/`, `src/routes/`, `src/theme/`

**Interfaces:**
- Consumes: Task 1 scaffold.
- Produces: `npm test` green; lint/format configured.

- [ ] **Step 1: Write `.eslintrc.cjs` and `.prettierrc`**

`.eslintrc.cjs`:
```cjs
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["react-refresh"],
  ignorePatterns: ["dist", ".eslintrc.cjs", "functions", "misc"],
  rules: {
    "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
  },
};
```

`.prettierrc`:
```json
{ "semi": true, "singleQuote": false, "trailingComma": "all" }
```

- [ ] **Step 2: Write `src/test/setup.ts`**

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 3: Write a failing smoke test**

`src/test/smoke.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import App from "../App";

test("renders app title", () => {
  render(<App />);
  expect(screen.getByText("Grace Homoeo")).toBeInTheDocument();
});
```

- [ ] **Step 4: Run the test**

Run: `npm test`
Expected: PASS (1 test). If RTL/jsdom misconfigured, it FAILS first — fix `vite.config.ts` test block.

- [ ] **Step 5: Lint passes**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add ESLint/Prettier and Vitest harness"
```

---

### Task 3: Firebase initialization from environment

**Files:**
- Create: `src/lib/firebase.ts`, `.env.example`
- Create (local, untracked): `.env.local`

**Interfaces:**
- Consumes: Task 1 env typing (`src/vite-env.d.ts`).
- Produces: `import { auth, db } from "@/lib/firebase"` — `auth: Auth`, `db: Firestore`. (Import path is relative `../lib/firebase` unless a path alias is added; use relative imports throughout.)

- [ ] **Step 1: Write `.env.example`**

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=grace-homoeo.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=grace-homoeo
VITE_FIREBASE_STORAGE_BUCKET=grace-homoeo.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

- [ ] **Step 2: Create `.env.local` with the real values**

Copy `.env.example` to `.env.local` and fill from the old `src/firestore/config.js` values (apiKey `AIzaSyDWt6RxMQVV9wdlU6vbYGwf4O_DaqYxNew`, messagingSenderId `231106436960`, appId `1:231106436960:web:942c6e78656a784ad10805`). This file is git-ignored.

- [ ] **Step 3: Write `src/lib/firebase.ts`**

```ts
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
export const db = getFirestore(app);

if (import.meta.env.VITE_USE_EMULATOR === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Initialize Firebase from environment variables"
```

---

### Task 4: Providers — QueryClient, Toast, and wired entry point

**Files:**
- Create: `src/lib/queryClient.ts`, `src/components/ToastProvider.tsx`
- Modify: `src/main.tsx`
- Test: `src/components/ToastProvider.test.tsx`

**Interfaces:**
- Consumes: Task 3 firebase.
- Produces:
  - `queryClient: QueryClient` from `src/lib/queryClient.ts`.
  - `ToastProvider` component; `useToast(): { showToast(message: string, severity?: "success" | "error" | "info" | "warning"): void }`.

- [ ] **Step 1: Write `src/lib/queryClient.ts`**

```ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});
```

- [ ] **Step 2: Write failing test for the toast hook**

`src/components/ToastProvider.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./ToastProvider";

function Trigger() {
  const { showToast } = useToast();
  return <button onClick={() => showToast("Saved!", "success")}>go</button>;
}

test("shows a toast message when triggered", async () => {
  render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  );
  await userEvent.click(screen.getByText("go"));
  expect(await screen.findByText("Saved!")).toBeInTheDocument();
});
```

- [ ] **Step 3: Run test, verify it fails**

Run: `npm test -- ToastProvider`
Expected: FAIL — cannot resolve `./ToastProvider`.

- [ ] **Step 4: Implement `src/components/ToastProvider.tsx`**

```tsx
import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";
import { Alert, Snackbar } from "@mui/material";

type Severity = "success" | "error" | "info" | "warning";
interface ToastContextValue {
  showToast: (message: string, severity?: Severity) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<Severity>("info");

  const showToast = useCallback((msg: string, sev: Severity = "info") => {
    setMessage(msg);
    setSeverity(sev);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity={severity} onClose={() => setOpen(false)} variant="filled">
          {message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
```

- [ ] **Step 5: Run test, verify it passes**

Run: `npm test -- ToastProvider`
Expected: PASS.

- [ ] **Step 6: Wire providers into `src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { queryClient } from "./lib/queryClient";
import { ToastProvider } from "./components/ToastProvider";
import { theme } from "./theme/theme";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ToastProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
```
(`theme` is created in Task 5; if implementing Task 4 first, temporarily import `createTheme()` inline, then replace in Task 5.)

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "Add QueryClient and global ToastProvider"
```

---

### Task 5: MUI theme + adaptive AppShell + placeholder routes

**Files:**
- Create: `src/theme/theme.ts`, `src/components/AppShell.tsx`, `src/routes/PatientsPlaceholder.tsx`, `src/routes/InventoryPlaceholder.tsx`, `src/routes/FundsPlaceholder.tsx`
- Modify: `src/App.tsx`
- Test: `src/components/AppShell.test.tsx`

**Interfaces:**
- Consumes: react-router `BrowserRouter` (from main.tsx).
- Produces:
  - `theme` (MUI Theme) from `src/theme/theme.ts`.
  - `AppShell` component rendering nav + `<Outlet />`. Nav destinations: `/patients`, `/inventory`, `/funds`.

- [ ] **Step 1: Write `src/theme/theme.ts`**

```ts
import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: { main: "#150E56" },
    secondary: { main: "#0EA5E9" },
    background: { default: "#f6f7fb" },
  },
  shape: { borderRadius: 10 },
  typography: { fontFamily: "'Inter','Roboto','Helvetica','Arial',sans-serif" },
});
```

- [ ] **Step 2: Write the three placeholder routes**

Each file (substitute name/label):
```tsx
// src/routes/PatientsPlaceholder.tsx
import { Typography } from "@mui/material";
export default function PatientsPlaceholder() {
  return <Typography variant="h5">Patients (coming soon)</Typography>;
}
```
Repeat as `InventoryPlaceholder.tsx` ("Inventory (coming soon)") and `FundsPlaceholder.tsx` ("Funds (coming soon)").

- [ ] **Step 3: Write a failing test for AppShell nav**

`src/components/AppShell.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material";
import { theme } from "../theme/theme";
import AppShell from "./AppShell";

test("renders navigation to all three modules", () => {
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={["/patients"]}>
        <AppShell />
      </MemoryRouter>
    </ThemeProvider>,
  );
  expect(screen.getByRole("link", { name: /patients/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /inventory/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /funds/i })).toBeInTheDocument();
});
```

- [ ] **Step 4: Run test, verify it fails**

Run: `npm test -- AppShell`
Expected: FAIL — cannot resolve `./AppShell`.

- [ ] **Step 5: Implement `src/components/AppShell.tsx`**

```tsx
import { ReactNode } from "react";
import {
  AppBar, Box, BottomNavigation, BottomNavigationAction, Drawer,
  List, ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography,
  useMediaQuery, useTheme,
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import PaidIcon from "@mui/icons-material/Paid";
import { Link, Outlet, useLocation } from "react-router-dom";

const NAV = [
  { to: "/patients", label: "Patients", icon: <PeopleIcon /> },
  { to: "/inventory", label: "Inventory", icon: <Inventory2Icon /> },
  { to: "/funds", label: "Funds", icon: <PaidIcon /> },
];
const DRAWER_WIDTH = 240;

export default function AppShell({ children }: { children?: ReactNode }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const { pathname } = useLocation();
  const current = NAV.find((n) => pathname.startsWith(n.to))?.to ?? "/patients";

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar variant="dense">
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Grace Homoeo</Typography>
        </Toolbar>
      </AppBar>

      {isDesktop && (
        <Drawer
          variant="permanent"
          sx={{ width: DRAWER_WIDTH, "& .MuiDrawer-paper": { width: DRAWER_WIDTH } }}
        >
          <Toolbar variant="dense" />
          <List>
            {NAV.map((n) => (
              <ListItemButton key={n.to} component={Link} to={n.to} selected={current === n.to}>
                <ListItemIcon>{n.icon}</ListItemIcon>
                <ListItemText primary={n.label} />
              </ListItemButton>
            ))}
          </List>
        </Drawer>
      )}

      <Box component="main" sx={{ flexGrow: 1, p: 2, pb: isDesktop ? 2 : 9 }}>
        <Toolbar variant="dense" />
        {children ?? <Outlet />}
      </Box>

      {!isDesktop && (
        <BottomNavigation
          value={current}
          showLabels
          sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: (t) => t.zIndex.drawer + 1 }}
        >
          {NAV.map((n) => (
            <BottomNavigationAction
              key={n.to}
              component={Link}
              to={n.to}
              value={n.to}
              label={n.label}
              icon={n.icon}
            />
          ))}
        </BottomNavigation>
      )}
    </Box>
  );
}
```

- [ ] **Step 6: Wire routes in `src/App.tsx`**

```tsx
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import PatientsPlaceholder from "./routes/PatientsPlaceholder";
import InventoryPlaceholder from "./routes/InventoryPlaceholder";
import FundsPlaceholder from "./routes/FundsPlaceholder";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/patients" element={<PatientsPlaceholder />} />
        <Route path="/inventory" element={<InventoryPlaceholder />} />
        <Route path="/funds" element={<FundsPlaceholder />} />
      </Route>
      <Route path="*" element={<Navigate to="/patients" replace />} />
    </Routes>
  );
}
```
Note: the smoke test from Task 2 now expects different content — update `src/test/smoke.test.tsx` to assert the redirect renders "Patients (coming soon)" wrapped in `MemoryRouter` + `ThemeProvider`, or delete it in favor of the AppShell test. Make that edit in this step and keep `npm test` green.

- [ ] **Step 7: Run tests and build**

Run: `npm test && npm run build`
Expected: all green, build exits 0.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "Add MUI theme and adaptive AppShell with placeholder routes"
```

---

### Task 6: Authentication — login, guard, user doc

**Files:**
- Create: `src/features/auth/useAuth.ts`, `src/features/auth/ensureUserDoc.ts`, `src/features/auth/AuthGuard.tsx`, `src/features/auth/LoginPage.tsx`
- Modify: `src/App.tsx`
- Test: `src/features/auth/ensureUserDoc.test.ts`

**Interfaces:**
- Consumes: `auth`, `db` from `src/lib/firebase.ts`.
- Produces:
  - `useAuth(): { user: User | null; loading: boolean }`.
  - `ensureUserDoc(user: User): Promise<void>` — creates `users/{uid}` with `{ uid, email, displayName, role: "admin" }` if missing.
  - `AuthGuard` — renders children when authenticated, else `<Navigate to="/login" />`.
  - `LoginPage` — email/password sign-in form at `/login`.

- [ ] **Step 1: Write failing test for `ensureUserDoc`**

`src/features/auth/ensureUserDoc.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const getDoc = vi.fn();
const setDoc = vi.fn();
const doc = vi.fn(() => ({ id: "u1" }));
vi.mock("firebase/firestore", () => ({ getDoc: (...a: unknown[]) => getDoc(...a), setDoc: (...a: unknown[]) => setDoc(...a), doc: (...a: unknown[]) => doc(...a) }));
vi.mock("../../lib/firebase", () => ({ db: {} }));

import { ensureUserDoc } from "./ensureUserDoc";

describe("ensureUserDoc", () => {
  beforeEach(() => { getDoc.mockReset(); setDoc.mockReset(); });

  it("creates a users doc with role admin when none exists", async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    await ensureUserDoc({ uid: "u1", email: "doc@x.com", displayName: "Dr" } as never);
    expect(setDoc).toHaveBeenCalledWith(expect.anything(), {
      uid: "u1", email: "doc@x.com", displayName: "Dr", role: "admin",
    });
  });

  it("does nothing when the doc already exists", async () => {
    getDoc.mockResolvedValue({ exists: () => true });
    await ensureUserDoc({ uid: "u1", email: "doc@x.com", displayName: "Dr" } as never);
    expect(setDoc).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- ensureUserDoc`
Expected: FAIL — cannot resolve `./ensureUserDoc`.

- [ ] **Step 3: Implement `src/features/auth/ensureUserDoc.ts`**

```ts
import { doc, getDoc, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../../lib/firebase";

export async function ensureUserDoc(user: User): Promise<void> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    uid: user.uid,
    email: user.email ?? "",
    displayName: user.displayName ?? "",
    role: "admin",
  });
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- ensureUserDoc`
Expected: PASS (2 tests).

- [ ] **Step 5: Implement `useAuth`, `AuthGuard`, `LoginPage`**

`src/features/auth/useAuth.ts`:
```ts
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../../lib/firebase";

export function useAuth(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); }), []);
  return { user, loading };
}
```

`src/features/auth/AuthGuard.tsx`:
```tsx
import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "./useAuth";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;
  }
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}
```

`src/features/auth/LoginPage.tsx`:
```tsx
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Box, Button, Card, CardContent, TextField, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { auth } from "../../lib/firebase";
import { ensureUserDoc } from "./ensureUserDoc";
import { useToast } from "../../components/ToastProvider";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await ensureUserDoc(cred.user);
      navigate("/patients", { replace: true });
    } catch {
      showToast("Login failed. Check your email and password.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2 }}>
      <Card sx={{ width: "100%", maxWidth: 380 }}>
        <CardContent component="form" onSubmit={submit}>
          <Typography variant="h5" align="center" sx={{ mb: 3 }}>Grace Homoeo</Typography>
          <TextField label="Email" type="email" fullWidth required sx={{ mb: 2 }}
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="Password" type="password" fullWidth required sx={{ mb: 3 }}
            value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" variant="contained" fullWidth disabled={busy}>
            {busy ? "Signing in..." : "Sign In"}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
```

- [ ] **Step 6: Gate the app in `src/App.tsx`**

```tsx
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import AuthGuard from "./features/auth/AuthGuard";
import LoginPage from "./features/auth/LoginPage";
import PatientsPlaceholder from "./routes/PatientsPlaceholder";
import InventoryPlaceholder from "./routes/InventoryPlaceholder";
import FundsPlaceholder from "./routes/FundsPlaceholder";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <AuthGuard>
            <AppShell />
          </AuthGuard>
        }
      >
        <Route path="/patients" element={<PatientsPlaceholder />} />
        <Route path="/inventory" element={<InventoryPlaceholder />} />
        <Route path="/funds" element={<FundsPlaceholder />} />
      </Route>
      <Route path="*" element={<Navigate to="/patients" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 7: Run tests and build**

Run: `npm test && npm run build`
Expected: green, exits 0.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "Add Firebase Auth login, guard, and user doc bootstrap"
```

---

### Task 7: Role-aware Firestore rules + emulator config

**Files:**
- Modify: `firestore.rules`, `firebase.json`, `.env.local` (add `VITE_USE_EMULATOR`)
- Create: `.env.example` addition for `VITE_USE_EMULATOR`

**Interfaces:**
- Consumes: nothing in code; configures backend + emulator used by Task 8.
- Produces: emulator runnable via `npm run emulators`; rules allowing signed-in access.

- [ ] **Step 1: Write `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    // role() reserved for future per-collection tightening:
    // function role() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role; }

    match /{document=**} {
      allow read, write: if signedIn();
    }
  }
}
```

- [ ] **Step 2: Add emulator ports to `firebase.json`**

Add this top-level key (keep existing `firestore`, `functions`, `hosting`):
```json
"emulators": {
  "auth": { "port": 9099 },
  "firestore": { "port": 8080 },
  "ui": { "enabled": true }
}
```

- [ ] **Step 3: Add `VITE_USE_EMULATOR=false` to `.env.example` and `.env.local`**

(Set to `true` locally only when running against emulators.)

- [ ] **Step 4: Verify emulator starts**

Run: `npm run emulators` (then Ctrl-C)
Expected: Firestore on 8080, Auth on 9099, Emulator UI URL printed.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add role-aware Firestore rules and emulator config"
```

---

### Task 8: Atomic patient serial counter (TDD, mocked Firestore)

**Files:**
- Create: `src/lib/serial.ts`, `src/lib/serial.test.ts`

**Interfaces:**
- Consumes: `db` from `src/lib/firebase.ts`.
- Produces: `nextPatientSerial(): Promise<number>` — atomically increments `counters/patients.lastSerial` inside a Firestore transaction and returns the new value. First call (no counter doc) returns `1`. Consumed by the Patients module (Plan 2).

Tests mock `firebase/firestore` (no emulator needed — `npm test` stays green standalone). The transaction body is exercised by invoking the callback passed to the mocked `runTransaction` with a fake `tx`.

- [ ] **Step 1: Write failing test (mocked transaction)**

`src/lib/serial.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const runTransaction = vi.fn();
const doc = vi.fn(() => ({ id: "patients" }));
vi.mock("firebase/firestore", () => ({
  runTransaction: (...a: unknown[]) => runTransaction(...a),
  doc: (...a: unknown[]) => doc(...a),
}));
vi.mock("./firebase", () => ({ db: {} }));

import { nextPatientSerial } from "./serial";

describe("nextPatientSerial", () => {
  beforeEach(() => runTransaction.mockReset());

  it("returns 1 when no counter doc exists yet", async () => {
    runTransaction.mockImplementation(async (_db: unknown, fn: (tx: unknown) => unknown) =>
      fn({ get: async () => ({ exists: () => false, data: () => ({}) }), set: vi.fn() }),
    );
    await expect(nextPatientSerial()).resolves.toBe(1);
  });

  it("increments and persists the existing counter", async () => {
    const set = vi.fn();
    runTransaction.mockImplementation(async (_db: unknown, fn: (tx: unknown) => unknown) =>
      fn({ get: async () => ({ exists: () => true, data: () => ({ lastSerial: 41 }) }), set }),
    );
    await expect(nextPatientSerial()).resolves.toBe(42);
    expect(set).toHaveBeenCalledWith(expect.anything(), { lastSerial: 42 }, { merge: true });
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- serial`
Expected: FAIL — cannot resolve `./serial`.

- [ ] **Step 3: Implement `src/lib/serial.ts`**

```ts
import { doc, runTransaction } from "firebase/firestore";
import { db } from "./firebase";

export async function nextPatientSerial(): Promise<number> {
  const ref = doc(db, "counters", "patients");
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const last = snap.exists() ? (snap.data().lastSerial as number) : 0;
    const next = last + 1;
    tx.set(ref, { lastSerial: next }, { merge: true });
    return next;
  });
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npm test -- serial`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add atomic patient serial counter with mocked-transaction test"
```

---

### Task 9: Shared QueryStates component

**Files:**
- Create: `src/components/QueryStates.tsx`, `src/components/QueryStates.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `<QueryStates status isError isEmpty emptyMessage>{children}</QueryStates>` where `status: "pending" | "error" | "success"`. Renders a spinner when pending, an error message when `isError`, an empty message when `isEmpty`, else `children`. Used by every list view in Plans 2-4.

- [ ] **Step 1: Write failing tests**

`src/components/QueryStates.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import QueryStates from "./QueryStates";

test("shows spinner when pending", () => {
  render(<QueryStates status="pending" isEmpty={false} emptyMessage="none"><div>x</div></QueryStates>);
  expect(screen.getByRole("progressbar")).toBeInTheDocument();
});

test("shows empty message when empty", () => {
  render(<QueryStates status="success" isEmpty emptyMessage="No patients yet"><div>x</div></QueryStates>);
  expect(screen.getByText("No patients yet")).toBeInTheDocument();
});

test("renders children on success with data", () => {
  render(<QueryStates status="success" isEmpty={false} emptyMessage="none"><div>content</div></QueryStates>);
  expect(screen.getByText("content")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run, verify fail**

Run: `npm test -- QueryStates`
Expected: FAIL — cannot resolve `./QueryStates`.

- [ ] **Step 3: Implement `src/components/QueryStates.tsx`**

```tsx
import { ReactNode } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";

interface Props {
  status: "pending" | "error" | "success";
  isError?: boolean;
  isEmpty: boolean;
  emptyMessage: string;
  children: ReactNode;
}

export default function QueryStates({ status, isError, isEmpty, emptyMessage, children }: Props) {
  if (status === "pending") {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }
  if (status === "error" || isError) {
    return <Typography color="error" sx={{ py: 4, textAlign: "center" }}>Something went wrong. Please try again.</Typography>;
  }
  if (isEmpty) {
    return <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>{emptyMessage}</Typography>;
  }
  return <>{children}</>;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npm test -- QueryStates`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add shared QueryStates loading/empty/error component"
```

---

### Task 10: PWA install support

**Files:**
- Modify: `vite.config.ts`
- Create: `public/icon-192.png`, `public/icon-512.png` (generated from existing logo)

**Interfaces:**
- Consumes: Task 1 vite config.
- Produces: a service worker + web manifest; the app is installable to a phone home screen.

- [ ] **Step 1: Generate icons from the old logo**

The old logo lives in git history (`src/assets/logo.png` before Task 1). Restore and resize:
```bash
git show HEAD~9:src/assets/logo.png > /tmp/logo.png 2>/dev/null || true
# Using sips (macOS) to produce required sizes:
sips -z 192 192 /tmp/logo.png --out public/icon-192.png
sips -z 512 512 /tmp/logo.png --out public/icon-512.png
```
If the old logo is unavailable, create two solid placeholder PNGs (192/512) and replace later.

- [ ] **Step 2: Add PWA plugin to `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Grace Homoeo",
        short_name: "Grace",
        theme_color: "#150E56",
        background_color: "#150E56",
        display: "standalone",
        start_url: "/patients",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
```

- [ ] **Step 3: Build and confirm manifest + SW emitted**

Run: `npm run build`
Expected: `dist/manifest.webmanifest` and `dist/sw.js` present.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Add PWA manifest, icons, and service worker"
```

---

### Task 11: Hosting deploy config + final verification

**Files:**
- Modify: `firebase.json` (hosting `public` → `dist`)

**Interfaces:**
- Consumes: everything above.
- Produces: `npm run release` deploys the built app to `grace-homoeo` hosting.

- [ ] **Step 1: Point hosting at `dist`**

In `firebase.json`, set hosting `"public": "dist"` (was `"./build"`), keep the SPA rewrite to `/index.html`, and the existing `ignore` list.

- [ ] **Step 2: Full verification pass**

Run: `npm run lint && npm test && npm run build`
Expected: all green.

- [ ] **Step 3: Manual smoke (local)**

Run: `npm run preview`
Expected: visiting the served URL redirects to `/login`; logging in with a valid Firebase Auth user lands on `/patients` with the adaptive shell (bottom nav on a narrow window, sidebar when widened).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Point Firebase Hosting at Vite dist output"
```

Deployment to production (`npm run release`) is performed only when the user explicitly asks.

---

## Self-Review

**Spec coverage:**
- §2 stack/decisions → Tasks 1-4, 10 (Vite/TS/MUI/Query/RHF deps, env config, PWA). ✓
- §3 architecture / adaptive layout → Tasks 2 (folders), 5 (AppShell bottom-nav/sidebar). ✓
- §4 data model: `counters/patients` + serial → Task 8; `users` doc → Task 6. *(patients/consultations/inventory/expenses collections are created by Plans 2-4 — out of Foundation scope by design.)* ✓
- §5 auth & security → Tasks 6 (auth/guard/user doc) + 7 (role-aware rules, env config). ✓
- §7 error/empty/loading states → Task 9 QueryStates. ✓
- §8 testing (Vitest + RTL) → Tasks 2, 8 (mocked Firestore — `npm test` needs no emulator); emulator still configured in Task 7 for manual/integration use. ✓
- §9 roadmap phases 1-4 → this entire plan; phases 5-7 are Plans 2-4. ✓

**Placeholder scan:** No TBD/TODO; every code/config step shows full content. Icon generation has an explicit fallback. ✓

**Type consistency:** `useToast`/`showToast` signature consistent (Tasks 4, 6). `nextPatientSerialWith(database)`/`nextPatientSerial()` consistent (Task 8). `QueryStates` prop names consistent (Task 9). `ensureUserDoc(user)` consistent (Task 6). NAV routes `/patients`,`/inventory`,`/funds` consistent (Tasks 5, 6). ✓

**Note carried to Plans 2-4:** use relative imports (no `@/` alias configured); list views consume `QueryStates`; patient creation consumes `nextPatientSerial()`.
