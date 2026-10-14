# EVOQ Practice Management: application audit and backlog

Audit date: 14 Oct 2026 (demo clock 7 Oct 2026). Direction: `EVOQ_PMS_Refinement_Strategy.docx`. Findings come from reading the code and, for the patient detail, running it. Items marked "not run" were assessed from code only.

Common baseline for every area: demo data resets on reload; permissions are frontend demo behaviour, not security; nothing is sent to patients or other EVOQ products.

## Priority backlog (updated 14 Oct 2026)

| # | Change | Area | Status |
|---|---|---|---|
| 1 | Separate real record counts from illustrative figures; label demo panels; export real records only | Reports | **Done**, browser-tested |
| 2 | Safety alert and follow-up-due indicators in the patient list; stale menu label | Patients | **Done** |
| 3 | Follow-ups: source visit date and type; reason | Follow-ups | **Done** (reason reuses `FollowUp.note`, never back-filled) |
| 4 | Visits list: in-progress first, linked booking or explicit "No booking linked", outstanding forms and follow-up flags, needs-attention filter | Visits | **Done**, unit and browser-tested |
| 4b | Visit detail: booking link, completed visits read-only, plan steps need recorded care | Visits | **Done** |
| 5 | Consent wording: no inferred withdrawal; four photo-consent states; no pre-ticked capture consent | CRM, patients, campaigns, comms | **Done**, unit and browser-tested |
| 6 | Route error boundary and failed-save behaviour | All | **Done**, boundary checked once with a temporary throwing page, failed save covered by Playwright |
| 7 | Browser test harness | All | **Done** (Playwright, 67 tests) |
| 8 | EVI/agents: "demo agents, fixed rules, no AI model connected" wording; "Why this appeared" on every finding (rule, recorded facts, limits, source links) | Agents | **Done**, unit and browser-tested. Also removed an invented claim ("a 3:00 PM slot with Dr. Rao is open") and made recall, follow-up and no-show rules ignore cancelled and no-show bookings |
| 9 | Calendar: booking versus attendance (Booked, Attending, Completed, Did not take place), status key, dashed outline for booked-only, visible "Cancelled"/"No-show" label, keyboard date navigation, focus return after the panel closes | Calendar | **Done**, unit and browser-tested. Week/month cells were already buttons. Arrow-key movement between events is not added (Tab reaches every event) |
| 10 | Services: active/inactive meaning stated; inactive services and rooms no longer offered in the new appointment form | Services | **Done**, browser-tested |
| 11 | Team: provider availability shown as the booking rules read it, with a live "what the rules will use" panel; unreadable text reported, nothing assumed | Team | **Done**, unit and browser-tested |
| 12 | Inventory: movement type, date, visit link; editable reorder level; movements record the amount actually applied; "demo session only" note | Inventory | **Done**, unit and browser-tested. No procurement or warehouse features added |
| 13 | Locations: room suitability by service | Locations | **Not enforced, documented.** The model has no room-to-service link. The Rooms screen says so. Decision needed: add `Room.serviceIds?: string[]` (empty means any) and a rule in `checkConflicts` |
| 14 | Forms: read-only preview from the list and the builder; multi-select questions now show their options; patient fill dialog states the template version | Forms | **Done**, browser-tested |
| 15 | Reports charts: replace illustrative charts with record-based ones | Reports | Blocked: seed has too little history. They stay labelled illustrative |

Backend and production work (not frontend): Contact service and migration, consent service, server-side authorization and audit, persistence, real messaging and payment integrations, real AI. See `IDENTITY_DECISIONS.md` sections 13 and 14.

## Area notes

### Global navigation and shell
- Purpose and users: every role; role-aware, module-gated groups (Clinic, Patient acquisition, Practice management).
- Preserve: grouping, module gating, search, Ask EVI, New menu, notifications, mobile More menu, `/front-desk` as a distinct route.
- Problems: Patient acquisition group is visible to roles without CRM access only if permissions allow (works). Search is not keyboard-announced as a command palette.
- Missing: none required.
- Dependencies: `moduleEnabled`, role permissions.
- Recommend: keep. Check skip-to-content link and focus return from menus (not run).
- Acceptance: each nav item reaches its route, active state correct on nested routes, hidden modules block direct links. Tests: role-perms.test.ts (exists).

### Today / Overview
- Purpose: front desk, providers, managers; schedule-first.
- Preserve: schedule filters, waiting list, quick actions, needs-attention, patient flow at `/front-desk`.
- Problems: none new after the recent refinement; keep an eye on duplicate attention items between Today and Follow-ups.
- Dependencies: appointment status rules, follow-up data.
- Recommend: keep. Acceptance: counts match Calendar for the same day; arrival and start-visit update both screens. Tests: appointment-consistency, flow-layout (exist).

### Calendar
- Purpose: scheduling by day/week/month, provider/room/location.
- Preserve: views, filters, side panel, reschedule rules (`canReschedule`), availability enforcement.
- Problems: month and week cells are buttons (good) but there is no distinct visual for booked versus attended beyond status colour; keyboard use of week grid not run.
- Missing: none required.
- Recommend: backlog 5. Acceptance: in-progress/completed cannot be rescheduled; cancelled/no-show not shown as upcoming. Tests: appointment-consistency.

### Patient listing
- Purpose: find a patient and take the next action.
- Preserve: search, filter tiles, row open, row menu, pagination, balance column by permission.
- Problems: safety alert and follow-up-due are not visible in the row; the row menu said "Add note (in a visit)" and opened a retired tab (fixed: now "Open care history"); location filter infers location from the first appointment.
- Recommend: backlog 2. Acceptance: alert shown as text plus icon, not colour only; role without `patients` sees no list. Tests: add a pure function test for row flags.

### Visits
- Purpose: list and open visit workspaces; providers and managers.
- Preserve: filters, search, row open, workspace tabs, resume behaviour.
- Done: see backlog 4 and 4b.
- Recommend: none further. Acceptance: opening an in-progress visit never creates a second visit. Tests: record-links.test.ts (appointment↔visit consistency, added).

### Follow-ups
- Purpose: front desk and providers track returns.
- Preserve: four status tabs, type filter, complete, schedule, agent hint.
- Problems: no reason or source visit date (only an "Open visit" link); "Schedule appointment" does not relate the new booking back to the follow-up; completing has no undo.
- Missing: owner reassignment, a reason. Needs a data decision (`reason` text on FollowUp).
- Recommend: backlog 3. Acceptance: each row shows why, who, when, source; completing updates Overview and Patients counts.

### Reports
- Purpose: managers and owners; operational view.
- Preserve: filters, charts, billing summary, inventory, CSV.
- Problems found: appointment tiles, trends, utilization, service volume, provider and patient activity were pseudo-random numbers shown as real, with one small footnote and a claim that billing and inventory were "live"; CSV exported the invented numbers; the agent hint asserted "no-shows are highest on Mondays" with no basis.
- Done: real record counts section (appointments by status in range, follow-ups snapshot), billing and inventory moved up and described as demo records, illustrative sections under a warning with an "Illustrative" badge on each panel, CSV now exports only record counts, unsupported Monday claim removed.
- Still open: charts remain illustrative. Replace with record-based charts only when the seed has enough history (it does not).
- Acceptance: tile numbers equal rows in Calendar for the same filters; CSV rows equal tile totals. Tests: report-records.test.ts (added).

### EVI and agents
- Purpose: rule-based findings with human approval.
- Preserve: approval model, "Planned capability. Not live." labels.
- Problems: findings do not all state the rule behind them.
- Recommend: backlog 6. Acceptance: every finding has a reason and a source link; nothing acts without approval.

### Team and provider management
- Purpose: owner/manager configure providers and user access.
- Preserve: Providers and Users & permissions views, role overrides, locked Owner.
- Problems: provider availability (weekdays, breaks) lives in Settings, not beside the provider.
- Recommend: backlog 8. Acceptance: a provider's hours shown are the hours enforced by `availability-rules`. Tests: availability-rules (exists).

### Services and treatments
- Purpose: define services, capabilities, price.
- Preserve: capability toggles that drive visit tabs.
- Problems: toggles do not explain their downstream effect.
- Recommend: backlog 7.

### Inventory
- Purpose: stock, usage from completed visits.
- Preserve: stock status, movements, visit-linked usage.
- Recommend: backlog 9. Acceptance: a booking never changes stock; only a completed visit does.

### Locations and rooms
- Preserve: location and room lists, room conflict checks.
- Problems: availability is demo data; room suitability per service is not modelled.
- Recommend: backlog 10 (needs a model decision).

### Forms and practice settings
- Preserve: templates, versions, settings groups, integrations marked demo.
- Problems: template versus completed response is clear in patient Forms tab; the Forms section has no patient-facing preview.
- Recommend: backlog 11.

### Enquiries and CRM handoffs
- Identity, consent and ownership decisions are in `IDENTITY_DECISIONS.md` sections 8 to 14. Known UI gaps: CRM maps `marketingConsent: false` to "withdrawn" (lossy), photo consent has only Granted/Pending, enquiry-only people have no consent state. Not changed (no model change in this phase).
- Purpose: enquiry pipeline; CRM directory is read-only.
- Preserve: boundaries, no auto-merge, booking-state resolver, consent not inferred.
- Recommend: no change. Acceptance: identity decisions in `IDENTITY_DECISIONS.md` still hold. Tests: crm-contacts, booking-state (exist).

### Online booking
- Preserve: availability rules, notice and window, manage-booking, demo labels, no delivery claims.
- Recommend: no change. Tests: booking, availability-rules (exist).

### Billing handoffs
- Preserve: patient Financials tab, Reports billing summary, invoice deep links.
- Problems: none found; the Financials tab already avoids duplicating Billing.
- Acceptance: invoice links open the correct invoice (verified in `record-links.test.ts` at data level).

## Patient detail validation (summary)
See the implementation report. Data link integrity is covered by `tests/record-links.test.ts`. Not simulated: network failure and slow responses (the mock API never rejects); the only failure UI reachable is the new route error boundary and the mutation toast.

## Validation evidence (14 Oct 2026)
- `npm test`: 94 unit tests pass.
- `npm run test:e2e`: 67 Playwright tests pass against the dev server (Chromium): journeys, role access, failed save, Reports, consent wording, Calendar status and keyboard, Services, Team, Inventory, Rooms, Forms preview, Agents explanations, and no horizontal scroll at 375, 768 and 1280px on the main and configuration screens.
- Checks: `tsc --noEmit`, `eslint src`, `npm run build`.
- Manual browser checks: Reports, Visits, patient list, follow-ups, route error boundary (temporary page, removed).
- Not tested: real network failure, slow responses, screen readers, other browsers, full keyboard pass of every control on every tab. Only targeted keyboard checks were run: patient tab arrow/Home/End, More menu, Edit dialog and focus return.
- Marketing role: a Playwright test confirms the patient page refuses it. The route error boundary has no automated test: it was checked once with a temporary throwing page, because a render error cannot be caused from the normal UI.
- Keyboard and focus checked for what was touched: Calendar (arrow keys, T, Enter on an event, Escape, focus returns to the event), Forms preview (Enter on the button, Escape, focus returns), patient tabs and More menu. Dialogs and panels opened from code now return focus to the control that opened them (`useReturnFocus` in `ui/index.tsx`).
- Not done: screen-reader testing, other browsers, a full accessibility audit.

## Detail pages (14 Oct 2026)
Done: `/enquiries/[id]`, `/crm/patient/[id]`, `/crm/enquiry/[id]` (side panel kept as quick view, with Open full page). Playwright covers both, the not-found states, a role without patient access, and 375 and 768px.
Not done, by choice of scope: appointments, campaigns, online bookings, and practice records (providers, services, inventory, forms).

## Remaining frontend gaps (14 Oct 2026)
- Full detail pages for appointments, campaigns, online bookings and practice records.
- Room suitability by service: needs the model decision above.
- Reports: illustrative charts stay until the seed has real history.
- Calendar: no arrow-key movement between events, and no keyboard way to create an appointment in an empty slot other than the New appointment button.
- Reorder level and stock movements are demo-session only; nothing persists.
