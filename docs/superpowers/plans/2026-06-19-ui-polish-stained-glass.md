# UI Polish — "Stained Glass" Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a subtle Christian-mandala "Stained Glass" theme across every screen, add a contextual back button, replace bare `+` FABs with labeled add buttons, and make Edit/Delete CRUD visible (delete wired for inventory items and expenses only).

**Architecture:** Centralize the look in `theme.ts` + a handful of new shared presentational components (`Mandala`, `PageHeader`, `AddButton`, `ListCard`, `RowMenu`, `ConfirmDialog`, `PageChrome`). Screens then adopt these components, so per-screen code stays small and DRY. The back button and contextual app-bar title come from a small React context (`PageChrome`) that pages feed via `useSetPageTitle`.

**Tech Stack:** Vite + React + TypeScript + MUI v6 (`sx` prop) + react-router v6 + TanStack Query + Vitest/RTL. Firestore is mocked in tests.

## Global Constraints

- MUI v6, styled with the `sx` prop only — no styled-components, no CSS files. (Verbatim from spec/CLAUDE.md.)
- Money displayed with `₹`; dates are epoch-ms numbers.
- Features must not import each other's internals — only shared modules (`src/components`, `src/lib`, `src/theme`).
- Global feedback via `useToast` — never `alert()`.
- All list views render via `QueryStates`.
- `npm test`, `npm run build`, `npm run lint` must pass in a clean checkout. Firestore stays mocked in unit tests.
- **No** data-model, Firestore-rule, or routing changes (app-bar chrome only).
- **No** delete for patients or consultations — edit only.
- Primary indigo `#150E56` unchanged. Jewel accents: Sapphire `#2E73D6`, Teal `#16A39B`, Rose `#C0496B`, Violet `#7A52C7`.

---

### Task 1: Theme foundation + fonts

**Files:**
- Modify: `src/theme/theme.ts`
- Modify: `index.html`

**Interfaces:**
- Produces: `theme` (unchanged export name); new export `JEWEL_ACCENTS: readonly string[]`; new export `accentFor(index: number): string`.

- [ ] **Step 1: Add the Inter font link to `index.html`**

In `<head>`, above the existing `<title>` (or near other links), add:

```html
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Rewrite `src/theme/theme.ts`**

```ts
import { createTheme } from "@mui/material/styles";

// Jewel accent set used for list-card left edges and Funds stat cards.
export const JEWEL_ACCENTS = ["#2E73D6", "#16A39B", "#C0496B", "#7A52C7"] as const;
export const accentFor = (index: number): string =>
  JEWEL_ACCENTS[((index % JEWEL_ACCENTS.length) + JEWEL_ACCENTS.length) % JEWEL_ACCENTS.length];

const APPBAR_GRADIENT =
  "radial-gradient(120% 140% at 80% -20%, #2563B6 0%, #15307A 55%, #101C57 100%)";
const SOFT_SHADOW = "0 4px 14px rgba(30,50,120,0.07)";

export const theme = createTheme({
  palette: {
    primary: { main: "#150E56" },
    secondary: { main: "#0EA5E9" },
    success: { main: "#16A34A" },
    error: { main: "#C0496B" },
    background: { default: "#F4F6FB" },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: "'Inter','Roboto','Helvetica','Arial',sans-serif",
    h5: { fontWeight: 700, letterSpacing: 0.2 },
    h6: { fontWeight: 700 },
    overline: { fontWeight: 700, letterSpacing: 1.4 },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundImage: APPBAR_GRADIENT, boxShadow: "0 2px 12px rgba(16,28,87,0.25)" },
      },
    },
    MuiCard: { defaultProps: { elevation: 0 }, styleOverrides: { root: { boxShadow: SOFT_SHADOW } } },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 14 } } },
    MuiListItemButton: {
      styleOverrides: { root: { borderRadius: 12, "&:hover": { backgroundColor: "rgba(46,115,214,0.06)" } } },
    },
  },
});
```

- [ ] **Step 3: Verify build & existing tests still pass**

Run: `npm run build && npm test`
Expected: build succeeds; all existing tests PASS (theme is a superset — no behavior removed).

- [ ] **Step 4: Commit**

```bash
git add src/theme/theme.ts index.html
git commit -m "feat(theme): stained-glass palette, jewel accents, soft shadows, Inter font"
```

---

### Task 2: Mandala component

**Files:**
- Create: `src/components/Mandala.tsx`
- Test: `src/components/Mandala.test.tsx`

**Interfaces:**
- Produces: `default function Mandala(props: { size?: number; color?: string; opacity?: number; sx?: SxProps<Theme> }): JSX.Element` — a decorative SVG rose-window (role `presentation`, `aria-hidden`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/Mandala.test.tsx
import { render } from "@testing-library/react";
import Mandala from "./Mandala";

test("renders a decorative svg that is hidden from assistive tech", () => {
  const { container } = render(<Mandala size={120} />);
  const svg = container.querySelector("svg");
  expect(svg).not.toBeNull();
  expect(svg).toHaveAttribute("aria-hidden", "true");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Mandala`
Expected: FAIL — cannot resolve `./Mandala`.

- [ ] **Step 3: Implement `src/components/Mandala.tsx`**

```tsx
import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

interface Props {
  size?: number;
  color?: string;
  opacity?: number;
  sx?: SxProps<Theme>;
}

const RAYS = Array.from({ length: 16 }, (_, i) => i * 22.5);
const PETALS = Array.from({ length: 8 }, (_, i) => i * 45);

export default function Mandala({ size = 160, color = "currentColor", opacity = 0.2, sx }: Props) {
  return (
    <Box
      component="svg"
      aria-hidden="true"
      role="presentation"
      viewBox="0 0 200 200"
      sx={{ width: size, height: size, color, opacity, pointerEvents: "none", ...sx }}
    >
      <g fill="none" stroke="currentColor" strokeWidth={1.4}>
        <circle cx={100} cy={100} r={94} />
        <circle cx={100} cy={100} r={70} />
        <circle cx={100} cy={100} r={46} />
        {RAYS.map((a) => (
          <line key={a} x1={100} y1={30} x2={100} y2={54} transform={`rotate(${a} 100 100)`} />
        ))}
        {PETALS.map((a) => (
          <path
            key={a}
            d="M100 54 C120 70 120 100 100 100 C80 100 80 70 100 54 Z"
            transform={`rotate(${a} 100 100)`}
          />
        ))}
      </g>
      <g stroke="currentColor" strokeWidth={3} strokeLinecap="round">
        <line x1={100} y1={88} x2={100} y2={112} />
        <line x1={88} y1={100} x2={112} y2={100} />
      </g>
    </Box>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Mandala`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Mandala.tsx src/components/Mandala.test.tsx
git commit -m "feat(ui): add decorative Mandala SVG component"
```

---

### Task 3: PageHeader + AddButton components

**Files:**
- Create: `src/components/PageHeader.tsx`
- Create: `src/components/AddButton.tsx`
- Test: `src/components/AddButton.test.tsx`

**Interfaces:**
- Produces: `PageHeader(props: { title: string; action?: ReactNode })`.
- Produces: `AddButton(props: { label: string; to: string })` — an extended FAB linking to `to`, fixed bottom-right, clear of the mobile bottom nav.

- [ ] **Step 1: Write the failing test for AddButton**

```tsx
// src/components/AddButton.test.tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AddButton from "./AddButton";

test("renders a labeled link to the target route", () => {
  render(
    <MemoryRouter>
      <AddButton label="Add patient" to="/patients/new" />
    </MemoryRouter>,
  );
  const link = screen.getByRole("link", { name: /add patient/i });
  expect(link).toHaveAttribute("href", "/patients/new");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- AddButton`
Expected: FAIL — cannot resolve `./AddButton`.

- [ ] **Step 3: Implement `src/components/AddButton.tsx`**

```tsx
import { Fab } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { Link } from "react-router-dom";

export default function AddButton({ label, to }: { label: string; to: string }) {
  return (
    <Fab
      variant="extended"
      color="primary"
      component={Link}
      to={to}
      aria-label={label}
      sx={{ position: "fixed", bottom: { xs: 72, md: 24 }, right: 24, fontWeight: 700 }}
    >
      <AddIcon sx={{ mr: 1 }} />
      {label}
    </Fab>
  );
}
```

- [ ] **Step 4: Implement `src/components/PageHeader.tsx`**

```tsx
import { Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

export default function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
      <Typography variant="h5">{title}</Typography>
      {action}
    </Stack>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- AddButton`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/AddButton.tsx src/components/AddButton.test.tsx src/components/PageHeader.tsx
git commit -m "feat(ui): add PageHeader and labeled AddButton (extended FAB)"
```

---

### Task 4: ListCard, RowMenu, ConfirmDialog

**Files:**
- Create: `src/components/ListCard.tsx`
- Create: `src/components/RowMenu.tsx`
- Create: `src/components/ConfirmDialog.tsx`
- Test: `src/components/RowMenu.test.tsx`
- Test: `src/components/ConfirmDialog.test.tsx`

**Interfaces:**
- Produces: `ListCard(props: { avatar?: ReactNode; edgeColor?: string; primary: ReactNode; secondary?: ReactNode; trailing?: ReactNode; menu?: ReactNode; onClick?: () => void })`.
- Produces: `RowMenu(props: { label: string; onEdit: () => void; onDelete?: () => void })` — a `⋮` IconButton opening a Menu with Edit and (optional) Delete; stops click propagation so the row's `onClick` does not fire.
- Produces: `ConfirmDialog(props: { open: boolean; title: string; message: string; confirmLabel?: string; onConfirm: () => void; onClose: () => void })`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/RowMenu.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RowMenu from "./RowMenu";

test("opens menu and fires edit/delete without triggering row click", async () => {
  const user = userEvent.setup();
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const onRowClick = vi.fn();
  render(
    <div onClick={onRowClick}>
      <RowMenu label="Arnica" onEdit={onEdit} onDelete={onDelete} />
    </div>,
  );
  await user.click(screen.getByRole("button", { name: /actions for arnica/i }));
  await user.click(screen.getByRole("menuitem", { name: /delete/i }));
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(onRowClick).not.toHaveBeenCalled();
});
```

```tsx
// src/components/ConfirmDialog.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmDialog from "./ConfirmDialog";

test("confirm fires onConfirm; cancel fires onClose", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <ConfirmDialog open title="Delete item?" message="Cannot be undone." onConfirm={onConfirm} onClose={onClose} />,
  );
  await user.click(screen.getByRole("button", { name: /delete/i }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- RowMenu ConfirmDialog`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/components/RowMenu.tsx`**

```tsx
import { useState, type MouseEvent } from "react";
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

interface Props {
  label: string;
  onEdit: () => void;
  onDelete?: () => void;
}

export default function RowMenu({ label, onEdit, onDelete }: Props) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };
  const close = (e?: MouseEvent<HTMLElement>) => {
    e?.stopPropagation();
    setAnchorEl(null);
  };
  const run = (fn: () => void) => (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchorEl(null);
    fn();
  };
  return (
    <>
      <IconButton aria-label={`Actions for ${label}`} size="small" onClick={open}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={close}>
        <MenuItem onClick={run(onEdit)}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        {onDelete && (
          <MenuItem onClick={run(onDelete)} sx={{ color: "error.main" }}>
            <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
```

- [ ] **Step 4: Implement `src/components/ConfirmDialog.tsx`**

```tsx
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({ open, title, message, confirmLabel = "Delete", onConfirm, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="error" variant="contained" onClick={onConfirm}>{confirmLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 5: Implement `src/components/ListCard.tsx`**

```tsx
import { Box, Card, CardActionArea, Stack } from "@mui/material";
import type { ReactNode } from "react";

interface Props {
  avatar?: ReactNode;
  edgeColor?: string;
  primary: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
  menu?: ReactNode;
  onClick?: () => void;
}

export default function ListCard({ avatar, edgeColor, primary, secondary, trailing, menu, onClick }: Props) {
  const inner = (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 1.5, py: 1.25, width: "100%" }}>
      {avatar}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {primary}
        </Box>
        {secondary && <Box sx={{ color: "text.secondary", fontSize: 13, mt: 0.25 }}>{secondary}</Box>}
      </Box>
      {trailing}
      {menu}
    </Stack>
  );
  return (
    <Card sx={{ mb: 1, borderLeft: edgeColor ? `3px solid ${edgeColor}` : undefined, overflow: "hidden" }}>
      {onClick ? <CardActionArea onClick={onClick}>{inner}</CardActionArea> : inner}
    </Card>
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- RowMenu ConfirmDialog`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/ListCard.tsx src/components/RowMenu.tsx src/components/ConfirmDialog.tsx src/components/RowMenu.test.tsx src/components/ConfirmDialog.test.tsx
git commit -m "feat(ui): add ListCard, RowMenu (overflow), and ConfirmDialog"
```

---

### Task 5: PageChrome context (contextual title)

**Files:**
- Create: `src/components/PageChrome.tsx`
- Test: `src/components/PageChrome.test.tsx`

**Interfaces:**
- Produces: `PageChromeProvider(props: { children: ReactNode })`; `usePageTitle(): string`; `useSetPageTitle(title: string): void`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/PageChrome.test.tsx
import { render, screen } from "@testing-library/react";
import { PageChromeProvider, usePageTitle, useSetPageTitle } from "./PageChrome";

function Setter() {
  useSetPageTitle("Anjali Menon");
  return null;
}
function Display() {
  return <span data-testid="title">{usePageTitle()}</span>;
}

test("a page can set the title and the bar reads it", () => {
  render(
    <PageChromeProvider>
      <Display />
      <Setter />
    </PageChromeProvider>,
  );
  expect(screen.getByTestId("title")).toHaveTextContent("Anjali Menon");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- PageChrome`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/PageChrome.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface Chrome {
  title: string;
  setTitle: (t: string) => void;
}
const PageChromeContext = createContext<Chrome>({ title: "", setTitle: () => {} });

export function PageChromeProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("");
  return <PageChromeContext.Provider value={{ title, setTitle }}>{children}</PageChromeContext.Provider>;
}

export function usePageTitle(): string {
  return useContext(PageChromeContext).title;
}

export function useSetPageTitle(title: string): void {
  const { setTitle } = useContext(PageChromeContext);
  useEffect(() => {
    setTitle(title);
  }, [title, setTitle]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- PageChrome`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PageChrome.tsx src/components/PageChrome.test.tsx
git commit -m "feat(ui): add PageChrome context for contextual app-bar title"
```

---

### Task 6: AppShell — back button + contextual title + themed nav

**Files:**
- Modify: `src/components/AppShell.tsx`
- Modify: `src/components/AppShell.test.tsx`

**Interfaces:**
- Consumes: `PageChromeProvider`, `usePageTitle` (Task 5); `Mandala` (Task 2).
- Produces: app bar showing a back button (`navigate(-1)`) on non-root routes and a contextual title; brand+mandala header in the sidebar.

- [ ] **Step 1: Add failing tests to `src/components/AppShell.test.tsx`**

Append:

```tsx
import { useSetPageTitle } from "./PageChrome";

function TitleSetter() {
  useSetPageTitle("Patient details");
  return <div>page body</div>;
}

test("shows a back button on a non-root route and navigates back on click", async () => {
  const user = userEvent.setup();
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={["/patients", "/patients/p1"]} initialIndex={1}>
        <AppShell><TitleSetter /></AppShell>
      </MemoryRouter>
    </ThemeProvider>,
  );
  const back = screen.getByRole("button", { name: /back/i });
  expect(back).toBeInTheDocument();
  await user.click(back);
});

test("hides the back button on a root tab", () => {
  render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={["/patients"]}>
        <AppShell><div /></AppShell>
      </MemoryRouter>
    </ThemeProvider>,
  );
  expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test -- AppShell`
Expected: FAIL — no button named "back".

- [ ] **Step 3: Rewrite `src/components/AppShell.tsx`**

```tsx
import { useState, type MouseEvent, type ReactNode } from "react";
import {
  AppBar, Box, BottomNavigation, BottomNavigationAction, Drawer,
  IconButton, List, ListItemButton, ListItemIcon, ListItemText,
  Menu, MenuItem, ListItemText as MenuItemText,
  Stack, Toolbar, Typography,
  useMediaQuery, useTheme,
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import PaidIcon from "@mui/icons-material/Paid";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../features/auth/useAuth";
import { PageChromeProvider, usePageTitle } from "./PageChrome";
import Mandala from "./Mandala";

const NAV = [
  { to: "/patients", label: "Patients", icon: <PeopleIcon /> },
  { to: "/inventory", label: "Inventory", icon: <Inventory2Icon /> },
  { to: "/funds", label: "Funds", icon: <PaidIcon /> },
];
const DRAWER_WIDTH = 240;

function ShellInner({ children }: { children?: ReactNode }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const { pathname } = useLocation();
  const current = NAV.find((n) => pathname.startsWith(n.to))?.to ?? "/patients";
  const isRoot = NAV.some((n) => n.to === pathname);
  const navigate = useNavigate();
  const { user } = useAuth();
  const pageTitle = usePageTitle();
  const navLabel = NAV.find((n) => n.to === current)?.label;
  const title = pageTitle || navLabel || "Grace Homoeo";

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = (e: MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const closeMenu = () => setAnchorEl(null);
  const handleSignOut = async () => {
    closeMenu();
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1, overflow: "hidden" }}>
        <Mandala
          size={120}
          color="#7FB4FF"
          opacity={0.18}
          sx={{ position: "absolute", top: -36, right: -24, zIndex: 0 }}
        />
        <Toolbar variant="dense" sx={{ position: "relative", zIndex: 1 }}>
          {!isRoot && (
            <IconButton color="inherit" aria-label="back" edge="start" onClick={() => navigate(-1)} sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ flexGrow: 1 }} noWrap>{title}</Typography>
          <IconButton color="inherit" aria-label="account" onClick={openMenu}>
            <AccountCircleIcon />
          </IconButton>
          <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={closeMenu}>
            {user?.email && (
              <MenuItem disabled>
                <MenuItemText primary={user.email} />
              </MenuItem>
            )}
            <MenuItem onClick={handleSignOut}>Sign out</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {isDesktop && (
        <Drawer
          variant="permanent"
          sx={{ width: DRAWER_WIDTH, "& .MuiDrawer-paper": { width: DRAWER_WIDTH } }}
        >
          <Toolbar variant="dense" />
          <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 2 }}>
            <Mandala size={28} color="#150E56" opacity={0.9} />
            <Typography sx={{ fontWeight: 700, color: "primary.main" }}>Grace Homoeo</Typography>
          </Stack>
          <List sx={{ px: 1 }}>
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
            <BottomNavigationAction key={n.to} component={Link} to={n.to} value={n.to} label={n.label} icon={n.icon} />
          ))}
        </BottomNavigation>
      )}
    </Box>
  );
}

export default function AppShell({ children }: { children?: ReactNode }) {
  return (
    <PageChromeProvider>
      <ShellInner>{children}</ShellInner>
    </PageChromeProvider>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- AppShell`
Expected: PASS (both new tests and the two existing ones).

- [ ] **Step 5: Commit**

```bash
git add src/components/AppShell.tsx src/components/AppShell.test.tsx
git commit -m "feat(shell): contextual title, back button on sub-routes, themed nav"
```

---

### Task 7: QueryStates polish

**Files:**
- Modify: `src/components/QueryStates.tsx`
- Modify: `src/components/QueryStates.test.tsx` (only if assertions break)

**Interfaces:**
- Consumes: `Mandala` (Task 2). Props unchanged (back-compatible).

- [ ] **Step 1: Update empty state in `src/components/QueryStates.tsx`**

```tsx
import { ReactNode } from "react";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import Mandala from "./Mandala";

interface Props {
  status: "pending" | "error" | "success";
  isEmpty: boolean;
  emptyMessage: string;
  children: ReactNode;
}

export default function QueryStates({ status, isEmpty, emptyMessage, children }: Props) {
  if (status === "pending") {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress /></Box>;
  }
  if (status === "error") {
    return <Typography color="error" sx={{ py: 4, textAlign: "center" }}>Something went wrong. Please try again.</Typography>;
  }
  if (isEmpty) {
    return (
      <Stack alignItems="center" spacing={1.5} sx={{ py: 7 }}>
        <Mandala size={84} color="#150E56" opacity={0.12} />
        <Typography color="text.secondary">{emptyMessage}</Typography>
      </Stack>
    );
  }
  return <>{children}</>;
}
```

- [ ] **Step 2: Run tests**

Run: `npm test -- QueryStates`
Expected: PASS. If the existing empty-state test queried exact markup, it should still find the message text via `getByText`. If it fails, adjust the test to assert `screen.getByText(emptyMessage)` rather than container structure.

- [ ] **Step 3: Commit**

```bash
git add src/components/QueryStates.tsx src/components/QueryStates.test.tsx
git commit -m "feat(ui): friendlier empty state with subtle mandala"
```

---

### Task 8: LoginPage polish

**Files:**
- Modify: `src/features/auth/LoginPage.tsx`

**Interfaces:**
- Consumes: `Mandala` (Task 2). No behavior change (login logic untouched).

- [ ] **Step 1: Rewrite the render of `src/features/auth/LoginPage.tsx`**

Keep all hooks/`submit` logic exactly as-is; replace only the returned JSX:

```tsx
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2,
      background: "radial-gradient(120% 120% at 50% -20%, #15307A 0%, #101C57 45%, #0B1442 100%)" }}>
      <Card sx={{ width: "100%", maxWidth: 380, overflow: "hidden" }}>
        <Box sx={{ position: "relative", bgcolor: "primary.main", color: "#EAF1FF", px: 3, py: 3.5, overflow: "hidden" }}>
          <Mandala size={120} color="#7FB4FF" opacity={0.2} sx={{ position: "absolute", top: -30, right: -20 }} />
          <Typography variant="h5" sx={{ position: "relative", color: "#fff" }}>Grace Homoeo</Typography>
          <Typography variant="body2" sx={{ position: "relative", opacity: 0.8 }}>Clinic sign-in</Typography>
        </Box>
        <CardContent component="form" onSubmit={submit} sx={{ p: 3 }}>
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
```

Add `import Mandala from "../../components/Mandala";` to the imports.

- [ ] **Step 2: Verify build & any existing login test**

Run: `npm run build && npm test -- LoginPage`
Expected: build OK; tests PASS (no login test asserts on layout; the form fields/labels are unchanged).

- [ ] **Step 3: Commit**

```bash
git add src/features/auth/LoginPage.tsx
git commit -m "feat(auth): themed login page with mandala header panel"
```

---

### Task 9: PatientListPage adopts shared components

**Files:**
- Modify: `src/features/patients/PatientListPage.tsx`
- Modify: `src/features/patients/PatientListPage.test.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `AddButton`, `ListCard` (Tasks 3–4), `useSetPageTitle` (Task 5).

- [ ] **Step 1: Add a failing test for the labeled add button**

Append to `PatientListPage.test.tsx`:

```tsx
it("shows a clearly labeled add button", () => {
  renderPage();
  expect(screen.getByRole("link", { name: /add patient/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- PatientListPage`
Expected: FAIL — current FAB has aria-label "Add patient" already? It does (`aria-label="Add patient"`). If this passes pre-change, strengthen it to assert visible text:

```tsx
it("shows a clearly labeled add button", () => {
  renderPage();
  expect(screen.getByRole("link", { name: "Add patient" })).toHaveTextContent("Add patient");
});
```
Expected after strengthening: FAIL (current FAB has no visible text).

- [ ] **Step 3: Rewrite `src/features/patients/PatientListPage.tsx`**

```tsx
// src/features/patients/PatientListPage.tsx
import { useMemo, useState } from "react";
import { Avatar, Box, Chip, TextField } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { usePatients } from "./usePatients";
import QueryStates from "../../components/QueryStates";
import PageHeader from "../../components/PageHeader";
import AddButton from "../../components/AddButton";
import ListCard from "../../components/ListCard";
import { useSetPageTitle } from "../../components/PageChrome";
import { calcAge, formatDate } from "../../lib/dates";

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

export default function PatientListPage() {
  useSetPageTitle("Patients");
  const { status, data } = usePatients();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data ?? [];
    if (!q) return list;
    return list.filter((p) => p.nameLower.includes(q) || p.phone.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <Box sx={{ position: "relative", minHeight: "60vh" }}>
      <PageHeader title="Patients" />
      <TextField
        label="Search by name or phone"
        fullWidth size="small" sx={{ mb: 2 }}
        value={search} onChange={(e) => setSearch(e.target.value)}
      />
      <QueryStates status={status} isEmpty={filtered.length === 0} emptyMessage="No patients yet">
        {filtered.map((p) => (
          <ListCard
            key={p.id}
            onClick={() => navigate(`/patients/${p.id}`)}
            avatar={<Avatar sx={{ bgcolor: "#E8F0FE", color: "#1F5FC0", fontWeight: 700 }}>{initials(p.name)}</Avatar>}
            primary={p.name}
            secondary={
              `${calcAge(p.dob)} yrs` +
              (p.place ? ` · ${p.place}` : "") +
              (p.lastVisitAt ? ` · Last visit ${formatDate(p.lastVisitAt)}` : "")
            }
            trailing={<Chip size="small" label={`#${p.serialNo}`} sx={{ bgcolor: "#EAF1FF", color: "#2E73D6", fontWeight: 600 }} />}
          />
        ))}
      </QueryStates>
      <AddButton label="Add patient" to="/patients/new" />
    </Box>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- PatientListPage`
Expected: PASS (list, filter-by-name, filter-by-phone, labeled add button).

- [ ] **Step 5: Commit**

```bash
git add src/features/patients/PatientListPage.tsx src/features/patients/PatientListPage.test.tsx
git commit -m "feat(patients): polished list with ListCard, avatars, labeled add button"
```

---

### Task 10: PatientDetailPage + ConsultationTimeline polish

**Files:**
- Modify: `src/features/patients/PatientDetailPage.tsx`
- Modify: `src/features/consultations/ConsultationTimeline.tsx`
- Modify: `src/features/patients/PatientDetailPage.test.tsx` (only if assertions break)

**Interfaces:**
- Consumes: `AddButton`, `ListCard`, `useSetPageTitle`.

- [ ] **Step 1: Rewrite `src/features/consultations/ConsultationTimeline.tsx`**

```tsx
// src/features/consultations/ConsultationTimeline.tsx
import { Stack } from "@mui/material";
import ListCard from "../../components/ListCard";
import { accentFor } from "../../theme/theme";
import { formatDate } from "../../lib/dates";
import type { Consultation } from "./consultationSchema";

interface Props {
  consultations: Consultation[];
  onSelect: (id: string) => void;
}

export default function ConsultationTimeline({ consultations, onSelect }: Props) {
  return (
    <Stack>
      {consultations.map((c, i) => (
        <ListCard
          key={c.id}
          edgeColor={accentFor(i)}
          onClick={() => onSelect(c.id)}
          primary={`${formatDate(c.date)} — ${c.complaint || "Consultation"}`}
          secondary={
            <>
              {c.remedy ? `Remedy: ${c.remedy} · ` : ""}
              {`₹${c.amount} · ${c.paymentMode}`}
            </>
          }
        />
      ))}
    </Stack>
  );
}
```

- [ ] **Step 2: Rewrite render of `src/features/patients/PatientDetailPage.tsx`**

Add imports `import { useSetPageTitle } from "../../components/PageChrome";` and `import AddButton from "../../components/AddButton";` (remove the now-unused `Fab` and `AddIcon` imports). Replace the component body so it sets the page title and uses `AddButton`:

```tsx
export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: patient } = usePatient(id);
  const { status, data: consultations } = useConsultations(id);
  useSetPageTitle(patient?.name ?? "Patient");

  if (!patient) {
    return <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>Loading patient…</Typography>;
  }

  return (
    <Box sx={{ position: "relative", minHeight: "60vh", maxWidth: 720, mx: "auto" }}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h5">{patient.name} · #{patient.serialNo}</Typography>
              <Typography color="text.secondary">
                {calcAge(patient.dob)} yrs · {patient.gender}
                {patient.place ? ` · ${patient.place}` : ""}
              </Typography>
              {patient.phone && <Typography color="text.secondary">📞 {patient.phone}</Typography>}
            </Box>
            <Button startIcon={<EditIcon />} variant="outlined" component={Link} to={`/patients/${id}/edit`}>Edit</Button>
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ mb: 1 }}>Consultation history</Typography>
      <Divider sx={{ mb: 1.5 }} />
      <QueryStates status={status} isEmpty={(consultations ?? []).length === 0} emptyMessage="No consultations yet">
        <ConsultationTimeline
          consultations={consultations ?? []}
          onSelect={(cid) => navigate(`/patients/${id}/consultations/${cid}/edit`)}
        />
      </QueryStates>

      <AddButton label="Add consultation" to={`/patients/${id}/consultations/new`} />
    </Box>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `npm test -- PatientDetailPage`
Expected: PASS. If a test asserted on the old timeline `ListItemButton` markup or the bare-FAB aria-label, update it to query by text (consultation date/complaint) or `getByRole("link", { name: /add consultation/i })`.

- [ ] **Step 4: Commit**

```bash
git add src/features/patients/PatientDetailPage.tsx src/features/consultations/ConsultationTimeline.tsx src/features/patients/PatientDetailPage.test.tsx
git commit -m "feat(patients): polished detail header, visible Edit, card timeline, labeled add"
```

---

### Task 11: Form pages — card-wrapped layout + page titles

**Files:**
- Modify: `src/features/patients/PatientFormPage.tsx`
- Modify: `src/features/inventory/InventoryFormPage.tsx`
- Modify: `src/features/consultations/ConsultationFormPage.tsx`
- Modify: `src/features/funds/ExpenseFormPage.tsx`

**Interfaces:**
- Consumes: `useSetPageTitle` (Task 5). MUI `Card`/`CardContent`. No logic change to any form.

For each file: wrap the existing form content in a `Card`/`CardContent`, and set the page title. Do not touch validation, hooks, or submit handlers.

- [ ] **Step 1: PatientFormPage — set title and wrap**

Add imports: `import { Card, CardContent } from "@mui/material";` (merge into existing MUI import line) and `import { useSetPageTitle } from "../../components/PageChrome";`. Inside the component, after `const isEdit = !!id;`, add:

```tsx
  useSetPageTitle(isEdit ? "Edit patient" : "Add patient");
```

Change the outer container and wrap the `<Stack>` in a card. Replace the opening `<Box component="form" ...>` … `<Typography variant="h5" ...>` with:

```tsx
    <Box component="form" noValidate onSubmit={onSubmit} sx={{ maxWidth: 480, mx: "auto" }}>
      <Card>
        <CardContent>
          <Typography variant="h5" sx={{ mb: 3 }}>{isEdit ? "Edit patient" : "Add patient"}</Typography>
          <Stack spacing={2}>
```

and add the matching closing tags `</Stack></CardContent></Card></Box>` at the end (replacing the previous `</Stack></Box>`). The `<Stack direction="row" ... justifyContent="flex-end">` action row stays inside.

- [ ] **Step 2: InventoryFormPage — set title and wrap**

Open the file, identify its title string (`"Add item"`/`"Edit item"`). Add `useSetPageTitle(isEdit ? "Edit item" : "Add item");` near the top of the component, import `Card, CardContent` and `useSetPageTitle`, and wrap the form `<Stack>`/content in `<Card><CardContent> … </CardContent></Card>` exactly as in Step 1.

- [ ] **Step 3: ConsultationFormPage — set title and wrap**

Same pattern: `useSetPageTitle(isEdit ? "Edit consultation" : "Add consultation");`, import `Card, CardContent` + `useSetPageTitle`, wrap content in a card.

- [ ] **Step 4: ExpenseFormPage — set title and wrap**

Same pattern: `useSetPageTitle(isEdit ? "Edit expense" : "Add expense");`, import `Card, CardContent` + `useSetPageTitle`, wrap content in a card.

- [ ] **Step 5: Verify build & form tests**

Run: `npm run build && npm test -- FormPage`
Expected: build OK; all form tests PASS (logic unchanged; labels/fields intact).

- [ ] **Step 6: Commit**

```bash
git add src/features/patients/PatientFormPage.tsx src/features/inventory/InventoryFormPage.tsx src/features/consultations/ConsultationFormPage.tsx src/features/funds/ExpenseFormPage.tsx
git commit -m "feat(forms): card-wrapped layout and contextual titles across all forms"
```

---

### Task 12: InventoryListPage — ListCard + visible delete

**Files:**
- Modify: `src/features/inventory/InventoryListPage.tsx`
- Create: `src/features/inventory/InventoryListPage.test.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `AddButton`, `ListCard`, `RowMenu`, `ConfirmDialog`, `useSetPageTitle`; `useInventory`, `useSetQuantity`, `useDeleteItem` (existing).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/inventory/InventoryListPage.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const data = [
  { id: "i1", name: "Arnica 30", nameLower: "arnica 30", quantity: 12, unit: "vials", reorderLevel: 3, notes: "", updatedAt: 1 },
];
const deleteMutate = vi.fn();
vi.mock("./useInventory", () => ({
  useInventory: () => ({ status: "success", data }),
  useSetQuantity: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteItem: () => ({ mutate: deleteMutate, isPending: false }),
}));
vi.mock("../../components/useToast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import InventoryListPage from "./InventoryListPage";

const renderPage = () => render(<MemoryRouter><InventoryListPage /></MemoryRouter>);

test("shows a labeled add button", () => {
  renderPage();
  expect(screen.getByRole("link", { name: "Add item" })).toHaveTextContent("Add item");
});

test("deletes an item after confirmation", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(screen.getByRole("button", { name: /actions for arnica 30/i }));
  await user.click(screen.getByRole("menuitem", { name: /delete/i }));
  await user.click(screen.getByRole("button", { name: /^delete$/i }));
  expect(deleteMutate).toHaveBeenCalledWith("i1", expect.anything());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- InventoryListPage`
Expected: FAIL — no actions/menu yet; no labeled add link text.

- [ ] **Step 3: Rewrite `src/features/inventory/InventoryListPage.tsx`**

```tsx
import { useMemo, useState } from "react";
import { Avatar, Box, Chip, IconButton, Stack, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { useNavigate } from "react-router-dom";
import { useInventory, useSetQuantity, useDeleteItem } from "./useInventory";
import { isLowStock, type InventoryItem } from "./inventorySchema";
import QueryStates from "../../components/QueryStates";
import PageHeader from "../../components/PageHeader";
import AddButton from "../../components/AddButton";
import ListCard from "../../components/ListCard";
import RowMenu from "../../components/RowMenu";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useSetPageTitle } from "../../components/PageChrome";
import { useToast } from "../../components/useToast";

export default function InventoryListPage() {
  useSetPageTitle("Inventory");
  const { status, data } = useInventory();
  const setQuantity = useSetQuantity();
  const deleteItem = useDeleteItem();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [toDelete, setToDelete] = useState<InventoryItem | null>(null);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data ?? [];
    if (!q) return list;
    return list.filter((i) => i.nameLower.includes(q));
  }, [data, search]);

  const adjust = (item: InventoryItem, delta: number) => {
    const quantity = Math.max(0, item.quantity + delta);
    if (quantity === item.quantity) return;
    setQuantity.mutate(
      { id: item.id, quantity },
      { onError: () => showToast("Could not update quantity. Please try again.", "error") },
    );
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    const item = toDelete;
    setToDelete(null);
    deleteItem.mutate(item.id, {
      onSuccess: () => showToast("Item deleted", "success"),
      onError: () => showToast("Could not delete item. Please try again.", "error"),
    });
  };

  return (
    <Box sx={{ position: "relative", minHeight: "60vh" }}>
      <PageHeader title="Inventory" />
      <TextField
        label="Search by name"
        fullWidth size="small" sx={{ mb: 2 }}
        value={search} onChange={(e) => setSearch(e.target.value)}
      />
      <QueryStates status={status} isEmpty={filtered.length === 0} emptyMessage="No items yet">
        {filtered.map((i) => (
          <ListCard
            key={i.id}
            onClick={() => navigate(`/inventory/${i.id}/edit`)}
            avatar={<Avatar sx={{ bgcolor: "#E6F7F3", color: "#0F8C7E", fontWeight: 700 }}>{i.name[0]?.toUpperCase()}</Avatar>}
            primary={
              <Stack direction="row" spacing={1} alignItems="center" component="span">
                <span>{i.name}</span>
                {isLowStock(i) && <Chip label="Low stock" color="warning" size="small" />}
              </Stack>
            }
            secondary={`${i.quantity}${i.unit ? ` ${i.unit}` : ""} in stock`}
            trailing={
              <Stack direction="row" alignItems="center" spacing={0.5} onClick={(e) => e.stopPropagation()}>
                <IconButton aria-label={`Decrease ${i.name}`} size="small"
                  disabled={i.quantity === 0 || setQuantity.isPending}
                  onClick={() => adjust(i, -1)}>
                  <RemoveIcon fontSize="small" />
                </IconButton>
                <Typography component="span" sx={{ minWidth: 24, textAlign: "center" }}>{i.quantity}</Typography>
                <IconButton aria-label={`Increase ${i.name}`} size="small"
                  disabled={setQuantity.isPending}
                  onClick={() => adjust(i, 1)}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </Stack>
            }
            menu={<RowMenu label={i.name} onEdit={() => navigate(`/inventory/${i.id}/edit`)} onDelete={() => setToDelete(i)} />}
          />
        ))}
      </QueryStates>
      <AddButton label="Add item" to="/inventory/new" />
      <ConfirmDialog
        open={!!toDelete}
        title="Delete item?"
        message={toDelete ? `Delete "${toDelete.name}"? This cannot be undone.` : ""}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </Box>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- InventoryListPage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/inventory/InventoryListPage.tsx src/features/inventory/InventoryListPage.test.tsx
git commit -m "feat(inventory): ListCard rows, qty steppers, overflow menu with confirm-delete"
```

---

### Task 13: FundsPage — polished stat cards + expense delete

**Files:**
- Modify: `src/features/funds/FundsPage.tsx`
- Create: `src/features/funds/FundsPage.test.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `AddButton`, `ListCard`, `RowMenu`, `ConfirmDialog`, `useSetPageTitle`, `accentFor`; `useIncome`, `useExpenses`, `useDeleteExpense` (existing).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/funds/FundsPage.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const expenses = [{ id: "e1", date: 1718000000000, category: "Rent", amount: 5000, note: "" }];
const deleteMutate = vi.fn();
vi.mock("./useFunds", () => ({
  useIncome: () => ({ data: [], status: "success", isPending: false, isError: false }),
  useExpenses: () => ({ data: expenses, status: "success", isPending: false, isError: false }),
  useDeleteExpense: () => ({ mutate: deleteMutate, isPending: false }),
}));
vi.mock("../../components/useToast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import FundsPage from "./FundsPage";

const renderPage = () => render(<MemoryRouter><FundsPage /></MemoryRouter>);

test("shows a labeled add button", () => {
  renderPage();
  expect(screen.getByRole("link", { name: "Add expense" })).toHaveTextContent("Add expense");
});

test("deletes an expense after confirmation", async () => {
  const user = userEvent.setup();
  renderPage();
  await user.click(screen.getByRole("button", { name: /actions for rent/i }));
  await user.click(screen.getByRole("menuitem", { name: /delete/i }));
  await user.click(screen.getByRole("button", { name: /^delete$/i }));
  expect(deleteMutate).toHaveBeenCalledWith("e1", expect.anything());
});
```

> Note: `useToast` is currently not imported in `FundsPage.tsx`; Task 13 adds it (delete needs toast feedback). The test mocks it accordingly.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- FundsPage`
Expected: FAIL — no add link text / no row actions yet.

- [ ] **Step 3: Rewrite `src/features/funds/FundsPage.tsx`**

```tsx
import { useMemo, useState } from "react";
import { Box, Card, CardContent, Chip, Divider, Stack, TextField, Typography } from "@mui/material";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { useIncome, useExpenses, useDeleteExpense } from "./useFunds";
import { summarizePeriod } from "./fundsSchema";
import type { Expense } from "./fundsSchema";
import { formatDate, msToDateInput, dateInputToMs } from "../../lib/dates";
import QueryStates from "../../components/QueryStates";
import PageHeader from "../../components/PageHeader";
import AddButton from "../../components/AddButton";
import ListCard from "../../components/ListCard";
import RowMenu from "../../components/RowMenu";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useSetPageTitle } from "../../components/PageChrome";
import { useToast } from "../../components/useToast";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function StatCard({ label, value, color, edge }: { label: string; value: string; color?: string; edge: string }) {
  return (
    <Card sx={{ flex: 1, minWidth: 0, borderLeft: `3px solid ${edge}` }}>
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h6" sx={{ color, fontWeight: 700 }} noWrap>{value}</Typography>
      </CardContent>
    </Card>
  );
}

export default function FundsPage() {
  useSetPageTitle("Funds");
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [startMs, setStartMs] = useState(() => dayjs().startOf("month").valueOf());
  const [endMs, setEndMs] = useState(() => dayjs().endOf("month").valueOf());
  const [toDelete, setToDelete] = useState<Expense | null>(null);

  const income = useIncome(startMs, endMs);
  const expenses = useExpenses(startMs, endMs);
  const deleteExpense = useDeleteExpense();

  const summary = useMemo(
    () => summarizePeriod(income.data ?? [], expenses.data ?? []),
    [income.data, expenses.data],
  );
  const summaryLoading = income.isPending || expenses.isPending;
  const summaryError = income.isError || expenses.isError;
  const stat = (value: number) => (summaryError ? "—" : summaryLoading ? "…" : inr(value));

  const confirmDelete = () => {
    if (!toDelete) return;
    const exp = toDelete;
    setToDelete(null);
    deleteExpense.mutate(exp.id, {
      onSuccess: () => showToast("Expense deleted", "success"),
      onError: () => showToast("Could not delete expense. Please try again.", "error"),
    });
  };

  return (
    <Box sx={{ position: "relative", minHeight: "60vh" }}>
      <PageHeader title="Funds" />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        <TextField label="From" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }}
          value={msToDateInput(startMs)}
          onChange={(e) => e.target.value && setStartMs(dateInputToMs(e.target.value))} />
        <TextField label="To" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }}
          value={msToDateInput(endMs)}
          onChange={(e) => e.target.value && setEndMs(dayjs(dateInputToMs(e.target.value)).endOf("day").valueOf())} />
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
        <StatCard label="Income" value={stat(summary.totalIncome)} color="success.main" edge="#16A39B" />
        <StatCard label="Expenses" value={stat(summary.totalExpenses)} color="error.main" edge="#C0496B" />
        <StatCard label="Balance" value={stat(summary.balance)}
          color={summary.balance < 0 ? "error.main" : "text.primary"} edge="#2E73D6" />
      </Stack>

      {!summaryLoading && !summaryError && summary.incomeByMode.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
          {summary.incomeByMode.map((m) => (
            <Chip key={m.mode} size="small" variant="outlined" label={`${m.mode}: ${inr(m.amount)}`} />
          ))}
        </Stack>
      )}

      <Divider sx={{ mb: 1.5 }} />
      <Typography variant="subtitle1" sx={{ mb: 1 }}>Expenses</Typography>

      <QueryStates status={expenses.status} isEmpty={(expenses.data ?? []).length === 0}
        emptyMessage="No expenses in this period">
        {(expenses.data ?? []).map((e) => (
          <ListCard
            key={e.id}
            onClick={() => navigate(`/funds/expenses/${e.id}/edit`)}
            primary={e.category}
            secondary={`${formatDate(e.date)}${e.note ? ` · ${e.note}` : ""}`}
            trailing={<Typography sx={{ color: "error.main", fontWeight: 600 }}>{inr(e.amount)}</Typography>}
            menu={<RowMenu label={e.category} onEdit={() => navigate(`/funds/expenses/${e.id}/edit`)} onDelete={() => setToDelete(e)} />}
          />
        ))}
      </QueryStates>

      <AddButton label="Add expense" to="/funds/expenses/new" />
      <ConfirmDialog
        open={!!toDelete}
        title="Delete expense?"
        message={toDelete ? `Delete "${toDelete.category}" (${inr(toDelete.amount)})? This cannot be undone.` : ""}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </Box>
  );
}
```

> If `Expense` is not the exported type name in `fundsSchema.ts`, open the file and use the actual exported expense type (e.g. inferred from the schema). Adjust the `import type { Expense }` line accordingly.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- FundsPage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/funds/FundsPage.tsx src/features/funds/FundsPage.test.tsx
git commit -m "feat(funds): accented stat cards, expense ListCards, confirm-delete"
```

---

### Task 14: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: no errors. Fix any unused imports left behind (e.g. removed `Fab`/`List`/`ListItemButton` imports in modified screens).

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: `tsc -b` clean, `vite build` succeeds.

- [ ] **Step 4: Manual smoke (optional but recommended)**

Run: `npm run dev`, then in the browser check: login page styling; back button appears on patient detail/forms and returns; labeled add buttons on all three lists; inventory & expense `⋮` → Delete → confirm flow; empty states show the mandala.

- [ ] **Step 5: Final commit (only if Step 1 required fixes)**

```bash
git add -A
git commit -m "chore: lint cleanup after UI polish"
```

---

## Self-Review

**Spec coverage:**
- Theme/foundation → Task 1. ✔
- Mandala art component → Task 2. ✔
- Shared components (PageHeader, AddButton, ListCard, RowMenu, ConfirmDialog, PageChrome) → Tasks 3–5. ✔
- Back button + contextual title → Task 6. ✔
- QueryStates polish → Task 7. ✔
- Login themed → Task 8. ✔
- Patients list/detail/timeline → Tasks 9–10. ✔
- All forms polished → Task 11. ✔
- Inventory delete (visible CRUD) → Task 12. ✔
- Funds stat cards + expense delete → Task 13. ✔
- Labeled add buttons everywhere → Tasks 9, 10, 12, 13. ✔
- No patient/consultation delete → honored (RowMenu omitted there). ✔
- Verification (lint/test/build) → Task 14. ✔

**Placeholder scan:** No TBD/TODO; every code step has full code. Two guarded "if the type/test differs, adjust" notes (Funds `Expense` type, pre-existing test selectors) point at exact files — acceptable since they depend on existing code the implementer can read.

**Type consistency:** `useSetPageTitle`/`usePageTitle` (Task 5) used consistently in Tasks 6, 9–13. `ListCard` prop names (`avatar`, `edgeColor`, `primary`, `secondary`, `trailing`, `menu`, `onClick`) match across Tasks 9–13. `RowMenu` (`label`, `onEdit`, `onDelete`) and `ConfirmDialog` (`open`, `title`, `message`, `confirmLabel`, `onConfirm`, `onClose`) consistent. `accentFor`/`JEWEL_ACCENTS` defined in Task 1, used in Tasks 10, 13.
