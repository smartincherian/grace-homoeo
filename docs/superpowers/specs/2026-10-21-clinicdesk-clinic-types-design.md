# ClinicDesk rename + clinic types — design

**Date:** 2026-10-21 · **Status:** approved (chat, 2026-10-21)

## Goal

Rename the product "Homoeo Desk" → **"ClinicDesk"** and let each clinic be a
**type**: `homoeo` (Homoeopathy) or `general` (General practice). Homoeo-only
parts of the app show only for homoeo clinics. More types (ayurveda, dental…)
can be added later by extending one list.

## Clinic type

- `clinics/{id}.type`: `"homoeo" | "general"`. **Missing or unknown = `homoeo`**
  (Grace and every existing clinic keep today's behaviour, no migration).
- Labels: `homoeo` → "Homoeopathy", `general` → "General practice".
- Set at self-signup (`/setup`, required select, default Homoeopathy) and on
  superadmin create (`/admin` dialog). The superadmin can change it later from the
  clinic row menu ("Change type"). Owners cannot change it (they cannot write the
  clinic doc today; unchanged).
- Rules: self-signup create adds `type` to the exact key list and requires
  `type in ['homoeo', 'general']`; superadmin create/update requires `type`, when
  present, to be one of those.

## Features per type

One helper decides; components ask for a feature, never compare type names.

| Feature | homoeo | general |
|---|---|---|
| LSMC (editor, visit table, history summary, "last LSMC" on the form) | shown | hidden |
| Differential remedy field (form + visit view) | shown | hidden |
| Generals: Mentals, whole Perspiration group | shown | hidden |
| Generals: "Sleep & dreams" label | "Sleep & dreams" | "Sleep" |
| Generals section heading / history page title | "Generals" | "Case history" |
| Inventory order list categories | homoeo list (today's) | general list |

Everything else (patients, consultations, bookings, funds, staff, calculator,
settings, people) is the same for both.

**Hiding is UI only.** Data, schemas and rules are unchanged. A hidden field keeps
whatever value the form loaded, so editing a visit in a `general` clinic never
deletes its existing LSMC rows or homoeo Generals (the visit update deletes LSMC
rows not in the submitted list — the hidden rows must still be submitted).

### Order categories

Each category gets the types it applies to. Homoeo: today's list unchanged.
General: Medicines (variant "Strength": 250 mg, 500 mg, 650 mg), Syrups,
Injections (named), Syringes (variant "Size": 2 ml, 5 ml, 10 ml), Dressings,
Gloves. Syrups is shared. Existing order items whose category is not in the
clinic's list still show under their category (never hidden).
The zod enum keeps every key so stored items always parse.

## Rename

Every user-visible "Homoeo Desk" becomes "ClinicDesk": page title, PWA manifest
`name`/`short_name`, login, verify-email, setup, AppShell fallback, BrandScope
document title, `displayNameOf` fallback, WhatsApp pricing message, icon script
comment, CLAUDE.md. The Firebase project stays `grace-homoeo` (IDs can't be
renamed). A third hosting site `clinicdesk` (clinicdesk.web.app) is added to
`firebase.json`; creating the site and adding it to Auth authorized domains are
manual console/CLI steps done by the user before the release deploy.

## Out of scope

Type-specific new sections (ayurveda Prakriti, dental chart), owner-editable
type, renaming stored fields (`remedy`, `generals`, `lsmc`).
