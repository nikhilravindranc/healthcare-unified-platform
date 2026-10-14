# Unified platform: module structure (proposal)

## Modules
| Module | Route | Status | Owns |
|---|---|---|---|
| PMS | existing top-level routes (`/overview`, `/patients`, `/practice/*`) | live | patients, visits, billing, inventory |
| CRM | `/crm` | preview (Contacts v1) | read-only contact directory: patients and enquiry-only people, stage, first-touch source, relationship history |
| Online Bookings | `/booking` (staff), `/book` and `/book/manage` (public) | demo | public self-service booking journey, offered services, online bookings list |
| Campaigns | `/campaigns` | demo | campaign list and editor, consent-based audience preview, simulated runs |

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
- **Data**: still the in-memory mock (`src/lib/db.ts`). The sample enquiries and the patients and appointments that belong to the booked ones come from one pure builder, `src/lib/demo-seed.ts`, called once by `db.ts` when it loads. Every route therefore sees the same 25 patients and appointments no matter which page is opened first (a test covers this). `src/modules/enquiries/data.ts` only reads the result.

## Identity ownership (product decisions agreed 14 Oct 2026; backend not built)
| Area | Owns |
|---|---|
| PMS | Patient record, clinical profile, appointments, visits. Authoritative for clinical information. |
| Enquiries | Enquiry capture, status, assignment, follow-up tasks, history, linking to a patient and converting to an appointment. A person can enquire before becoming a patient. |
| CRM | Broader contact visibility: who a person is across patients and enquiries, how they first found the practice, and their enquiry and appointment history. Read-only today. It owns no records and has no pipeline or tasks of its own. |
| Contact (shared identity) | A person across products, linked to Patient and CRM records by stable IDs. May exist without a Patient. Holds no clinical content. Records are linked, not duplicated. |
| Consent | An authoritative consent record or service. Patient, visit, photo and form records hold references. |
| Visit, Appointment | Visit is care delivered. Appointment is the booking and attendance lifecycle. Neither implies the other. |
| Campaigns, Billing, Booking | Campaigns own audiences and sends. Billing owns transactions. Booking owns the public experience. Each links by id. |

The agreed ownership model, conversion and direct-booking behaviour, consent categories and record shape, merge policy, source-of-truth table, audit requirements, migration path and items needing legal or security review are in `docs/IDENTITY_DECISIONS.md` (sections 0 and 8 to 14). That file is the single place for these decisions and this section only summarises them. `Patient.contactId` is a documented future relationship, not implemented. No migration in the frontend-only phase (`src/platform/contact.ts` is the type sketch).

**Enquiry to patient**
1. Enquiries creates an enquiry for a person who is not yet a patient (CRM shows them as an enquiry-only contact).
2. Front desk follows up and books an appointment.
3. If the person is new, PMS creates the patient record when appropriate.
4. The enquiry is linked to that patient with `Enquiry.patientId`. From then on CRM shows one patient contact that includes the enquiry.
5. If the person is already a patient, link the existing patient instead of creating a duplicate.

One person may have several enquiries and appointments, or become a patient later; the model must allow all of these.

**Deduplication**: plan for it, but never decide "same person" from email or phone alone (shared family details, changed numbers and typos cause false matches). Use cautious matching and let staff review uncertain matches; no automatic merge.

**Consent**: append-only records by category (marketing, care communication, treatment, photo), purpose and channel, with status, effective date, source, method and wording reference; not a yes/no flag. Missing is never granted. The backend or communication service enforces it; the UI does not. Today only `Patient.marketingConsent` (boolean), signed visit forms, filed consent documents and `PhotoAsset.consent` exist.

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

## CRM Contacts v1 (`src/modules/crm/`)
- `contacts.ts` is a pure module (the rules are written at the top of the file and covered by tests). `hooks.ts` joins patients, appointments, visits and the enquiries list (already joined with their appointments). `crm-directory.tsx` and `contact-detail.tsx` are the UI. Nothing here writes data.
- **Who is a contact.** Every patient. Every enquiry linked to that patient belongs to that contact. Every enquiry with no patient is its own enquiry-only contact. People are never merged by name, phone or email, so one person who enquired twice appears twice. The row `key` is a temporary render key, not a Contact id.
- **Stage** (derived): enquiry-only New or Contacted is Prospect, Closed or Not converted is Not converted. Patients: a completed appointment or visit within 90 days, or a live appointment ahead, is Active patient. Older completed history with nothing ahead is Lapsed patient. No completed history but a live appointment from today on is Appointment booked. Otherwise Patient, no activity. Cancelled and no-show appointments never count as live.
- **First-touch source.** The earliest linked enquiry, else the patient's recorded referral, else Unknown. Enquiry sources are used as they are. Referral values map as: Website enquiry becomes Website form, Patient referral, Walk-in and Social media map to themselves, and Provider referral stays as its own source. Anything else (for example free text such as a doctor's name) becomes "Other (as recorded)" and keeps its raw text.
- **Seed sources.** The original demo patients no longer carry a default referral. Earlier seed data gave every one of them "Website enquiry", which was a generic default rather than recorded history. Now only Sarah Johnson has a referral (a free-text name, shown as "Other (as recorded)"). The other original patients show "Unknown" until an enquiry or a referral is recorded. Patients created from enquiries get their source from the enquiry.
- **Consent.** The patient record stores `marketingConsent` as yes, no or nothing recorded (undefined). No demo patient gets a default: nine original patients have an explicit recorded decision in the seed (seven granted, two not granted), and everyone else, including every enquiry-only person and every patient created from an enquiry or online booking, is "Not recorded". The patient edit form offers Not recorded, Granted and Not granted, and saving without touching it keeps the value unrecorded. An enquiry is never treated as consent. No consent date or source exists, so the directory shows "Date not recorded" and "Source not recorded". A missing value shows "Not recorded", never "Granted".
- **Permissions (demo).** `/crm` needs the `crm` permission and the module switch. Phone, email and date of birth need `patients` or `enquiries`, so Marketing sees them hidden in the list, the detail panel and search. Without `patients`, `maskContact` also removes the patient id and status and every appointment detail except its date and status (no service, provider, time or appointment id), and replaces the render key, so those values never reach the page. Links into patient records and the appointment panel need `patients`. Enquiry links open the enquiry in its own read-only panel, which shows only the appointment date and status and replaces record ids in the history text. A requested service on an enquiry stays visible to Marketing, as it already does in the read-only Enquiries views.
- **Not in CRM:** no pipeline, tasks, follow-up status, merging, editing or record creation. Those stay in Enquiries or Practice Management.

## Appointment rules (`src/lib/appointment-rules.ts`)
One place defines what a status means: **lost** is cancelled or no-show (never a successful booking, never upcoming, never a seen patient), **open** is anything not completed, cancelled or no-show, and **upcoming** is an open appointment from today on. Patients, patient detail, summaries, agents and the enquiry join all use it instead of repeating status lists. `Appointment.events` logs cancelled, no-show and rescheduled, so reviving a cancelled appointment keeps its history, and the enquiry shows those events. Rescheduling a completed or in-progress appointment is rejected. Booking from an enquiry first offers to link a matching upcoming appointment of the same patient instead of creating a duplicate. The appointment panel has an "Open enquiry" link when the appointment came from one.

## Communications (`src/modules/comms/`)
- One `Message` model (channel email, SMS or call log; direction; status draft, simulated, received or logged; purpose service or marketing) and one reusable `CommunicationPanel`: history, a consent and eligibility summary, and one composer. The composer is only in the Enquiry detail panel. The CRM contact panel shows the same history read-only, and says to reply from the enquiry, so messages are written in one place.
- `eligibility.ts` is the single rule, also used by Campaigns: marketing needs an explicit granted consent for the channel, and a way to reach the person. Not recorded and withdrawn both block it. SMS marketing is always blocked because only an email-marketing decision is stored. Service messages need no marketing consent but need a phone or email. Calls are only logged.
- `commsApi.send` re-checks eligibility and refuses ineligible sends. A send is stored as **simulated** ("Demo only, not delivered"). The UI never says sent or delivered. Message text is hidden for roles without enquiry management.
- Sample history is built only from what the sample enquiries support (how each arrived, and a simulated service reply once contacted).

## Campaigns (`src/modules/campaigns/`)
- `audience.ts` filters the CRM contacts by derived stage and first-touch source (no second taxonomy) and applies the shared eligibility rule, returning matched, eligible and left-out people and a count per reason. The editor shows that preview live.
- A campaign is Draft, Scheduled (demo) or Run in demo mode. "Simulate send" records one simulated marketing message per eligible recipient, so each recipient's history shows the campaign, and then locks the campaign (duplicate it to run again). Scheduling needs a date and at least one eligible person.
- The only performance figures are on one seeded campaign, labelled **Sample data** and sized to the demo audience. Appointment confirmations and reminders are not part of Campaigns.
- The demo seed records an explicit email-marketing decision for 9 original patients (7 granted, 2 not granted) so audiences can be shown. Everyone else, including all enquiry-only people, has none, and is left out with the reason "No marketing consent recorded".
- `campaigns` permission manages campaigns, and `insights` alone gives a read-only view. The module switch and route guard apply.

## Online Bookings (`src/modules/booking/`)
- **Public journey** at `/book` (no staff navigation, no internal data): service, provider (or any available), date and time, details, review, confirmation. It reuses the internal rules, `freeSlots` and `checkConflicts`, so an offered time is one the practice could book internally. Availability rules live in `src/lib/availability-rules.ts` (pure, tested) and are applied inside `checkConflicts`, so the appointment form and online booking agree: clinic working hours, each provider's days and hours (read from the existing `hours` text, for example "Mon–Fri · 8:30 AM–5:00 PM"), provider time off (the existing `timeOff` text), a practice break, closed dates, and the buffer between visits (the existing `bufferMin` setting). Text that cannot be read gives no rule and is reported, never guessed. Staff booking internally get a warning; online booking refuses. Online booking adds a notice period (`booking.leadHours`, default 2) and a booking window (`booking.windowDays`, default 60, 0 = no limit), both editable on `/booking`. The break and closed dates are settings under Practice > Settings > Appointments and are empty by default. The data is still demo data: a real service must read live provider calendars.
- A booking creates an ordinary appointment (`origin: "online"`) through the existing API, with a room picked from the location. A new person also gets a patient record and an enquiry with source "Online booking" (so first touch is kept). A returning patient is matched only on exact email and last name together, with no merging on partial matches. Marketing consent is recorded only if the person ticks an opt-in. An existing patient's consent is never changed.
- `/book/manage` finds an online booking from its reference and email, then cancels or moves it through the same appointment API. It shows only service, provider, place, date and time.
- **Practice side** at `/booking`: turn the page on or off, choose which active services are offered (settings `booking`), and list online bookings with a link to the appointment. Providers, locations and durations come from the existing configuration. No other booking rules exist.
- The module switch also turns off the public pages.

## Known limitations
- Everything is mock data in memory, and permissions and module toggles live in the browser, so none of it is security.
- Reports and Agents do not know about enquiries yet. Today has an "Enquiries to follow up" panel and a "New enquiry" quick action.
- Enquiry follow-up tasks are separate from patient Follow-ups.
- Campaigns, Online Bookings and messaging run in demo mode: they use the shared demo records and never send, deliver or measure anything real.
- Drag and drop between Board stages was verified with native browser drag events (Chrome DevTools Protocol): plain moves, reopen, a booking without a linked patient (opens the link prompt), a booking with a linked patient (opens the prefilled appointment panel) and read-only (no draggable cards). The in-app browser tool cannot deliver the final drop event, so that tool alone cannot confirm it. The card menu ("Move to ...") is the keyboard alternative.
- Live camera capture is not testable here. Photos were tested with the sample image.
- Reports keeps its own copy of its line chart. `components/app/charts.tsx` serves the new screens.

## Tests
`npm test` runs Node's built-in test runner on `tests/*.test.ts` (type stripping needs Node 22.18 or later): permission overrides, appointment rules and joins, availability, booking, comms eligibility and consent wording, CRM contacts, campaigns, patient Overview rules, record-link integrity (every invoice, photo, form, follow-up and appointment points at a real record of the same patient, and appointment and visit point at each other), Reports record counts, and the Visits list rules.
`npm run test:e2e` runs Playwright (`e2e/`, one added dev dependency, `@playwright/test`) against the dev server on port 3000. Data is in memory and resets on each full page load, so each test starts from the demo seed. A development-only seam in `useAction` (`window.__pmsFailNext`) fails the next save so the error path can be tested; it is disabled when `NODE_ENV` is production.

## Phases
1. (done) Registry, perms, nav entries, Contact type sketch, CRM Contacts v1, shared appointment rules, communications foundation, Campaigns and Online Bookings in demo mode.
2. Agree identity ownership with the backend developer, then implement it consistently when the backend is ready (Contact link, dedupe review, consent enforcement). Deferred: no Contact source-of-truth migration now. Extract `PlatformShell`.
3. Build modules in order Booking (reuses PMS availability), CRM, Campaigns (needs the consent model).
4. Optionally move PMS under `/pms/*` with redirects once other modules exist.

## Decisions to confirm
- Backend: session, roles and data are front-end placeholders (localStorage and in-memory mock) for the backend developer to replace.
- Users who already saved custom role permissions won't see the new module perms until they re-save them (saved arrays replace the defaults).

## Patient Overview rules (`src/lib/patient-overview.ts`)
Pure functions behind the patient Overview, tested in `tests/patient-overview.test.ts`: the next appointment (open bookings only, never cancelled or no-show), the visit to resume, the last completed visit, signed consent on file, medical history on file, forms awaiting signature, treatment-plan progress and the prioritised "Needs action" list. They read recorded facts only: a booking is never treated as care that took place, plan steps count only when recorded as Completed, and a missing record is reported as missing. No backend or data-model change was needed.

**Decision, Appointments tab:** the audit found no patient-specific booking history. Care history listed only upcoming bookings, and the older visits table in `records.tsx` was not used anywhere, so past, cancelled and no-show bookings were not visible from the patient record. A new Appointments tab was added. It reuses the appointment panel for reschedule and cancel, so the rules stay in one place.


## Visits, follow-ups and consent wording (frontend)
- `src/lib/visit-list.ts`: pure rules for the Visits list. A booking is shown only when the visit and an appointment point at each other. Attention flags are limited to forms awaiting signature and a recommended follow-up with no follow-up created; a missing booking is information, not a task.
- `FollowUp.note` is the follow-up's reason (it already existed and was unused). `type` stays the category. Older records have no reason and show "Reason not recorded".
- `hasCare` (`patient-overview.ts`): a plan step can be completed from a visit only if that visit records care.
- Consent states: `ConsentState` is `granted | withdrawn | not-granted | not-recorded`. `not-granted` is the old stored "no" with unknown details. It blocks marketing and is never called a withdrawal. `PhotoConsent` is `Granted | Denied | Withdrawn | Not recorded`. These are display states over the current storage; the append-only consent model in `IDENTITY_DECISIONS.md` section 10 is not simulated in the frontend.
- A route error boundary (`src/app/(app)/error.tsx`) keeps the shell usable if a screen fails to render.

## Calendar, configuration, forms and agent explanations (frontend)
- `apptStage` and `STAGE_LABEL` (`appointment-rules.ts`) group the existing eight statuses into Booked, Attending, Completed and Did not take place. No new status field exists. `STATUS` in `ui/index.tsx` keeps one visual per status; Confirmed is now a hollow marker so it cannot look like Completed.
- `describeAvailability` (`availability-rules.ts`) reports what `parseProviderHours` and `parseDateRanges` actually read, so the Team screen cannot show hours the rules do not enforce.
- `InventoryMove.kind` is optional. `moveKind` reads older records from what they record (a visit means used, a gain means received). `adjustStock` logs the amount actually applied.
- `Finding.why` (`insight.ts`) carries the rule, recorded facts, limits and source links for each agent finding. These are fixed rules over demo data, not a model.
- Dialogs and panels opened from code return focus to the opener (`useReturnFocus`, `ui/index.tsx`); the appointment panel also re-finds its opener by label if the list re-rendered.
- Open model decision: `Room` has no link to services. If suitability is wanted, add `Room.serviceIds?: string[]` (empty means any) and apply it in `checkConflicts` and the room pickers, then show it in Rooms. Not done, so nothing claims it.

## Detail pages
`EnquiryDetailSheet` and `ContactDetailSheet` take a `page` prop and render the same content either in a side panel or as a full page, so the two cannot drift apart. Contact page addresses use `Patient.id` or `Enquiry.id` (`/crm/patient/P-10248`, `/crm/enquiry/E-1001`), never the CRM display key, in line with `IDENTITY_DECISIONS.md`. When a Contact id exists, the address should change to it and these two routes should redirect.
