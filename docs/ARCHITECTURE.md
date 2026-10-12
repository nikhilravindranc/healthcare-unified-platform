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
- Statuses: New, Contacted, Appointment booked, Closed, Not converted. "Appointment booked" is only reached through the booking flow, never by editing the status alone.
- Three views of the same data (switch at the top of `/enquiries`, remembered per browser): **List**, **Board** (stage columns, drag between stages, quick buttons) and **Flow** (Source to Stage ribbon diagram with a side panel; `flow-layout.ts` is generic over columns so a third column can be added). Board and Flow share `enquiry-actions.tsx`.
- Booking uses the existing New appointment panel (prefilled from the enquiry). A new optional `onCreated` callback on `ui.newAppt` marks the enquiry "Appointment booked".
- **Appointment link.** An enquiry stores the real PMS `appointmentId` (and earlier ones in `previousAppointmentIds`). `enquiriesApi.list()` joins it with the live appointment (`booking-state.ts`): an enquiry counts as "Appointment booked" only while that appointment exists and is not cancelled or a no-show. Otherwise it shows as Contacted again with a "not kept" notice, and its stored history stays, with a derived "was cancelled" entry. The status field alone cannot set "Appointment booked", and `appointmentBooked` rejects an unknown appointment or one for a different patient. The View buttons open that appointment.
- **Seed data.** Each seeded booked enquiry has a real patient (`P-10400` and up, status New) and a real appointment (`A-E1001` and up, dated around the enquiry, none today). Two of the appointments are cancelled so the reopened state is visible. The PMS demo therefore has 25 patients (12 original plus 13).
- Patient link: a person picks an existing patient, with phone/email matches only suggested. "Create new patient (demo)" reuses the existing mock `createPatient` after confirmation. No Contact migration was done.
- Permissions: `enquiries` (manage: Owner, Practice manager, Front desk) and `enquiries_view` (read-only: also Marketing). Read-only users see the same three views without phone or email, cannot drag cards, edit, assign, book or link patients, and the patient-record section is hidden. `config` (Practice configuration) covers Team, Services, Locations, Forms and Integrations. Everyone except Marketing has it by default, so those pages are blocked for Marketing by menu and by direct URL.
- **Role permission storage.** Only changes are stored (`pms.rolePermOverrides`: per role `add` and `remove`, see `src/lib/role-perms.ts`). Current permissions are the code defaults plus those overrides, so a default added later reaches every role that did not customize that permission, and custom choices are never overwritten. Older saved full lists (`pms.rolePerms`) are converted once, and permissions that did not exist when they were saved follow the defaults. The old key is left in place as a backup. Frontend demo only, not security.

**Marketing Insights** is computed by `insights.ts` from the same enquiries. "Appointments from enquiries" counts enquiries whose linked appointment exists and was not cancelled or missed. Those that were are shown as a note and counted as open. Labelled demo. No ad platform or analytics is connected.

## Known limitations
- Everything is mock data in memory, and permissions and module toggles live in the browser, so none of it is security.
- Reports and Agents do not know about enquiries yet. Today has an "Enquiries to follow up" panel and a "New enquiry" quick action.
- Enquiry follow-up tasks are separate from patient Follow-ups.
- Campaigns, Online Bookings and CRM are previews.
- Real mouse drag-and-drop was exercised up to dragover with the browser tool, but the tool does not deliver the final drop event, so the drop itself is covered only by synthetic events.
- Live camera capture is not testable here. Photos were tested with the sample image.
- Reports keeps its own copy of its line chart. `components/app/charts.tsx` serves the new screens.

## Tests
`npm test` runs Node's built-in test runner on `tests/*.test.ts` (type stripping needs Node 22.18 or later). They cover the permission-override logic, the appointment join and insights counts, and the Flow layout. UI behavior is checked manually in the browser.

## Phases
1. (done) Registry, perms, nav entries, skeleton pages, Contact type + adapter.
2. Agree identity ownership with the backend developer, then implement it consistently when the backend is ready (Contact link, dedupe review, consent enforcement). Deferred: no Contact source-of-truth migration now. Extract `PlatformShell`.
3. Build modules in order Booking (reuses PMS availability), CRM, Campaigns (needs the consent model).
4. Optionally move PMS under `/pms/*` with redirects once other modules exist.

## Decisions to confirm
- Backend: session, roles and data are front-end placeholders (localStorage and in-memory mock) for the backend developer to replace.
- Users who already saved custom role permissions won't see the new module perms until they re-save them (saved arrays replace the defaults).
