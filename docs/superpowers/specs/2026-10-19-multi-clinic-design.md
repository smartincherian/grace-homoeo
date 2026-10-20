# Multi-Clinic Tenancy — Design

_Date: 2026-10-19 · Status: approved in conversation, not yet built_

## 1. Goal

Offer the app to several homoeopathy clinics. Each clinic signs in with
allow-listed emails and **can never see another clinic's data**. The superadmin
(`smartin.cherian@gmail.com`) creates clinics, assigns emails to them, and can
open any clinic.

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Clinic data lives in **Firestore subcollections** under `clinics/{clinicId}` | Isolation is structural: a rule on the path covers every collection, and no query can forget a `where("clinicId")` filter. |
| D2 | The **clinic ID is a URL slug** (e.g. `grace-homoeo`) and is also the document ID | The URL segment and the Firestore path are the same string; no slug→ID lookup. |
| D3 | **One clinic per email** — `allowedEmails/{email}.clinicId` | The user did not ask for doctors working at several clinics. Upgradable later to `clinicIds: string[]` + switcher. |
| D4 | **Security comes from Firestore rules**, never from the URL | The URL is navigation only. Rules re-read the caller's allow-list entry server-side on every request. |
| D5 | Superadmin is not a clinic member; they open any clinic by slug from an **Admin** page | Keeps the single hardcoded superadmin model already in place. |
| D6 | Existing data is **copied** (not moved) to `clinics/grace-homoeo/...` by an Admin-SDK script; legacy top-level docs are deleted manually only after verification | A failed or partial migration is recoverable. |
| D7 | Slugs are immutable after creation | They are document IDs; renaming means copying the clinic. |

## 3. Data model

```
clinics/{clinicId}                         { name, createdAt }
clinics/{clinicId}/patients/{id}           (unchanged fields)
clinics/{clinicId}/consultations/{id}      (unchanged fields)
clinics/{clinicId}/generals/{id}
clinics/{clinicId}/lsmc/{id}
clinics/{clinicId}/inventory/{id}
clinics/{clinicId}/orderItems/{id}
clinics/{clinicId}/expenses/{id}
clinics/{clinicId}/counters/patients       { lastSerial }   (serials are per clinic)
allowedEmails/{email}                      { email, clinicId, addedAt, addedBy }   ← clinicId added
users/{uid}                                (unchanged, top-level)
```

Document fields inside a clinic do **not** gain a `clinicId`. Document IDs are
preserved by the migration, so `patientId`/`consultationId` references stay valid.
`firestore.indexes.json` is empty and Firestore index scopes are by collection ID,
so no index changes are needed.

### Slug rules
`^[a-z0-9]+(-[a-z0-9]+)*$`, 3–40 characters, and not one of the reserved first
path segments: `login`, `admin`, `access`, `patients`, `inventory`, `calculator`,
`funds`, `clinics`.

## 4. How a request is restricted

1. User signs in → Firebase Auth gives a signed token with their email.
2. App reads `allowedEmails/{email}` → `{ clinicId: "grace-homoeo" }` (its *membership*).
3. App navigates to `/grace-homoeo/patients` and queries `clinics/grace-homoeo/patients`.
4. Firestore rules, on the server, read the same allow-list entry and allow the
   request only if the path's `{clinicId}` equals the entry's `clinicId` (or the
   caller is the superadmin). Requests for any other clinic get *permission denied*.

```
function myClinic() {
  return get(/databases/$(database)/documents/allowedEmails/$(authEmail())).data.get('clinicId', '');
}
function member(clinicId) {
  return superadmin() || (allowed() && myClinic() == clinicId);
}
match /clinics/{clinicId} {
  allow get: if member(clinicId);
  allow list, write: if superadmin();
  // needs >= 1 segment: a bare {document=**} also matches the clinic doc itself
  match /{sub}/{document=**} { allow read, write: if member(clinicId); }
}
match /users/{uid} {
  allow read, write: if superadmin() || (allowed() && request.auth.uid == uid);
}
```

The current catch-all `match /{collection}/{document=**}` is **removed**, so the
legacy top-level collections become unreadable from the app after cutover.

## 5. URLs

| URL | Who | Page |
|---|---|---|
| `/login` | everyone | Login (unchanged) |
| `/admin` | superadmin | Clinics + allowed emails (replaces `/access`) |
| `/:clinicSlug/patients…`, `/:clinicSlug/inventory…`, `/:clinicSlug/calculator`, `/:clinicSlug/funds…` | members of that clinic, superadmin | Existing pages, unchanged apart from links |
| `/patients/…` etc. (legacy) | members | Redirect to `/<own clinic><same path>` so bookmarks and the installed PWA keep working |
| `/` and unknown paths | — | Member → `/<own clinic>/patients`; superadmin → `/admin` |

A member who opens another clinic's slug is redirected to their own clinic. A
superadmin who opens a slug with no clinic document sees "Clinic not found" with
a link to `/admin`. The app bar shows the clinic's `name`.

When the active clinic changes (superadmin switching), the TanStack Query cache is
cleared so one clinic's cached lists never render under another's URL.

## 6. Admin page (`/admin`)

- **Clinics:** list (name, slug, link to open), create (name → auto slug, editable,
  validated per §3, rejected if the slug already exists).
- **Allowed emails:** add email + required clinic select; list shows each email's
  clinic; remove as today.

## 7. Migration & cutover

Script `scripts/migrate-to-clinics.mjs` (Node, `firebase-admin`, Application
Default Credentials). Arguments: `--clinic grace-homoeo --name "Grace Homoeo"
[--dry-run]`.

1. Create `clinics/grace-homoeo` `{ name, createdAt }` if missing.
2. For each of `patients, consultations, generals, lsmc, inventory, orderItems,
   expenses`, copy every doc to `clinics/grace-homoeo/<name>/<same id>` (batched ≤ 500).
3. Copy `counters/patients` → `clinics/grace-homoeo/counters/patients`.
4. Set `clinicId: "grace-homoeo"` on every `allowedEmails` doc lacking one.
5. Print source vs destination counts per collection; `--dry-run` prints counts only.

The script aborts (exit 1) if the destination already has data, because a re-run would overwrite live edits with stale legacy copies. `--resync` overrides this and is only for a re-run BEFORE the new rules are deployed; never after cutover. The counter is written as max(source, existing destination) `lastSerial`. Verification compares every source doc ID against the destination and exits 1 on any missing doc; a missing source counter with existing patients is a hard error. `--project` is mandatory unless `FIRESTORE_EMULATOR_HOST` is set.

**Cutover order:** run `migrate:clinics` → verify counts → run `npm run backfill:seats -- --clinic <id> --owner <email> --project <id>` (dry run, then real; assigns `ownerEmail`, `timeZone`, `seats/{1..3}` and `allowedEmails.seat`; aborts if >3 emails, the owner is missing, the superadmin is in the clinic, or seats exist) → deploy rules + hosting together
(`firebase deploy --only firestore:rules,hosting`) → reopen the app on every device (see below) → tell existing password users they will verify their email once (rules now require a verified email for everyone) → check the app → delete legacy
top-level collections manually later. Between the script and the deploy, new
writes still go to the old collections, so deploy straight after the script (or
re-run it with `--resync` immediately before deploying).

After deploying, close and reopen the app (or refresh) on every device: the first
open may still show the old cached PWA version, which reads legacy collections
the new rules deny (it looks like errors until the new service worker takes
over). Do not create a second clinic until the rules deploy is confirmed:
hosting deployed with the old catch-all rules would let any allow-listed member
read every clinic. `npm run release` ships rules and hosting together.

## 8. Deferred (not in this build)

- New common hosting site `homoeoclinic.web.app` (name appeared free on
  2026-10-19, not reserved): `firebase hosting:sites:create`, hosting target in
  `firebase.json`, add the domain to Auth authorized domains, then redirect
  `grace-homoeo.web.app` → `homoeoclinic.web.app/grace-homoeo`.
- Generic PWA name/icon ("Homoeo Clinic"); per-clinic logo and scripture footer.
- Emails belonging to several clinics; clinic-level roles.

## 9. Testing

- Unit (Vitest, Firestore mocked, no emulator): clinic path helpers, slug
  validation, membership lookup, every repo writes/reads under
  `clinics/<id>/…`, routing guard behaviour, Admin page.
- Rules (`npm run test:rules`, Firestore emulator via `@firebase/rules-unit-testing`):
  member allowed on own clinic, denied on other clinic, denied on legacy
  top-level collections, cannot edit own `allowedEmails` entry, superadmin allowed
  everywhere.
