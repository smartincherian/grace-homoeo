# Generals & LSMC — patient-level case record, linked to consultations

**Date:** 2026-10-19
**Branch:** `feature/patient-last-visit` (builds on the consultation details page, history table/drawer and `ConsultationFields` work there)

## Intent

The doctor wants a structured homoeopathic case record for each patient, made of two parts:

- **Generals**, e.g. appetite, thirst, sleep and menstrual details. These describe the patient as a whole and change slowly.
- **LSMC** (Location, Sensation, Modality, Concomitant) rows, which describe individual complaints.

Both belong to the **patient**, but every entry is **linked to the consultation** in which it was recorded. That way the doctor can see the patient's current picture and also when each piece was noted. Both are entered from the Add/Edit consultation form.

## Goals

1. The consultation form gets a **Generals** section and a separate **LSMC** section.
2. The **patient page** shows the patient's current Generals and all of their LSMC rows.
3. The **consultation page** and the **history drawer** show the Generals and LSMC recorded at that visit.
4. Generals **pre-fill** from the patient's latest recorded generals when adding a consultation, so the doctor only changes what is different. **LMP is never pre-filled**, because it changes every cycle. A visit stores Generals **only when the doctor changed something** compared with the pre-fill, so "Updated <date>" always means a real change.
5. **Menstrual details** appear only for patients whose gender is `Female`.

## Non-goals

- No AI summary (a separate, later piece of work).
- No editing of Generals or LSMC from the patient page. Edits always go through a consultation.
- No consultation delete flow. None exists today; don't add one.
- No migration of old data.

## Anti-goals

- Losing any existing consultation text: the old `generals`, `allergy` and `history` values.
- Making anything required. **Every new field is optional free text** (LMP is an optional date).
- Breaking the "blank fields are hidden" rule on read-only views.

## Fields

### Generals (one set per consultation that records them)

| Group | Field (label → key) |
|---|---|
| — | Appetite → `appetite`, Thirst → `thirst`, Bladder → `bladder`, Bowel → `bowel`, Sleep & dreams → `sleepDreams` |
| Menstrual (Female only) | LMP → `lmp` (epoch ms or `null`), Menarche → `menarche`, Menopause → `menopause`, Pain → `menstrualPain`, Clots → `clots`, Mood swings → `moodSwings`, Leucorrhoea → `leucorrhoea` |
| Perspiration | Odour → `perspirationOdour`, Staining → `perspirationStaining`, Remarks → `perspirationRemarks` |
| History | Sexual history → `sexualHistory`, Past history → `pastHistory`, Mentals → `mentals`, Allergic history → `allergicHistory` |

All are strings defaulting to `""`, except `lmp`. Keys are flat to keep react-hook-form and zod simple. The user's "LMP, Date" is taken as a single LMP date field (builder's call, can be changed).

### LSMC row

`location`, `sensation`, `modality`, `concomitant`: strings, all optional. A row whose four cells are all blank is dropped on save.

## Data model (Firestore)

Both new collections are top-level, keyed by `patientId`, like `consultations`, so the patient page reads each with one `where("patientId","==",id)` query, sorted client-side. No composite index is needed. The existing rules wildcard (`signedIn()`) already covers new collections, so **no rules change** is needed.

- **`generals/{consultationId}`**: `{ patientId, consultationId, date, ...generalsFields, updatedAt }`.
  - The doc id is the consultation id, so there is at most one generals record per visit and edits are a plain `set`.
  - `date` is copied from the consultation.
- **`lsmc/{autoId}`**: `{ patientId, consultationId, date, location, sensation, modality, concomitant, createdAt }`.
  - A visit can have zero or more rows.

**"Current generals"** for a patient is the generals doc with the greatest `date`. On ties, the greatest `updatedAt` wins. Each doc is a **full snapshot** of all fields, written only at visits where something changed.

### Writes are atomic with the consultation

- **Create consultation:** the existing `writeBatch` also:
  - sets `generals/{newId}` only when the submitted generals **differ from the pre-fill baseline** (defined under Form behaviour) and are not all blank
  - sets one `lsmc` doc per non-blank row
- **Update consultation:** in one batch:
  - update the consultation
  - Generals:
    - **if the visit already has its own generals doc:** replace it, or delete it if all fields are now blank
    - **if it doesn't:** create one only when the values differ from the baseline
  - for that visit's LSMC rows: update the kept rows, create the new ones, delete the removed ones
  - if the consultation `date` changed, write the new `date` onto its generals and LSMC docs

## Form behaviour (`ConsultationFormPage`)

- **Layout:** the existing fields stay, minus the three removed below. Below them come a **Generals** section and an **LSMC** section, each under its own heading.
  - Generals uses sub-headings for Menstrual, Perspiration and History.
  - The Menstrual group renders only when `patient.gender === "Female"`.
- **LSMC section:** a table with columns Location | Sensation | Modality | Concomitant.
  - Each cell is a text box, and each row has a remove button.
  - An **Add row** button sits below the table.
  - It starts with zero rows. Use react-hook-form `useFieldArray`.
  - On a phone, each row may stack as a small card of four text boxes instead of a table row (builder's call).
- **Pre-fill and baseline:**
  - **New consultation:** Generals start from the patient's current generals, with `lmp` set to `null`. This pre-fill is the **baseline**. LSMC starts empty, because LSMC rows are per complaint and get added fresh.
  - **Edit, visit has its own generals doc:** Generals load from that doc.
  - **Edit, visit has no generals doc:** Generals load from the latest generals dated *before* this visit, with `lmp` set to `null`. That is the baseline, and it is saved only if changed.
  - LSMC always loads that visit's own rows.
  - "Differ" means any field compares unequal after trimming. `lmp` compares by value.
- **Removed from the form:** the per-visit `generals`, `allergy` and `history` boxes.
  - They are dropped from `consultationFormSchema`.
  - `updateConsultation` must not overwrite them. `updateDoc` with only the form keys already leaves them alone.
  - The `Consultation` read type keeps them as optional legacy fields.

## Display

- **Patient page** (`PatientDetailPage`): the order is header card, then **Generals**, then **LSMC**, then Consultation history.
  - **Generals card:** shows the current generals, blank fields hidden, with "Updated 16 Jun 2026 · N days ago". It is hidden entirely if the patient has no generals.
  - **LSMC table:** all of the patient's rows, newest visit first, with a visit-date column. Clicking a row opens that consultation page. It reuses the history table's styling (card, overline headers, accent edge). It is hidden if there are no rows.
- **Consultation page and history drawer** (`ConsultationFields`) add a Generals block and a read-only LSMC table for that visit. Blank fields and empty blocks are hidden, and "No details recorded" still appears when everything is empty.
- **Legacy text:** when non-empty, old `generals`, `allergy` and `history` show in Case notes as "Generals (notes)", "Allergy" and "History".

## Code organisation (builder's call within these bounds)

- **Location:** generals and LSMC code live in the **consultations feature** (`src/features/consultations/`), because they are written in the consultation's batch.
  - Files: `generalsSchema.ts`, `lsmcSchema.ts`, and repo functions in or beside `consultationsRepo.ts`.
  - Hooks: `usePatientGenerals(patientId)`, `useConsultationGenerals(cid)`, `usePatientLsmc(patientId)`, `useConsultationLsmc(cid)`.
- **Boundaries:** the patients feature already imports consultation hooks and components, and that stays acceptable.
- **Cache invalidation:** create and update mutations invalidate the new query keys alongside the existing ones.
- **Testing:** TDD with Vitest + RTL, mocking `firebase/firestore` as in `consultationsRepo.test.ts`. Cover:
  - batch contents on create and update, including LSMC add, edit and remove
  - the date change propagating to generals and LSMC
  - generals pre-fill on a new visit
  - Menstrual shown only for Female patients
  - blank hiding on display

## Decisions made by Claude (please check)

- Generals are stored as one full snapshot per visit (`generals/{consultationId}`), and "current" is the latest by date. *(Confirmed: a snapshot is saved only when something changed. LMP is not pre-filled.)*
- New visits pre-fill Generals from the latest snapshot. LSMC is not pre-filled.
- When a patient is not Female, the hidden Menstrual values are kept, not cleared. "Other" does not see the Menstrual group.
- The old Generals, Allergy and History boxes are removed from the form, and their old text is still displayed.
- "LMP, Date" is a single LMP date field.
- Patient page order: header, Generals, LSMC, history.
- No editing of Generals or LSMC outside a consultation.

## Revision — Generals as field-by-field history (supersedes pre-fill / baseline)

Most generals stay the same between visits. The doctor records only what is **new** at a visit.

- **Form:** Generals is a table, one row per field, with three columns:
  - **Field**
  - **Present / history** (read-only), drawn from earlier visits:
    - **Present:** the latest non-blank value, with its visit date.
    - **History:** older values beneath it, newest first. Consecutive repeats are collapsed and keep the date the value was first entered.
  - **This visit:** starts **empty**; blank means "no change".
- **No pre-fill and no baseline.** A visit stores a generals doc with just what was typed, and only when something was typed. On edit, blanking every field deletes that visit's doc.
- **"Earlier" means:**
  - new visit: all of the patient's visits
  - editing: other visits dated on or before this one
- **LSMC on the form:** earlier visits' rows show read-only, with their dates, above this visit's editable rows.
- **Patient page:** the Generals card becomes the same read-only table across all visits (Field, Present with date, history). The "Updated …" line is dropped.
- **Consultation page and drawer:** unchanged. They show only what was entered at that visit.
- **Save gating:**
  - **New visit:** never waits for history, because nothing can be overwritten.
  - **Edit:** still waits for that visit's own generals and LSMC to load, and is blocked if they fail.
