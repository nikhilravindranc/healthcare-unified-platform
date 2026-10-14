# Contact, Patient and Enquiry identity: decisions for the backend developer

Status: **product decisions agreed (sections 0 and 8 to 14), developer confirmation pending**. Nothing in this document has been migrated or implemented as a permanent model. Where sections 3 to 6 (reasoning and options) differ from sections 0 and 8 to 14, the later decisions win. Last reconciled 14 Oct 2026.
Sections 1 and 2 describe what the frontend does today and can be checked in the code. Section 0 records what product has agreed. Sections 3 to 6 give the reasoning and options behind it. For the build instructions, see `docs/DEVELOPER_INSTRUCTIONS.md`.

## 0. Decisions agreed by product

| # | Decision |
|---|---|
| 1 | A **Contact** exists from the first touch (enquiry, online booking, import). A Patient is a clinical record that points to one contact. |
| 2 | The permanent identifier is a **system-generated contact id**. A name is never an identifier. A phone number or email is never an identifier either. They are attributes used to suggest matches. |
| 3 | `Patient.id` does not change. One contact has at most one patient record. |
| 4 | Phone and email matches are **suggestions only**, shown with the reason. A person always confirms. Nothing merges automatically. |
| 5 | A contact can have several phone numbers and emails, each with a status (active, shared, no longer in use) and a date. A number used by family or friends is marked shared. When a number changes hands it is marked no longer in use, and the new owner inherits nothing. |
| 6 | **Merges.** Records with no patient record: Front desk, Practice Manager or Owner can merge. One side is a patient: Front desk can request, a Practice Manager or Owner approves. Both sides are patients: Practice Manager or Owner only. Always audited, the other id keeps resolving, and a merge is reversible for 30 days. |
| 7 | One **global source list**, edited by the Owner. A referrer name goes in a separate field, not in the source. |
| 8 | **Consent** is recorded by category, purpose and channel, never as one yes/no, and never belongs to a phone number. Four categories: marketing, care communication, treatment, photo (section 10). At launch the communication scope is email marketing, SMS marketing, and reminders by email and SMS. Each record stores status, effective date, who recorded it, source, method and wording or form version. History is append-only. SMS marketing stays blocked until SMS consent is captured. |
| 9 | One **task** entity: one assignee, one due date, linked to a contact, enquiry or patient. Notes are never edited in place. |
| 10 | Delivery status comes from the messaging provider and the app only displays it. The email and SMS vendors are still to be chosen by the business. |
| 11 | Changing an online booking works only through a **signed, expiring link** sent to the person. The page never reveals whether an email or phone belongs to a patient. |
| 12 | The server enforces permissions and field masking, and checks consent again at send time. |
| 13 | A Contact may exist without a Patient (prospect, enquiry-only person). Contact holds shared identity and details. Patient holds the clinical profile and records. The full clinical record is never copied into Contact (section 8). |
| 14 | An Enquiry owns acquisition and the pipeline. CRM is a directory and worklist, never a second pipeline. A direct appointment booking needs no Enquiry (section 9). |
| 15 | Conversion links records and never overwrites or deletes the enquiry. No merge is made by matching alone (sections 9 and 11). |
| 16 | Missing consent is never permission. Marketing consent is never inferred from treatment consent, and photo consent is never inferred from treatment consent (section 10). |
| 17 | Each record type has one authoritative owner (section 12). |

Assumption to confirm: "staff who handle appointments" in decision 6 is the **Front desk** role, not the separate Staff role.

## 1. What the frontend does today (confirmed)

| Topic | Current frontend behavior | Where |
|---|---|---|
| Patient identity | `Patient.id` (`P-<number>`) is the only permanent person id. It is created by the mock `api.createPatient`. | `src/lib/db.ts` |
| Contact | There is no stored Contact. `src/platform/contact.ts` is an unused type sketch. The CRM directory builds contact rows on the fly from patients and enquiries. | `src/modules/crm/contacts.ts` |
| Directory keys | `patient:<patientId>` and `enquiry:<enquiryId>`. They are render keys only, are replaced by an opaque key for restricted roles, and must never be stored or treated as ids. | `buildContacts`, `maskContact` |
| Enquiry to patient | `Enquiry.patientId` is set by a person (link an existing patient, or create one after a confirmation). Never inferred. | `enquiriesApi.linkPatient`, `createPatientFrom` |
| Several enquiries, one person | Enquiries linked to the same patient appear under that patient. Unlinked enquiries each become their own enquiry-only contact, even if the same person enquired twice. | `buildContacts` |
| Duplicates | Never merged by name, phone or email. Phone or email matches are only suggested when linking an enquiry. The online booking page matches a returning patient only on exact email and exact last name together. | `enquiry-detail.tsx`, `bookingApi.findReturning` |
| Conversion | An enquiry stays as it was. It gains `patientId` and `appointmentId`. History is kept, and a cancelled appointment reopens the enquiry without deleting anything. | `booking-state.ts` |
| Appointment history | `Appointment.events` logs cancelled, no-show and rescheduled. Enquiry history shows these as derived entries. | `src/lib/db.ts`, `booking-state.ts` |
| Source | Enquiries use 7 values (`ENQUIRY_SOURCES`). Patients have a free-text `referral` chosen from 5 settings values. The CRM maps the second to the first (see 3.5). First touch comes from the earliest linked enquiry, then the patient's referral, otherwise "Unknown". | `crm/contacts.ts` |
| Consent | Only `Patient.marketingConsent?: boolean`, read as an email-marketing decision. `undefined` means not recorded. There is no date, source, channel or purpose, and nothing for enquiry-only people. | `src/lib/types.ts` |
| Messages | A demo `Message` has channel, direction, status, purpose (service or marketing), and links to an enquiry, patient, appointment and campaign. Nothing is delivered. | `src/modules/comms/` |
| Tasks, notes, assignments | Enquiry tasks, notes and assignee live on the enquiry. Patient follow-ups are a separate list. There are no CRM tasks. | `modules/enquiries`, `FollowUp` |
| Permissions | Role permissions are frontend demo state. Field masking for Marketing is applied in the browser. | `lib/clinical.ts`, `maskContact` |

## 2. Rules the frontend already follows (keep them)

1. No automatic merging. A link between records is always an explicit act by a person.
2. A missing value is shown as missing. Missing consent is never treated as permission.
3. Consent dates and sources are never invented.
4. Source values that cannot be mapped are kept as recorded.
5. Clinical data stays in Practice Management. Restricted roles never receive patient ids, appointment detail, phone, email or date of birth in the data the screen gets.

## 3. Decisions to agree

### 3.1 Does a Contact exist before a person is a patient? (Agreed: Option A, decision 1)
- **Option A (recommended):** yes. A `Contact` is created at the first touch (enquiry, online booking, import). A `Patient` is a clinical record that references a contact.
- **Option B:** no. The enquiry holds the identity until conversion. Simpler, but a person with two enquiries is two people until someone links them.
- **Why A:** it matches what the CRM directory has to show and removes the "same person twice" case at the source. It needs a decision on duplicates (3.4).

### 3.2 Who creates and owns the permanent contact identifier?
- **Recommendation:** the backend generates an opaque, never-reused id (UUID). The frontend never creates or derives ids. `Patient.id` stays the clinical identifier and must not change. The contact id and patient id are separate columns linked one to one.
- **Open point:** whether a contact can ever link to more than one patient record (for example after a merge). Recommended: no, enforce one patient per contact and handle merges as a controlled operation.

### 3.3 Contacts, patients and several enquiries
- One contact, zero or one patient, many enquiries, many appointments (through the patient), many messages.
- `Enquiry.contactId` is required. `Enquiry.patientId` stays optional and is set on conversion.
- The enquiry-only contact is then one real contact with several enquiries, not several rows.

### 3.4 Duplicate detection and manual merge approval
- Detection runs on the server and only produces **suggestions** with a reason (same email, same phone, similar name and date of birth). It never merges.
- A merge is a separate, permissioned, audited action by a named person. It records which record survives, keeps the other id as an alias that still resolves, and is reversible for a defined period.
- Shared family phone numbers and changed numbers make phone and email weak evidence. Name and date of birth together are stronger but still need a human decision.
- Agreed: see decision 6 in section 0. Merges that touch no patient record are open to Front desk, because most duplicates are enquiry-only people. Merges that touch clinical history need a Practice Manager or Owner.
- Phone numbers are shared by families and change hands. A number can be linked to several contacts and can be marked shared or no longer in use. A number never carries consent or history to its next owner.

### 3.5 Source attribution and the canonical taxonomy
Current mapping used by the CRM (`REFERRAL_TO_SOURCE`):

| Enquiry source | Patient referral value |
|---|---|
| Website form | Website enquiry |
| Phone call | none |
| Walk-in | Walk-in |
| Patient referral | Patient referral |
| Social media | Social media |
| Campaign | none |
| Online booking | none (new, set automatically by the public booking page) |
| none | Provider referral (kept as its own source) |

- **Recommendation:** one canonical list owned by the backend, configurable per practice, with `first_touch_source`, `first_touch_at` and the originating record stored on the contact and never overwritten. Free text such as a doctor's name goes in a separate `referrer` field, not in the source.
- Campaign attribution (which campaign) is a separate field from source. The frontend only has a campaign name on a few sample enquiries. No attribution is claimed beyond that.

### 3.6 Consent ownership, channel, purpose, status, date and source (extended by section 10, which wins)
Current model is one boolean. Recommended record, one per contact, channel and purpose:

| Field | Meaning |
|---|---|
| `channel` | email, sms, phone |
| `purpose` | marketing, reminders, recall (service messages about a person's own appointment need no marketing consent) |
| `status` | granted, withdrawn (no row = not recorded) |
| `recorded_at`, `recorded_by`, `source` | when, by whom (or "patient on the booking page"), and where it came from |
| `evidence` | optional reference such as a form or a message id |

- Consent history is append-only. A withdrawal is a new row, never an edit.
- **The server must evaluate eligibility at send time.** The frontend preview and its rule (explicit granted consent for the channel and purpose, plus a way to reach the person) are a convenience and must not be trusted.
- SMS marketing consent does not exist anywhere in the demo data. It must be captured, not assumed from email consent.

### 3.7 Appointment and communication history
- Appointments stay owned by Practice Management. An enquiry references `appointment_id`. A re-booking keeps the earlier ids. The status history (booked, cancelled, no-show, rescheduled, with who and when) should be a proper audit table. The frontend's `Appointment.events` is a placeholder for it.
- Messages are owned by a communication service and reference contact, enquiry, appointment and campaign. Delivery state (queued, sent, delivered, failed, bounced) comes from the provider. The frontend only has `draft`, `simulated`, `received` and `logged`, and never claims delivery.
- Service messages (confirmations, reminders) and marketing messages are separate purposes with separate rules.

### 3.8 Tasks, notes and assignments
- Today: enquiry tasks, enquiry notes and `assigneeId` sit on the enquiry. Patient follow-ups are a second list. A third (CRM) task list was deliberately not built.
- **Recommendation:** one task entity with an optional link to a contact, enquiry or patient, one assignee, one due date, one status. Notes attach to a contact or enquiry with author and time, and are never edited in place.

### 3.9 API responsibilities and server-side authorization
- The server enforces authorization. The frontend's role checks and masking are for presentation only.
- Field-level rules to enforce on the server: phone, email and date of birth need patient-data access or enquiry management. Patient ids, appointment service, provider and time need patient-record access. Marketing sees name, stage, source and appointment date and status only. Message text needs enquiry management.
- Public booking endpoints must be separate from staff endpoints, return only what a patient may see, verify identity for changes (for example a signed link to the address), rate limit, and never reveal whether an email belongs to a patient.

## 4. Proposed entities (not implemented)

```
Contact (id, first_name, last_name, created_at, first_touch_source, first_touch_at, first_touch_ref)
  1 --- 0..1  Patient   (id = existing patient id, contact_id)
  1 --- 0..*  ContactChannel   (contact_id, type email|phone, value, verified_at, is_primary)
  1 --- 0..*  ConsentRecord    (contact_id, channel, purpose, status, recorded_at, recorded_by, source, evidence)
  1 --- 0..*  Enquiry          (id, contact_id, patient_id?, source, requested_service_id?, status, assignee_id?, created_at)
  1 --- 0..*  Message          (id, contact_id, enquiry_id?, appointment_id?, campaign_id?, channel, direction, purpose, status, provider_ref?)
Patient 1 --- 0..*  Appointment (id, patient_id, provider_id, service_id, start, status, origin)
Enquiry 0..1 --- 0..* Appointment  via enquiry_appointment_link (enquiry_id, appointment_id, linked_at)  // history kept
Appointment 1 --- 0..*  AppointmentEvent (appointment_id, at, actor, type, detail)
Task (id, assignee_id, due, status, note, contact_id?, enquiry_id?, patient_id?)
MergeRequest (id, kept_contact_id, merged_contact_id, requested_by, approved_by, approved_at, reason)
Campaign (id, channel, audience_criteria, status, scheduled_for) 1 --- 0..* CampaignRecipient (campaign_id, contact_id, eligibility_snapshot, message_id)
```

## 5. Suggested API boundaries (not implemented)

| Area | Responsibility |
|---|---|
| `contacts` | search, read (field-masked by role), create from first touch, suggestions for duplicates, merge with approval |
| `enquiries` | create, update, status, assign, link patient, link or replace appointment, history |
| `patients` and `appointments` | unchanged ownership. Add status history and `origin` |
| `consent` | append a decision, read current and history, evaluate eligibility for a contact, channel and purpose |
| `messages` | compose, send through a provider, receive webhooks, list by contact or enquiry |
| `campaigns` | CRUD, audience preview (server-evaluated), schedule, run, per-recipient results |
| `booking-public` | list bookable services and providers, availability, create booking, look up, change, cancel |
| `auth` | users, roles and permissions, server-side authorization and audit log |

## 6. Questions for the backend developer

Product has answered the policy side of these questions (section 0). The developer is asked to confirm each is buildable, and to answer the open points.

1. Contact before patient: Option A or B (3.1)?
2. Is the patient id kept as it is, and can one contact ever own two patient records (3.2)?
3. Which roles approve a merge, and how long is a merge reversible (3.4)?
4. Is the canonical source list per practice or global, and who edits it (3.5)?
5. Which consent channels and purposes are needed at launch (3.6)?
6. Which messaging providers are in scope, and who owns delivery status (3.7)?
7. Is a single task entity acceptable (3.8)?
8. How is a member of the public verified when changing an online booking (3.9)?

## 7. What the frontend will not do until this is agreed

- Create or store any contact id, merge records, or change a patient id.
- Treat a derived directory row as a permanent identity.
- Send or claim to send any message, or claim delivery, attribution or analytics.

## 8. Entity ownership and stable identifiers (agreed)

| Entity | Owns | Does not own |
|---|---|---|
| **Contact** | Stable `contact_id`. Name, shared contact details (phones and emails with status), communication preferences, first-touch source, links to Patient, Enquiries and consent records. | Medical history, visits, treatment, photos, forms or any clinical content. |
| **Patient** | `patient_id` (never changes), `contact_id` reference, clinical profile, medical history, visits, treatment records, photos, forms, documents. | Identity, phone and email as the permanent key, marketing consent. |

Rules:
1. A Contact can exist with no Patient. A Contact has zero or one Patient. A Patient always has one Contact.
2. Identity keys are opaque server-generated ids. Name, email and phone are attributes used for search and suggestions only, never as a key.
3. Contact stores references to clinical records at most (for example "has a patient record"), never copies.
4. Every other record refers to people by id: `Enquiry.contact_id` (required) and `Enquiry.patient_id` (optional), `Appointment.patient_id`, `Message.contact_id`, `ConsentRecord.contact_id`.
5. Today the frontend has no Contact. `Patient.id` and `Enquiry.id` are the only ids, and CRM rows use display keys (`patient:<id>`, `enquiry:<id>`) that must never be stored.

## 9. Enquiry, CRM, conversion and direct booking (agreed)

**Enquiry owns:** acquisition source and attribution, requested service, status, assignment, notes, communication history, follow-up tasks, and the conversion history with links to the resulting Contact, Patient and Appointment.

**CRM owns nothing of its own.** It is the relationship directory and worklist over Contacts, Enquiries and Patients. It has no pipeline, no duplicate identity and no clinical records.

**Conversion** (an enquiry leads to a patient):
1. Staff confirm whether the person is already a Contact or Patient (using suggestions, section 11). If so, link the enquiry to that Contact and Patient. If not, create the Contact and Patient as appropriate.
2. The Enquiry is kept with its source, attribution and history.
3. The relationship is recorded explicitly as a conversion link (`enquiry_id`, `contact_id`, `patient_id`, `appointment_id?`, `linked_at`, `linked_by`). A cancelled or missed booking reopens the enquiry without deleting the link history.
4. No duplicate person or patient is created when a match is confirmed.

**Direct booking:** a booking made by staff for an existing patient, or by a returning patient online, does not create an Enquiry. A brand-new person booking online creates a Contact, a Patient and an Enquiry with source "Online booking" so first touch is kept (this is what the demo does today).

## 10. Consent model (agreed, with extension points)

### Categories
| Category | About | Typical subject | Frontend today |
|---|---|---|---|
| Marketing | Permission to send promotional messages, by channel | Contact | `Patient.marketingConsent` (boolean, email only, `undefined` = not recorded). Enquiry-only people have none. |
| Care communication | Reminders, recall and service messages about a person's own care, by channel, and the preferred channel | Contact | Not modelled. Demo `Message.purpose` separates service from marketing. |
| Treatment | Informed consent to a specific treatment | Patient and Visit | Signed `Visit.forms` of kind Consent, and `PatientDoc` of kind "Consent record". |
| Photo | Taking, storing and using clinical photos, with separate usage permissions (clinical record, education, marketing use) | Patient and Photo | `PhotoAsset.consent` ("Granted" or "Pending"), one value, no usage detail. |

### Record (one append-only entity, `ConsentRecord`)
| Field | Notes |
|---|---|
| `id` | Stable record id. |
| `category`, `purpose`, `channel` | Category as above. Purpose for example `email_marketing`, `reminders`, `photo_clinical`, `photo_marketing`. Channel (email, sms, phone, post) only where it applies. |
| `contact_id` | Always. Plus `patient_id`, `visit_id` or `photo_id` where the consent concerns a clinical record. |
| `status` | `granted`, `denied`, `withdrawn`. **Not recorded is the absence of a row**, not a value to assume. |
| `effective_at` | When the decision applies (may differ from when it was recorded). |
| `recorded_at`, `recorded_by` | Who captured it, or "the person themselves" for self-service. |
| `source`, `method` | For example online booking page, paper form, in clinic, phone call, signed digital form. |
| `wording_ref` | The form, template and version, or the exact text shown, so the person can later see what they agreed to. |
| `supersedes_id` | Link to the record it replaces. Withdrawal or change is a new row. History is never edited or deleted. |
| `evidence_ref` | Optional signature, upload, call reference or message id. |

### Rules
1. Missing consent is never granted. No row means not recorded, which means not allowed to market.
2. Marketing consent is not inferred from treatment consent, from booking, or from being a patient. Photo consent is not inferred from treatment consent. A photo usage permission applies only to the usage it names.
3. Care communication and marketing are separate purposes. A service message about a person's own appointment needs a reachable address, not marketing consent.
4. A typed name or ticked box is stored as what it is (method and wording) and is not described as a legally valid signature unless the supported signing process captured it.
5. Consent belongs to the Contact (or to the Patient and record for clinical categories), never to a phone number or email. When a number changes hands the new owner inherits nothing.
6. Enforcement is by the backend and the communication service at send time, and by the backend when a photo is published or shared. Frontend visibility, disabled buttons and previews are not enforcement.
7. Categories have different legal and operational rules by jurisdiction (for example marketing opt-in, health-data and image-use rules). One shared entity gives a common shape and audit trail. It does not mean any jurisdiction's requirements are satisfied. See section 14.
8. Extension points: new `purpose` and `channel` values, expiry or review dates, guardian or representative consent (`given_by`), jurisdiction tag, and a link to a signing provider. Adding these must not need a change to existing rows.

### Frontend gaps (closed on 14 Oct 2026, with what remains)
- Closed: a stored marketing "no" is shown as "Not granted (earlier record, details unknown)", never as "Withdrawn" (`consentFromFlag`, `deriveConsent`). Campaign audience reasons use the same wording.
- Closed: photo consent has four states (Granted, Denied, Withdrawn, Not recorded). Capture no longer pre-ticks consent, and demo photos no longer claim consent they have no evidence for.
- Remaining by design: the frontend stores one boolean for marketing, one value per photo and signed forms for treatment. It cannot hold dates, sources, wording versions or history, so none is shown or invented. The append-only record in this section is for the backend.
- Treatment consent is read from signed forms and filed documents only (`consentOnFile`). A missing one is shown as missing. A typed name is labelled as a typed name.

## 11. Duplicate detection and manual merge (agreed)

1. Matching runs on the server and returns **suggestions with a reason** (same phone, same email, similar name with date of birth). It is shown to staff. It never merges, links or changes consent.
2. A merge is a separate explicit action by a named person with a reason, controlled by role (decision 6), and recorded in a `MergeRequest`.
3. It preserves stable ids: the surviving Contact and Patient keep their ids, and the retired id keeps resolving to the survivor. Enquiries, appointments, messages and consent records keep their original ids and move by reference, not by copy.
4. The consent history of both records is kept in full. A merge never turns a missing or withdrawn consent into granted. If the two records disagree, the more restrictive status applies until a person records a new decision.
5. Reversible for 30 days with its own audit entry.
6. The frontend adds no automatic matching and no identity migration in this phase.

## 12. Source of truth by product (agreed)

| Record | Authoritative owner | Others hold |
|---|---|---|
| Contact (person identity) | Contact service | `contact_id` references |
| Patient (clinical profile) | Practice Management | `patient_id` references |
| Enquiry (acquisition, pipeline) | Enquiries | `enquiry_id` on appointments, messages, CRM rows |
| Appointment (booking and attendance lifecycle) | Practice Management | `appointment_id` on enquiries, visits, invoices |
| Visit (care delivered and its documentation) | Practice Management | `visit_id` on photos, forms, invoices, stock movements |
| Consent | Consent service (authoritative records) | Reference ids on patient, visit, photo, form |
| Relationship directory and worklist | CRM (a view, not a source) | Reads from the owners above |
| Campaigns, audiences, sends, performance | Campaigns | `campaign_id` on messages. Audience eligibility asks the consent service. |
| Financial transactions | Billing | `invoice_id` references. Patient Financials displays and links. |
| Public booking experience and its rules | Booking | Creates appointments through Practice Management |

Distinctions that must hold in every screen and API: a **booking** is a plan, **attendance** is a recorded outcome of an appointment, a **visit** is care actually delivered with documentation, and a **completed treatment** is a recorded care event. None implies the next (see the Appointments tab and Patient Overview rules in `docs/ARCHITECTURE.md`).

## 13. Permissions, audit and migration

### Permissions and audit (server side)
1. The server enforces authorization for every read and write. The frontend's roles, masking and module toggles are presentation only.
2. The field-level rules in 3.9 stand. Consent history is readable by roles that manage the relevant category. Recording or changing consent needs its own permission and a named actor.
3. Audit log (who, what, when, from where, before and after) for: reading clinical records and photos, consent changes, conversions and links, merges and un-merges, exports, permission changes, sending and campaign approvals.
4. Retention, access-log review and export controls need security review (section 14).

### Smallest safe migration path for the backend developer
1. Create `Contact` and backfill one contact per Patient and one per **unlinked** Enquiry. Never merge during backfill. Store `Patient.contact_id` and `Enquiry.contact_id`. Keep `Patient.id` and `Enquiry.id` unchanged.
2. Move phones and emails into `ContactChannel` with status `active`. Mark any number shared by more than one record as `shared`, for staff review. Do not decide it automatically.
3. Create `ConsentRecord`. Backfill from `Patient.marketingConsent`: no value, no row. For `true` and `false`, create a legacy record with `source = migrated` and no invented date or method, flagged **legacy, unverified**. Store `false` as `denied` (the boolean cannot say withdrawn). Treat legacy `true` as not eligible until section 14 item 1 is answered.
4. Backfill treatment and photo consent as references: signed consent forms and filed consent documents become `ConsentRecord` rows with the form or document as `evidence_ref` and their real signed date. `PhotoAsset.consent = "Granted"` becomes a photo record with no usage permission beyond the clinical record. `"Pending"` creates no row.
5. Add the explicit conversion link from existing `Enquiry.patient_id` and `appointment_id`.
6. Run duplicate suggestion over the result and let staff review. Merge nothing automatically.
7. Swap the frontend data layers one at a time (`enquiriesApi`, `commsApi`, `campaignsApi`, `bookingApi`, then patients and appointments) behind the existing API boundaries.

## 14. Needs legal, security or implementation review (classified 14 Oct 2026)

| # | Item | Classification | Notes |
|---|---|---|---|
| 1 | Reliance on legacy marketing consent, and evidence needed per jurisdiction | **Legal or privacy review** | Product default until answered: legacy "granted" is not eligible in the backend, and the frontend shows legacy "no" as "not granted, details unknown". |
| 2 | Guardian or representative consent (minors, lack of capacity) | **Legal or privacy review** | Extension point `given_by` is reserved. Nothing built. |
| 3 | Retention and deletion of consent history and images versus erasure | **Legal or privacy review, then security architecture** | Append-only history is the product decision. How erasure applies needs an accountable reviewer. |
| 4 | Audit log design, access review, encryption, export controls, digital signature capture | **Security or backend architecture review** | Required before any real patient data. Not frontend work. |
| 5 | Consent service boundary, send-time eligibility query, failure behaviour | **Security or backend architecture review** | Product decision already made: if the check is unavailable, do not send. |
| 6 | Merge handling of conflicting clinical records, alias resolution in URLs and exports | **Future implementation decision** | Policy for ids and consent is decided (section 11). The mechanics depend on the backend. |
| 7 | Email and SMS vendors, delivery status ownership | **Future implementation decision (business input)** | The frontend only displays status and never claims delivery. |

None of these is closed by this document. Items 1 to 3 need a named legal or privacy reviewer. Items 4 and 5 need the backend owner.
