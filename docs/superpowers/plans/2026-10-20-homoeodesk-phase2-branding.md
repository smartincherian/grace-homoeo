# HomoeoDesk Phase 2: White-labelling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present the app as generic "HomoeoDesk" outside a clinic, and let each clinic's owner brand their clinic (name, logo, colour, contact, scripture toggle) from an owner-only Settings page.

**Architecture:** Accent colours move from hard-coded hex to CSS variables (`--brand-*`) that `TOKENS` references, so every existing `sx` usage follows the clinic colour; a per-clinic MUI theme is built from the real hex. Branding lives in `clinics/{id}/settings/branding` (members read, owner/superadmin write, validated in rules), cached in `localStorage` to avoid a colour flash. The footer is split out of the scripture banner so it always shows.

**Tech Stack:** Vite + React + TS, MUI v6, TanStack Query, Firebase v10 Firestore, Vitest + RTL, `@firebase/rules-unit-testing`, vite-plugin-pwa.

**Spec:** `docs/superpowers/specs/2026-10-20-homoeodesk-roles-branding-staff-booking-design.md` (section "Phase 2: White-labelling").

## Global Constraints

- Product name **HomoeoDesk**, tagline **Homoeo Clinic Manager**. No "Grace" text or Grace logo anywhere outside clinic data.
- Browser title: `<displayName> · HomoeoDesk` inside a clinic, `HomoeoDesk` elsewhere.
- "Developed by" footer (`SiteFooter`) on every page, including login, whether or not scripture is shown. Scripture banner shown on login; inside a clinic only when `showScripture` is true (default true).
- Branding doc `clinics/{clinicId}/settings/branding` fields exactly: `displayName` (string ≤ 60), `logoDataUrl` (string, `""` = none, else `data:image/(png|webp|jpeg);base64,…`, ≤ 200000 chars), `primaryColor` (`^#[0-9a-fA-F]{6}$`), `showScripture` (bool), `contact` (`{ doctorName, qualifications, registrationNo, address, phone, email }`, strings ≤ 120), `updatedAt` (epoch ms), `updatedBy` (= writer's email).
- Default brand colour `#2f6bff`. Presets (label, hex): Blue `#2f6bff`, Indigo `#4f46e5`, Teal `#0f766e`, Green `#15803d`, Maroon `#9f1239`, Purple `#7e22ce`, Orange `#c2410c`, Slate `#334155`.
- White text on the effective brand colour must reach WCAG contrast ≥ 4.5:1 (darken until it does).
- Logo resized client-side to ≤ 256 px on the long side; no Firebase Storage; no new runtime dependencies.
- `localStorage` access wrapped in try/catch; key `homoeodesk.branding.<clinicId>`.
- Owner-only Settings at `/:clinicSlug/settings` (reuse `<OwnerOnly>`, `canManageClinic`).
- Feedback via `useToast`; repositories + hooks only (no Firestore in UI); epoch ms dates.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Clinic switch (superadmin moves between clinics / to /admin)**: colours, name and logo must follow the current clinic and reset to HomoeoDesk defaults on `/admin` and `/login`. (Task 4 test.)
- **Branding doc missing** (every existing clinic before its owner saves): app shows `clinics/{id}.name`, default colour, scripture on — no errors. (Task 2 test.)
- **Very light custom colour (e.g. `#ffff00`)**: buttons stay readable (auto-darkened). (Task 1 test.)
- **Huge or non-image logo file**: rejected with a toast, nothing saved. (Task 5 test.)
- **Member opens `/settings` by URL or calls Firestore directly**: redirected / denied. (Tasks 2, 5 tests.)

---

### Task 1: Brand palette and themeable tokens

**Files:**
- Create: `src/theme/brand.ts`, `src/theme/brand.test.ts`
- Modify: `src/theme/theme.ts`, `src/main.tsx`, `src/components/AppShell.tsx` (raw hex at the logo tile and the `rgba(47,107,255,.35)` shadow), `src/features/auth/LoginPage.tsx` (raw gradient), `src/components/ScriptureBanner.tsx` (`#1b3aa8` in `FRAME`)

**Interfaces:**
- Produces (`src/theme/brand.ts`):
  - `DEFAULT_BRAND = "#2f6bff"`
  - `BRAND_PRESETS: readonly { label: string; hex: string }[]` (the 8 from Global Constraints, in that order)
  - `contrastRatio(hexA: string, hexB: string): number` (WCAG 2.x)
  - `ensureContrast(hex: string): string`: returns `hex` (lowercased) if contrast with `#ffffff` ≥ 4.5, else mixes toward black in 5% steps until it is
  - `interface BrandPalette { main; hover; s50; s100; s200; s300; s700; rgb }` (all hex strings except `rgb` = `"r, g, b"`)
  - `derivePalette(hex: string): BrandPalette`: `main = ensureContrast(hex)`; `hover` = main mixed 12% toward black; `s700` = 35% toward black; `s50/s100/s200/s300` = main mixed toward white by 95/88/75/25%
  - `brandCssVars(p: BrandPalette): Record<string, string>` → keys `--brand`, `--brand-hover`, `--brand-50`, `--brand-100`, `--brand-200`, `--brand-300`, `--brand-700`, `--brand-rgb`
- Produces (`src/theme/theme.ts`):
  - `TOKENS.blue = "var(--brand)"`, `blueHover = "var(--brand-hover)"`, `blue50/100/200/700 = "var(--brand-50|100|200|700)"`; other tokens unchanged
  - `BLUE_SHADOW = "0 6px 16px rgba(var(--brand-rgb), .28)"`, `GRADIENT = "linear-gradient(160deg, var(--brand), var(--brand-300))"`
  - `buildTheme(hex: string = DEFAULT_BRAND): Theme`: today's theme, with `palette.primary` from `derivePalette(hex)` real hex values (MUI needs real colours) and `MuiCssBaseline` `:root` setting `brandCssVars(derivePalette(hex))`
  - `theme = buildTheme()` kept as an export for existing imports

- [ ] **Step 1: Failing tests (`brand.test.ts`)**
  - `contrastRatio("#ffffff", "#000000")` ≈ 21; `contrastRatio("#ffffff","#ffffff")` = 1.
  - `ensureContrast("#ffff00")` returns a colour with `contrastRatio(result, "#ffffff") >= 4.5`; `ensureContrast("#150e56")` returns `"#150e56"` unchanged.
  - Every preset passes through `ensureContrast` with ratio ≥ 4.5.
  - `derivePalette("#2f6bff")`: `s50` lighter than `s100` lighter than `s200` (compare luminance); `hover` and `s700` darker than `main`; `rgb` matches `/^\d{1,3}, \d{1,3}, \d{1,3}$/`.
  - `brandCssVars` returns exactly the 8 keys.
  - `buildTheme("#0f766e").palette.primary.main === ensureContrast("#0f766e")`.
- [ ] **Step 2: Run** `npm test -- brand` → FAIL.
- [ ] **Step 3: Implement**, switch `TOKENS`/`BLUE_SHADOW`/`GRADIENT` to variables, `main.tsx` uses `buildTheme()`, replace the four raw hex/rgba spots with `GRADIENT`/`TOKENS`/`rgba(var(--brand-rgb), .35)`/`var(--brand-700)`.
- [ ] **Step 4: Run** `npm test` (whole suite: tests that assert colours may need updating to the variable strings), `npx tsc -b` → PASS. Also `npm run dev` and visually confirm the app still looks blue (record in report).
- [ ] **Step 5: Commit** `feat(theme): brand palette with contrast correction; accent tokens as CSS variables`

---

### Task 2: Branding data (rules, repository, hooks)

**Files:**
- Modify: `firestore.rules`, `rules-tests/firestore.rules.test.ts`
- Create: `src/lib/branding.ts`, `src/lib/branding.test.ts`, `src/lib/useBranding.ts`, `src/lib/useBranding.test.tsx`

**Interfaces:**
- Consumes: `DEFAULT_BRAND` (Task 1), `clinicDoc` (`src/lib/clinic.ts`, pass `clinicId` explicitly), `getClinic` (`src/lib/clinicQueries.ts`).
- Produces:
  - `interface Contact { doctorName; qualifications; registrationNo; address; phone; email }` (strings)
  - `interface Branding { displayName: string; logoDataUrl: string; primaryColor: string; showScripture: boolean; contact: Contact }`
  - `DEFAULT_BRANDING: Branding` (`displayName: ""`, `logoDataUrl: ""`, `primaryColor: DEFAULT_BRAND`, `showScripture: true`, empty contact)
  - `getBranding(clinicId: string): Promise<Branding>`: missing doc → `DEFAULT_BRANDING`; present → merged over defaults (missing fields filled)
  - `saveBranding(clinicId: string, b: Branding, by: string): Promise<void>`: `setDoc(clinics/{id}/settings/branding, { ...b, updatedAt: Date.now(), updatedBy: by })`
  - `readCachedBranding(clinicId): Branding | undefined`, `writeCachedBranding(clinicId, b): void` (localStorage, try/catch, key `homoeodesk.branding.<clinicId>`)
  - `useBranding(clinicId: string | undefined)`: query key `["branding", clinicId]`, `enabled: !!clinicId`, `initialData` from cache with `initialDataUpdatedAt: 0`; the queryFn writes the cache on success
  - `useSaveBranding(clinicId)`: mutation `{ branding, by }` → `saveBranding`, then `setQueryData` + cache write
  - `displayNameOf(b: Branding | undefined, clinicName: string | undefined): string` → `b.displayName.trim() || clinicName || "HomoeoDesk"`

- [ ] **Step 1: Failing rules tests** (seed from Phase 1; owner `o@x.com`, member `a@x.com` in `c1`):
  - member reads `clinics/c1/settings/branding` → ok; member of c2 (`t@x.com`) reads it → fail.
  - owner sets a valid doc (all fields, `updatedBy: "o@x.com"`) → ok; member sets it → fail.
  - owner sets `primaryColor: "blue"` → fail; `displayName` of 61 chars → fail; `logoDataUrl: "http://x/y.png"` → fail; `logoDataUrl` = `"data:image/png;base64," + "A".repeat(200001)` → fail; extra key `foo` → fail; `updatedBy: "a@x.com"` by owner → fail.
  - superadmin sets a valid doc → ok.
  - owner writes `clinics/c1/settings/other` → fail (only `branding` for now).
- [ ] **Step 2: Failing unit tests** (`branding.test.ts`, `useBranding.test.tsx`; mock `firebase/firestore`):
  - `getBranding` on a missing doc → `DEFAULT_BRANDING`; on `{ primaryColor: "#0f766e" }` → defaults with that colour.
  - `saveBranding` writes the shape with `updatedAt` number and `updatedBy`.
  - cache read/write round-trip; when `localStorage.getItem` throws, `readCachedBranding` returns `undefined` and `writeCachedBranding` doesn't throw.
  - `useBranding` returns cached data immediately, then the fetched value; `displayNameOf` fallbacks.
- [ ] **Step 3: Run** rules tests (`npx -y firebase-tools@13.35.1 emulators:exec --only firestore --project demo-grace "npx vitest run --config vitest.rules.config.ts"`) and `npm test -- branding` → FAIL.
- [ ] **Step 4: Implement.** Rules: inside `match /clinics/{clinicId}` add `match /settings/{docId} { allow read: if member(clinicId); allow write: if manager(clinicId) && docId == 'branding' && validBranding(request.resource.data); }` (delete allowed for manager too, without validation). `validBranding` checks keys `hasOnly`/`hasAll` the 7 fields, types, sizes and patterns from Global Constraints, and `updatedBy == authEmail()`.
- [ ] **Step 5: Run** both suites → PASS.
- [ ] **Step 6: Commit** `feat(branding): per-clinic branding doc, rules validation, cached hooks`

---

### Task 3: Generic HomoeoDesk brand and always-on footer

**Files:**
- Create: `src/components/ProductMark.tsx`, `src/components/BottomDock.tsx`, `src/components/BottomDock.test.tsx`, `public/favicon.svg`, `scripts/make-icons.mjs`
- Modify: `index.html`, `vite.config.ts`, `public/icon-192.png`, `public/icon-512.png` (regenerated), `src/components/ScriptureBanner.tsx`, `src/features/auth/LoginPage.tsx` (+ test), `src/features/auth/VerifyEmailPage.tsx` (header mark only)

**Interfaces:**
- Produces:
  - `<ProductMark size?: number />`: neutral HomoeoDesk mark (rounded square in `GRADIENT` with a simple white geometric glyph, no letters "G")
  - `<BottomDock pinned?: boolean (default true); showScripture?: boolean (default true) />`: renders `<ScriptureBanner pinned={false-like content only} />` when `showScripture`, then `<SiteFooter />`; owns the sticky positioning and publishes `--scripture-h` (height of the whole dock) when pinned
  - `ScriptureBanner` becomes content-only (no `SiteFooter`, no sticky/ResizeObserver logic)

- [ ] **Step 1: Failing tests**
  - `BottomDock`: renders the footer text "Developed by" with `showScripture={false}` and no verse text; with `showScripture` renders both.
  - `LoginPage`: heading "HomoeoDesk" and text "Homoeo Clinic Manager" present; no text matching `/grace/i` in the rendered page (mock `ScriptureBanner` content as today if needed, but `SiteFooter` must render).
- [ ] **Step 2: Run** `npm test -- BottomDock LoginPage` → FAIL.
- [ ] **Step 3: Implement.**
  - `index.html` `<title>HomoeoDesk</title>`, `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />`, `<meta name="description" content="Homoeo Clinic Manager" />`.
  - Manifest: `name: "HomoeoDesk"`, `short_name: "HomoeoDesk"`, `description: "Homoeo Clinic Manager"`, `start_url: "/"`.
  - `scripts/make-icons.mjs`: Node script, no dependencies (encode PNG with `node:zlib`), draws the same mark as `favicon.svg` into `public/icon-192.png` and `public/icon-512.png`; run it once and commit the PNGs (add `"icons": "node scripts/make-icons.mjs"` to package.json).
  - LoginPage/VerifyEmailPage: `ProductMark` + "HomoeoDesk" + caption "Homoeo Clinic Manager"; login uses `<BottomDock pinned={false} />`.
  - `AppShell` keeps using the banner via `BottomDock` (its `showScripture` is wired in Task 4; pass `true` for now).
- [ ] **Step 4: Run** `npm test`, `npm run build` (manifest builds) → PASS. Check `grep -ri grace src index.html vite.config.ts public/*.svg` shows only the scripture verse text / clinic-data references (record the output in the report).
- [ ] **Step 5: Commit** `feat(brand): HomoeoDesk name, icons and login; footer always shown`

---

### Task 4: Clinic branding in the shell

**Files:**
- Create: `src/components/BrandScope.tsx`, `src/components/BrandScope.test.tsx`, `src/components/ClinicMark.tsx`
- Modify: `src/components/AppShell.tsx` (+ test); delete `src/assets/logo.png` and its import

**Interfaces:**
- Consumes: `useBranding`, `displayNameOf` (Task 2); `buildTheme`, `derivePalette`, `brandCssVars`, `DEFAULT_BRAND` (Task 1); `BottomDock` (Task 3).
- Produces:
  - `<BrandScope clinicId: string | undefined>{children}</BrandScope>`: when `clinicId` is set, applies `brandCssVars(derivePalette(branding.primaryColor))` to `document.documentElement.style` and wraps children in `ThemeProvider theme={buildTheme(primaryColor)}` (memoised); when undefined or on unmount, restores the default variables. Sets `document.title` to `` `${displayNameOf(...)} · HomoeoDesk` `` inside a clinic and `"HomoeoDesk"` otherwise.
  - `<ClinicMark branding name size />`: `<img alt={name}>` of `logoDataUrl` if set, else an initial-letter tile in `GRADIENT`.

- [ ] **Step 1: Failing tests**
  - `BrandScope` with mocked `useBranding` returning `primaryColor: "#0f766e"` sets `--brand` on `documentElement` to `ensureContrast("#0f766e")` and `document.title` to "Teal Clinic · HomoeoDesk" (displayName "Teal Clinic"); rerendered with `clinicId={undefined}` restores `--brand` to `ensureContrast(DEFAULT_BRAND)` and title "HomoeoDesk".
  - With branding `displayName: ""` and clinic name "One", title is "One · HomoeoDesk".
  - `AppShell`: sidebar/header show `displayNameOf(...)`; `ClinicMark` shows `<img alt=…>` when `logoDataUrl` set, else the initial letter; `BottomDock` receives `showScripture={false}` when branding says so (assert no verse text but footer present); on `/admin` the header shows "HomoeoDesk" and no clinic name.
- [ ] **Step 2: Run** `npm test -- BrandScope AppShell` → FAIL.
- [ ] **Step 3: Implement.** Wrap AppShell's content in `<BrandScope clinicId={canReadClinic ? clinicSlug : undefined}>`. Replace the `logo.png` image and the "G" `LogoTile` with `ClinicMark` (inside a clinic) or `ProductMark` (outside); replace the "Grace Homoeo" header text with the display name / "HomoeoDesk".
- [ ] **Step 4: Run** `npm test`, `npx tsc -b`, `npm run build` → PASS.
- [ ] **Step 5: Commit** `feat(brand): apply clinic name, logo, colour and scripture toggle in the shell`

---

### Task 5: Owner Settings page

**Files:**
- Create: `src/features/settings/SettingsPage.tsx`, `src/features/settings/SettingsPage.test.tsx`, `src/features/settings/resizeLogo.ts`, `src/features/settings/resizeLogo.test.ts`
- Modify: `src/App.tsx` (route `settings` in `<OwnerOnly>`), `src/components/AppShell.tsx` (+ test: "Settings" menu item when `canManageClinic`), `src/lib/clinic.ts` + `scripts/migrate-to-clinics.mjs` (add `"settings"` to reserved slugs), `CLAUDE.md`

**Interfaces:**
- Consumes: `useBranding`, `useSaveBranding`, `DEFAULT_BRANDING`, `Branding` (Task 2); `BRAND_PRESETS`, `ensureContrast` (Task 1); `ClinicMark` (Task 4).
- Produces:
  - `resizeLogo(file: File, maxSide = 256): Promise<string>`: rejects with `Error("not-image")` unless `file.type` is `image/png|jpeg|webp`, `Error("too-large")` if `file.size > 5_000_000`; draws to a canvas scaled to fit `maxSide`, exports `image/webp` (falls back to `image/png` if the browser returns a non-webp data URL); rejects `Error("too-large")` if the result exceeds 200000 chars.

- [ ] **Step 1: Failing tests**
  - `resizeLogo`: rejects `not-image` for `text/plain`; rejects `too-large` for a 6 MB file; with mocked `Image`/canvas (`HTMLCanvasElement.prototype.getContext`/`toDataURL` stubs) resolves to the stubbed data URL and sizes the canvas to 256×128 for a 1024×512 image.
  - `SettingsPage` (mock the hooks): fields prefilled from branding; choosing the "Teal" preset updates the preview swatch; a custom colour that needs darkening shows the helper "Adjusted for readability" with the corrected hex; toggling "Show scripture banner"; editing contact fields; Save calls `useSaveBranding` with the full `Branding` and `by` = signed-in email, then toast "Settings saved"; a logo upload error `not-image` → toast "Choose a PNG, JPG or WebP image."; `too-large` → toast "That image is too large."; "Remove logo" sets `logoDataUrl` to `""`; displayName over 60 chars shows "Keep the name under 60 characters." and disables Save.
  - `AppShell`: "Settings" item visible only for owners/superadmin in a clinic.
- [ ] **Step 2: Run** `npm test -- resizeLogo SettingsPage AppShell` → FAIL.
- [ ] **Step 3: Implement.** Sections: Clinic name; Logo (preview via `ClinicMark`, Upload, Remove); Colour (8 preset swatches + `<input type="color">`, preview of a primary button and the sidebar tile using the effective colour); Scripture banner switch; Contact details (6 text fields, "Stored for future printing" caption); sticky Save. Page title "Settings". Saving updates the shell immediately (via `setQueryData`).
- [ ] **Step 4: Update CLAUDE.md**: project name HomoeoDesk; routes (`/:clinicSlug/settings` owner-only); data model (`settings/branding` fields, rules validation); theming note (accent `TOKENS` are CSS variables set per clinic by `BrandScope`; use `TOKENS`/`GRADIENT`, never raw accent hex); `npm run icons`.
- [ ] **Step 5: Run** `npm test`, `npx tsc -b`, `npm run lint`, `npm run build` → PASS.
- [ ] **Step 6: Commit** `feat(settings): owner page for clinic branding and contact details`
