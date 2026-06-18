# Grace Homoeo — Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Inventory module — a searchable medicine/stock list with low-stock highlighting and quick +/− quantity adjust, plus add/edit/delete forms — on top of the completed Foundation and Patients modules.

**Architecture:** The `inventory` feature owns a zod schema, a typed Firestore repository (no Firestore SDK calls outside the repo), TanStack Query hooks (fetching + cache invalidation), and route-page UI. There is a single `inventory` collection — no serial numbers, no denormalization, no cross-feature coupling. Quantities are non-negative integers; quick adjust computes the clamped new quantity in the UI and persists it through a single repo write. Every list view renders through the shared `QueryStates`; every mutation reports through `useToast`. Forms use react-hook-form + zod on full-page routes (phone-first).

**Tech Stack:** React 18 + TypeScript (strict), MUI v6, Firebase v10 Firestore, TanStack Query v5, react-hook-form + `@hookform/resolvers/zod` + zod, Vitest + React Testing Library.

## Global Constraints

- Firebase project is **`grace-homoeo`** — reuse it; never create a new project.
- **UI never calls the Firestore SDK directly** — all access goes through the per-collection repository in `src/features/inventory/`.
- **Features must not import each other's internals** — only shared `src/components/`, `src/lib/`, `src/theme/`. Inventory is self-contained and imports no other feature.
- **TypeScript strict mode**; no `any` in committed code.
- Quantities and reorder levels are **non-negative integers**.
- Dates (`updatedAt`) are stored as **epoch milliseconds (number)**.
- Every data view exposes explicit **loading / empty / error** states via `QueryStates`.
- All mutation success/failure surfaces through `useToast` — never `alert()`.
- Relative imports only (no `@/` alias).
- Tests **mock `firebase/firestore`** — `npm test` needs no emulator. Do not delete `.env.test`.
- Commit after every passing step.

---

## Foundation interfaces this plan consumes (already built — verify before use)

- `src/lib/firebase.ts` → `db`.
- `src/lib/dates.ts` → `formatDate(ms: number): string` (e.g. `"18 Jun 2026"`).
- `src/components/QueryStates.tsx` → default export `QueryStates`, props `{ status: "pending"|"error"|"success"; isEmpty: boolean; emptyMessage: string; children }`.
- `src/components/useToast.ts` → `useToast(): { showToast(message: string, severity?: "success"|"error"|"info"|"warning"): void }`.
- `src/components/AppShell.tsx` → adaptive shell rendering `<Outlet />`; already has an **Inventory** nav entry pointing at `/inventory`. No shell changes are needed in this plan.
- `src/App.tsx` → routes; `/inventory` currently maps to `InventoryPlaceholder`.
- Established list/form patterns to mirror exactly: `src/features/patients/PatientListPage.tsx` (search + `QueryStates` + FAB), `src/features/patients/PatientFormPage.tsx` (react-hook-form + zod + toast), `src/features/patients/patientsRepo.ts` (`toX` mapper + CRUD), `src/features/patients/usePatients.ts` (query/mutation hooks).

---

## File Structure

```
src/features/inventory/inventorySchema.ts        # zod schema + InventoryItem/InventoryFormValues types + isLowStock
src/features/inventory/inventorySchema.test.ts
src/features/inventory/inventoryRepo.ts           # typed Firestore access for inventory
src/features/inventory/inventoryRepo.test.ts
src/features/inventory/useInventory.ts            # TanStack Query hooks
src/features/inventory/useInventory.test.tsx
src/features/inventory/InventoryListPage.tsx      # searchable list + low-stock highlight + quick +/- + FAB
src/features/inventory/InventoryListPage.test.tsx
src/features/inventory/InventoryFormPage.tsx      # add/edit/delete item
src/features/inventory/InventoryFormPage.test.tsx

src/App.tsx                                       # MODIFY: add inventory routes, drop placeholder import
src/routes/InventoryPlaceholder.tsx               # DELETE (replaced by InventoryListPage)
```

---

### Task 1: Inventory schema + repository

**Files:**
- Create: `src/features/inventory/inventorySchema.ts`, `src/features/inventory/inventoryRepo.ts`
- Test: `src/features/inventory/inventorySchema.test.ts`, `src/features/inventory/inventoryRepo.test.ts`

**Interfaces:**
- Consumes: `db` from `../../lib/firebase`.
- Produces:
  - `inventoryFormSchema` (zod); `type InventoryFormValues = { name: string; quantity: number; unit: string; reorderLevel: number; notes: string }`.
  - `interface InventoryItem extends InventoryFormValues { id: string; nameLower: string; updatedAt: number }`.
  - `isLowStock(item: Pick<InventoryItem, "quantity" | "reorderLevel">): boolean` — `quantity <= reorderLevel`.
  - `listInventory(): Promise<InventoryItem[]>` (ordered by `nameLower` ascending).
  - `getItem(id: string): Promise<InventoryItem | null>`.
  - `createItem(values: InventoryFormValues): Promise<string>` (writes `nameLower`, `updatedAt`; returns new id).
  - `updateItem(id: string, values: InventoryFormValues): Promise<void>` (rewrites `nameLower`, `updatedAt`).
  - `setQuantity(id: string, quantity: number): Promise<void>` (writes `quantity`, `updatedAt`; used by quick adjust).
  - `deleteItem(id: string): Promise<void>`.

- [ ] **Step 1: Write the failing schema test**

```ts
// src/features/inventory/inventorySchema.test.ts
import { describe, expect, it } from "vitest";
import { inventoryFormSchema, isLowStock } from "./inventorySchema";

describe("inventoryFormSchema", () => {
  it("accepts a valid item and trims the name", () => {
    const parsed = inventoryFormSchema.parse({
      name: "  Arnica 30  ", quantity: 12, unit: "vials", reorderLevel: 3, notes: "shelf A",
    });
    expect(parsed.name).toBe("Arnica 30");
    expect(parsed.quantity).toBe(12);
  });
  it("rejects an empty name", () => {
    expect(() => inventoryFormSchema.parse({ name: "  ", quantity: 1 })).toThrow();
  });
  it("rejects a negative quantity", () => {
    expect(() => inventoryFormSchema.parse({ name: "A", quantity: -1 })).toThrow();
  });
  it("rejects a non-integer quantity", () => {
    expect(() => inventoryFormSchema.parse({ name: "A", quantity: 1.5 })).toThrow();
  });
  it("defaults unit, reorderLevel and notes", () => {
    const parsed = inventoryFormSchema.parse({ name: "A", quantity: 0 });
    expect(parsed.unit).toBe("");
    expect(parsed.reorderLevel).toBe(0);
    expect(parsed.notes).toBe("");
  });
});

describe("isLowStock", () => {
  it("is true when quantity is at or below the reorder level", () => {
    expect(isLowStock({ quantity: 3, reorderLevel: 3 })).toBe(true);
    expect(isLowStock({ quantity: 1, reorderLevel: 3 })).toBe(true);
  });
  it("is false when quantity is above the reorder level", () => {
    expect(isLowStock({ quantity: 4, reorderLevel: 3 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- inventorySchema`
Expected: FAIL — cannot resolve `./inventorySchema`.

- [ ] **Step 3: Write the schema**

```ts
// src/features/inventory/inventorySchema.ts
import { z } from "zod";

export const inventoryFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  quantity: z
    .number({ invalid_type_error: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .nonnegative("Quantity cannot be negative"),
  unit: z.string().trim().default(""),
  reorderLevel: z
    .number({ invalid_type_error: "Reorder level must be a number" })
    .int("Reorder level must be a whole number")
    .nonnegative("Reorder level cannot be negative")
    .default(0),
  notes: z.string().trim().default(""),
});

export type InventoryFormValues = z.infer<typeof inventoryFormSchema>;

export interface InventoryItem extends InventoryFormValues {
  id: string;
  nameLower: string;
  updatedAt: number;
}

export function isLowStock(
  item: Pick<InventoryItem, "quantity" | "reorderLevel">,
): boolean {
  return item.quantity <= item.reorderLevel;
}
```

- [ ] **Step 4: Run to verify schema test passes**

Run: `npm test -- inventorySchema`
Expected: PASS.

- [ ] **Step 5: Write the failing repository test**

```ts
// src/features/inventory/inventoryRepo.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const addDoc = vi.fn();
const getDocs = vi.fn();
const updateDoc = vi.fn();
const deleteDoc = vi.fn();
const collection = vi.fn((..._a: unknown[]) => ({ path: "inventory" }));
const doc = vi.fn((..._a: unknown[]) => ({ id: "doc-ref" }));
const query = vi.fn((...a: unknown[]) => a);
const orderBy = vi.fn((...a: unknown[]) => ({ orderBy: a }));

vi.mock("firebase/firestore", () => ({
  addDoc: (...a: unknown[]) => addDoc(...a),
  getDocs: (...a: unknown[]) => getDocs(...a),
  getDoc: vi.fn(),
  updateDoc: (...a: unknown[]) => updateDoc(...a),
  deleteDoc: (...a: unknown[]) => deleteDoc(...a),
  collection: (...a: unknown[]) => collection(...a),
  doc: (...a: unknown[]) => doc(...a),
  query: (...a: unknown[]) => query(...a),
  orderBy: (...a: unknown[]) => orderBy(...a),
}));
vi.mock("../../lib/firebase", () => ({ db: {} }));

import { createItem, listInventory, updateItem, setQuantity, deleteItem } from "./inventoryRepo";

beforeEach(() => {
  addDoc.mockReset(); getDocs.mockReset(); updateDoc.mockReset(); deleteDoc.mockReset();
});

describe("createItem", () => {
  it("writes derived nameLower and updatedAt", async () => {
    addDoc.mockResolvedValue({ id: "new-id" });
    const id = await createItem({ name: "Arnica 30", quantity: 5, unit: "vials", reorderLevel: 2, notes: "" });
    expect(id).toBe("new-id");
    const payload = addDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.nameLower).toBe("arnica 30");
    expect(payload.quantity).toBe(5);
    expect(typeof payload.updatedAt).toBe("number");
  });
});

describe("listInventory", () => {
  it("maps Firestore docs to InventoryItem objects", async () => {
    getDocs.mockResolvedValue({
      docs: [{
        id: "i1",
        data: () => ({ name: "Arnica", nameLower: "arnica", quantity: 5, unit: "vials", reorderLevel: 2, notes: "x", updatedAt: 9 }),
      }],
    });
    const list = await listInventory();
    expect(list).toEqual([{
      id: "i1", name: "Arnica", nameLower: "arnica", quantity: 5, unit: "vials", reorderLevel: 2, notes: "x", updatedAt: 9,
    }]);
  });
});

describe("updateItem", () => {
  it("rewrites nameLower and updatedAt", async () => {
    updateDoc.mockResolvedValue(undefined);
    await updateItem("i1", { name: "New Name", quantity: 1, unit: "", reorderLevel: 0, notes: "" });
    const payload = updateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.nameLower).toBe("new name");
    expect(typeof payload.updatedAt).toBe("number");
  });
});

describe("setQuantity", () => {
  it("writes the new quantity and updatedAt only", async () => {
    updateDoc.mockResolvedValue(undefined);
    await setQuantity("i1", 8);
    const payload = updateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.quantity).toBe(8);
    expect(typeof payload.updatedAt).toBe("number");
    expect(Object.keys(payload).sort()).toEqual(["quantity", "updatedAt"]);
  });
});

describe("deleteItem", () => {
  it("deletes the item document", async () => {
    deleteDoc.mockResolvedValue(undefined);
    await deleteItem("i1");
    expect(deleteDoc).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npm test -- inventoryRepo`
Expected: FAIL — cannot resolve `./inventoryRepo`.

- [ ] **Step 7: Write the repository**

```ts
// src/features/inventory/inventoryRepo.ts
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, updateDoc,
  type DocumentData, type QueryDocumentSnapshot, type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { InventoryItem, InventoryFormValues } from "./inventorySchema";

const COLLECTION = "inventory";

function toItem(
  snap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>,
): InventoryItem {
  const d = snap.data() as DocumentData;
  return {
    id: snap.id,
    name: d.name,
    nameLower: d.nameLower,
    quantity: d.quantity,
    unit: d.unit ?? "",
    reorderLevel: d.reorderLevel ?? 0,
    notes: d.notes ?? "",
    updatedAt: d.updatedAt,
  };
}

export async function listInventory(): Promise<InventoryItem[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), orderBy("nameLower")));
  return snap.docs.map(toItem);
}

export async function getItem(id: string): Promise<InventoryItem | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? toItem(snap) : null;
}

export async function createItem(values: InventoryFormValues): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...values,
    nameLower: values.name.toLowerCase(),
    updatedAt: Date.now(),
  });
  return ref.id;
}

export async function updateItem(id: string, values: InventoryFormValues): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    ...values,
    nameLower: values.name.toLowerCase(),
    updatedAt: Date.now(),
  });
}

export async function setQuantity(id: string, quantity: number): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { quantity, updatedAt: Date.now() });
}

export async function deleteItem(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
```

- [ ] **Step 8: Run to verify all tests pass**

Run: `npm test -- inventorySchema inventoryRepo`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/inventory/inventorySchema.ts src/features/inventory/inventorySchema.test.ts \
  src/features/inventory/inventoryRepo.ts src/features/inventory/inventoryRepo.test.ts
git commit -m "feat: add inventory schema and Firestore repository"
```

---

### Task 2: Inventory query hooks (`useInventory.ts`)

**Files:**
- Create: `src/features/inventory/useInventory.ts`
- Test: `src/features/inventory/useInventory.test.tsx`

**Interfaces:**
- Consumes: repo functions from `./inventoryRepo`; `InventoryFormValues` from `./inventorySchema`.
- Produces:
  - `useInventory()` → query, key `["inventory"]`.
  - `useInventoryItem(id: string | undefined)` → query, key `["inventory", id]`, disabled when no id.
  - `useCreateItem()` → mutation `(values: InventoryFormValues) => Promise<string>`; invalidates `["inventory"]`.
  - `useUpdateItem(id: string)` → mutation `(values: InventoryFormValues) => Promise<void>`; invalidates `["inventory"]` and `["inventory", id]`.
  - `useSetQuantity()` → mutation `({ id, quantity }: { id: string; quantity: number }) => Promise<void>`; invalidates `["inventory"]`.
  - `useDeleteItem()` → mutation `(id: string) => Promise<void>`; invalidates `["inventory"]`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/inventory/useInventory.test.tsx
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("./inventoryRepo", () => ({
  listInventory: vi.fn().mockResolvedValue([{ id: "i1", name: "Arnica" }]),
  getItem: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  setQuantity: vi.fn(),
  deleteItem: vi.fn(),
}));

import { useInventory } from "./useInventory";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useInventory", () => {
  it("returns the inventory list from the repository", async () => {
    const { result } = renderHook(() => useInventory(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: "i1", name: "Arnica" }]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- useInventory`
Expected: FAIL — cannot resolve `./useInventory`.

- [ ] **Step 3: Write the hooks**

```ts
// src/features/inventory/useInventory.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createItem, deleteItem, getItem, listInventory, setQuantity, updateItem,
} from "./inventoryRepo";
import type { InventoryFormValues } from "./inventorySchema";

export function useInventory() {
  return useQuery({ queryKey: ["inventory"], queryFn: listInventory });
}

export function useInventoryItem(id: string | undefined) {
  return useQuery({
    queryKey: ["inventory", id],
    queryFn: () => getItem(id as string),
    enabled: !!id,
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: InventoryFormValues) => createItem(values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useUpdateItem(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: InventoryFormValues) => updateItem(id, values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["inventory"] });
      void qc.invalidateQueries({ queryKey: ["inventory", id] });
    },
  });
}

export function useSetQuantity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; quantity: number }) => setQuantity(vars.id, vars.quantity),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteItem(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- useInventory`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/inventory/useInventory.ts src/features/inventory/useInventory.test.tsx
git commit -m "feat: add inventory query hooks"
```

---

### Task 3: Inventory list page (`InventoryListPage.tsx`)

**Files:**
- Create: `src/features/inventory/InventoryListPage.tsx`
- Test: `src/features/inventory/InventoryListPage.test.tsx`

**Interfaces:**
- Consumes: `useInventory`, `useSetQuantity` from `./useInventory`; `isLowStock`, `InventoryItem` from `./inventorySchema`; `QueryStates` from `../../components/QueryStates`; `useToast` from `../../components/useToast`.
- Produces: default-exported `InventoryListPage` route component. Searchable by name (filters `nameLower`); each row shows name, `quantity unit`, a low-stock chip when `isLowStock`, and `−`/`+` icon buttons that persist a clamped quantity via `useSetQuantity` (never below 0). Tapping the row body navigates to `/inventory/:id/edit`. A FAB links to `/inventory/new`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/inventory/InventoryListPage.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const mutate = vi.fn();
vi.mock("./useInventory", () => ({
  useInventory: () => ({
    status: "success",
    data: [
      { id: "i1", name: "Arnica 30", nameLower: "arnica 30", quantity: 2, unit: "vials", reorderLevel: 3, notes: "", updatedAt: 1 },
      { id: "i2", name: "Belladonna", nameLower: "belladonna", quantity: 9, unit: "vials", reorderLevel: 3, notes: "", updatedAt: 1 },
    ],
  }),
  useSetQuantity: () => ({ mutate, isPending: false }),
}));
const showToast = vi.fn();
vi.mock("../../components/useToast", () => ({ useToast: () => ({ showToast }) }));

import InventoryListPage from "./InventoryListPage";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/inventory"]}>
      <Routes>
        <Route path="/inventory" element={<InventoryListPage />} />
        <Route path="/inventory/:id/edit" element={<div>edit</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("InventoryListPage", () => {
  it("flags a low-stock item", () => {
    renderPage();
    const arnica = screen.getByText("Arnica 30").closest("li") as HTMLElement;
    expect(within(arnica).getByText(/low stock/i)).toBeInTheDocument();
  });

  it("filters by name", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/search/i), "bella");
    expect(screen.queryByText("Arnica 30")).not.toBeInTheDocument();
    expect(screen.getByText("Belladonna")).toBeInTheDocument();
  });

  it("increments quantity", async () => {
    const user = userEvent.setup();
    renderPage();
    const arnica = screen.getByText("Arnica 30").closest("li") as HTMLElement;
    await user.click(within(arnica).getByRole("button", { name: /increase/i }));
    expect(mutate).toHaveBeenCalledWith({ id: "i1", quantity: 3 });
  });

  it("does not decrement below zero", async () => {
    const user = userEvent.setup();
    mutate.mockClear();
    render(
      <MemoryRouter><InventoryListPage /></MemoryRouter>,
    );
    // Arnica has quantity 2; click decrease — allowed down to 1, then re-render is mocked-static so
    // we only assert the call computes 1 (2 - 1), never a negative.
    const arnica = screen.getByText("Arnica 30").closest("li") as HTMLElement;
    await user.click(within(arnica).getByRole("button", { name: /decrease/i }));
    expect(mutate).toHaveBeenCalledWith({ id: "i1", quantity: 1 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- InventoryListPage`
Expected: FAIL — cannot resolve `./InventoryListPage`.

- [ ] **Step 3: Write the component**

```tsx
// src/features/inventory/InventoryListPage.tsx
import { useMemo, useState } from "react";
import {
  Box, Chip, Fab, IconButton, List, ListItem, ListItemButton, ListItemText,
  Stack, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { Link, useNavigate } from "react-router-dom";
import { useInventory, useSetQuantity } from "./useInventory";
import { isLowStock, type InventoryItem } from "./inventorySchema";
import QueryStates from "../../components/QueryStates";
import { useToast } from "../../components/useToast";

export default function InventoryListPage() {
  const { status, data } = useInventory();
  const setQuantity = useSetQuantity();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
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

  return (
    <Box sx={{ position: "relative", minHeight: "60vh" }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Inventory</Typography>
      <TextField
        label="Search by name"
        fullWidth size="small" sx={{ mb: 2 }}
        value={search} onChange={(e) => setSearch(e.target.value)}
      />
      <QueryStates status={status} isEmpty={filtered.length === 0} emptyMessage="No items yet">
        <List>
          {filtered.map((i) => (
            <ListItem
              key={i.id} divider disableGutters
              secondaryAction={
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <IconButton aria-label={`Decrease ${i.name}`} size="small"
                    disabled={i.quantity === 0 || setQuantity.isPending}
                    onClick={() => adjust(i, -1)}>
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <Typography component="span" sx={{ minWidth: 24, textAlign: "center" }}>
                    {i.quantity}
                  </Typography>
                  <IconButton aria-label={`Increase ${i.name}`} size="small"
                    disabled={setQuantity.isPending}
                    onClick={() => adjust(i, 1)}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Stack>
              }
            >
              <ListItemButton onClick={() => navigate(`/inventory/${i.id}/edit`)}>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>{i.name}</span>
                      {isLowStock(i) && <Chip label="Low stock" color="warning" size="small" />}
                    </Stack>
                  }
                  secondary={`${i.quantity}${i.unit ? ` ${i.unit}` : ""} in stock`}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </QueryStates>
      <Fab color="primary" aria-label="Add item" component={Link} to="/inventory/new"
        sx={{ position: "fixed", bottom: { xs: 72, md: 24 }, right: 24 }}>
        <AddIcon />
      </Fab>
    </Box>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- InventoryListPage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/inventory/InventoryListPage.tsx src/features/inventory/InventoryListPage.test.tsx
git commit -m "feat: add inventory list page with low-stock highlight and quick adjust"
```

---

### Task 4: Inventory add/edit/delete form page (`InventoryFormPage.tsx`)

**Files:**
- Create: `src/features/inventory/InventoryFormPage.tsx`
- Test: `src/features/inventory/InventoryFormPage.test.tsx`

**Interfaces:**
- Consumes: `useInventoryItem`, `useCreateItem`, `useUpdateItem`, `useDeleteItem` from `./useInventory`; `inventoryFormSchema`, `InventoryFormValues` from `./inventorySchema`; `useToast` from `../../components/useToast`.
- Produces: default-exported `InventoryFormPage` route component. Edit mode when route param `id` is present (`/inventory/:id/edit`); otherwise create mode (`/inventory/new`). On success: toast + navigate to `/inventory`. Edit mode shows a Delete button that, after a `window.confirm`, deletes and navigates to `/inventory`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/inventory/InventoryFormPage.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const createAsync = vi.fn().mockResolvedValue("new-id");
const deleteAsync = vi.fn().mockResolvedValue(undefined);
vi.mock("./useInventory", () => ({
  useInventoryItem: () => ({ data: undefined, isLoading: false }),
  useCreateItem: () => ({ mutateAsync: createAsync, isPending: false }),
  useUpdateItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteItem: () => ({ mutateAsync: deleteAsync, isPending: false }),
}));
const showToast = vi.fn();
vi.mock("../../components/useToast", () => ({ useToast: () => ({ showToast }) }));

import InventoryFormPage from "./InventoryFormPage";

function renderCreate() {
  return render(
    <MemoryRouter initialEntries={["/inventory/new"]}>
      <Routes>
        <Route path="/inventory/new" element={<InventoryFormPage />} />
        <Route path="/inventory" element={<div>list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("InventoryFormPage (create)", () => {
  it("submits a valid new item", async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.type(screen.getByLabelText(/name/i), "Arnica 30");
    await user.clear(screen.getByLabelText(/quantity/i));
    await user.type(screen.getByLabelText(/quantity/i), "12");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(createAsync).toHaveBeenCalledTimes(1);
    const arg = createAsync.mock.calls[0][0];
    expect(arg.name).toBe("Arnica 30");
    expect(arg.quantity).toBe(12);
  });

  it("shows a validation error when name is empty", async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
  });

  it("does not show a delete button in create mode", () => {
    renderCreate();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- InventoryFormPage`
Expected: FAIL — cannot resolve `./InventoryFormPage`.

- [ ] **Step 3: Write the component**

```tsx
// src/features/inventory/InventoryFormPage.tsx
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { inventoryFormSchema, type InventoryFormValues } from "./inventorySchema";
import { useInventoryItem, useCreateItem, useUpdateItem, useDeleteItem } from "./useInventory";
import { useToast } from "../../components/useToast";

const DEFAULTS: InventoryFormValues = {
  name: "", quantity: 0, unit: "", reorderLevel: 0, notes: "",
};

export default function InventoryFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: existing } = useInventoryItem(id);
  const create = useCreateItem();
  const update = useUpdateItem(id ?? "");
  const remove = useDeleteItem();

  const { control, handleSubmit, reset, register, formState: { errors } } =
    useForm<InventoryFormValues>({
      resolver: zodResolver(inventoryFormSchema),
      defaultValues: DEFAULTS,
    });

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name, quantity: existing.quantity, unit: existing.unit,
        reorderLevel: existing.reorderLevel, notes: existing.notes,
      });
    }
  }, [existing, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit) {
        await update.mutateAsync(values);
        showToast("Item updated", "success");
      } else {
        await create.mutateAsync(values);
        showToast("Item added", "success");
      }
      navigate("/inventory");
    } catch {
      showToast("Could not save item. Please try again.", "error");
    }
  });

  const onDelete = async () => {
    if (!id || !window.confirm("Delete this item?")) return;
    try {
      await remove.mutateAsync(id);
      showToast("Item deleted", "success");
      navigate("/inventory");
    } catch {
      showToast("Could not delete item. Please try again.", "error");
    }
  };

  const busy = create.isPending || update.isPending || remove.isPending;

  return (
    <Box component="form" onSubmit={onSubmit} sx={{ maxWidth: 480, mx: "auto" }}>
      <Typography variant="h5" sx={{ mb: 3 }}>{isEdit ? "Edit item" : "Add item"}</Typography>
      <Stack spacing={2}>
        <TextField label="Name" fullWidth required
          {...register("name")} error={!!errors.name} helperText={errors.name?.message} />

        <Controller name="quantity" control={control} render={({ field }) => (
          <TextField label="Quantity" type="number" fullWidth required
            value={Number.isFinite(field.value) ? field.value : ""}
            onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
            error={!!errors.quantity} helperText={errors.quantity?.message} />
        )} />

        <TextField label="Unit" fullWidth placeholder="e.g. vials, drops, g"
          {...register("unit")} />

        <Controller name="reorderLevel" control={control} render={({ field }) => (
          <TextField label="Reorder level" type="number" fullWidth
            value={Number.isFinite(field.value) ? field.value : ""}
            onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
            error={!!errors.reorderLevel} helperText={errors.reorderLevel?.message} />
        )} />

        <TextField label="Notes" fullWidth multiline minRows={2} {...register("notes")} />

        <Stack direction="row" spacing={2} justifyContent="space-between">
          {isEdit ? (
            <Button color="error" onClick={onDelete} disabled={busy}>Delete</Button>
          ) : <span />}
          <Stack direction="row" spacing={2}>
            <Button onClick={() => navigate(-1)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? "Saving..." : "Save"}
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Box>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- InventoryFormPage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/inventory/InventoryFormPage.tsx src/features/inventory/InventoryFormPage.test.tsx
git commit -m "feat: add inventory add/edit/delete form page"
```

---

### Task 5: Wire routes and remove the placeholder

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/routes/InventoryPlaceholder.tsx`

**Interfaces:**
- Consumes: `InventoryListPage`, `InventoryFormPage` (default exports from `./features/inventory/...`).
- Produces: live `/inventory`, `/inventory/new`, `/inventory/:id/edit` routes inside the existing `<AuthGuard><AppShell/></AuthGuard>` group; `InventoryPlaceholder` no longer imported or present.

- [ ] **Step 1: Edit `src/App.tsx`**

Replace the inventory placeholder import:

```tsx
// remove this line:
import InventoryPlaceholder from "./routes/InventoryPlaceholder";
// add (next to the other feature page imports):
import InventoryListPage from "./features/inventory/InventoryListPage";
import InventoryFormPage from "./features/inventory/InventoryFormPage";
```

Replace the single inventory route:

```tsx
// remove:
<Route path="/inventory" element={<InventoryPlaceholder />} />
// add:
<Route path="/inventory" element={<InventoryListPage />} />
<Route path="/inventory/new" element={<InventoryFormPage />} />
<Route path="/inventory/:id/edit" element={<InventoryFormPage />} />
```

- [ ] **Step 2: Delete the placeholder**

```bash
git rm src/routes/InventoryPlaceholder.tsx
```

- [ ] **Step 3: Verify the full suite, lint, and build are green**

Run: `npm test`
Expected: PASS (all files, including the new inventory tests).

Run: `npm run lint`
Expected: no errors.

Run: `npm run build`
Expected: `tsc -b` clean and `vite build` produces `dist/` with the PWA service worker.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire inventory routes and remove placeholder"
```

---

## Final: whole-branch review

After all tasks pass, run a whole-branch code review (the same loop used for the Foundation and Plan 2: per-task review during execution, then one final whole-branch review). Address any Critical/Important findings before considering Plan 3 complete, then update `docs/superpowers/REBUILD-STATUS.md` to mark **Inventory — ✅ COMPLETE** and set **Funds (Plan 4)** as next.

---

## Self-Review (against the spec)

- **Spec §6 "Item list with low-stock highlighting (`quantity <= reorderLevel`), search, add/edit/delete, and quick +/− quantity adjust"** — all covered: low-stock via `isLowStock` + `Chip` (Task 1, 3); search by name (Task 3); add/edit (Task 4); delete (Task 4); quick +/− with zero-clamp (Task 3 + `setQuantity` repo/hook). ✅
- **Data model `inventory` — `name`, `nameLower`, `quantity`, `unit`, `reorderLevel`, `notes`, `updatedAt`** — every field written by `createItem`/`updateItem`; `nameLower`/`updatedAt` derived (Task 1). ✅
- **Spec §8 component test "inventory low-stock highlight"** — `InventoryListPage.test.tsx` asserts the low-stock chip (Task 3). ✅
- **Spec §7 loading/empty/error + toast on mutations** — list uses `QueryStates`; all mutations route through `useToast` (Tasks 3, 4). ✅
- **Type consistency** — `InventoryItem`/`InventoryFormValues`/`isLowStock` defined in Task 1 are used with identical names/shapes in Tasks 2–4; hook names (`useInventory`, `useInventoryItem`, `useCreateItem`, `useUpdateItem`, `useSetQuantity`, `useDeleteItem`) match between Task 2 and Tasks 3–4. ✅
- **Placeholder scan** — no TBD/TODO; every code step shows full code. ✅
