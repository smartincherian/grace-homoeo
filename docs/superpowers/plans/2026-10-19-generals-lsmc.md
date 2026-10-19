# Generals & LSMC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record a patient-level homoeopathic case record — Generals and LSMC rows — entered from the consultation form, linked to the visit it was recorded in, and shown on the patient page, the consultation page and the history drawer.

**Architecture:** Two new top-level Firestore collections:
- `generals/{consultationId}` holds one snapshot per visit.
- `lsmc/{autoId}` holds zero or more rows per visit.

Both are keyed by `patientId` and written in the same `writeBatch` as the consultation. Reads go through a new `caseRecordRepo.ts` plus TanStack Query hooks. The form gains two sections: `GeneralsFormSection`, and `LsmcEditor` (which uses `useFieldArray`). Read-only display uses `GeneralsView` and `LsmcTable`.

**Tech Stack:** Vite + React 18 + TypeScript, MUI v6, react-hook-form + zod, TanStack Query, Firebase v10 Firestore, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-10-19-generals-lsmc-design.md`

## Global Constraints

- **Optional fields:** every new field is optional. Strings default to `""`, and `lmp` is `number | null` (epoch ms).
- **Field keys:**
  - Generals: `appetite`, `thirst`, `bladder`, `bowel`, `sleepDreams`, `lmp`, `menarche`, `menopause`, `menstrualPain`, `clots`, `moodSwings`, `leucorrhoea`, `perspirationOdour`, `perspirationStaining`, `perspirationRemarks`, `sexualHistory`, `pastHistory`, `mentals`, `allergicHistory`.
  - LSMC row: `location`, `sensation`, `modality`, `concomitant`.
- **Labels** (exact):
  - Appetite, Thirst, Bladder, Bowel, Sleep & dreams
  - Menstrual: LMP, Menarche, Menopause, Pain, Clots, Mood swings, Leucorrhoea
  - Perspiration: Odour, Staining, Remarks
  - History: Sexual history, Past history, Mentals, Allergic history
  - LSMC: Location, Sensation, Modality, Concomitant
- **Menstrual group:** rendered in the form only when `patient.gender === "Female"`.
- **Blank values:** hidden on every read-only view. An all-blank block is hidden entirely.
- **Pre-fill rules:**
  - LMP is never pre-filled; it is set to `null` in every baseline.
  - A visit stores generals only when they differ from the baseline (see Task 5).
- **Write rules:**
  - An LSMC row whose four cells are all blank is never written.
  - A generals doc is never written when every field is blank. On edit, an existing one is deleted instead.
- **Legacy fields:** the per-visit `generals`, `allergy` and `history` are removed from the form schema. Saving an edit must not overwrite or clear their stored values.
- **Rules and indexes:** no Firestore rules change and no composite index. Queries are `where("patientId"|"consultationId","==",x)`, sorted client-side.
- **Display formats:** dates via `formatDate` / `daysAgoLabel` from `src/lib/dates.ts`. Never `alert()`; feedback goes through `useToast`.

## Review Focus

1. **Editing an old visit that has legacy `generals`/`allergy`/`history` text:** after saving, that text is still stored and still displayed (Task 2 test).
2. **Changing a consultation's date on edit:** its generals doc and LSMC rows get the new `date`, so the patient's "current generals" and the LSMC ordering follow (Task 2 test).
3. **Pre-fill race on a new visit:** the latest generals load after the form mounts. They must fill the Generals section once, without overwriting anything the doctor has already typed there (Task 5 test).
4. **Edit that removes all LSMC rows or blanks all generals:** the linked docs are deleted, and the patient page falls back to the previous visit's generals (Task 2 test plus the Task 3 latest-selection test).
5. **Non-Female patient with stored menstrual values** (e.g. gender corrected later): the form hides the group but keeps the values, so saving doesn't erase them. Read-only views still show them, since blank-hiding is the only filter (Task 5 test).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/features/consultations/caseRecordSchema.ts` (create) | zod `generalsSchema`, `lsmcRowSchema`, types, `EMPTY_GENERALS`, `isGeneralsBlank`, `isLsmcRowBlank` |
| `src/features/consultations/consultationSchema.ts` (modify) | Drop `generals`/`allergy`/`history` from form schema; keep them optional on `Consultation` |
| `src/features/consultations/consultationsRepo.ts` (modify) | Create/update batches also write generals + LSMC |
| `src/features/consultations/caseRecordRepo.ts` (create) | Reads: generals by consultation / patient-latest; LSMC by patient / consultation |
| `src/features/consultations/useCaseRecord.ts` (create) | Query hooks for the above |
| `src/features/consultations/useConsultations.ts` (modify) | Mutation signatures + invalidation |
| `src/features/consultations/GeneralsFormSection.tsx` (create) | Generals inputs (form) |
| `src/features/consultations/LsmcEditor.tsx` (create) | LSMC rows editor (form) |
| `src/features/consultations/ConsultationFormPage.tsx` (modify) | Wire sections, pre-fill, submit |
| `src/features/consultations/GeneralsView.tsx` (create) | Read-only generals, blanks hidden |
| `src/features/consultations/LsmcTable.tsx` (create) | Read-only LSMC table, styled like `ConsultationHistory` |
| `src/features/consultations/ConsultationFields.tsx` (modify) | Add visit's generals + LSMC; legacy notes |
| `src/features/patients/PatientDetailPage.tsx` (modify) | Generals card + LSMC table |

---

### Task 1: Case-record schemas and consultation form schema change

**Files:**
- Create: `src/features/consultations/caseRecordSchema.ts`
- Create: `src/features/consultations/caseRecordSchema.test.ts`
- Modify: `src/features/consultations/consultationSchema.ts`
- Modify: `src/features/consultations/consultationSchema.test.ts`

**Interfaces:**
- Produces:
  - `generalsSchema` (zod object with the 19 keys above; strings `.trim().default("")`, `lmp: z.number().int().nullable().default(null)`)
  - `type Generals = z.infer<typeof generalsSchema>`
  - `EMPTY_GENERALS: Generals`
  - `lsmcRowSchema` (`id: z.string().optional()` plus the four trimmed strings defaulting `""`)
  - `type LsmcRowInput = z.infer<typeof lsmcRowSchema>`
  - `isGeneralsBlank(g: Generals): boolean`
  - `isLsmcRowBlank(r: LsmcRowInput): boolean`
  - `interface GeneralsRecord extends Generals { id: string; patientId: string; consultationId: string; date: number; updatedAt: number }`
  - `interface LsmcRow { id: string; patientId: string; consultationId: string; date: number; location: string; sensation: string; modality: string; concomitant: string; createdAt: number }`
  - `type CaseRecordInput = { generals: Generals | null; lsmc: LsmcRowInput[] }`, where `null` means "leave generals alone"
  - `generalsEqual(a: Generals, b: Generals): boolean`, which compares trimmed strings and `lmp` by value
  - `toBaseline(rec: GeneralsRecord | null): Generals`, which strips the meta fields and sets `lmp: null` (or returns `EMPTY_GENERALS` for `null`)
  - `consultationFormSchema` without `generals`, `allergy`, `history`
  - `Consultation` gains `generals?: string; allergy?: string; history?: string`

- [ ] **Step 1: Write failing tests** in `caseRecordSchema.test.ts`:
  - `generalsSchema.parse({})` equals `EMPTY_GENERALS` (all `""`, `lmp: null`).
  - `isGeneralsBlank(EMPTY_GENERALS)` is `true`.
  - `isGeneralsBlank({ ...EMPTY_GENERALS, thirst: "  " })` is `true`, because strings are trimmed before the check.
  - `isGeneralsBlank({ ...EMPTY_GENERALS, lmp: 1 })` is `false`.
  - `isLsmcRowBlank({ location: "", sensation: " ", modality: "", concomitant: "" })` is `true`, and becomes `false` when `location: "head"`.
  - `generalsEqual({ ...EMPTY_GENERALS, thirst: "low " }, { ...EMPTY_GENERALS, thirst: "low" })` is `true`, and becomes `false` when `lmp` differs.
  - `toBaseline({ ...rec, lmp: 5, thirst: "low" })` has `lmp: null`, `thirst: "low"` and no `patientId` key.

  In `consultationSchema.test.ts`, add a test that `consultationFormSchema.parse({ date: 1, amount: 0, paymentMode: "Cash", generals: "x" })` has no `generals` key, because zod strips unknown keys.

- [ ] **Step 2:** Run `npm test -- caseRecordSchema consultationSchema`. Expected: FAIL (module missing / `generals` present).
- [ ] **Step 3:** Implement `caseRecordSchema.ts` and edit `consultationSchema.ts` per Interfaces.
- [ ] **Step 4:** Run `npm test -- caseRecordSchema consultationSchema`. Expected: PASS.
  - `npx tsc -b` will now flag `generals`/`allergy`/`history` usages in `ConsultationFormPage.tsx`, `consultationsRepo.test.ts` and `ConsultationFields.tsx`. Make the minimal fix to each:
    - drop the three keys from `DEFAULTS`, `TEXT_FIELDS` and the `reset` call, and from the repo test fixture
    - in `ConsultationFields`, read them as optional
  - Then rerun `npm test`. Expected: all PASS.
- [ ] **Step 5: Commit**

  ```bash
  git add src/features/consultations
  git commit -m "feat(consultations): generals & LSMC schemas; drop legacy text fields from form"
  ```

### Task 2: Atomic writes of generals + LSMC with the consultation

**Files:**
- Modify: `src/features/consultations/consultationsRepo.ts`
- Modify: `src/features/consultations/consultationsRepo.test.ts`
- Modify: `src/features/consultations/useConsultations.ts`

**Interfaces:**
- Consumes: Task 1 types.
- Produces:
  - `createConsultation(patient: ConsultationPatientRef, values: ConsultationFormValues, record: CaseRecordInput): Promise<string>`
  - `updateConsultation(id: string, patientId: string, values: ConsultationFormValues, record: CaseRecordInput, existingLsmcIds: string[]): Promise<void>`
  - `useCreateConsultation(patientId)` with mutation vars `{ patient, values, record }`
  - `useUpdateConsultation(patientId)` with mutation vars `{ id, values, record, existingLsmcIds }`
  - On success, both also invalidate `["generals", patientId]`, `["generals", "visit", cid]`, `["lsmc", patientId]`, `["lsmc", "visit", cid]`. For create, `cid` is the returned id.

**Behaviour:**

- **Create:** the batch adds `set(doc(db,"generals",newId), { ...generals, patientId, consultationId: newId, date: values.date, updatedAt: now })` only when `record.generals !== null && !isGeneralsBlank(record.generals)`. The page has already decided "changed vs baseline". It also adds one `set(doc(collection(db,"lsmc")), { location, sensation, modality, concomitant, patientId, consultationId: newId, date: values.date, createdAt: now })` per non-blank row. The `lastVisitAt` update stays.
- **Update:** one batch containing:
  - `update` of the consultation with `{ ...values }` only, so legacy keys stay untouched
  - generals:
    - `record.generals === null`: no generals write at all
    - not blank: `set` (full replace)
    - blank: `delete(doc(db,"generals",id))`
  - each non-blank row with an `id` that is in `existingLsmcIds`: `update` of its four cells plus `date`
  - each non-blank row without an `id`: a new `set`, as on create
  - each id in `existingLsmcIds` that is absent from the non-blank submitted rows: `delete`

  Replace the current `updateDoc` call with this batch. Deleting the generals doc when none exists is harmless in Firestore.

- [ ] **Step 1: Write failing tests** in `consultationsRepo.test.ts`. Extend the mock with `batchDelete` and `delete` on `writeBatch`. Make `doc` return `{ id: "generated-id", path: a.slice(1).join("/") }` so tests can tell targets apart.
  - `"create writes a generals snapshot linked to the new consultation"`: the generals `set` payload has `consultationId: "generated-id"`, `patientId: "p1"`, `date: 500` and `thirst: "thirstless"`.
  - `"create writes no generals when record.generals is null"`
  - `"create skips generals when all blank and skips blank LSMC rows"`: given `record = { generals: EMPTY_GENERALS, lsmc: [{location:"head",...}, {all blank}] }`, there are exactly 2 `set` calls (consultation and one LSMC row).
  - `"update keeps legacy text fields untouched"`: the consultation `update` payload has no `generals`, `allergy` or `history` key.
  - `"update syncs LSMC rows: edits kept, adds new, deletes removed"`: given `existingLsmcIds = ["l1","l2"]` and rows `[{id:"l1",location:"knee"}, {location:"new"}]`, expect `update` on l1, `set` for the new row, and `delete` on l2.
  - `"update deletes the generals doc when all fields are blank"`
  - `"update leaves generals alone when record.generals is null"`: no `set` or `delete` targets `generals/…`.
  - `"update writes the new date onto generals and LSMC rows"`: given `values.date = 900`, the generals payload and the l1 update both have `date: 900`.
- [ ] **Step 2:** Run `npm test -- consultationsRepo`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement the two repo functions per Behaviour, then update the two mutation hooks per Interfaces. Use a `toLsmcCells(r)` helper that picks the four cells.
- [ ] **Step 4:** Run `npm test -- consultationsRepo` and then `npx tsc -b`. `ConsultationFormPage` call sites will fail type-check. Fix them minimally by passing `record: { generals: EMPTY_GENERALS, lsmc: [] }` and `existingLsmcIds: []`; Task 5 replaces this. Run `npm test`. Expected: all PASS.
- [ ] **Step 5: Commit** with the message `feat(consultations): write generals & LSMC atomically with the consultation`.

### Task 3: Case-record reads and hooks

**Files:**
- Create: `src/features/consultations/caseRecordRepo.ts`
- Create: `src/features/consultations/caseRecordRepo.test.ts`
- Create: `src/features/consultations/useCaseRecord.ts`

**Interfaces:**
- Produces:
  - `getConsultationGenerals(cid: string): Promise<GeneralsRecord | null>`, which does a `getDoc` on `generals/{cid}`
  - `listPatientGenerals(patientId: string): Promise<GeneralsRecord[]>`, sorted by `date` desc, then `updatedAt` desc
  - pure helpers:
    - `latestGenerals(list): GeneralsRecord | null`, which returns `list[0]`
    - `latestGeneralsBefore(list, date: number): GeneralsRecord | null`, which returns the first record with `r.date < date`
  - `listLsmcByPatient(patientId: string): Promise<LsmcRow[]>`, sorted by `date` desc, then `createdAt` asc
  - `listLsmcByConsultation(cid: string): Promise<LsmcRow[]>`, sorted by `createdAt` asc
  - Hooks, with these query keys:

    | Hook | Query key |
    |---|---|
    | `usePatientGenerals(patientId?)` (returns the sorted list) | `["generals", patientId]` |
    | `useConsultationGenerals(cid?)` | `["generals", "visit", cid]` |
    | `usePatientLsmc(patientId?)` | `["lsmc", patientId]` |
    | `useConsultationLsmc(cid?)` | `["lsmc", "visit", cid]` |

    Each hook is `enabled` only when its id is set.
  - Doc mappers default missing strings to `""` and missing `lmp` to `null`.

- [ ] **Step 1: Write failing tests** (mock `firebase/firestore` as in `consultationsRepo.test.ts`):
  - `"patient generals are sorted by date, then updatedAt, newest first"`
  - `"latestGenerals is null for an empty list"`
  - `"latestGeneralsBefore skips records on or after the given date"`
  - `"patient LSMC rows are newest visit first, in entry order within a visit"`
  - `"generals mapper fills missing fields with defaults"`
- [ ] **Step 2:** Run `npm test -- caseRecordRepo`. Expected: FAIL.
- [ ] **Step 3:** Implement the repo and hooks.
- [ ] **Step 4:** Run `npm test -- caseRecordRepo`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `feat(consultations): case-record read repo and hooks`.

### Task 4: Read-only views — `GeneralsView`, `LsmcTable`, `ConsultationFields`

**Files:**
- Create: `src/features/consultations/GeneralsView.tsx`, `GeneralsView.test.tsx`
- Create: `src/features/consultations/LsmcTable.tsx`, `LsmcTable.test.tsx`
- Modify: `src/features/consultations/ConsultationFields.tsx`, `ConsultationFields.test.tsx`

**Interfaces:**
- Consumes: Task 1 types; Task 3 `useConsultationGenerals`, `useConsultationLsmc`.
- Produces:
  - `GeneralsView({ generals }: { generals: Generals })` renders labelled values in groups: the top five, then Menstrual, Perspiration and History, under overline sub-headings.
    - Blank fields are hidden, and a group with no non-blank fields is hidden.
    - `lmp` is shown via `formatDate`.
    - It returns `null` when `isGeneralsBlank`.
  - `LsmcTable({ rows, showDate, onSelect }: { rows: LsmcRow[]; showDate?: boolean; onSelect?: (consultationId: string) => void })` is styled like `ConsultationHistory`'s table: a Card, overline headers and an `accentFor(i)` left edge.
    - Columns are Visit (only when `showDate`), Location, Sensation, Modality, Concomitant.
    - Blank cells show a light grey "—".
    - Rows are clickable only when `onSelect` is given.
    - It returns `null` for an empty `rows`.
    - To avoid duplicating the styling, move `TABLE_SX`, `Cell` and `WIDE_ONLY` out of `ConsultationHistory.tsx` into a new `src/features/consultations/tableStyles.tsx` and import them in both files.
  - `ConsultationFields({ c })` additionally fetches the visit's generals and LSMC through the hooks. Under the clinical card it renders a **Generals** heading with `GeneralsView`, then an **LSMC** heading with `LsmcTable` (no date column).
    - Case notes include legacy "Generals (notes)", "Allergy" and "History" when non-empty.
    - "No details recorded" shows only when the clinical fields, case notes, generals and LSMC are all empty.

- [ ] **Step 1: Write failing tests:**
  - `GeneralsView`:
    - `"shows only filled generals, grouped"`: given `thirst` and `perspirationOdour` filled, "Thirst" and "Odour" are visible; "Appetite" and "Menstrual" are absent.
    - `"formats LMP as a date"`
    - `"renders nothing when blank"`
  - `LsmcTable`:
    - `"lists rows with the visit date when showDate"`
    - `"calls onSelect with the consultation id on row click"`
  - `ConsultationFields` (mock `./useCaseRecord`):
    - `"shows the visit's generals and LSMC"`
    - `"shows legacy notes when present"`
    - Update the existing "No details recorded" test so it also mocks empty generals and LSMC.
- [ ] **Step 2:** Run `npm test -- GeneralsView LsmcTable ConsultationFields`. Expected: FAIL.
- [ ] **Step 3:** Implement per Interfaces. `ConsultationDetailPage.test.tsx` and `ConsultationHistory.test.tsx` render `ConsultationFields`, so add `vi.mock("./useCaseRecord", …)` returning `{ data: null }` / `{ data: [] }` there too.
- [ ] **Step 4:** Run `npm test`. Expected: all PASS.
- [ ] **Step 5: Commit** with the message `feat(consultations): show generals and LSMC on consultation views`.

### Task 5: Consultation form — Generals section, LSMC editor, pre-fill

**Files:**
- Create: `src/features/consultations/GeneralsFormSection.tsx`
- Create: `src/features/consultations/LsmcEditor.tsx`
- Modify: `src/features/consultations/ConsultationFormPage.tsx`, `ConsultationFormPage.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - The form value type `ConsultationFormValues & { generals: Generals; lsmc: LsmcRowInput[] }`, validated by `consultationFormSchema.extend({ generals: generalsSchema, lsmc: z.array(lsmcRowSchema) })`. The page splits it into `values` and `record` before calling the mutations.
  - `GeneralsFormSection({ control, register, showMenstrual }: { control: Control<FormValues>; register: UseFormRegister<FormValues>; showMenstrual: boolean })`
    - Uses multiline `TextField`s named `generals.<key>`.
    - LMP is a `type="date"` field converted with `msToDateInput` / `dateInputToMs`. An empty input maps to `null`.
  - `LsmcEditor({ control, register })` uses `useFieldArray({ name: "lsmc" })`.
    - On `sm` and up, rows render as a table with the four labelled text boxes and a remove `IconButton` (aria-label "Remove row"). On phones, each row stacks as a small card.
    - An **Add row** button sits below. Rows start empty.
    - Each row keeps its `id` as a hidden registered field, so edits are detected.

**Page behaviour:**

- **Section order:** after Complaint come Diagnosis, Tests required, Prescription, Differential remedy, Followup criteria, Remarks, Amount and Payment mode. Then the **Generals** heading with `GeneralsFormSection`, then the **LSMC** heading with `LsmcEditor`, then Save/Cancel.
- **`showMenstrual`:** `patient?.gender === "Female"`. Hidden menstrual inputs stay in form state, because they are unregistered only visually: use conditional rendering with `shouldUnregister: false`, the default. Their values are therefore submitted unchanged.
- **New visit pre-fill:** the baseline is `toBaseline(latestGenerals(list))`. When `usePatientGenerals(patientId).data` first resolves, if the user hasn't touched any `generals.*` field (`!formState.dirtyFields.generals`), call `setValue("generals", baseline)`. Use a ref guard so this happens once. Keep the baseline in a ref for submit.
- **Edit load:** the existing `reset` also sets `generals` and `lsmc`. Reset only after the consultation, `useConsultationGenerals(cid)`, `useConsultationLsmc(cid)` and `usePatientGenerals(patientId)` are no longer pending.
  - `generals`: the visit's own record (meta stripped, LMP kept) if it exists. Otherwise `toBaseline(latestGeneralsBefore(list, consultation.date))`, which is also the baseline.
  - `lsmc`: from `useConsultationLsmc(cid)`.
- **`record.generals` on submit:**
  - the visit has its own record: the submitted generals
  - otherwise: `generalsEqual(submitted, baseline) ? null : submitted`
- **Submit:**
  - create: `{ patient, values, record }`
  - update: `{ id, values, record, existingLsmcIds }`, where `existingLsmcIds` is the ids loaded for this visit

- [ ] **Step 1: Write failing tests** in `ConsultationFormPage.test.tsx`. Mock `./useCaseRecord` and `usePatient` with a `gender` field.
  - `"submits generals and LSMC rows with a new consultation"`: type "thirstless" into Thirst, click **Add row**, and type "head" into Location. The create `record.generals.thirst` is "thirstless" and `record.lsmc[0].location` is "head".
  - `"pre-fills generals from the patient's latest record, except LMP"`: given the latest has `appetite: "good"` and an `lmp`, the Appetite input has the value "good" and the LMP input is empty.
  - `"does not save generals when the pre-filled values are unchanged"`: the create vars have `record.generals === null`.
  - `"saves the full generals snapshot when one field is changed"`: change Thirst; `record.generals` has the new thirst and the pre-filled appetite.
  - `"does not overwrite generals typed before the latest record loads"`: start with `data: undefined`, type into Appetite, rerender with data. The typed value remains.
  - `"shows menstrual fields only for female patients"`: the LMP label is absent for `Male` and present for `Female`.
  - `"keeps stored menstrual values when editing a non-female patient"`: in edit mode with generals `menarche: "13"` and gender `Male`, submit. `record.generals.menarche` is `"13"`.
  - `"edit passes existing LSMC ids so removed rows are deleted"`: load `[{id:"l1"},{id:"l2"}]`, remove the second row, and save. The update vars have `existingLsmcIds: ["l1","l2"]` and `record.lsmc` contains only `l1`.
  - Remove the old assertions about the Generals, Allergy and History text boxes.
- [ ] **Step 2:** Run `npm test -- ConsultationFormPage`. Expected: FAIL.
- [ ] **Step 3:** Implement per Interfaces and Page behaviour.
- [ ] **Step 4:** Run `npm test`, `npx tsc -b` and `npm run lint`. Expected: all PASS, with lint at 0 errors (the 2 warnings already there are fine).
- [ ] **Step 5: Commit** with the message `feat(consultations): generals and LSMC sections in the consultation form`.

### Task 6: Patient page — current Generals and all LSMC

**Files:**
- Modify: `src/features/patients/PatientDetailPage.tsx`, `PatientDetailPage.test.tsx`

**Interfaces:**
- Consumes: `usePatientGenerals`, `usePatientLsmc` (Task 3); `GeneralsView`, `LsmcTable` (Task 4).

**Behaviour:** the page order is header card, then **Generals**, then **LSMC**, then Consultation history.
- **Generals:** a `Card` with heading "Generals" and, underneath, "Updated {formatDate(date)} · {daysAgoLabel(date)}", followed by `GeneralsView`. The whole card is hidden when there is no record or it is blank.
- **LSMC:** heading "LSMC" with `LsmcTable rows showDate onSelect={(cid) => navigate(`/patients/${id}/consultations/${cid}`)}`. Hidden when there are no rows.

- [ ] **Step 1: Write failing tests** (mock `../consultations/useCaseRecord`):
  - `"shows the current generals with when they were updated"`: "Thirst", "thirstless" and `/Updated 1 Jan 2000/` are visible.
  - `"lists the patient's LSMC rows and opens the linked consultation on click"`
  - `"hides Generals and LSMC when the patient has none"`
- [ ] **Step 2:** Run `npm test -- PatientDetailPage`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`, `npx tsc -b`, `npm run lint` and `npm run build`. Expected: all PASS and the build succeeds.
- [ ] **Step 5: Commit** with the message `feat(patients): show current generals and LSMC on the patient page`.
