/**
 * Shared Contact model. One Contact is one real person across every module.
 * Modules attach their own records by `contactId` instead of copying identity fields.
 * Proposal only: ownership is to be agreed with the backend developer (see docs/ARCHITECTURE.md).
 *  - PMS:       Patient.contactId (clinical record; PHI stays in PMS)
 *  - CRM:       lifecycle stage, owner, activity
 *  - Booking:   bookings reference contactId
 *  - Campaigns: audiences resolve to contacts + consent
 */
export type ContactSource = "pms" | "crm" | "booking" | "campaign" | "import";
export type ConsentChannel = "email" | "sms" | "phone";
export type ConsentPurpose = "marketing" | "reminders" | "recall";
/** One record per channel and purpose. Sending services must enforce it. */
/** `at` and `source` stay empty when they were not recorded. They must never be filled in to make a record look complete. */
export interface Consent { channel: ConsentChannel; purpose: ConsentPurpose; status: "granted" | "withdrawn"; at?: string; source?: string }
export interface Contact {
  id: string;                       // "C-<n>"; stable across modules
  first: string; last: string;
  email?: string; phone?: string; dob?: string;
  tags: string[];
  source: ContactSource;            // where the contact was first created
  consents: Consent[];
  links: { patientId?: string };    // module record links (extend as modules land)
  createdAt: string;
}
export const contactName = (c: Pick<Contact, "first" | "last">) => `${c.first} ${c.last}`.trim();
