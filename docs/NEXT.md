# Handoff note

Last updated: 2026-10-15. Repo state: `main`, clean, last commit `5d40264` (new navigation, Appointments, Activities, Analytics and Reports), pushed.

## Standing rules
- Do not commit or push unless explicitly told ("commit and push").
- Frontend only: no backend, database, auth, live AI, payments or integrations.
- No new dependencies unless needed.
- Never fabricate patient history, appointments, consent, signatures, payments, audit trails, analytics or illustrative trends.
- Never present mock or simulated functionality as live (messages, campaigns and bookings are simulated, with no delivery claims).
- Missing consent is never permission; no invented consent dates or sources.
- No auto-merge of identities by name, email or phone.
- Frontend permissions are demo behaviour, not security.
- Do not claim tests passed unless they were run (`npm test`, `npm run test:e2e`, `npm run build`).
- Keep the EVOQ palette and the "Minimal by default. Complete when needed." approach.
- Preserve routes, working behaviour, mock API boundaries and permissions.
- No shared Contact model, migration, live AI or unrelated navigation redesign without a separate decision.
- Read `node_modules/next/dist/docs/` before framework-level changes (see `AGENTS.md`).

## Where things are
- Docs: `docs/APP_OVERVIEW.md/.docx`, `APP_AUDIT.md`, `ARCHITECTURE.md`, `IDENTITY_DECISIONS.md`, `DEVELOPER_INSTRUCTIONS.md`. Keep them in sync with changes.
- Panels (appointment, new appointment, follow-up, visit): `src/components/app/panels.tsx`. Opened globally from `src/components/app/shell.tsx` via `ui.newAppt(prefill, { onCreated })`.
- Appointments: `src/app/(app)/appointments/`, `src/lib/appointment-view.ts`.
- Enquiry and Contact full pages: `src/app/(app)/enquiries/[id]/`, `src/app/(app)/crm/[kind]/[id]/`. Side panels stay as quick view with an "Open full page" link.
- Analytics and Reports: `src/lib/insights.ts`, `src/lib/reports.ts`, `src/components/insights/`, `src/app/(app)/analytics/`, `src/app/(app)/reports/`.
- Tests: `tests/*.test.ts` (Node runner), `e2e/*.spec.ts` (Playwright, helper `openAs(page, path, role)`).
- Demo clock: TODAY = 2026-10-07. Mock data is in-memory (`src/lib/db.ts`, `src/lib/clinical.ts`).

## Open question (decision pending)
Should New appointment get a full page like Enquiries and Contacts?
- Recommendation given: keep the side panel. Creation is a short task started from Calendar slots, Today, patient headers, follow-ups and enquiry booking, and the enquiry flow relies on the `onCreated` callback.
- Option if wanted: add `/appointments/new`, built on the same form, with prefill from query parameters, and keep the panel as the quick path.
- The user has started a separate chat for this. Confirm the choice before changing code.

## Open backlog (not started, do not begin without confirmation)
- Room suitability by service (needs a model decision, e.g. `Room.serviceIds`).
- Calendar arrow-key movement between events.
- Campaign delivery and response tracking (currently simulated only).
- Time to contact / booking, revenue by location, call duration.
- Saved and scheduled reports.
- Full detail pages for campaigns, online bookings, providers, services, inventory and forms.
- Specialist-review items (legal, privacy, security, backend) listed in `docs/IDENTITY_DECISIONS.md` section 14.

## Working tips
- Windows: moving a directory can be denied while the dev server runs. Playwright reuses the dev server on port 3000.
- Next page files may only export page-valid exports; put shared helpers in separate modules.
- Keep each chat to one phase of work and start a new chat after a commit and push.
