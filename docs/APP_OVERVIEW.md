# Healthcare Platform: what the app is today

Status snapshot of the frontend after the unified frontend completion work (Enquiries, CRM, messaging, Campaigns, Online Bookings, availability rules) and the visual redesign. For the target structure see [ARCHITECTURE.md](ARCHITECTURE.md), for the identity and consent decisions see [IDENTITY_DECISIONS.md](IDENTITY_DECISIONS.md), and for the backend build brief see [DEVELOPER_INSTRUCTIONS.md](DEVELOPER_INSTRUCTIONS.md).

## 1. In one paragraph
A clickable, frontend-only web app. One part is a complete Practice Management System (PMS) demo for clinics: schedule, patients, visits, photos, billing, inventory, forms, reports and AI "agents". On top of it sit working Enquiries (front-desk handling of enquiries through to a booked appointment), Marketing Insights, a read-only CRM directory, simulated messaging, Campaigns and Online Bookings with a public booking page. The last three run in demo mode: they use the shared sample records and never send, deliver or measure anything real. There is no backend: all data is in-memory sample data that resets on reload, and sign-in, roles and settings are demo state in the browser.

## 2. Tech stack
| Area | What is used |
|---|---|
| Framework | Next.js 16.4 (App Router), React 19.3, TypeScript 5 |
| Styling | Tailwind CSS 4, Radix UI primitives, lucide-react icons, `class-variance-authority`, `tailwind-merge` |
| Data fetching | TanStack Query 5 over a mock API with artificial delays (`src/lib/db.ts`, `src/lib/clinical.ts`) |
| Forms | react-hook-form + zod 4 validation |
| Feedback | sonner toasts |
| Persistence | None server-side. `localStorage` for session, role, permissions, settings, sidebar; sample data in memory |
| Tests | `npm test`: 70 unit tests for permissions, the shared seed, appointment/insights logic, the Flow layout, CRM contact derivation, appointment rules, messaging eligibility, campaigns, online booking, availability rules and the patient Overview rules. No UI test suite |
| Run | `npm run dev` (development), `npm run build` then `npm run start` (production check) |

Note: this Next.js version differs from older ones. [AGENTS.md](../AGENTS.md) tells developers to read `node_modules/next/dist/docs/` before changing framework code.

## 3. Modules
| Module | Route | State |
|---|---|---|
| Practice (PMS) | `/overview`, `/calendar`, `/appointments`, `/visits`, `/patients`, `/activities`, `/follow-ups`, `/agents`, `/billing`, `/practice/*` | Working demo |
| Enquiries | `/enquiries` | Working demo: list, filters, create/edit, status, follow-up tasks, link patient, book appointment |
| Analytics and Reports | `/analytics`, `/analytics/[slug]`, `/reports`, `/reports/[slug]` | Working demo on record data. `/insights`, `/insights/[slug]` and `/marketing-insights` redirect to Analytics |
| CRM | `/crm` | Working read-only contact directory (preview). Patients plus enquiry-only people, with search, stage and source filters and a detail panel. Reached from Contacts in the sidebar |
| Online Bookings | `/booking` (staff), `/book` (public) | Working in demo mode: public booking journey that follows provider days, time off, breaks, closed dates and notice rules (on demo data), practice settings, list of online bookings |
| Campaigns | `/campaigns` | Working in demo mode: campaign list and editor, consent-based audience preview, simulated runs. Nothing is sent |

Modules are registered in `src/platform/modules.ts`. Contacts (CRM), Online booking and Campaigns appear in the sidebar's "Patient acquisition" group when the module is switched on and the role has a matching permission.

**Sidebar:** Clinic (Today, Calendar, Appointments, Visits, Patients, Activities, Follow-ups), Patient Acquisition (Enquiries, Contacts), Patient Engagement (Online booking, Campaigns), Insights (two destinations: Analytics and Reports), Practice Management in three small groups (People & Services: Team & providers, Services & treatments. Facilities & Resources: Locations & rooms, Inventory. Administration: Forms & documents, Billing), then Settings and Help at the bottom. Front desk is no longer in the menu: patient flow is a view inside Today (`/front-desk` still opens it). Marketing Insights is a view inside Analytics, not a menu item. The floating EVI avatar was removed; Ask EVI stays in the top bar and on Ctrl+J. Optional modules (Contacts, Online booking, Campaigns) still hide when switched off.

## 4. Customer journey
One person can pass through every step below without being entered twice. Records are linked, never copied, and never merged by name, phone or email.

| Step | Where | What happens | Who usually does it |
|---|---|---|---|
| 1. First contact | Enquiries (`/enquiries`), public booking page (`/book`) | An enquiry is created with a source: Website form, Phone call, Walk-in, Patient referral, Social media, Campaign or Online booking. A new person who books online gets a patient record and an enquiry with source "Online booking". | Front desk, or the person themselves |
| 2. Follow-up | Enquiry detail panel | Status moves from New to Contacted. Follow-up tasks, notes and an assignee are tracked. The message composer can log a call or write an email or SMS, which is simulated and labelled "Demo only, not delivered". | Front desk |
| 3. Booking | Appointment panel, Calendar, public page | An appointment is booked for a patient (linked or created, never matched automatically). Conflicts, provider days and time off, breaks, closed dates and buffers are checked. The enquiry becomes "Appointment booked". A patient can also book, change or cancel online with a reference and email. | Front desk, or the patient |
| 4. Before the visit | Today, Calendar, Patients | Today shows the day's schedule and who needs attention. A cancelled or missed appointment is logged, reopens the enquiry and prompts a rebook. Visit prep and the "Before you start" bar summarise alerts, consent and the last visit. | Front desk, provider |
| 5. Arrival | Today > Patient flow | Check in (arrived), then waiting, with waiting times and the "Waiting now" list. | Front desk |
| 6. The visit | Visits (`/visits/[id]`) | Start visit, then work through six tabs: Summary, Consent & photos, Plotting & products, Notes & treatment, Follow-up & plan, Billing. The completion checklist shows what is still missing. Completing locks the notes, deducts stock and creates any recommended follow-up. | Provider |
| 7. Checkout | Billing tab, checkout dialog, patient Financials | Invoices, payments, deposits and refunds. | Front desk, practice manager |
| 8. After care | Follow-ups, agents, patient Summary | Follow-ups are due, overdue or upcoming. Agents flag patients who have not returned. The patient Overview shows safety information, the next appointment, treatment plan progress, clinical notes and what needs action. | Front desk, provider |
| 9. Marketing | CRM, Campaigns | Campaigns reach only people with an explicit marketing consent for the channel. Missing consent is never treated as permission, and SMS marketing is blocked because no SMS consent is stored. | Marketing |
| 10. Measure | Analytics, Reports | Analytics shows what is changing; Reports lists the records behind it and exports them. Every number states how it is worked out. | Owner, practice manager, marketing |

**Appointment statuses:** scheduled, confirmed, arrived, waiting, in progress, completed. Cancelled and no-show are "lost": they are never counted as booked or upcoming, and they are logged in the appointment history. A completed or in-progress appointment cannot be rescheduled.

**What is simulated:** messages and campaign runs are never delivered, booking confirmations and reminders are not sent, availability is demo data, and sign-in, roles and consent are browser state.

## 5. Features
### Enquiries and Marketing Insights
- **Enquiries (`/enquiries`)**: list with status tabs (New, Contacted, Appointment booked, Closed, Not converted), search by name, phone or email, source and assigned-staff filters, pagination and a mobile card layout. 48 synthetic enquiries.
- **Three views**: List, Board (stage columns with drag between stages and quick buttons) and Flow (Source to Stage ribbon diagram with a side panel; fits phone screens without sideways scrolling). The choice is remembered per browser.
- **Enquiry detail panel**: contact details, requested service, source, status and assignee (editable), notes, follow-up tasks (add, mark done, overdue flag) and history.
- **Appointments**: an enquiry links to a real appointment. Cancelled or missed appointments reopen the enquiry, keep its history and show a rebook prompt. Marketing Insights counts linked appointments, not statuses.
- **Actions**: create and edit an enquiry (validated; phone or email required; no clinical details collected), change status, assign staff, close or mark not converted, link to an existing patient (matches are suggested, never automatic) or create a patient (demo), and book an appointment using the existing appointment panel, prefilled from the enquiry. Booking marks the enquiry "Appointment booked".
- **Marketing Insights (`/marketing-insights`)**: total enquiries, appointments from enquiries, enquiry-to-appointment rate, enquiries over time, by source, conversion by source and campaign attribution. Labelled demo data. No ad platform or analytics is connected.
- **Today page**: an "Enquiries to follow up" panel and a "New enquiry" quick action, for roles with the Enquiries permission.
- **CRM (`/crm`)**: a read-only directory of every patient and every enquiry-only person (25 patients plus 35 enquiry-only people in the demo). Search by name, phone or email, filter by derived stage and first-touch source, and open a detail panel with the enquiries and appointments linked to the person and links to the patient, enquiry and appointment screens. People are never merged by name, phone or email. Consent shows "Not recorded" unless a decision is recorded on the patient (only nine demo patients have one), and no consent date or source is ever shown because none is stored. Marketing sees names, stage, source and a date and status for appointments, but phone, email, date of birth, patient ids and appointment details are hidden, and it gets no links into patient records. Original demo patients show source "Unknown" because no referral is recorded for them.
- **Messages**: every enquiry has a message history and one composer for email, SMS and call logs. Sending is simulated and labelled "Demo only, not delivered". A consent and eligibility summary shows marketing eligibility (an explicit yes is required) separately from service messages. The CRM contact panel shows the same history read-only.
- **Campaigns (`/campaigns`)**: create and edit email or SMS campaigns, choose an audience by stage and source, and see who is eligible and why others are left out. Only people with explicit marketing consent are eligible, and SMS marketing is always blocked because no SMS consent is stored. Schedule (demo) or "Simulate send", which records simulated messages in recipients' histories. The one set of performance figures is labelled sample data.
- **Online Bookings**: the practice page (`/booking`) controls which services are offered and lists online bookings. The public page (`/book`) is a five-step journey that ends in a normal appointment. It offers only times the practice could book itself: working hours, each provider's days and time off, the practice break, closed dates, the buffer between visits, a notice period and a booking window. The page has a wide two-column layout with a stepper, service and provider cards, a week date strip with times grouped by part of the day, and a summary card that fills in as the person chooses. `/book/manage` lets a person change or cancel with a reference and email. Nothing is emailed or texted. The break and closed dates are set in Practice > Settings > Appointments (empty by default), and the notice period (default 2 hours) and booking window (default 60 days) on the Online Bookings page.

### Practice (PMS) module
- **Today (`/overview`)**: a compact greeting with the date and clinic, and four clickable counts (Appointments, Arrived, Waiting, In progress) that filter the schedule. A collapsible "Getting started" checklist, the **Today's schedule** table (Time, Patient, Service / reason, Provider, Room, Status, one contextual Action and a menu) in Today, Providers, Rooms and Patient flow views, with Day and Week ranges and filters. Columns adapt to the width of the schedule, so it holds up with the sidebar open or collapsed. Quick actions (Add patient, Book appointment, Start visit, More actions), "Enquiries to follow up" for roles with the Enquiries permission, and on the right "Needs attention" and "Waiting now". The schedule actions follow the existing appointment states only: Check in, Move to waiting, Start visit, View visit. `/front-desk` shows the same page on the Patient flow view.
- **Calendar**: day, week and month views of appointments by provider, room and location. Click an appointment for a side panel (change status, cancel, mark no-show, check out). Appointment statuses: scheduled, confirmed, arrived, waiting, in progress, completed, cancelled, no-show.
- **Patients**: four filter tiles (All, New, Upcoming appointment, Follow-up due) above a searchable and filterable list. Create patient. The patient record opens on **Overview** and has six tabs: Overview, Appointments, Care history, Photos, Documents & forms, Financials (Photos and Financials follow permissions).
  - **Header**: name, patient ID, age, phone and email; the most relevant safety alert in an amber chip, kept apart from relationship tags such as VIP; the next appointment and last visit; **Start visit**, or **Resume visit** when a visit is already in progress (it opens that visit and never starts a second one); Book appointment; and a More menu (edit patient, add follow-up, upload photo, message, which is not connected).
  - **Overview**, in priority order: safety and medical information (alerts, medical history on file, signed consent on file, forms awaiting signature); next appointment with a "Before this appointment" checklist; active treatment plan with progress that counts only steps recorded as completed; a "Needs action" list (overdue and open follow-ups, missing consent for the next appointment, unsigned forms, documents or forms awaiting review, missing medical history, outstanding balance for roles that may see money), each with a reason, due date and owner; last visit and recent care with a small photo strip; clinical notes. Patient details are compact, with the full details, tags and demo message history behind "All details, tags and messages".
  - **Appointments** (new): the patient's booking history, grouped into Upcoming and Earlier, with filters for upcoming, attended, cancelled and no-show. Each row says what the status means ("Booked. Not yet attended.", "Cancelled. Did not take place.", "Did not attend.") and links to the appointment panel and, where one is linked, the visit. Rescheduling and cancelling stay in the appointment panel.
  - **Care history**: the active treatment plan first, other plans folded away, then the chronological timeline. Events open in place and link to the source visit, injection plot, photos, form, invoice or follow-up. A booking appears only as an upcoming plan.
  - **Photos**: capture date, visit and treatment context and photo stage on each photo. Originals are never overwritten.
  - **Documents & forms**: "Needed for the next appointment" first, then structured forms and consent (status such as Signed (typed name), Awaiting signature, Submitted awaiting review, Reviewed), then uploaded documents, kept separate. Only the record of an upload is kept in this demo.
  - **Financials**: outstanding balance up front with a compact summary, then invoices, estimates, credits and refunds, and payment history, with the billing boundary noted.
- **Visits**: a list with filter tiles (All, In progress, Today, Completed) and a "Needs attention" filter. In-progress visits come first and say "resume". Each row shows patient, visit type and reason, provider, status, and the linked booking, or "No booking linked" when no appointment and visit point at each other (nothing is guessed). Rows flag forms awaiting signature and a recommended follow-up that has no follow-up task. The detail screen has at most six tabs in the order a visit unfolds, shows the booking it belongs to and links back to the patient. A plan step can be marked completed only from a visit that records care (treatment lines, injection points or an assessment); a booking alone never completes a step.
- **Appointments (`/appointments`, `/appointments/[id]`)**: a searchable list that is separate from the Calendar and uses the same records and status rules. Quick views (All, Upcoming, Today, Past, Cancelled / no-show), quick filters (Today, Awaiting confirmation, Needs attention), and filters for provider, service, location, source, booking status, attendance, and dates. Each row shows booking and attendance apart (the model has one stored status, so each is stated only as far as it supports: for example, once someone has arrived, confirmation is shown as "Booked", not "Confirmed"). The row menu offers only actions that fit the status: Open, Confirm booking, Check in, Open visit, Reschedule, Mark no-show, Open patient, Cancel (with confirmation). The detail page shows who, what, when, the recorded provider, location, room, source and notes, the linked visit or a plain statement that none exists (opening a page never creates one), only the history that is actually logged, and a concise invoice indicator for roles with Financials. Rescheduling offers only times the availability rules allow. The side panel stays as a quick view with an Open full page link.
- **Activities (`/activities`)**: one worklist of logged calls, tasks, meetings and other interactions. Each record appears once: calls come from the communication log, tasks on an enquiry are the enquiry's own tasks, and other tasks and meetings are kept in an in-memory list that starts empty. Views: All, My activities, Upcoming, Overdue, Completed, with search and filters. Overdue and due-soon are shown in text. A follow-up stays in Follow-ups: an activity can point to one, and completing the activity never completes it. No telephony or call recording exists.
- **Billing (`/billing`)**: a read-only list of invoices and balances across patients with links to each patient's financials. EVOQ Billing is not connected, and nothing here processes a payment.
- **Follow-ups**: four tiles that double as filters (due today, overdue, upcoming, completed). Each row shows the source visit (date and type, linked), the type and a free-text reason ("Reason not recorded" for any follow-up where nobody entered one; no reason is invented), owner, due date and status. The reason is entered when a follow-up is created, from the Follow-ups page, the patient, or the visit.
- **Analytics (`/analytics`)**: answers "what is changing, and where should I look?". Category tabs (Overview, Clinic, Patients, Acquisition, Services, Capacity, Financials) and a catalogue of views: Clinic overview, Appointment analytics (booking volume, confirmation, attendance, cancellation and no-show rates, rescheduling, demand by weekday, hour, provider and location), Patient analytics (returning vs first visit on record, frequency, rebooking, inactive patients with a chosen threshold), Marketing Insights (under Acquisition: sources, conversion by source and by service, campaigns), Service & treatment analytics, Provider & capacity analytics (utilisation only where working hours can be read), Financial analytics (invoiced, collected, refunds and outstanding kept separate; needs Financials) and Follow-up & care continuity. Inventory analytics is shown as not available yet, with the reason. Filters live in the address. Every metric prints its definition, and most link to the matching report. There are no illustrative charts. The appointment view keeps a counts-by-day CSV with no patient details.
- **Reports (`/reports`)**: answers "which records make up this result?". A searchable catalogue by category (Appointments, Patients, Enquiries, Visits, Follow-ups, Services & treatments, Financials, Campaigns) with a record count on each. Each report has filters that live in the address, free-text search, sortable columns, links to the source records, a record count that names the date the range applies to, and CSV export (Exports permission) of exactly the filtered, sorted records. Reports and Analytics use the same range and status rules, so a figure in Analytics equals the record count after following its link (tested). Patient names need the Patients permission, money needs Financials, enquiries need an enquiry permission. Campaign records carry no delivery or response figures because nothing is delivered. Reports do not repeat workflows: opening a row goes to the Appointments, Patients, Visits, Follow-ups, Enquiries, Campaigns or Billing screen.
- **Calendar**: day, week and month. Each appointment shows its stage, kept apart: Booked (scheduled, confirmed; dashed outline), Attending (arrived, waiting, in visit), Completed, and Did not take place (cancelled, no-show, labelled and struck through). A key sits under the grid. Keyboard: with the calendar focused, left and right arrows move the period and T returns to today; Enter on an appointment opens it, and Escape returns focus to it.
- **Agents and EVI**: demo agents apply fixed rules to the demo records; no AI model is connected. Each finding has a "Why this appeared" panel: the rule, what is recorded, what the rule cannot tell, and links to the patient, visit or follow-up. Nothing changes until a person approves it.
- **Agents and EVI**: "EVI" is a chat assistant (Ctrl+J) and agents page. Visit prep, follow-up, appointment, recall, no-show and insights agents produce findings from the mock data. They propose items for a person to approve and never act alone. Engagement, Scribe and Receptionist are shown as not live. This is rule-based logic over sample data, not a connected AI model.
- **Practice configuration (`/practice/*`)**: Team (providers and users), Services and treatments (with per-service capability toggles), Inventory, Locations and rooms, Forms (templates), Integrations (EVOQ Campaigns, Billing, Messaging toggles, demo only), Settings (clinic type, scheduling, patient rules, photos, billing, notifications, agents on/off, security, roles and permissions, audit log).
- **Clinic type switch**: Medical aesthetics, Dermatology, Dental, Physiotherapy, Wellness, General medical, Other. It changes visit tabs, labels and photo checklists.
- **Billing**: invoices, estimates, payments, deposits, refunds, checkout dialog.
- **Look and feel**: most screens start with a soft gradient header (lavender, sky, mint, peach from the brand palette) and, where useful, colour-barred number tiles that can act as filters. Today is more restrained: a plain compact header on a very light brand tint, a Cloud app background and white surfaces. Secondary buttons are white with blue text and a light blue border. They come from shared `PageHeader`, `StatTile` and `StatGrid` components, so new screens inherit the style. Status colours are always paired with a text label.
- **Shell**: collapsible sidebar, global search (Ctrl+K), notifications, "New" menu, role switcher for demos, guided tour and help panel, mobile bottom navigation, skip-to-content link.
- **Onboarding**: sign in, sign up, email verification, forgot/reset password, practice setup, welcome page. A "Use the demo practice account" button on the sign-in page fills the demo login.

## 6. Roles and permissions
Six roles. Permissions can be edited per role in Practice > Settings. Owner is fixed. Only a role's changes are stored, on top of the code defaults, so new defaults reach roles that did not customize that permission and custom choices are never overwritten.

| Permission | Owner | Practice manager | Provider | Front desk | Staff | Marketing |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Patient data | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| Clinical notes | ✓ |  | ✓ |  |  |  |
| Photos | ✓ |  | ✓ |  | ✓ |  |
| Financials | ✓ | ✓ |  | ✓ |  |  |
| Refunds | ✓ | ✓ |  |  |  |  |
| Inventory | ✓ | ✓ | ✓ |  | ✓ |  |
| Reports | ✓ | ✓ | ✓ |  |  |  |
| Exports | ✓ | ✓ |  |  |  |  |
| Settings | ✓ | ✓ |  |  |  |  |
| AI actions | ✓ | ✓ | ✓ |  |  |  |
| CRM | ✓ | ✓ |  | ✓ |  | ✓ |
| Manage enquiries | ✓ | ✓ |  | ✓ |  |  |
| View enquiries (read-only) | ✓ | ✓ |  | ✓ |  | ✓ |
| Practice configuration | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| Manage bookings | ✓ | ✓ |  | ✓ |  |  |
| View bookings | ✓ | ✓ | ✓ | ✓ |  |  |
| Manage campaigns | ✓ | ✓ |  |  |  | ✓ |
| Marketing insights | ✓ | ✓ |  |  |  | ✓ |

How they are enforced today (frontend only):
- Checked in the UI for notes, photos, financials, refunds, inventory, reports, settings and AI actions, and exports (audit-log CSV only). Hidden nav items and "You don't have access" panels.
- The **Patient data** permission now blocks the patient-facing pages (Today, Calendar, Patients, Visits, Follow-ups, Agents), including by direct URL. Marketing lands on Marketing Insights inside Analytics.
- Enquiries and Marketing Insights check their permission on the page, not just in the menu. A switched-off optional module also blocks its direct URL.
- The CRM permission gates the contact directory. Campaign and booking permissions gate their modules: managing needs `campaigns` or `booking`, and `insights` or `booking_view` alone give a read-only view. Message text needs enquiry management.
- Practice configuration (Team, Services, Locations, Forms, Integrations) needs the new Practice configuration permission, so Marketing is blocked by menu and direct URL. Inventory and Settings keep their own permissions.
- Read-only enquiry access (Marketing): the enquiry views hide phone and email and turn off every change.
- "View as role (demo)" in the account menu switches roles for testing. A real app must do this server-side.

## 7. Data and the shared Contact idea
- Sample data lives in `src/lib/db.ts` and `src/lib/clinical.ts`: 25 patients (12 original plus 13 created from converted enquiries, built once by `src/lib/demo-seed.ts` so every page sees the same data), 3 providers, 7 services, 2 locations, 6 rooms, 6 users, appointments dated around 2026-10-07 (a fixed "today" and a demo clock), visits, photos, invoices, inventory, forms, treatment plans, audit entries.
- Changes during a session are held in memory and lost on reload.
- `Contact` (`src/platform/contact.ts`) is a proposed shared person record with per-channel, per-purpose consent. It is not wired into PMS data. The CRM directory builds its rows from patients and enquiries with temporary keys and does not use this type. Ownership between Patient, CRM and Contact is a decision still to agree with the backend developer (see ARCHITECTURE.md).

### Detail pages
- **Enquiries** (`/enquiries/[id]`) and **Contacts** (`/crm/patient/[patientId]`, `/crm/enquiry/[enquiryId]`) have full pages with the same content as the side panel. Lists still open the side panel for quick viewing, and each panel has an "Open full page" link. The contact address uses the patient or enquiry record id, not the directory's display key, because a contact has no id of its own yet. A role that cannot see those ids gets no page link and a "Contact not found" message.
- Other records (campaigns, online bookings, providers, services, inventory items, forms) still open in a panel or editor. Appointments open in the appointment panel; their full-page version is not built.

### Practice configuration (frontend)
- **Services**: Active services are offered for new bookings. Inactive services are not offered on the online booking page or in the new appointment form; existing appointments, visits and invoices keep them. Inactive rooms are treated the same way.
- **Team**: each provider's availability is shown as the booking rules actually read it (days and hours, time off). Text that cannot be read is reported and no rule is applied. The practice break, closed dates, booking notice and window are practice-wide settings.
- **Inventory**: each item shows its quantity, status, an editable reorder level, and its movements by type (Opening stock, Received, Used in a visit, Count correction) with date, who, and a link to the visit. Changes last for the demo session only.
- **Rooms**: not linked to services. Any active room at the location can be chosen for any service and only double-booking is checked.
- **Forms**: Preview opens a read-only view of a template (its questions, answer options and required count) from the list or the builder. It never creates a response, signs a form or records consent.

### Consent as shown in the app (frontend only)
- **Marketing consent** (patients only): Granted, Not granted (earlier record, details unknown), or Not recorded. The old stored yes/no cannot say whether someone declined, withdrew or was never asked, so it is never shown as "Withdrawn". Enquiry-only people always show Not recorded. No date or source is shown unless one exists.
- **Photo consent** (clinical record only): Granted, Denied, Withdrawn or Not recorded. Photo capture defaults to Not recorded and no longer pre-ticks consent. Demo photos are Not recorded because the demo has no photo consent evidence. Use of a photo in marketing or teaching is a separate permission that is not modelled.
- **Treatment consent** is read only from signed consent forms and filed consent documents. **Care communication preferences** are not modelled. The four are kept separate and none is inferred from another.

## 8. Not built or not real
- Backend, database, real authentication (sessions, MFA, email verification are simulated).
- CRM pipeline, owners, tasks, merging and editing (the directory is read-only). Real delivery for Campaigns, messages and booking confirmations, real-time availability, identity checks on the public booking page. Messaging, email/SMS sending, online booking page, payment processing, EVOQ Billing and Campaigns connections.
- Enquiries are part of Marketing Insights but not of EVI agents, and enquiry follow-up tasks are separate from patient Follow-ups.
- Real AI. File storage (uploaded photos and documents are not persisted).
- UI-level automated tests, accessibility audit, audit-log persistence, data export beyond the audit-log CSV.
- Multi-clinic tenancy: one practice per browser.

### Browser tests
`npm run test:e2e` runs 143 Playwright tests (Chromium) against the dev server: Calendar status and keyboard, configuration screens, form preview and agent explanations, plus patient tabs by mouse and keyboard, resuming an in-progress visit without a duplicate, patient to appointment to visit and back, a follow-up to its source visit, completing a form, role access, a controlled save failure, Reports labelling, consent wording, and no horizontal scroll at 375, 768 and 1280px on key screens. A development-only seam (`window.__pmsFailNext`, absent from production builds) makes the next save fail, because the mock API never does. `npm test` runs the unit tests.

## 9. Risks to know before building further
- Roles and permissions are only enforced in the browser, so they must be enforced by the backend.
- Patient data is clinical data. A real backend needs encryption, access logging and consent enforcement before any real records are used.
- Internal storage keys and some names still say `pms.*`. Safe to leave, costly to rename later without migration.
- Patient identity is stored on `Patient` only. Introducing Contact later touches many files, which is why it is deferred.

## 10. Options for the next step
1. **Hand off as is** to the backend developer with ARCHITECTURE.md and this file, and agree the API and identity model first.
2. **Hand the identity and consent decisions to the backend developer**: `docs/IDENTITY_DECISIONS.md` records what product has agreed, and `docs/DEVELOPER_INSTRUCTIONS.md` is the short build brief. Then replace the demo data layers behind `enquiriesApi`, `commsApi`, `campaignsApi` and `bookingApi` one at a time.
3. **Close remaining permission gaps**: view-only booking behavior, and field-level rules for what read-only roles may see.
4. **Split the shell** into a generic platform shell plus PMS-only parts, so new modules don't depend on PMS panels.
5. **Clean-up**: tests, renaming internal `pms.*` keys, removing sample-data clock assumptions.

