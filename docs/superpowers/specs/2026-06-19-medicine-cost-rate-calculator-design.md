# Medicine Cost — Inventory Pricing + Rate Calculator

_Design spec — 2026-06-19_

## Problem

The doctor charges a flat ₹150 per visit covering both consultation and ~15 days
of medicine. He wants to know the **actual medicine cost per patient** so he can
see his real margin. The difficulty: medicines are bought in bulk (a big jar of
globules, a tincture bottle) with only a **total bill**, and dispensed in small
plastic bottles. He needs to turn "total cost of a lot" into a **per-unit rate**,
then multiply by what a patient actually receives over two weeks
(e.g. 4 times/day × 4 pills × 14 days) plus the dispensing bottle.

## Scope

Two pieces of work:

1. **Inventory pricing** — each inventory item records its purchase **form** and
   **bulk cost**, from which the app derives a per-unit rate. Pricing is optional
   and additive; existing stock-tracking fields are untouched.
2. **Rate Calculator** — a new read-only feature/tab that reads priced inventory
   items and totals the medicine cost for one patient's dispense. **Nothing is
   saved** — the result is shown on screen only.

Out of scope: persisting the computed cost to consultations/Funds, patient
selection, stock decrement when dispensing.

## Part A — Inventory pricing

### Forms and the per-unit rule

One uniform rule: `unitCost = purchaseCost ÷ lotSize`, where *lotSize* is how many
base units the purchase yields.

| Form (`form`) | You enter | Base unit | `lotSize` is | Derived rate |
|---------------|-----------|-----------|--------------|--------------|
| `pieces` | total cost + pills in the lot | pill | pill count | ₹/pill |
| `liquid` | total cost + total ml | ml | ml | ₹/ml |
| `packaging` | total cost + bottles in the pack | bottle | bottle count | ₹/bottle |
| `flat` | cost per unit directly | unit | `1` | ₹/unit |

### Schema changes (`inventorySchema.ts`)

New fields on `inventoryFormSchema` (all additive, backward-compatible):

- `form`: enum `["pieces","liquid","packaging","flat"]`, default `"flat"`.
- `purchaseCost`: number ≥ 0 (rupees), default `0`.
- `lotSize`: number > 0, default `1`. (For `flat`, forced to `1`.)

Helpers:

- `unitCostOf({ purchaseCost, lotSize })` → `lotSize > 0 ? purchaseCost / lotSize : 0`.
- `isPriced(item)` → `purchaseCost > 0 && lotSize > 0` (gate for the calculator).
- `baseUnitLabel(form)` → `"pill" | "ml" | "bottle" | "unit"`.

### Repository (`inventoryRepo.ts`)

`toItem` reads the new fields with defaults so pre-existing docs (no `form`) load
as `flat`, `purchaseCost 0`, `lotSize 1`. `createItem`/`updateItem` already spread
form values, so they persist automatically.

### Form page (`InventoryFormPage.tsx`)

- A **Form** select (Pills / Liquid / Empty bottles / Whole unit).
- Cost inputs whose labels adapt to the form:
  - `flat`: single "Cost per unit (₹)" (writes `purchaseCost`, keeps `lotSize = 1`).
  - others: "Total purchase cost (₹)" + a lot-size field labelled per form
    ("Pills in the lot" / "Total volume (ml)" / "Bottles in the pack").
- A live **rate preview**: e.g. "≈ ₹0.20 / pill". Hidden until both inputs are valid.

## Part B — Rate Calculator feature

New folder `src/features/rateCalculator/`. Route `/calculator`, nav tab
"Calculator" (CalculateIcon). Mirrors every other feature's stack.

### Cost math (`calculatorMath.ts`, pure + unit-tested)

A line's cost = `baseQuantity(line) × unitCost`. `baseQuantity` per form:

- `pieces`: `timesPerDay × pillsPerDose × days`
- `liquid` (drops mode): `(dropsPerDose × timesPerDay × days) ÷ dropsPerMl`
- `liquid` (fixed mode): `ml`
- `packaging` / `flat`: `quantity`

Defaults (editable per line): `timesPerDay 4`, `pillsPerDose 4`, `days 14`,
`dropsPerMl 20`, `quantity 1`. Default fee `150`.

### Data layer

- `calculatorRepo.ts` — own read-only query into the `inventory` collection
  (mirrors `fundsRepo.listIncome` reading consultations, to respect feature
  boundaries). Returns only **priced** items as
  `PricedItem { id, name, form, unitCost, baseUnitLabel }`.
- `useCalculator.ts` — `usePricedItems()` TanStack Query hook.

### Page (`CalculatorPage.tsx`)

- A **basket** of lines (local state, nothing persisted). Each line: pick a priced
  item → inputs adapt to its form (liquid lines also choose drops vs fixed) →
  shows the line cost. Add line / remove line / one-tap "+ dispensing bottle".
- Footer: **total medicine cost**, an editable **fee** (default ₹150) and the
  derived **margin** (`fee − total`).
- `QueryStates` for loading; empty state when no priced items:
  "Add purchase cost to inventory items to use the calculator."

## Data model / rules impact

- No new collection. `inventory` docs gain three optional fields.
- Firestore rules unchanged — the catch-all `match /{document=**}` already covers
  `inventory`.

## Testing

- TDD for the logic: `inventorySchema` (new fields/helpers) and `calculatorMath`
  (all five base-quantity cases). UI built consistent with existing form pages;
  a light render test for the calculator if cheap.
- `npm run lint`, `npm test`, `npm run build` all green before completion.
