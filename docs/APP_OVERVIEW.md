# Healthcare Platform: what the app is today

Status snapshot of the frontend after the module skeletons, rebranding and roles work (commit `a70159c`). For the target structure see [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. In one paragraph
A clickable, frontend-only web app. One part is a complete Practice Management System (PMS) demo for clinics: schedule, patients, visits, photos, billing, inventory, forms, reports and AI "agents". Three more modules (CRM, Booking, Campaigns) exist only as empty skeletons in the navigation. There is no backend: all data is in-memory sample data that resets on reload, and sign-in, roles and settings are demo state in the browser.

## 2. Tech stack
| Area | What is used |
|---|---|
| Framework | Next.js 16.4 (App Router), React 19.3, TypeScript 5 |
| Styling | Tailwind CSS 4, Radix UI primitives, lucide-react icons, `class-variance-authority`, `tailwind-merge` |
| Data fetching | TanStack Query 5 over a mock API with artificial delays (`src/lib/db.ts`, `src/lib/clinical.ts`) |
| Forms | react-hook-form + zod 4 validation |
| Feedback | sonner toasts |
| Persistence | None server-side. `localStorage` for session, role, permissions, settings, sidebar; sample data in memory |
| Tests | None |
| Run | `npm run dev` (development), `npm run build` then `npm run start` (production check) |

Note: this Next.js version differs from older ones. [AGENTS.md](../AGENTS.md) tells developers to read `node_modules/next/dist/docs/` before changing framework code.

## 3. Modules
| Module | Route | State |
|---|---|---|
| Practice (PMS) | `/overview`, `/calendar`, `/patients`, `/visits`, `/follow-ups`, `/reports`, `/agents`, `/practice/*` | Working demo |
| Enquiries | `/enquiries` | Working demo: list, filters, create/edit, status, follow-up tasks, link patient, book appointment |
| Marketing Insights | `/marketing-insights` | Working demo on sample data |
| CRM | `/crm` | Preview. Lists contacts derived from patients. Reached from the account menu |
| Online Bookings | `/booking` | Preview only |
| Campaigns | `/campaigns` | Preview only |

Modules are registered in `src/platform/modules.ts` and appear in the sidebar's "Platform" section when the role has a matching permission.

## 4. Features in the Practice (PMS) module
- **Today (`/overview`)**: day schedule with filters, "needs attention" list, who is waiting, and a Patient flow (front desk) view. `/front-desk` redirects here.
- **Calendar**: day, week and month views of appointments by provider, room and location. Click an appointment for a side panel (change status, cancel, mark no-show, check out). Appointment statuses: scheduled, confirmed, arrived, waiting, in progress, completed, cancelled, no-show.
- **Patients**: searchable and filterable list (status, tag). Create patient. Patient record has five tabs: Summary, Care history, Photos, Documents & forms, Financials. Includes alerts (allergy, medical), tags, referral source and marketing consent flag.
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
Six roles. Permissions can be edited per role in Practice > Settings. Owner is fixed. Permissions saved in a browser replace the defaults (a known limitation after adding new ones).

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
| CRM and enquiries | ✓ | ✓ |  | ✓ |  | ✓ |
| Manage bookings | ✓ | ✓ |  | ✓ |  |  |
| View bookings | ✓ | ✓ | ✓ | ✓ |  |  |
| Manage campaigns | ✓ | ✓ |  |  |  | ✓ |
| Marketing insights | ✓ | ✓ |  |  |  | ✓ |

How they are enforced today (frontend only):
- Checked in the UI for notes, photos, financials, refunds, inventory, reports, settings and AI actions, and exports (audit-log CSV only). Hidden nav items and "You don't have access" panels.
- The **Patient data** permission is defined but no screen checks it yet, so a Marketing user can still open `/patients` directly.
- CRM, booking and campaign permissions currently only decide whether the module shows in the nav and whether its skeleton page opens, because the modules have no features yet.
- "View as role (demo)" in the account menu switches roles for testing. A real app must do this server-side.

## 6. Data and the shared Contact idea
- Sample data lives in `src/lib/db.ts` and `src/lib/clinical.ts`: 12 patients, 3 providers, 7 services, 2 locations, 6 rooms, 6 users, appointments dated around 2026-10-07 (a fixed "today" and a demo clock), visits, photos, invoices, inventory, forms, treatment plans, audit entries.
- Changes during a session are held in memory and lost on reload.
- `Contact` (`src/platform/contact.ts`) is a proposed shared person record with per-channel, per-purpose consent. It is not wired into PMS data. CRM shows contacts derived from patients as an interim demo. Ownership between Patient, CRM and Contact is a decision still to agree with the backend developer (see ARCHITECTURE.md).

## 7. Not built or not real
- Backend, database, real authentication (sessions, MFA, email verification are simulated).
- CRM, Booking and Campaigns features. Messaging, email/SMS sending, online booking page, payment processing, EVOQ Billing and Campaigns connections.
- Real AI. File storage (uploaded photos and documents are not persisted).
- Automated tests, accessibility audit, audit-log persistence, data export beyond the audit-log CSV.
- Multi-clinic tenancy: one practice per browser.

## 8. Risks to know before building further
- Roles and permissions are only enforced in the browser, so they must be enforced by the backend.
- Patient data is clinical data. A real backend needs encryption, access logging and consent enforcement before any real records are used.
- Internal storage keys and some names still say `pms.*`. Safe to leave, costly to rename later without migration.
- Patient identity is stored on `Patient` only. Introducing Contact later touches many files, which is why it is deferred.

## 9. Options for the next step
1. **Hand off as is** to the backend developer with ARCHITECTURE.md and this file, and agree the API and identity model first.
2. **Build one module's UI next**, most reuse first: Booking (can reuse providers, services, rooms and availability), then CRM (enquiries and pipeline), then Campaigns (audiences and consent).
3. **Close the permission gaps** in the frontend: enforce Patient data, add view-only booking and insights behaviors.
4. **Split the shell** into a generic platform shell plus PMS-only parts, so new modules don't depend on PMS panels.
5. **Clean-up**: tests, renaming internal `pms.*` keys, removing sample-data clock assumptions.

---
Update: Enquiries, Marketing Insights, the new sidebar groups, the `enquiries` permission and optional-module toggles were added after this overview was written. See ARCHITECTURE.md ("Healthcare workspace") for the current state.
