# AI Patient Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a clinic owner store their own Gemini API key, encrypted, and let any member generate, save and re-run a short bullet summary of a patient from the patient detail page.

**Architecture:** A new `functions/` package (Cloud Functions 2nd gen, `asia-south1`) holds three callables (`saveAiKey`, `removeAiKey`, `summarizePatient`) and one Firestore delete trigger. The key is KMS-encrypted into a client-locked `aiSecrets/{clinicId}` doc. The client only calls callables and reads `settings/ai` (status) and `patientSummaries/{patientId}`. Handlers are pure functions taking injected `Deps`, so they unit-test without emulators.

**Tech Stack:** firebase-functions v6 (`onCall`, `onDocumentDeleted`), firebase-admin ^14, @google-cloud/kms ^5, zod ^3.23.8, Gemini REST v1beta via `fetch`, vitest. Client: React + MUI + TanStack Query + `firebase/functions`.

**Spec:** `docs/superpowers/specs/2026-10-22-ai-patient-summary-design.md`

## Global Constraints

- Region `asia-south1` for functions and the KMS key ring `llm-keys` / key `clinic-api-keys`. Runtime `nodejs22`.
- The plaintext key is never logged, returned, cached client-side or placed in an error message. It is sent to Gemini only in the `x-goog-api-key` header.
- KMS encryption uses `additionalAuthenticatedData = Buffer.from(clinicId)`.
- Never sent to Gemini: `name, nameLower, phone, place, serialNo, amount, paymentMode`, any IDs, emails.
- Caps: latest 30 consultations, 50 LSMC rows, ~40,000 prompt characters (drop the oldest consultations first).
- Output: 1–8 bullets, each 1–300 chars after trim. Gemini `temperature 0.2`, `maxOutputTokens 600`, JSON with schema `{ bullets: string[] }`, 30 s timeout.
- Rate limit per clinic: 30/hour, 200/day. The same patient can't be re-run within 20 s.
- Superadmin email `smartin.cherian@gmail.com`: exempt from trial and owner checks, may act on any clinic.
- Error contract (exact messages):
  - not a member / wrong clinic / inactive → `permission-denied` "You don't have access to this clinic."
  - not owner → `permission-denied` "Only the clinic owner can change the AI key."
  - trial ended → `failed-precondition`, details `{ reason: "trial-ended" }`, "The clinic's trial has ended."
  - no key → `failed-precondition`, details `{ reason: "no-key" }`, "AI summary is off. Ask the owner to add a Gemini key in Settings."
  - key rejected (Gemini 400/401/403) → `failed-precondition`, details `{ reason: "key-rejected" }`, "The clinic's Gemini key was rejected. Ask the owner to replace it in Settings." (when saving: "That key was rejected by Gemini.")
  - Gemini 429 → `resource-exhausted` "Gemini quota reached for this key, try again later."
  - our rate limit → `resource-exhausted` "Summary limit reached, try again in N minutes." (for the 20 s guard: "A summary was just requested, wait a moment.")
  - bad output / other → `internal` "The summary couldn't be generated, try again."
- Homoeo-only generals (left out for `general` clinics): `mentals, perspirationOdour, perspirationStaining, perspirationRemarks`. *Correction to the spec:* sleep & dreams stays, because general clinics show it as "Sleep". Also left out for general clinics: LSMC rows and `differentialRemedy`.
- UI copy is fixed by the spec (Settings notice, card caption "AI-generated from the record. Check before relying on it.", no-key text).

## Review Focus

1. **A patient with no consultations, no dob and no generals.** The prompt still builds (age "unknown"), and Gemini is asked anyway. The expected result is one bullet saying the record is thin. Test in Task 2: `buildCaseRecord` with only gender returns text containing "No consultations recorded".
2. **The name is a substring of another word** (patient "Anu", remarks "continuous pain"). Redaction must be whole-word only. Test in Task 2.
3. **A Gemini 200 response with no candidates, or blocked by safety** (`promptFeedback.blockReason`, empty `candidates`). This must map to `internal`, not crash. Test in Task 3.
4. **Owner saves a new key while the old one exists.** The doc is overwritten, `last4` updates, and the old ciphertext is gone. Test in Task 5.
5. **Two quick taps on Summarize.** The client button is disabled while pending, and the server's 20 s guard rejects the second call. Tests in Task 4 (limiter) and Task 9 (button disabled while pending).

---

## File map

```
functions/
  package.json, tsconfig.json, vitest.config.ts, .gitignore (lib/, node_modules/)
  src/index.ts          — wires onCall/onDocumentDeleted to handlers with real deps
  src/deps.ts           — Deps interface + real implementation (admin Firestore, KMS, fetch, Date.now)
  src/access.ts         — assertAccess
  src/caseRecord.ts     — buildCaseRecord (prompt text from patient data), redactName, featuresFor
  src/gemini.ts         — GEMINI_MODEL, validateGeminiKey, generateBullets, mapGeminiError
  src/crypto.ts         — encryptKey / decryptKey (KMS)
  src/rateLimit.ts      — checkAndCount
  src/handlers.ts       — saveAiKey, removeAiKey, summarizePatient, cleanupClinic
  src/*.test.ts
firebase.json           — + functions block, + functions emulator port 5001
firestore.rules         — aiSecrets, aiUsage, patientSummaries
rules-tests/firestore.rules.test.ts — new cases
src/lib/firebase.ts     — export functions
src/lib/aiSummary.ts (+ test) — schemas, hooks, callable wrappers
src/features/access/clinicAdminRepo.ts — CLINIC_COLLECTIONS += patientSummaries
src/features/patients/patientsRepo.ts  — deletePatient removes the summary
src/features/settings/AiSummarySection.tsx (+ test), SettingsPage.tsx
src/features/patients/PatientSummaryCard.tsx (+ test), PatientDetailPage.tsx
CLAUDE.md, package.json (release script)
```

---

### Task 1: Functions package scaffold + `assertAccess`

**Files:**
- Create: `functions/package.json`, `functions/tsconfig.json`, `functions/vitest.config.ts`, `functions/.gitignore`, `functions/src/deps.ts`, `functions/src/access.ts`
- Test: `functions/src/access.test.ts`
- Modify: `firebase.json` (add `"functions": [{ "source": "functions", "codebase": "default", "runtime": "nodejs22", "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"] }]` and `"functions": { "port": 5001 }` under emulators), root `tsconfig.json`/eslint ignore `functions/` if root tooling picks it up.

**Interfaces:**
- Produces, in `deps.ts`:
  ```ts
  export interface Store {            // thin wrapper over admin Firestore, easy to fake
    get(path: string): Promise<Record<string, unknown> | null>;
    set(path: string, data: Record<string, unknown>): Promise<void>;
    delete(path: string): Promise<void>;
    query(collection: string, field: string, value: string): Promise<Record<string, unknown>[]>;
    transaction<T>(fn: (tx: { get: Store["get"]; set: Store["set"] }) => Promise<T>): Promise<T>;
  }
  export interface Deps {
    store: Store;
    kms: { encrypt(plain: string, aad: string): Promise<string>; decrypt(cipher: string, aad: string): Promise<string> };
    fetch: typeof fetch;
    now(): number;
  }
  export function realDeps(): Deps;
  export const SUPER = "smartin.cherian@gmail.com";
  ```
- Produces, in `access.ts`:
  ```ts
  export interface Caller { email: string; name: string; superadmin: boolean }
  export interface ClinicInfo { id: string; type: "homoeo" | "general"; ownerEmail: string }
  export async function assertAccess(
    deps: Deps,
    auth: { token: { email?: string; email_verified?: boolean; name?: string } } | undefined,
    clinicId: unknown,
    opts: { owner?: boolean; write?: boolean },
  ): Promise<{ caller: Caller; clinic: ClinicInfo }>;
  ```
  Throws `HttpsError` (from `firebase-functions/v2/https`) per the error contract. `clinicId` must match `^[a-z0-9]+(-[a-z0-9]+)*$`, otherwise `invalid-argument`. Email is lowercased. `type` uses the same default as `parseClinicType` (anything but `"general"` → `"homoeo"`). The trial check matches the rules' `trialOk`: `authorized === true || trialEndsAt == null || now < trialEndsAt`.

- [ ] **Step 1: Scaffold** `functions/package.json` (`"type": "module"`, `"main": "lib/index.js"`, `"engines": { "node": "22" }`, scripts `build: tsc`, `test: vitest run`). Dependencies: `firebase-functions@^6`, `firebase-admin@^14`, `@google-cloud/kms@^5`, `zod@^3.23.8`. Dev dependencies: `typescript`, `vitest`. Run `npm --prefix functions install`.
- [ ] **Step 2: Write failing tests** in `access.test.ts` with an in-memory fake `Store` (a `Map<string, object>`) and `now = () => 1_000`:
  - `rejects unauthenticated` → `unauthenticated`
  - `rejects unverified email` → `permission-denied`
  - `rejects malformed clinicId "../x"` → `invalid-argument`
  - `rejects member of another clinic` (allowedEmails `a@x.com` → `c2`) → `permission-denied` "You don't have access to this clinic."
  - `rejects inactive entry` (`active: false`) and `inactive clinic` → `permission-denied`
  - `rejects missing clinic doc` → `permission-denied`
  - `member passes without owner` → returns `{ caller: { email: "a@x.com", superadmin: false }, clinic: { type: "homoeo" } }`
  - `owner option rejects non-owner` → "Only the clinic owner can change the AI key."
  - `write option rejects expired trial` (`trialEndsAt: 500`) → `failed-precondition` with `details.reason === "trial-ended"`
  - `write passes when authorized despite expired trial`, and `when trialEndsAt missing`
  - `superadmin passes owner+write on any clinic with no allow-list entry`
  - `general type read from clinic doc`; `unknown type → homoeo`
- [ ] **Step 3: Run** `npm --prefix functions test -- access`. Expected: FAIL (module missing).
- [ ] **Step 4: Implement** `deps.ts` (`realDeps` uses `getFirestore()` from firebase-admin, a `KeyManagementServiceClient` (left as a stub here and filled in Task 4), global `fetch`, `Date.now`) and `access.ts`.
- [ ] **Step 5: Run** `npm --prefix functions test -- access && npm --prefix functions run build`. Expected: PASS, tsc clean.
- [ ] **Step 6: Commit** `feat(functions): scaffold functions package with clinic access check`

### Task 2: Case record builder (what Gemini sees)

**Files:**
- Create: `functions/src/caseRecord.ts`
- Test: `functions/src/caseRecord.test.ts`

**Interfaces:**
- Consumes: `ClinicInfo["type"]` from Task 1.
- Produces:
  ```ts
  export interface PatientInput { name: string; dob: number | null; gender: string }
  export type Visit = Record<string, unknown> & { date: number; createdAt?: number };
  export interface CaseInput {
    type: "homoeo" | "general";
    patient: PatientInput;
    consultations: Visit[];          // any order
    generals: Record<string, unknown> | null;   // latest snapshot
    lsmc: Record<string, unknown>[];
    now: number;
  }
  export function featuresFor(type: "homoeo" | "general"): { lsmc: boolean; differentialRemedy: boolean; homoeoGenerals: boolean };
  export function redactName(text: string, name: string): string;
  export function buildCaseRecord(input: CaseInput): { text: string; consultationCount: number; lastConsultationAt: number | null };
  export function systemInstruction(type: "homoeo" | "general"): string;
  export const MAX_VISITS = 30, MAX_LSMC = 50, MAX_CHARS = 40_000;
  ```
  The text is plain labelled lines: `Age: 34 years` (or `Age: unknown`), `Gender: F`, then `## Consultations (newest first)` with a `### YYYY-MM-DD` block per visit listing non-blank fields by label, then `## Generals` and `## LSMC`. Visit fields sent: complaint, diagnosis, testsRequired, remedy (label "Prescription"), differentialRemedy (homoeo only), followupCriteria, remarks, legacy generals/allergy/history. Every string value passes through `redactName`. Dates are formatted in `Asia/Kolkata`.

- [ ] **Step 1: Write failing tests:**
  - `never includes excluded fields`: a patient with name "Ravi Kumar", phone "98400", place "Kochi", serialNo 77, a visit with amount 500 and paymentMode "UPI". The text contains none of "98400", "Kochi", "77", "500", "UPI", "Ravi", "Kumar".
  - `redacts name words whole-word, case-insensitive`: `redactName("ravi has fever; Ravi Kumar better", "Ravi Kumar")` → `"the patient has fever; the patient better"`.
  - `does not redact inside other words`: `redactName("continuous pain", "Anu")` → unchanged. Words shorter than 3 letters are not redacted: `redactName("Al is ok", "Al B")` → unchanged.
  - `newest first and capped at 30 visits`: 35 visits → `consultationCount === 35`, the text has 30 `###` headers, and the oldest are absent.
  - `drops oldest visits until under MAX_CHARS`: visits with 5,000-char remarks → `text.length <= 40_000`, and the newest visit is present.
  - `general clinic omits LSMC, differentialRemedy, mentals, perspiration` (but keeps `sleepDreams`).
  - `homoeo clinic includes LSMC rows (cap 50) and mentals`.
  - `thin record`: no visits, no dob, no generals → contains "Age: unknown" and "No consultations recorded"; `lastConsultationAt === null`.
  - `lastConsultationAt` is the max `createdAt ?? date` across all visits.
  - `systemInstruction("general")` does not contain "modalities"; `systemInstruction("homoeo")` contains "peculiar".
- [ ] **Step 2: Run** `npm --prefix functions test -- caseRecord`. Expected: FAIL.
- [ ] **Step 3: Implement.** `redactName` builds one regex from name words of ≥3 letters plus the full name (escaped, `\b…\b`, `gi`) and replaces with "the patient". The system instruction is the spec's prompt text.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(functions): build redacted case record for the summary prompt`

### Task 3: Gemini client

**Files:**
- Create: `functions/src/gemini.ts`
- Test: `functions/src/gemini.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const GEMINI_MODEL: string;   // check the current cheapest GA Flash-Lite ID in Google's docs, e.g. "gemini-2.5-flash-lite"
  export async function validateGeminiKey(f: typeof fetch, key: string): Promise<void>;   // GET v1beta/models/{MODEL}; throws HttpsError
  export async function generateBullets(f: typeof fetch, key: string, system: string, record: string): Promise<string[]>;
  export function mapGeminiStatus(status: number, context: "save" | "summarize"): HttpsError;
  ```
  Both calls send the key **only** in the `x-goog-api-key` header and use a 30 s `AbortSignal.timeout`. The request body uses `systemInstruction`, `contents: [{ role: "user", parts: [{ text: record }] }]`, and the generationConfig from the Global Constraints. The response text is `candidates[0].content.parts[0].text`, which is JSON-parsed and zod-validated (1–8 bullets, each trimmed, 1–300 chars).

- [ ] **Step 1: Write failing tests** with a fake `fetch` that records calls:
  - `sends key in header, never in URL`: the URL doesn't contain the key and `headers["x-goog-api-key"] === key`.
  - `returns trimmed bullets on valid JSON`.
  - `401 on summarize → failed-precondition key-rejected` with the exact message; `403 on save → "That key was rejected by Gemini."`
  - `429 → resource-exhausted`.
  - `500 → internal`.
  - `empty candidates / blockReason → internal "The summary couldn't be generated, try again."`
  - `non-JSON text → internal`; `2 bullets → internal`; `9 bullets → internal`; `a 301-char bullet → internal`.
  - `fetch throws (timeout) → internal`.
  - `no thrown error message or details contains the key`: run every error case above with key `"AIzaSECRET123"` and assert `JSON.stringify(err)` and `err.message` don't include it.
- [ ] **Step 2: Run** `npm --prefix functions test -- gemini`. Expected: FAIL.
- [ ] **Step 3: Implement.** Gemini error bodies are never read into messages.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(functions): Gemini client with fixed error mapping`

### Task 4: KMS crypto + rate limiter

**Files:**
- Create: `functions/src/crypto.ts`, `functions/src/rateLimit.ts`
- Modify: `functions/src/deps.ts` (real `kms` uses `crypto.ts`)
- Test: `functions/src/rateLimit.test.ts`, `functions/src/crypto.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // crypto.ts
  export const KMS_KEY = (project: string) => `projects/${project}/locations/asia-south1/keyRings/llm-keys/cryptoKeys/clinic-api-keys`;
  export function kmsCrypto(client: Pick<KeyManagementServiceClient, "encrypt" | "decrypt">, keyName: string): Deps["kms"];
  // rateLimit.ts
  export const HOUR_LIMIT = 30, DAY_LIMIT = 200, SAME_PATIENT_MS = 20_000;
  export async function checkAndCount(store: Store, clinicId: string, patientId: string, now: number): Promise<void>;
  ```
  `aiUsage/{clinicId}` = `{ hourKey: number /* floor(now/3.6e6) */, hourCount, dayKey: number /* floor(now/8.64e7) */, dayCount, lastByPatient: { [patientId]: number } }`. In one transaction: reset a count when its key changed, reject over-limit or a same-patient run within 20 s, otherwise increment and write. Keep `lastByPatient` to entries younger than 1 h, so the doc stays small. The "try again in N minutes" value is `ceil` of the minutes to the next hour (or day) window.

- [ ] **Step 1: Write failing tests:**
  - `crypto`: encrypt passes `additionalAuthenticatedData` = the clinicId bytes and returns base64; decrypt passes the same AAD and returns the utf8 plaintext (fake client).
  - `rateLimit`: `allows first call and writes counts 1/1`; `31st call in the same hour → resource-exhausted` with a message matching `/try again in \d+ minutes/`; `resets in next hour`; `201st in a day → resource-exhausted even across hours`; `same patient within 20 s → "A summary was just requested, wait a moment."`; `same patient after 20 s ok`; `different patient immediately ok`; `prunes lastByPatient entries older than 1 h`.
- [ ] **Step 2: Run** `npm --prefix functions test -- rateLimit crypto`. Expected: FAIL.
- [ ] **Step 3: Implement** both files and wire `realDeps().kms = kmsCrypto(new KeyManagementServiceClient(), KMS_KEY(process.env.GCLOUD_PROJECT!))`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(functions): KMS key encryption and per-clinic rate limit`

### Task 5: Handlers + function exports

**Files:**
- Create: `functions/src/handlers.ts`, `functions/src/index.ts`
- Test: `functions/src/handlers.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces, with Firestore paths as fixed contracts for the client:
  ```ts
  export interface AiStatus { provider: "gemini"; configured: boolean; last4: string; model: string; updatedAt: number; updatedBy: string }
  export interface SummaryDoc { bullets: string[]; generatedAt: number; generatedBy: string; generatedByName: string; model: string; consultationCount: number; lastConsultationAt: number | null }
  export async function saveAiKey(deps: Deps, auth, data: { clinicId: string; apiKey: string }): Promise<AiStatus>;
  export async function removeAiKey(deps: Deps, auth, data: { clinicId: string }): Promise<AiStatus>;
  export async function summarizePatient(deps: Deps, auth, data: { clinicId: string; patientId: string }): Promise<SummaryDoc>;
  export async function cleanupClinic(deps: Deps, clinicId: string): Promise<void>;
  ```
  - `aiSecrets/{clinicId}` = `{ provider: "gemini", ciphertext, updatedAt, updatedBy }`
  - `clinics/{id}/settings/ai` = `AiStatus` (removal writes `configured: false, last4: ""`)
  - `clinics/{id}/patientSummaries/{patientId}` = `SummaryDoc`
  - `saveAiKey`: `assertAccess(owner, write)` → key `trim()`, 20–200 chars, `/^\S+$/` else `invalid-argument` "That doesn't look like a Gemini API key." → `validateGeminiKey` → encrypt → write both docs.
  - `removeAiKey`: `assertAccess(owner)` (no write check: removing is allowed after the trial ends).
  - `summarizePatient`: `assertAccess(write)` → `patientId` matches `^[A-Za-z0-9_-]{1,128}$` → patient doc exists else `not-found` "Patient not found." → secret exists else no-key → `checkAndCount` → decrypt → query `consultations`, `lsmc` where `patientId ==` → latest generals = the `generals` doc with max `date` for the patient → `buildCaseRecord` → `generateBullets` → write and return. `generatedByName` = token `name` or else email.
  - `cleanupClinic` deletes `aiSecrets/{id}` and `aiUsage/{id}`.
  - `index.ts`: `setGlobalOptions({ region: "asia-south1", maxInstances: 5 })`; `onCall({ enforceAppCheck: false }, (req) => saveAiKey(realDeps(), req.auth, req.data))`, likewise for the others; `onDocumentDeleted("clinics/{clinicId}", (e) => cleanupClinic(realDeps(), e.params.clinicId))`. Logging is only `logger.info("summarize", { clinicId, patientId, ok })`, and similar for others.

- [ ] **Step 1: Write failing tests** with the fake Store, fake kms (`enc:<aad>:<plain>`), fake fetch:
  - `saveAiKey stores ciphertext and status, returns no key`: the secret doc's `ciphertext !== apiKey`, `status.last4 === apiKey.slice(-4)`, and `JSON.stringify(result)` doesn't contain `apiKey`.
  - `saveAiKey replaces an existing key` (Review Focus 4).
  - `saveAiKey rejects member (not owner)`, `rejects whitespace key`, `rejects key Gemini refuses (nothing written)`.
  - `removeAiKey works after trial ended` and deletes the secret.
  - `summarizePatient writes summary doc with counts`; `no key → failed-precondition no-key`; `missing patient → not-found`; `trial ended → trial-ended`; `Gemini failure → nothing written, previous summary kept`.
  - `summarizePatient decrypts with the clinic's own AAD`: a secret copied from c2 into c1 fails (fake kms throws on an AAD mismatch → `internal`).
  - `prompt sent to Gemini excludes phone and name`: inspect the fake fetch body.
  - `cleanupClinic deletes aiSecrets and aiUsage`.
- [ ] **Step 2: Run** `npm --prefix functions test -- handlers`. Expected: FAIL.
- [ ] **Step 3: Implement** `handlers.ts` and `index.ts`.
- [ ] **Step 4: Run** `npm --prefix functions test && npm --prefix functions run build`. Expected: all PASS, tsc clean.
- [ ] **Step 5: Commit** `feat(functions): AI key and patient summary callables`

### Task 6: Firestore rules, clinic deletion, patient deletion

**Files:**
- Modify: `firestore.rules` (top-level `match /aiSecrets/{id} { allow read, write: if false; }` and the same for `aiUsage`; inside `clinics/{clinicId}`: `match /patientSummaries/{patientId} { allow read: if member(clinicId); allow create, update: if false; allow delete: if superadmin() || (member(clinicId) && canWrite(clinicId)); }`)
- Modify: `src/features/access/clinicAdminRepo.ts` (`CLINIC_COLLECTIONS` += `"patientSummaries"`), `src/features/patients/patientsRepo.ts` (`deletePatient` adds `clinicDoc("patientSummaries", id, clinic)` to `refs` before the patient)
- Test: `rules-tests/firestore.rules.test.ts`, `src/features/patients/patientsRepo.test.ts`

- [ ] **Step 1: Write failing rules tests** (`describe("ai summary")`): the superadmin, owner and member each fail to get/set `aiSecrets/c1` and `aiUsage/c1`. The member can read `clinics/c1/settings/ai` (seeded) but not set it, and neither can the owner. The member can read `clinics/c1/patientSummaries/p1`, can't create/update it, and can delete it. A member of c2 can't read c1's summary. The superadmin can delete it. An expired-trial member can't delete it.
- [ ] **Step 2: Write failing repo test:** `deletePatient also deletes the patient's summary` (assert the batch deletes the ref for `patientSummaries/p1`).
- [ ] **Step 3: Run** `npm run test:rules` and `npm test -- patientsRepo`. Expected: FAIL.
- [ ] **Step 4: Implement** the rule blocks and repo changes. Also update the existing `CLINIC_COLLECTIONS`/rules sync test, if one exists.
- [ ] **Step 5: Run** both again. Expected: PASS.
- [ ] **Step 6: Commit** `feat(rules): lock AI secrets, members read patient summaries`

### Task 7: Client data layer

**Files:**
- Modify: `src/lib/firebase.ts` (`export const functions = getFunctions(app, "asia-south1")`; `connectFunctionsEmulator(functions, "127.0.0.1", 5001)` in the emulator branch)
- Create: `src/lib/aiSummary.ts`
- Test: `src/lib/aiSummary.test.ts`

**Interfaces:**
- Consumes: the Firestore paths and callable names from Task 5, and `notifyWriteDenied` from `src/lib/writeDenied.ts`.
- Produces:
  ```ts
  export const aiStatusSchema: z.ZodType<AiStatus>;   // missing doc → { configured: false, last4: "", ... }
  export const patientSummarySchema: z.ZodType<PatientSummary>;
  export type PatientSummary = { bullets: string[]; generatedAt: number; generatedBy: string; generatedByName: string; model: string; consultationCount: number; lastConsultationAt: number | null };
  export function useAiStatus(clinicId: string | undefined): UseQueryResult<AiStatus>;         // key ["aiStatus", clinicId]
  export function useSaveAiKey(clinicId: string): UseMutationResult<AiStatus, Error, string>;   // sets ["aiStatus", clinicId]
  export function useRemoveAiKey(clinicId: string): UseMutationResult<AiStatus, Error, void>;
  export function usePatientSummary(patientId: string | undefined): UseQueryResult<PatientSummary | null>;  // key ["patientSummary", clinic, patientId]
  export function useSummarizePatient(patientId: string): UseMutationResult<PatientSummary, Error, void>;   // sets the summary query data
  export function aiErrorMessage(err: unknown): string;   // FunctionsError.message, or "Something went wrong, try again."
  ```
  Each mutation's `onError` calls `notifyWriteDenied()` when `err.details?.reason === "trial-ended"`. The key string is passed straight to `httpsCallable` and is never stored in query data or variables kept after settle. Use `mutate(key)` and nothing else; don't add `meta`.

- [ ] **Step 1: Write failing tests** (mock `firebase/functions` and `firebase/firestore`, matching how the existing lib tests mock):
  - `aiStatusSchema parses a missing doc as not configured`.
  - `useSaveAiKey calls saveAiKey with { clinicId, apiKey } and sets status`.
  - `useSummarizePatient calls summarizePatient with { clinicId, patientId } and sets summary data`.
  - `trial-ended error triggers notifyWriteDenied`; a `permission-denied` callable error does not.
  - `aiErrorMessage returns the callable message`.
- [ ] **Step 2: Run** `npm test -- aiSummary`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(ai): client hooks for AI key status and patient summaries`

### Task 8: Settings section

**Files:**
- Create: `src/features/settings/AiSummarySection.tsx`
- Modify: `src/features/settings/SettingsPage.tsx` (render `<AiSummarySection clinicId={...} />` inside a `Section title="AI patient summary"` after clinic hours)
- Test: `src/features/settings/AiSummarySection.test.tsx`

**Interfaces:** Consumes `useAiStatus`, `useSaveAiKey`, `useRemoveAiKey` and `aiErrorMessage` from Task 7.

- [ ] **Step 1: Write failing tests** (mock `../../lib/aiSummary`):
  - `not configured: shows password field "Gemini API key" with autocomplete="off" and Save key button` (the input `type === "password"`).
  - `Save key calls mutate with trimmed value, clears field on success, toasts "Gemini key saved"`.
  - `Save disabled while empty or pending`.
  - `configured: shows "ends in …a1b2" and Replace/Remove, no input`.
  - `Replace reveals the field; Cancel hides it`.
  - `Remove asks to confirm, then calls remove, toasts "Gemini key removed"`.
  - `save error shows aiErrorMessage in a toast, field keeps value`.
  - `shows the privacy notice text` (exact spec copy) and a "Get a key" link to `https://aistudio.google.com/apikey` with `rel="noopener noreferrer"`.
- [ ] **Step 2: Run** `npm test -- AiSummarySection`. Expected: FAIL.
- [ ] **Step 3: Implement** with MUI, matching the other Settings sections. Colours come from `TOKENS`.
- [ ] **Step 4: Run** `npm test -- AiSummarySection SettingsPage`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(settings): owner can add, replace and remove a Gemini key`

### Task 9: Patient summary card

**Files:**
- Create: `src/features/patients/PatientSummaryCard.tsx`
- Modify: `src/features/patients/PatientDetailPage.tsx` (render `<PatientSummaryCard patientId={id} latestVisitAt={max createdAt of visits} />` above "Consultation history")
- Test: `src/features/patients/PatientSummaryCard.test.tsx`

**Interfaces:** Consumes `useAiStatus`, `usePatientSummary`, `useSummarizePatient` and `aiErrorMessage` from Task 7; `useMembership` + `canManageClinic` for the owner's Settings link; `useClinic(clinicSlug)` + `clinicStatus`/`trialOk` from `src/lib/subscription.ts` for the expired state.
- Props: `{ patientId: string; latestVisitAt: number | null }`.

- [ ] **Step 1: Write failing tests:**
  - `no key: shows "AI summary is off. The clinic owner can add a Gemini key in Settings."`; for an owner, a "Settings" link to `/<slug>/settings`.
  - `key set, no summary: shows Summarize button`.
  - `summary: renders bullets as a list, "Generated 22 Oct 2026, 10:14 by Asha", a Re-run button, and the caption "AI-generated from the record. Check before relying on it."` (format with dayjs `D MMM YYYY, HH:mm`).
  - `stale hint when latestVisitAt > lastConsultationAt` ("New visits since this summary"), and none when equal or null.
  - `button disabled with spinner while pending` (Review Focus 5).
  - `error toasts aiErrorMessage`.
  - `expired trial: summary shown, Re-run disabled`.
  - `summary still shows if key was removed`, with no Re-run button and the no-key text.
- [ ] **Step 2: Run** `npm test -- PatientSummaryCard`. Expected: FAIL.
- [ ] **Step 3: Implement** with `CARD_SX`-style styling consistent with the page.
- [ ] **Step 4: Run** `npm test -- PatientSummaryCard PatientDetailPage`. Expected: PASS. If the `PatientDetailPage` test needs it, add a mock of `../../lib/aiSummary`.
- [ ] **Step 5: Commit** `feat(patients): one-tap AI summary card on the patient page`

### Task 10: Release wiring + docs + full verification

**Files:**
- Modify: `package.json` (`"release": "npm run build && npm --prefix functions run build && firebase deploy --only functions,firestore:rules,hosting"`, `"test:functions": "npm --prefix functions test"`), `CLAUDE.md` (an "AI summary" data-model bullet: paths, KMS, rules, the one-time setup steps from the spec's "Deploy and setup", and the reserved-collections note)

- [ ] **Step 1: Update** `package.json` and `CLAUDE.md`. In CLAUDE.md, the one-time setup lists: the Blaze plan + budget alert; enabling the KMS/Functions/Cloud Build/Artifact Registry/Eventarc APIs; the two `gcloud kms` commands; and granting `roles/cloudkms.cryptoKeyEncrypterDecrypter` on the key to the functions runtime service account (`<project-number>-compute@developer.gserviceaccount.com`).
- [ ] **Step 2: Verify everything:** `npm run lint && npm test && npm run test:functions && npm run build && npm --prefix functions run build && npm run test:rules`. Expected: all green. Report any failure verbatim.
- [ ] **Step 3: Leak check:** `grep -rn "apiKey\|x-goog-api-key" functions/src --include=*.ts | grep -v test`. Confirm the key only appears in the request header and the handler input, and never in a `logger` call.
- [ ] **Step 4: Commit** `chore(release): deploy functions with rules and hosting; document AI summary`

Deploying is **not** part of this plan: it needs the Blaze upgrade and the KMS setup, which the user does or approves first.
