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

## Healthcare workspace: navigation and Enquiries (frontend phase)
**Sidebar** (`src/components/app/shell.tsx`, `src/platform/modules.ts`)
- *Clinic*: Today, Calendar, Patients, **Enquiries**, Follow-ups, Reports.
- *Practice*: Team, Services & treatments, Inventory, Locations & rooms, Forms (unchanged).
- *Growth & Engagement*: Marketing Insights, Campaigns, Online Bookings. Driven by `GROWTH_NAV`.
- CRM is not in the everyday nav. It is reached from the account menu under "Applications" (`SWITCHER_MODULES`), and its `/crm` route still works.
- CRM, Booking and Campaigns are optional modules. Each can be switched off in Practice > Integrations (`settings.modules`). A module shows only when it is on and the role has one of its permissions.

**Direct URLs.** `RouteGuard` (`src/platform/route-guard.tsx`) checks permission and module-on for each new page, and `ModuleSkeleton` uses it. The shell also blocks patient-facing routes (`/overview`, `/calendar`, `/patients`, `/visits`, `/follow-ups`, `/agents`) for roles without the `patients` permission, so Marketing cannot reach patient records by typing a URL.

**Enquiries** (`src/modules/enquiries/`)
- `types.ts`, `schemas.ts` (zod), `data.ts` (48 synthetic enquiries), `api.ts` (the only data-access surface; swap its body for real HTTP calls), `hooks.ts`, plus UI: `enquiry-form.tsx` and `enquiry-detail.tsx`. Routes: `/enquiries`, `/marketing-insights`.
- Statuses: New, Contacted, Appointment booked, Closed, Not converted.
- Booking uses the existing New appointment panel (prefilled from the enquiry). A new optional `onCreated` callback on `ui.newAppt` marks the enquiry "Appointment booked".
- Patient link: a person picks an existing patient, with phone/email matches only suggested. "Create new patient (demo)" reuses the existing mock `createPatient` after confirmation. No Contact migration was done.
- Permission `enquiries` (Owner, Practice manager, Front desk). Marketing sees Marketing Insights (aggregate only), Campaigns preview and CRM, not individual enquiries or patients.
- Saved role permissions are kept. A one-time merge (`pms.rolePermsV` = 2) adds the new default permissions to roles saved earlier.

**Marketing Insights** is computed from the same enquiry data and labelled demo. No ad platform or analytics is connected.

## Known limitations
- Everything is mock data in memory, and permissions and module toggles live in the browser, so none of it is security.
- The Today dashboard, Reports and Agents do not know about enquiries yet.
- Enquiry follow-up tasks are separate from patient Follow-ups.
- Campaigns, Online Bookings and CRM are previews.
- Marketing still sees practice configuration pages (Team, Services, Locations, Forms) because those had no permission before.
- Reports keeps its own copy of its line chart. `components/app/charts.tsx` serves the new screens.

## Phases
1. (done) Registry, perms, nav entries, skeleton pages, Contact type + adapter.
2. Agree identity ownership with the backend developer, then implement it consistently when the backend is ready (Contact link, dedupe review, consent enforcement). Deferred: no Contact source-of-truth migration now. Extract `PlatformShell`.
3. Build modules in order Booking (reuses PMS availability), CRM, Campaigns (needs the consent model).
4. Optionally move PMS under `/pms/*` with redirects once other modules exist.

## Decisions to confirm
- Backend: session, roles and data are front-end placeholders (localStorage and in-memory mock) for the backend developer to replace.
- Users who already saved custom role permissions won't see the new module perms until they re-save them (saved arrays replace the defaults).
