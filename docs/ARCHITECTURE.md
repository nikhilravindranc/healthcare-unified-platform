# Unified platform: module structure (proposal)

## Modules
| Module | Route | Status | Owns |
|---|---|---|---|
| PMS | existing top-level routes (`/overview`, `/patients`, `/practice/*`) | live | patients, visits, billing, inventory |
| CRM | `/crm` | skeleton | leads, pipeline, tasks, contact timeline |
| Booking | `/booking` | skeleton | public booking, availability, booking requests |
| Campaigns | `/campaigns` | skeleton | audiences, email/SMS sends, delivery stats |

Registry: `src/platform/modules.ts`. The shell builds nav from it, filtered by permission.

## Layers
- **Shell** (`src/components/app/shell.tsx`): sidebar, top bar, search, notifications, account menu. It still hosts PMS-specific panels (new appointment, new patient, checkout, EVI). Phase 2: split into a generic `PlatformShell` plus a PMS-only provider.
- **Auth and roles** (`src/lib/auth.ts`, `src/lib/clinical.ts`): one session, one role, permissions as `PermKey`. Module perms: `crm`, `booking` (manage), `booking_view`, `campaigns` (manage), `insights` (view-only marketing metrics). A module shows in the nav if the role has any of its perms. Defaults are starting points and editable per role in Practice > Settings.

  | Role | CRM | Bookings | Campaigns | Insights |
  |---|---|---|---|---|
  | Owner, Practice manager | yes | manage | manage | yes |
  | Front desk | yes | manage | no | no |
  | Provider | no | view | no | no |
  | Staff | no | no | no | no |
  | Marketing | yes | no | manage | yes |

  Marketing has no clinical perms. Exporting contact lists stays under `exports` (Owner, Practice manager). Auth is front-end demo state; the backend developer replaces it.
- **Data**: still the in-memory mock (`src/lib/db.ts`). `src/platform/contacts.ts` derives Contacts from patients. This is interim demo data only and does not mean Patient owns identity long term.

## Identity ownership (proposed; to agree with the backend developer)
| Area | Owns |
|---|---|
| PMS | Patient record, clinical profile, appointments, visits. Authoritative for clinical information. |
| CRM | Enquiry/lead, source, status, assignment, follow-up history. A person can enquire before becoming a patient. |
| Contact (shared identity) | A person across products, linked to Patient and CRM records by stable IDs. Records are linked, not duplicated. |

`Patient.contactId` stays a proposed relationship. No migration in the frontend-only phase (`src/platform/contact.ts` is the type sketch).

**Enquiry to patient**
1. CRM creates an enquiry tied to a prospect Contact.
2. Front desk follows up and books an appointment.
3. If the person is new, PMS creates the patient record when appropriate.
4. The Contact is linked to that patient.
5. If the person is already a patient, link the existing patient instead of creating a duplicate.

One person may have several enquiries and appointments, or become a patient later; the model must allow all of these.

**Deduplication**: plan for it, but never decide "same person" from email or phone alone (shared family details, changed numbers and typos cause false matches). Use cautious matching and let staff review uncertain matches; no automatic merge.

**Consent**: a record per channel and purpose (`channel`, `purpose`, `status`, `at`, `source`), not a yes/no flag. Any service that sends communications must enforce it; the UI does not.

## Phases
1. (done) Registry, perms, nav entries, skeleton pages, Contact type + adapter.
2. Agree identity ownership with the backend developer, then implement it consistently when the backend is ready (Contact link, dedupe review, consent enforcement). Deferred: no Contact source-of-truth migration now. Extract `PlatformShell`.
3. Build modules in order Booking (reuses PMS availability), CRM, Campaigns (needs the consent model).
4. Optionally move PMS under `/pms/*` with redirects once other modules exist.

## Decisions to confirm
- Backend: session, roles and data are front-end placeholders (localStorage and in-memory mock) for the backend developer to replace.
- Users who already saved custom role permissions won't see the new module perms until they re-save them (saved arrays replace the defaults).
