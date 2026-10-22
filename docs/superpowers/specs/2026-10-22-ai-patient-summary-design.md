# AI patient summary (bring-your-own Gemini key): design

Date: 2026-10-22. Status: draft for approval.

## Intent

A doctor opening a patient wants an at-a-glance view of what is peculiar or
characteristic about that patient (an unusual disease, strong mentals, striking
modalities, allergies, notable past history) without re-reading every visit.
Each clinic brings its own Gemini API key, so it pays for its own usage. A
summary is generated **only when someone taps a button**, saved with its date,
and can be re-run later to pick up the latest record.

The key must be handled safely. It is encrypted on the server, never sent back
to any browser, and never logged.

## Goals

- Owner adds, replaces or removes a Gemini key in Settings.
- Patient detail page: a "Patient summary" card with **Summarize** /
  **Re-run**, showing 4–6 bullet points plus "Generated <date, time> by <name>".
- The summary is saved in Firestore and visible to every clinic member.
- The key is stored encrypted (Cloud KMS). Only Cloud Functions can read it.
  No browser, including the owner's and the superadmin's, can ever read it back.
- A small per-clinic rate limit caps runaway cost.

## Non-goals

- Other providers (OpenAI, Claude). Gemini only for now; the design keeps the
  provider as a field so it can grow later.
- Automatic or background summaries, or summaries in lists.
- Remedy suggestions, diagnosis, or chat with the record.
- Summary history (only the latest summary is kept).
- Languages other than English.

## Anti-goals (a failure even if it works)

- The API key reaches a browser, a log line, an error message or a Firestore
  doc any client can read.
- Patient name, phone, place or serial number is sent to Gemini.
- A member of clinic A can summarize, or read the key status of, clinic B.
- Bullets that state things not in the record (made-up symptoms).
- A stuck button or a script running up a large Gemini bill.

## Constraints

- Today the app has no server. This feature adds **Cloud Functions for
  Firebase (2nd gen)**, so the `grace-homoeo` project must be on the **Blaze**
  plan (agreed with the user).
- Existing patterns apply on the client: typed repo + TanStack Query hooks +
  zod, `useToast`, `QueryStates`, `TOKENS` for colour, and no feature importing
  another feature's internals.
- Clinic isolation, inactive clinic/user and expired-trial (read-only) rules
  must hold for the new functions exactly as they do in `firestore.rules`.

## Decisions

### Architecture

```
Browser ──httpsCallable──▶ Cloud Functions (asia-south1)
                               │ verify caller (auth, allow-list, owner…)
                               │ read aiSecrets/{clinicId} (Admin SDK)
                               │ KMS decrypt ──▶ key in memory only
                               │ read patient record, build prompt
                               ├──▶ Gemini API (x-goog-api-key header)
                               └──▶ write clinics/{id}/patientSummaries/{patientId}
```

All Gemini traffic goes through functions. The client only calls callables and
reads Firestore docs that never contain the key.

### Functions (new `functions/` folder, TypeScript, Node 22, region `asia-south1`)

Three `onCall` functions (firebase-functions v2), each taking `{ clinicId, … }`:

| Function | Who | What |
|---|---|---|
| `saveAiKey({ clinicId, apiKey })` | owner or superadmin; trial OK | trims the key and checks its shape (non-empty, ≤200 chars, no whitespace). Validates it with Gemini by calling `GET …/v1beta/models/{MODEL}` (no tokens spent); a rejected key gives "That key was rejected by Gemini". It then KMS-encrypts the key, writes `aiSecrets/{clinicId}` and the public status doc, and returns the status (no key). |
| `removeAiKey({ clinicId })` | owner or superadmin (allowed even when the trial has ended) | deletes `aiSecrets/{clinicId}` and sets the status to not configured. |
| `summarizePatient({ clinicId, patientId })` | any active member; trial OK | rate-limit check → decrypt key → build prompt → call Gemini → validate the output → write the summary doc and return it. |

**Caller checks**, a shared `assertAccess(ctx, clinicId, { owner?, write? })`
helper that mirrors the rules:
signed in, `email_verified == true`, then either superadmin
(`smartin.cherian@gmail.com`) or `allowedEmails/{email}` with
`clinicId == clinicId` and `active != false`. The clinic doc must exist with
`active != false`. For `owner`, the caller must be `ownerEmail` or superadmin.
For `write`, `trialOk` applies (authorized, or no `trialEndsAt`, or
`now < trialEndsAt`), and the superadmin is exempt. Failures throw
`HttpsError("permission-denied" | "failed-precondition", <safe message>)`.

**Secrets handling**

- Cloud KMS key ring `llm-keys`, key `clinic-api-keys`, location `asia-south1`,
  symmetric. Only the functions' runtime service account has
  `roles/cloudkms.cryptoKeyEncrypterDecrypter` on it.
- Encrypt with `additionalAuthenticatedData = clinicId`, so a ciphertext copied
  to another clinic's doc fails to decrypt.
- Stored at top-level `aiSecrets/{clinicId}`:
  `{ provider: "gemini", ciphertext (base64), kmsKeyVersion, updatedAt, updatedBy }`.
  Rules: `allow read, write: if false;`. Only the Admin SDK touches it.
- The plaintext key lives only in function memory for one request. It is never
  logged, returned or put in an error. Gemini calls send it in the
  `x-goog-api-key` header, never in the URL. Gemini error bodies are not
  forwarded to the client. Errors are mapped to fixed messages.
- Functions use `functions.logger` with clinicId, patientId and outcome only.
  They never log prompt text, the response text or the key.

**Public status doc** `clinics/{id}/settings/ai`, written only by functions:
`{ provider: "gemini", configured: bool, last4: string, model, updatedAt, updatedBy }`.
Members can already read `settings/*`, and the existing settings write rule only
allows `branding`/`schedule`, so clients can't write it. A rules test should
confirm this.

### Gemini call

- Model: a cheap Gemini **Flash-Lite** class model, held in one constant
  `GEMINI_MODEL` in `functions/src/gemini.ts`. *Builder:* at build time, check
  the current cheapest generally-available Flash/Flash-Lite model ID in Google's
  docs (e.g. `gemini-2.5-flash-lite` or newer) and use it.
- REST `POST https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent`
  using plain `fetch` (no SDK needed). `generationConfig`: `temperature 0.2`,
  `maxOutputTokens ~600`, `responseMimeType: "application/json"`, and
  `responseSchema` `{ bullets: string[] }`. Timeout 30 s (AbortController).
- The result is validated with zod: 3–8 bullets, each 1–300 chars, trimmed. If it
  fails, return "The summary couldn't be generated, try again" and write
  nothing.
- Error mapping: 400/401/403 from Gemini → "The clinic's Gemini key was
  rejected. Ask the owner to replace it in Settings." 429 → "Gemini quota
  reached for this key, try again later." Anything else → generic.

### What is sent (and not sent)

Sent: age (derived from `dob`, if any), gender, clinic type; every consultation
(newest first, capped at the latest **30**) with date (as YYYY-MM-DD), complaint, diagnosis,
testsRequired, remedy (prescription), differentialRemedy, followupCriteria,
remarks and legacy generals/allergy/history; the latest generals snapshot (all
non-blank fields); and LSMC rows (location/sensation/modality/concomitant,
newest first, cap 50). Total prompt text is capped at ~40,000 characters, and the oldest
consultations are dropped first.

**Never sent:** name, nameLower, phone, place, serialNo, amount, paymentMode,
IDs, createdBy, emails. (Free-text notes are sent as written. The Settings
notice tells owners not to put identifying details in notes.)

### Prompt (system instruction, roughly)

> You are assisting a {homoeopathic | general practice} doctor. From the case
> record below, write 4–6 short bullet points giving the doctor an at-a-glance
> picture of this patient. Prioritise what is peculiar, rare, strange or
> characteristic: unusual symptoms, marked mentals/emotional state, striking
> modalities, concomitants, allergies, significant past history, chronic
> conditions and how the case has progressed. Use only facts in the record. Do
> not guess, diagnose or recommend treatment. If the record is thin, say so in
> one bullet. Plain English, no patient name.

For `general` clinics, drop the homoeopathy-specific wording (modalities,
concomitants, mentals emphasis) and emphasise chronic conditions, allergies,
medications and red flags. The function reads `clinics/{id}.type` via the same
`homoeo` default as `parseClinicType`.

### Saved summary

`clinics/{id}/patientSummaries/{patientId}`:
`{ bullets: string[], generatedAt (epoch ms), generatedBy (email), generatedByName,
model, consultationCount, lastConsultationAt (epoch ms | null) }`.
It is overwritten on re-run, so only the latest summary is kept.

Rules: `allow read: if member(clinicId); allow write: if false;` (functions
only). Add a superadmin `allow delete` so `deleteClinic` can remove the docs,
and add `"patientSummaries"` to `CLINIC_COLLECTIONS`.

### Rate limit

Top-level `aiUsage/{clinicId}` (rules: no client access), updated in a
transaction before calling Gemini: **at most 30 summaries per hour and 200 per
day per clinic** (fixed windows keyed on the hour and the day). It also blocks a
second run for the same patient within **20 s**, which catches double taps. Going over the limit
gives `resource-exhausted` with "Summary limit reached, try again in N minutes".
The count is taken before the Gemini call, so failed calls still count.
That's acceptable.

### Clinic deletion

`aiSecrets/{id}` and `aiUsage/{id}` are top-level and client-locked. A
Firestore trigger `onDocumentDeleted("clinics/{clinicId}")` in functions
deletes both. `deleteClinic` itself is unchanged.

### Client

- `src/lib/firebase.ts`: export `functions = getFunctions(app, "asia-south1")`
  and `connectFunctionsEmulator(functions, "127.0.0.1", 5001)` under
  `VITE_USE_EMULATOR`.
- `src/lib/aiSummary.ts` (shared, used by settings and patients):
  zod schemas for the status doc and the summary doc; `useAiStatus()`
  (reads `settings/ai`); `useSaveAiKey`, `useRemoveAiKey`;
  `usePatientSummary(patientId)`; `useSummarizePatient()`, a mutation that
  calls the callable and then sets the query data / invalidates. These use
  `httpsCallable`. UI never calls Firebase directly.
- **Settings**: `src/features/settings/AiSummarySection.tsx`, a new `Section`
  "AI patient summary" (Settings is already owner-only).
  - Not configured: a password-type `TextField` "Gemini API key" (autocomplete
    off, not saved to local state after submit), **Save key**, and a "Get a
    key" link to Google AI Studio.
  - Configured: "Gemini key saved · ends in …{last4} · updated {date}",
    **Replace** (shows the field again) and **Remove** (confirm dialog).
  - Notice: "Patient case notes (not name or phone) are sent to Google Gemini
    when a summary is generated. Use a key from a Google Cloud project with
    billing enabled: Google may use free-tier requests to improve its
    products."
  - The input is cleared on success and on unmount. The key is never put in
    the React Query cache, localStorage or a toast.
- **Patient detail page**: `src/features/patients/PatientSummaryCard.tsx`
  above the consultation history.
  - No key: muted text "AI summary is off. The clinic owner can add a Gemini
    key in Settings." (owners get a link to Settings).
  - Key set, no summary: **Summarize** button.
  - Summary: bullets, then "Generated 22 Oct 2026, 10:14 by <name>" and
    **Re-run**. If the patient has a consultation newer than
    `lastConsultationAt`, show a small "New visits since this summary" hint.
  - Running: the button shows a spinner and is disabled. Errors go to a toast
    with the function's message.
  - Expired trial: the old summary shows and Re-run is disabled with the
    trial-ended hint. (The callable also refuses, and the existing
    `writeDenied` dialog may be triggered by the mapped `permission-denied`.)
  - A small caption: "AI-generated from the record. Check before relying on
    it."

### Deploy and setup (one-time, documented in CLAUDE.md)

1. Upgrade `grace-homoeo` to Blaze, and set a budget alert (for example
   ₹500/month).
2. Enable the Cloud KMS, Cloud Functions, Cloud Build, Artifact Registry and
   Eventarc APIs.
3. `gcloud kms keyrings create llm-keys --location asia-south1` and
   `gcloud kms keys create clinic-api-keys --keyring llm-keys --location asia-south1 --purpose encryption`
   (consider a yearly rotation period). Grant the functions runtime service
   account `roles/cloudkms.cryptoKeyEncrypterDecrypter` on that key only.
4. `firebase.json` gains a `functions` block (source `functions`, predeploy
   build). The release becomes
   `firebase deploy --only functions,firestore:rules,hosting`, and the rules and
   functions go live together.

### Testing

- `functions/`: vitest unit tests with Firestore/KMS/fetch mocked. Cover
  `assertAccess` (each denial path), prompt building (excluded fields really
  absent, caps applied, homoeo vs general wording), output validation, error
  mapping (and that no key text appears in any thrown message), and the rate
  limiter windows.
- Rules tests: `aiSecrets`/`aiUsage` unreadable/unwritable by anyone including
  the superadmin client; `settings/ai` readable by members but not writable;
  `patientSummaries` member-read, client-write denied, superadmin delete
  allowed, and cross-clinic read denied.
- Client: RTL tests for `AiSummarySection` (states, field cleared, Remove
  confirm) and `PatientSummaryCard` (no key / empty / summary / stale hint /
  error toast / trial-expired disabled), with the callables mocked.

## Left to the builder

- The exact Gemini model ID (see above), and the exact prompt wording within the
  rules above.
- The functions folder layout and its own `package.json`/tsconfig, and whether
  to share zod schemas via a small copied file (the client and functions are
  separate builds).
- The card's visual details, kept consistent with the patient page and
  `TOKENS`.
- Whether the Settings key validation uses `models.get` or a 1-token
  `generateContent` (prefer the one that doesn't spend tokens).

## Calls made after review (builder's decisions, for the user to check)

1. **Patient deleted → summary deleted.** `patientSummaries` rules also allow
   `delete` for `member(clinicId) && canWrite(clinicId)`. `deletePatient` (in
   `patientsRepo.ts`) deletes `patientSummaries/{patientId}` alongside the
   patient's visits, generals and LSMC. Client create/update stays denied.
2. **Name inside free text.** Before sending, the function replaces the
   patient's name in the free text with "the patient". This is best effort:
   case-insensitive, matching the full name and each name word of 3+ letters
   as whole words. The anti-goal applies to the name/phone/place/serial
   *fields* plus this redaction; other identifying text typed into notes may
   still go through, and the Settings notice says so.
3. **Made-up bullets.** The guards are the prompt, `temperature 0.2`, JSON
   output and the "AI-generated, check before relying on it" caption. There's
   no automated fact-check (explicitly out of scope).
4. **Expired trial error.** The callables throw
   `failed-precondition` with `details: { reason: "trial-ended" }`. The client
   hooks see that reason and call the existing `writeDenied` notifier, so the
   "Trial ended" dialog opens. Wrong-clinic, inactive and not-owner errors use
   `permission-denied` and show a toast only.
5. **General-practice clinics send only what the clinic shows.** The function
   applies the same flags as `clinicFeatures(type)`. For `general` it leaves
   out LSMC rows, `differentialRemedy` and the homoeo-only generals (mentals,
   perspiration, sleep & dreams). The flag logic is copied into functions,
   with a test that keeps it in step with `src/lib/useClinicFeatures.ts`.
6. **Superadmin** may save or remove keys and run summaries for any clinic.
   `generatedByName` is the superadmin's display name. No new UI path: the
   superadmin reaches a clinic's Settings the same way they reach any owner
   page today.
