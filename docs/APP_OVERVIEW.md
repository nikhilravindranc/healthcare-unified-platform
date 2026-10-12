# Healthcare Platform: what the app is today

Status snapshot of the frontend after the Enquiries, Marketing Insights and navigation work (after the stabilization pass). For the target structure see [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. In one paragraph
A clickable, frontend-only web app. One part is a complete Practice Management System (PMS) demo for clinics: schedule, patients, visits, photos, billing, inventory, forms, reports and AI "agents". On top of it sit a working Enquiries screen (front-desk handling of enquiries through to a booked appointment) and a Marketing Insights screen, both on sample data. CRM, Online Bookings and Campaigns exist only as labelled previews. There is no backend: all data is in-memory sample data that resets on reload, and sign-in, roles and settings are demo state in the browser.

## 2. Tech stack
| Area | What is used |
|---|---|
| Framework | Next.js 16.4 (App Router), React 19.3, TypeScript 5 |
| Styling | Tailwind CSS 4, Radix UI primitives, lucide-react icons, `class-variance-authority`, `tailwind-merge` |
| Data fetching | TanStack Query 5 over a mock API with artificial delays (`src/lib/db.ts`, `src/lib/clinical.ts`) |
| Forms | react-hook-form + zod 4 validation |
| Feedback | sonner toasts |
| Persistence | None server-side. `localStorage` for session, role, permissions, settings, sidebar; sample data in memory |
| Tests | `npm test`: 57 unit tests for permissions, the shared seed, appointment/insights logic, the Flow layout, CRM contact derivation, appointment rules, messaging eligibility, campaigns and online booking. No UI test suite |
| Run | `npm run dev` (development), `npm run build` then `npm run start` (production check) |

Note: this Next.js version differs from older ones. [AGENTS.md](../AGENTS.md) tells developers to read `node_modules/next/dist/docs/` before changing framework code.

## 3. Modules
| Module | Route | State |
|---|---|---|
| Practice (PMS) | `/overview`, `/calendar`, `/patients`, `/visits`, `/follow-ups`, `/reports`, `/agents`, `/practice/*` | Working demo |
| Enquiries | `/enquiries` | Working demo: list, filters, create/edit, status, follow-up tasks, link patient, book appointment |
| Marketing Insights | `/marketing-insights` | Working demo on sample data |
| CRM | `/crm` | Working read-only contact directory (preview). Patients plus enquiry-only people, with search, stage and source filters and a detail panel. Reached from the account menu |
| Online Bookings | `/booking` (staff), `/book` (public) | Working in demo mode: public booking journey that follows provider days, time off, breaks, closed dates and notice rules (on demo data), practice settings, list of online bookings |
| Campaigns | `/campaigns` | Working in demo mode: campaign list and editor, consent-based audience preview, simulated runs. Nothing is sent |

Modules are registered in `src/platform/modules.ts` and appear in the sidebar's "Growth & Engagement" group (CRM in the account menu) when the module is switched on and the role has a matching permission.

**Sidebar:** Clinic (Today, Calendar, Patients, Enquiries, Follow-ups, Reports), Practice (Team, Services & treatments, Inventory, Locations & rooms, Forms), Growth & Engagement (Marketing Insights, Campaigns, Online Bookings). CRM, Online Bookings and Campaigns are optional and can be switched off in Practice > Integrations.

## 4. Features
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
- **Online Bookings**: the practice page (`/booking`) controls which services are offered and lists online bookings. The public page (`/book`) is a five-step journey that ends in a normal appointment. It offers only times the practice could book itself: working hours, each provider's days and time off, the practice break, closed dates, the buffer between visits, a notice period and a booking window, and `/book/manage` lets a person change or cancel with a reference and email. Nothing is emailed or texted.

### Practice (PMS) module
- **Today (`/overview`)**: day schedule with filters, "needs attention" list, who is waiting, and a Patient flow (front desk) view with 8 patients per page. `/front-desk` redirects here.
- **Calendar**: day, week and month views of appointments by provider, room and location. Click an appointment for a side panel (change status, cancel, mark no-show, check out). Appointment statuses: scheduled, confirmed, arrived, waiting, in progress, completed, cancelled, no-show.
- **Patients**: searchable and filterable list (status, tag). Create patient. Patient record has five tabs: Summary, Care history, Photos, Documents & forms, Financials. Includes alerts (allergy, medical), tags, referral source and marketing consent (Granted, Not granted or Not recorded).
- **Visits**: documentation per visit with SOAP-style notes, treatments, forms and consent, follow-up instructions, treatment plan, billing. Tabs adapt to the clinic type and to what each service enables. Aesthetics extras: guided photo capture and an injection plotting map with product and units.
- **Follow-ups**: due today, overdue, upcoming, completed.
- **Reports**: appointment and no-show trends, provider utilization, service volume, provider and patient activity, billing summary, inventory.
- **Agents and EVI**: "EVI" is a chat assistant (Ctrl+J) and agents page. Visit prep, follow-up, appointment, recall, no-show and insights agents produce findings from the mock data. They propose items for a person to approve and never act alone. Engagement, Scribe and Receptionist are shown as not live. This is rule-based logic over sample data, not a connected AI model.
- **Practice configuration (`/practice/*`)**: Team (providers and users), Services and treatments (with per-service capability toggles), Inventory, Locations and rooms, Forms (templates), Integrations (EVOQ Campaigns, Billing, Messaging toggles, demo only), Settings (clinic type, scheduling, patient rules, photos, billing, notifications, agents on/off, security, roles and permissions, audit log).
- **Clinic type switch**: Medical aesthetics, Dermatology, Dental, Physiotherapy, Wellness, General medical, Other. It changes visit tabs, labels and photo checklists.
- **Billing**: invoices, estimates, payments, deposits, refunds, checkout dialog.
- **Shell**: collapsible sidebar, global search (Ctrl+K), notifications, "New" menu, role switcher for demos, guided tour and help panel, mobile bottom navigation, skip-to-content link.
- **Onboarding**: sign in, sign up, email verification, forgot/reset password, practice setup, welcome page. A "Use the demo practice account" button on the sign-in page fills the demo login.

## 5. Roles and permissions
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
- The **Patient data** permission now blocks the patient-facing pages (Today, Calendar, Patients, Visits, Follow-ups, Agents), including by direct URL. Marketing lands on Marketing Insights.
- Enquiries and Marketing Insights check their permission on the page, not just in the menu. A switched-off optional module also blocks its direct URL.
- The CRM permission gates the contact directory. Campaign and booking permissions gate their modules: managing needs `campaigns` or `booking`, and `insights` or `booking_view` alone give a read-only view. Message text needs enquiry management.
- Practice configuration (Team, Services, Locations, Forms, Integrations) needs the new Practice configuration permission, so Marketing is blocked by menu and direct URL. Inventory and Settings keep their own permissions.
- Read-only enquiry access (Marketing): the enquiry views hide phone and email and turn off every change.
- "View as role (demo)" in the account menu switches roles for testing. A real app must do this server-side.

## 6. Data and the shared Contact idea
- Sample data lives in `src/lib/db.ts` and `src/lib/clinical.ts`: 25 patients (12 original plus 13 created from converted enquiries, built once by `src/lib/demo-seed.ts` so every page sees the same data), 3 providers, 7 services, 2 locations, 6 rooms, 6 users, appointments dated around 2026-10-07 (a fixed "today" and a demo clock), visits, photos, invoices, inventory, forms, treatment plans, audit entries.
- Changes during a session are held in memory and lost on reload.
- `Contact` (`src/platform/contact.ts`) is a proposed shared person record with per-channel, per-purpose consent. It is not wired into PMS data. The CRM directory builds its rows from patients and enquiries with temporary keys and does not use this type. Ownership between Patient, CRM and Contact is a decision still to agree with the backend developer (see ARCHITECTURE.md).

## 7. Not built or not real
- Backend, database, real authentication (sessions, MFA, email verification are simulated).
- CRM pipeline, owners, tasks, merging and editing (the directory is read-only). Real delivery for Campaigns, messages and booking confirmations, real-time availability, identity checks on the public booking page. Messaging, email/SMS sending, online booking page, payment processing, EVOQ Billing and Campaigns connections.
- Enquiries are not yet part of Reports or EVI agents, and enquiry follow-up tasks are separate from patient Follow-ups.
- Real AI. File storage (uploaded photos and documents are not persisted).
- UI-level automated tests, accessibility audit, audit-log persistence, data export beyond the audit-log CSV.
- Multi-clinic tenancy: one practice per browser.

## 8. Risks to know before building further
- Roles and permissions are only enforced in the browser, so they must be enforced by the backend.
- Patient data is clinical data. A real backend needs encryption, access logging and consent enforcement before any real records are used.
- Internal storage keys and some names still say `pms.*`. Safe to leave, costly to rename later without migration.
- Patient identity is stored on `Patient` only. Introducing Contact later touches many files, which is why it is deferred.

## 9. Options for the next step
1. **Hand off as is** to the backend developer with ARCHITECTURE.md and this file, and agree the API and identity model first.
2. **Agree the identity and consent model** in `docs/IDENTITY_DECISIONS.md` with the backend developer, then replace the demo data layers behind `enquiriesApi`, `commsApi`, `campaignsApi` and `bookingApi`.
3. **Close remaining permission gaps**: view-only booking behavior, and field-level rules for what read-only roles may see.
4. **Split the shell** into a generic platform shell plus PMS-only parts, so new modules don't depend on PMS panels.
5. **Clean-up**: tests, renaming internal `pms.*` keys, removing sample-data clock assumptions.

