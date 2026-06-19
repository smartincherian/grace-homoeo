# UI Polish — "Stained Glass" theme & screen refinement

**Date:** 2026-06-19
**Branch:** `rebuild`
**Status:** Design — approved, pending spec review

## Problem

All three feature modules (Patients/Consultations, Inventory, Funds) are functionally
built but the UI is plain and has usability gaps the doctor noticed in daily use:

1. **No back button** — detail and form sub-pages offer no app-level way back; users
   rely on the bottom nav or a "Cancel" button.
2. **Plain UI** — bare MUI `List`/`ListItemButton` rows, a dense generic app bar, grey
   text empty states. Nothing distinctive.
3. **CRUD not visible** — delete is unreachable. `useDeleteItem` (inventory) and
   `useDeleteExpense` (expenses) already exist in the codebase but **no screen wires
   them up**. Edit is only reachable by tapping into a detail page.
4. **Add button unclear** — a bare `+` FAB with no label.

## Goals

- Apply a single, distinctive-but-subtle **Christian mandala / zentangle** visual theme
  ("Stained Glass", chosen from three mockups) across **every** screen including login.
- Add a contextual **back button** on all non-root routes.
- Make **CRUD actions visible**: clear Edit, and wire **Delete** for the two safe
  entities (inventory items, expenses) behind a confirmation dialog.
- Replace the bare FAB with a **clearly labeled** add button.

## Non-goals (scope guardrails)

- No data-model changes, no new Firestore collections, no rule changes.
- No delete for **patients or consultations** (protects clinical history; no backend
  exists for it and none will be added).
- No routing changes beyond app-bar chrome (title + back affordance).
- No unrelated refactoring.

## Chosen direction — Theme B "Stained Glass"

Crisp white background; a jewel-tone gradient app bar
(`radial-gradient(... #2563B6 → #15307A → #101C57)`) carrying a faint geometric
zentangle rose-window watermark; white list cards with a soft shadow and a colored left
edge cycling through a jewel accent set; Inter typography. The mandala art is always
**subtle** — it sits behind UI and never competes with content.

### Accent palette (added to theme)
- Sapphire `#2E73D6`, Teal `#16A39B`, Rose `#C0496B`, Violet `#7A52C7`
- Primary indigo `#150E56` (unchanged), secondary `#0EA5E9` (unchanged)

## Architecture & components

Most polish is centralized in the theme and a few shared components, so individual
screens change little. Features still import only shared modules — no cross-feature imports.

### Theme (`src/theme/theme.ts`)
- Extend palette with the jewel accent set (exposed for card edges / stat cards).
- `shape.borderRadius: 14`; define a soft default shadow `0 4px 14px rgba(30,50,120,.07)`.
- Tighten typography scale/weights (h5/h6 → 700; uppercase letter-spaced label variant).
- `components` overrides so every screen inherits polish for free:
  - `MuiAppBar` — jewel gradient background.
  - `MuiCard` / `MuiPaper` — soft shadow, rounded.
  - `MuiListItemButton` — hover lift / background.
  - `MuiFab` — extended-variant friendly sizing.
- Add the Google Fonts `<link>` (Inter) to `index.html` if not already present.

### `src/components/Mandala.tsx` (new)
Reusable SVG component rendering the zentangle rose-window (8-fold petals + 16 rays +
concentric rings) at a caller-controlled `size`, `color`, and `opacity`. Used in the app
bar watermark, the sidebar/login header, and empty states. Pure presentational, no deps.

### `src/components/PageHeader.tsx` (new)
Screen title (+ optional right-aligned action slot). Consistent spacing/typography.

### `src/components/ListCard.tsx` (new)
The themed list row: avatar/initials tile, primary + secondary text, optional trailing
slot (chip, qty stepper, amount, or `⋮` menu), optional colored left edge, hover state.
`onClick` opens the row's primary action. Replaces bare `List`/`ListItemButton` on every
list screen. Built so each list passes content via props/slots — no list-specific logic
inside.

### `src/components/AddButton.tsx` (new)
A **labeled extended FAB** (icon + text, e.g. "Add patient"). Fixed bottom-right, clear
of the mobile bottom nav (`bottom: { xs: 72, md: 24 }`). Props: `label`, `to`.

### `src/components/ConfirmDialog.tsx` (new)
Reusable destructive-confirm dialog: `title`, `message`, `confirmLabel`, `onConfirm`,
`open`, `onClose`. Used by inventory & expense delete.

### `src/components/RowMenu.tsx` (new)
A `⋮` `IconButton` + MUI `Menu` exposing Edit / Delete items. Generic — caller supplies
`onEdit` and optional `onDelete`. Used in `ListCard` trailing slots.

### `QueryStates.tsx` (upgrade)
Empty state renders a faint `Mandala` + friendly message instead of plain grey text.
Loading/error states restyled to match. Existing props unchanged (back-compatible).

### `AppShell.tsx` (upgrade)
- App bar: gradient + corner `Mandala` watermark; **contextual title**.
- **Back button**: on any non-root route, render a leading `ArrowBack` `IconButton`
  wired to `navigate(-1)`; hidden on the three root tabs (`/patients`, `/inventory`,
  `/funds`).
- Title + back state derived from a small **`usePageChrome`** context: a provider in the
  shell holds `{ title, showBack }`; pages set their title via a `useSetPageTitle(title)`
  hook in an effect. Root tabs default to their nav label; deeper routes set their own
  (e.g. patient name, "Add patient"). Default `showBack = pathname` is not a root tab.
- Sidebar (desktop) + bottom nav (mobile) restyled with selected/hover states; sidebar
  header shows brand + small mandala.

## Per-screen changes

| Screen | Changes |
|---|---|
| `LoginPage` | Themed: gradient/mandala header panel, centered card, polished fields. |
| `PatientListPage` | `PageHeader` + `ListCard` (initials avatar, `#serial` chip) + labeled `AddButton`. Search field restyled. |
| `PatientDetailPage` | Polished header card; **Edit** clearly visible; restyled consultation timeline; sets page title to patient name. |
| `PatientFormPage` | Card-wrapped layout, clearer Save/Cancel; sets title "Add/Edit patient". |
| `InventoryListPage` | `ListCard` with qty stepper retained + **`⋮` menu → Edit/Delete**; delete via `useDeleteItem` behind `ConfirmDialog` + success toast. Low-stock chip kept. |
| `InventoryFormPage` | Card-wrapped layout, clearer actions. |
| `FundsPage` | Stat cards restyled with accent palette; expense rows as `ListCard` with amount + **`⋮` menu → Edit/Delete** via `useDeleteExpense` behind `ConfirmDialog`. Income-by-mode chips restyled. |
| `ExpenseFormPage` | Card-wrapped layout, clearer actions. |
| `ConsultationFormPage` | Card-wrapped layout, clearer actions. |
| `ConsultationTimeline` | Restyled entries to match cards; Edit affordance clear (no delete). |

## CRUD / delete behavior

- Inventory & expense `ListCard` rows get a trailing `⋮` `RowMenu` with **Edit** and
  **Delete**. Tapping the row body still navigates to Edit (primary path).
- **Delete** → `ConfirmDialog` ("Delete <name>? This cannot be undone.") → on confirm call
  the existing hook (`useDeleteItem` / `useDeleteExpense`) → success/error toast via
  `useToast`. Query invalidation already handled by the hooks.
- Patients & consultations: **no delete**; Edit only.

## Error handling

- All mutations surface failures through `useToast` (`"...could not ... try again."`),
  matching the existing pattern; no `alert()`.
- Delete confirm is mandatory before any destructive call.

## Testing (TDD, Firestore mocked — `npm test` green in clean checkout)

- `AppShell.test.tsx` — back button shows on sub-routes, hidden on root tabs; `navigate(-1)`
  called on click; contextual title renders.
- `QueryStates.test.tsx` — updated for new empty-state markup (assert message still present).
- `PatientListPage.test.tsx` / `InventoryListPage.test.tsx` / Funds — labeled add button
  present; `ListCard` rows render expected content.
- New: `ConfirmDialog`, `RowMenu` unit tests; inventory & expense delete flow tests
  (open menu → Delete → confirm → hook called → toast). Mock the delete hooks.
- Keep all existing passing tests green; adjust selectors where markup changed.

## Rollout

Single feature branch off `rebuild`. Build incrementally: theme + shared components
first (with tests), then screen-by-screen adoption, then delete wiring. `npm run build`,
`npm test`, and `npm run lint` must pass before completion.
