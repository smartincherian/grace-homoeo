# Homoeo Desk: self-serve clinic signup and 21-day free trial

## Intent

Today only the superadmin can create a clinic (on `/admin`). We want any doctor to start
using Homoeo Desk on their own: sign in, create their clinic, and use it free for up to
21 days. After that they must pay; pricing is not shown in the app — they ask on
WhatsApp (9036209639). The superadmin decides who has paid by flagging a clinic as
**authorized**, and sees every clinic's trial status on `/admin`.

## Decisions (from the user)

- Doctors create their own clinic (self-serve signup).
- Free trial: **maximum 21 days from signup** (signup = clinic creation).
- The superadmin can flag a clinic as **authorized**; an authorized clinic is never limited
  by the trial.
- To subscribe they pay an amount; the app links to a **WhatsApp chat with 9036209639** to
  ask for pricing.
- The superadmin sees all clinics and their status on the page they land on after login
  (`/admin`).

## Calls made by Claude (user may override)

- **After the trial ends, the clinic is read-only**, not fully locked: everyone in it can
  still open and read all data (patient records stay available), but no writes of any kind
  until authorized. Enforced in Firestore rules, not only the UI.
- WhatsApp message is pre-filled: `Hi, I'd like to know the Homoeo Desk subscription
  pricing. Clinic: <clinic name> (<slug>), email: <owner email>.` Link:
  `https://wa.me/919036209639?text=<urlencoded>` (opens the app on phones, WhatsApp Web on
  desktop). The number lives in one constant.
- A trial counter ("Free trial · 12 days left") is shown inside the app to every member;
  it turns to a warning colour in the last 5 days and becomes the "Trial ended" banner
  after expiry. Authorized clinics show nothing.
- Clinics the superadmin creates on `/admin` also get a 21-day trial, with an
  "Authorized" checkbox on the create form. **Every new clinic always gets `trialEndsAt`**
  (ticking "Authorized" only sets `authorized: true`), so removing authorization later
  really takes effect.
- **Removing authorization from a clinic without `trialEndsAt`** (legacy) also writes
  `trialEndsAt = now`, making it expired at once; the confirm dialog says so. Removing it
  from a clinic whose trial is still running just returns it to the trial.
- **Both sign-in methods can sign up**: Google, and email/password after verifying the email.
- Existing clinics (`grace-homoeo`, `grace`, `test`) have no trial fields; **a clinic
  without `trialEndsAt` counts as active** (grandfathered), so the deploy breaks nothing.
  After deploy the superadmin also marks `grace-homoeo` authorized from `/admin`.
- Authorizing and un-authorizing are superadmin-only toggles. No "extend trial" control
  (not asked for; the superadmin can authorize instead).

## Non-goals

- In-app payments, invoices, pricing display, payment reminders by email/SMS.
- Stopping someone making repeated trials with throwaway emails (one clinic per email is
  the only limit).
- Automatic deletion of expired clinics' data.
- Changing the 3-seat limit or the member/owner roles.

## Anti-goals (would be a failure even if it "works")

- Grace or any existing clinic loses write access at deploy time.
- An expired clinic can still write by bypassing the UI (rules must enforce it).
- A self-signup user can create a clinic that is pre-authorized, has a longer trial, takes
  over an existing clinic/slug, or joins someone else's clinic.
- A staff member who should be invited into an existing clinic accidentally creates their
  own clinic without understanding it (they would then be stuck: one clinic per email).

## Data model

`clinics/{clinicId}` gains:

| Field | Type | Meaning |
|---|---|---|
| `trialEndsAt` | number (epoch ms) | `createdAt + 21 days` (21 × 86 400 000 ms). Absent on legacy clinics. |
| `authorized` | bool | `true` = paid/approved, no trial limit. Default `false`. |
| `authorizedAt` | number \| null | When last authorized (for the admin list). |
| `selfSignup` | bool | `true` when created through the signup screen. |

A clinic is **active** when `authorized == true`, or `trialEndsAt` is absent, or
`now < trialEndsAt`. Otherwise it is **expired**.

Self-signup creates, in one batch (same shape as `createClinic` in
`src/features/access/clinicsRepo.ts`): `clinics/{slug}` `{ name, createdAt, ownerEmail,
timeZone: "Asia/Kolkata", trialEndsAt, authorized: false, authorizedAt: null,
selfSignup: true }`, `clinics/{slug}/seats/1` `{ email }`, and `allowedEmails/{email}`
`{ email, clinicId, seat: "1", addedAt, addedBy: email }`.

## Firestore rules

- New `active(c)`: `clinicData(c).get('authorized', false) == true ||
  !('trialEndsAt' in clinicData(c)) || request.time.toMillis() < clinicData(c).trialEndsAt`.
- Every **write** rule under `clinics/{clinicId}/…` (seats, settings, appointments,
  appointmentHistory, staff, leaves, salaryPayments, the `memberSubs` catch-all) additionally
  requires `superadmin() || active(clinicId)`. Reads are unchanged. Split the combined
  `allow read, write` rules into separate read and write lines to do this.
- `allowedEmails` create/delete by a clinic owner also require `active(clinicId)` (People
  page is read-only after expiry). Superadmin is unaffected.
- **Self-signup create** (new branches, all must hold):
  - `clinics/{clinicId}` create: signed in, verified, not superadmin, caller has **no**
    `allowedEmails` entry before the write (`!exists(...)`), `clinicId` matches the slug
    format (3–40 chars, `^[a-z0-9]+(-[a-z0-9]+)*$`) and is not reserved, keys exactly the
    list above, `ownerEmail == authEmail()`, `authorized == false`, `authorizedAt == null`,
    `selfSignup == true`, `createdAt` within ±5 minutes of `request.time`,
    `trialEndsAt == createdAt + 1814400000`, `timeZone == 'Asia/Kolkata'`, name a string of
    1–60 chars, and `entryAfterIs(authEmail(), clinicId, '1')`. `create` already fails if
    the doc exists, so a taken slug cannot be overwritten. The `createdAt` window is
    ±10 minutes (device clock); a shorter trial from a slow clock is acceptable, a longer
    one is not possible beyond 10 minutes.
  - `clinics/{clinicId}` **get when it does not exist** (`resource == null`) is allowed to
    any signed-in verified user, so `/setup` can honestly check "web address taken" before
    submitting. (Slugs are visible in URLs anyway; existing clinics stay unreadable.)
  - `seats/1` create: `email == authEmail()`, the clinic did not exist before but does
    after (`!exists` + `existsAfter`), and its `ownerEmail` after is the caller.
  - `allowedEmails/{email}` create: `email == authEmail()`, `seat == '1'`, `clinicId` names a
    clinic that did not exist before and exists after with `ownerEmail == email`, and
    `seatAfterIs(clinicId, '1', email)`.
- Owners still cannot update their own clinic doc (only the superadmin), so they cannot
  change `authorized` or `trialEndsAt`.
- Reserved slugs must be mirrored in the rules (a list literal) — keep it in sync with
  `RESERVED_SLUGS` in `src/lib/clinic.ts`, and add `setup` and `signup` to both.
- Rules tests (`npm run test:rules`) cover: self-signup happy path; each forbidden variant
  (authorized true, longer trial, someone else's ownerEmail, existing slug, reserved slug,
  already allow-listed caller, unverified caller); expired clinic: reads allowed, every
  write family denied; legacy clinic without `trialEndsAt` still writable; superadmin can
  write to an expired clinic and toggle `authorized`.

## Screens and flows

### Signup (new route `/setup`, public to signed-in verified users without membership)

- Today, `LoginPage.signIn`, `AuthGuard` and `VerifyEmailPage` (its own "not allowed"
  sign-out) sign out users with no membership ("…is not allowed to sign in"). Instead, a
  verified user with **no allow-list entry** is sent to `/setup`.
- `getMembership` must tell apart: no entry (→ `/setup`), an **unassigned entry**
  (`clinicId: ""`, → keep today's "not allowed" sign-out; the superadmin cleans those up),
  and denied/unverified (unchanged). Suggested: return a distinct result such as
  `{ kind: "none" }` vs `null`, builder's choice of shape.
- A member who was removed from a clinic has no entry and can also sign up; acceptable,
  the warning copy covers it.
- `/setup` shows: product mark + "Start your clinic on Homoeo Desk", a clear warning:
  **"Joining a clinic that already uses Homoeo Desk? Don't create one — ask its owner to
  add <your email> on their People page, then sign in again."**, then the form: clinic
  name (required, ≤60) and web address (slug, auto-filled from the name with `slugify`,
  editable, validated with `isValidSlug`, shown as `homoeodesk.web.app/<slug>`),
  "21-day free trial, no payment needed" note, a **Start free trial** button, a
  "Sign out" link, and a small "Pricing? Ask on WhatsApp" link.
- Taken slug: checked before submit with a `getDoc(clinics/{slug})` — free slugs read as
  "not found"; a taken slug's read is `permission-denied` → inline "That web address is
  taken, try another". A commit that is still denied shows a generic "Couldn't create the
  clinic. Check your phone's date and time, then try again." (clock skew or a race), and
  logs the error.
- On success: refresh the `["access", uid]` membership query and go to
  `/<slug>/settings` so they set branding and clinic hours first. `ensureUserDoc` must
  run **after** the batch commits (the `users` rule needs an allow-list entry), so the
  signup path calls it itself; it is not called for users without membership.
- Password users still verify their email first (`/verify-email`) — unchanged.

### In the app (all clinic pages)

- `Membership` (in `src/lib/access.ts`) gains the clinic's `authorized` and `trialEndsAt`
  (already read in `getMembership`), or a separate `useClinicStatus(clinicId)` query
  polled like branding — builder's choice; it must refresh at least on app open so an
  authorization by the superadmin shows up without signing out.
- `TrialBanner` (shared component in `src/components/`) at the top of the shell:
  - Active trial: "Free trial · N days left" + "Subscribe" (WhatsApp link). Days left =
    ceil((trialEndsAt − now) / 1 day), clinic zone not needed.
  - Expired: "Your free trial has ended. Your records are read-only. Subscribe to keep
    adding patients and bookings." + "Ask pricing on WhatsApp" button.
  - Authorized / legacy: nothing.
- Expired clinics: add/edit/delete buttons across features stay visible but any write that
  fails with `permission-denied` while the clinic is expired shows a "Trial ended —
  subscribe to continue" dialog with the WhatsApp button, via one global mutation
  `onError` hook on the `QueryClient` (`MutationCache` `onError`; not per-feature
  changes). All feature writes go through `useMutation` hooks, so this covers them; the
  best-effort appointment-link writes swallow their own errors, which is fine. Builder may additionally
  disable obvious primary actions (e.g. "New patient") if cheap.

### Superadmin (`/admin`)

- Clinic list shows per clinic: name, slug, owner email, created date, "Self signup" chip
  when `selfSignup`, and a status chip: **Authorized** (green), **Trial · N days left**,
  **Trial ended** (red), or **Legacy** (no trial fields).
- Sort: expired and soon-to-expire trials first, then the rest by name (builder's call if
  a simpler order reads better).
- Per clinic: an **Authorize** / **Remove authorization** toggle (confirm dialog), writing
  `authorized` and `authorizedAt` via a new `setClinicAuthorized(id, bool)` in
  `clinicsRepo.ts`. Superadmin rules already allow clinic updates; the ownerEmail check in
  the update rule must keep passing for these partial updates.
- Create-clinic form gets an "Authorized (no trial)" checkbox; unchecked writes the trial
  fields with `selfSignup: false`.

## Constants

`src/lib/subscription.ts`: `TRIAL_DAYS = 21`, `TRIAL_MS`, `WHATSAPP_NUMBER = "919036209639"`,
`pricingWhatsAppUrl({ clinicName, clinicId, email })`, `clinicStatus({ authorized,
trialEndsAt }, now) → { kind: "authorized" | "legacy" | "trial" | "expired", daysLeft? }`.
Unit-tested.

## Release

Rules and hosting together (`npm run release`), like earlier phases. Before deploying,
run rules tests. After deploying: authorize `grace-homoeo` on `/admin`; confirm Grace can
still write. Update CLAUDE.md (routes `/setup`, clinic fields, `active()` rule, reserved
slugs, signup flow).

## Left to the builder

Exact copy and layout of the banner and `/setup`, whether trial status rides on
`Membership` or a separate query, list sort order, whether to also disable primary action
buttons when expired, test structure.
