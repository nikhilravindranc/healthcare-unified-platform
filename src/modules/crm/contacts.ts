/**
 * CRM contact directory: pure derivation, no browser or network access.
 *
 * Verified data this reads: patients, enquiries (already joined with their appointment by the enquiries data layer),
 * PMS appointments and visits. It reads them and never writes, merges or creates records.
 *
 * WHO IS A CONTACT
 *  - Every patient is one contact.
 *  - Every enquiry linked to that patient (`Enquiry.patientId`) belongs to that contact. This is the only way enquiries
 *    and patients are joined. Phone, email and name are never used to merge people.
 *  - Every enquiry with no linked patient is its own "enquiry-only" contact. If the same person enquired twice, they
 *    appear twice. Duplicate suggestions are a later feature.
 *  - `key` is a temporary identifier for rendering ("patient:<id>" or "enquiry:<id>"). It is not a Contact id and must
 *    not be stored.
 *
 * STAGE (derived, first matching rule wins)
 *  Enquiry-only:  enquiry New or Contacted (including a booking that was cancelled or missed) -> "Prospect"
 *                 enquiry Closed or Not converted -> "Not converted"
 *  Patient:       has a completed appointment or visit
 *                   and (the latest one is within 90 days of today, or a live appointment is still ahead) -> "Active patient"
 *                   otherwise -> "Lapsed patient"
 *                 no completed appointment or visit, and a live appointment today or later -> "Appointment booked"
 *                 otherwise -> "Patient, no activity"
 *  A "live" appointment is not cancelled and not a no-show.
 *
 * FIRST-TOUCH SOURCE
 *  1. The earliest linked enquiry (by received date, then id) -> its source.
 *  2. Otherwise the patient's recorded referral, mapped with REFERRAL_TO_SOURCE.
 *     A value that cannot be mapped becomes "Other (as recorded)" and keeps the raw text.
 *  3. Otherwise "Unknown". Nothing is guessed.
 */
import type { Appointment, ApptStatus, Patient } from "@/lib/types";
import type { ConsentState } from "../comms/eligibility";
import { isLostAppointment } from "../enquiries/booking-state";
import { ENQUIRY_SOURCES, type Enquiry } from "../enquiries/types";

export const CONTACT_STAGES = ["Prospect", "Not converted", "Appointment booked", "Active patient", "Lapsed patient", "Patient, no activity"] as const;
export type ContactStage = (typeof CONTACT_STAGES)[number];
export const LAPSED_AFTER_DAYS = 90;

export const SOURCE_OTHER = "Other (as recorded)";
export const SOURCE_UNKNOWN = "Unknown";
/** Patient referral options (Practice > Settings) and the enquiry source they are treated as. Anything else is preserved, not mapped. */
export const REFERRAL_TO_SOURCE: Record<string, string> = {
  "Website enquiry": "Website form",
  "Patient referral": "Patient referral",
  "Walk-in": "Walk-in",
  "Social media": "Social media",
  "Provider referral": "Provider referral",     // exists only on the patient side, kept as its own source
};
export const SOURCE_FILTER_OPTIONS = [...ENQUIRY_SOURCES, "Provider referral", SOURCE_OTHER, SOURCE_UNKNOWN] as string[];

export interface FirstTouch { source: string; basis: "enquiry" | "patient-referral" | "none"; mapped: boolean; raw?: string; date?: string; enquiryId?: string }
/** The patient model records only a yes/no. A date or source for consent is not stored anywhere, so they stay undefined. */
export interface ConsentView { status: ConsentState["status"]; recordedAt?: string; source?: string }
export interface ContactAppointment { id: string; date: string; time: string; status: ApptStatus; serviceId: string; providerId: string; enquiryId?: string; lost: boolean }
export interface VisitLite { patientId: string; date: string; status: string }

export interface CrmContact {
  key: string;
  kind: "patient" | "enquiry-only";
  name: string;
  phone?: string; email?: string; dob?: string;
  /** True when phone, email and date of birth were removed for the viewer's role. */
  detailsHidden: boolean;
  /** Whether the person can be reached by email or phone. Computed before masking and holds no contact details, so every role may see it. */
  reach: { email: boolean; phone: boolean };
  patientId?: string;
  patientStatus?: Patient["status"];
  enquiries: Enquiry[];
  appointments: ContactAppointment[];
  stage: ContactStage;
  firstTouch: FirstTouch;
  consent: ConsentView;
  lastActivity?: string;
}

const addDays = (d: string, n: number) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const byEarliest = (a: Enquiry, b: Enquiry) => a.received.localeCompare(b.received) || a.id.localeCompare(b.id);

export function mapReferral(raw?: string): FirstTouch {
  const r = (raw ?? "").trim();
  if (!r) return { source: SOURCE_UNKNOWN, basis: "none", mapped: false };
  const mapped = REFERRAL_TO_SOURCE[r];
  return mapped ? { source: mapped, basis: "patient-referral", mapped: true, raw: r } : { source: SOURCE_OTHER, basis: "patient-referral", mapped: false, raw: r };
}

export function deriveFirstTouch(enquiries: Enquiry[], patient?: Pick<Patient, "referral">): FirstTouch {
  const first = [...enquiries].sort(byEarliest)[0];
  if (first) {
    const known = (ENQUIRY_SOURCES as readonly string[]).includes(first.source);
    return { source: known ? first.source : SOURCE_OTHER, basis: "enquiry", mapped: known, raw: known ? undefined : first.source, date: first.received, enquiryId: first.id };
  }
  return mapReferral(patient?.referral);
}

export function deriveConsent(patient?: Pick<Patient, "marketingConsent">): ConsentView {
  if (!patient || patient.marketingConsent === undefined) return { status: "not-recorded" };
  return { status: patient.marketingConsent ? "granted" : "not-granted" };
}

export function derivePatientStage(appts: { status: ApptStatus; date: string }[], visits: { date: string; status: string }[], today: string): ContactStage {
  const live = appts.filter((a) => !isLostAppointment(a as never));
  const ahead = live.some((a) => a.date >= today && a.status !== "completed");
  const done = [...appts.filter((a) => a.status === "completed").map((a) => a.date), ...visits.filter((v) => v.status === "Completed").map((v) => v.date)].sort();
  if (done.length) return ahead || done[done.length - 1] >= addDays(today, -LAPSED_AFTER_DAYS) ? "Active patient" : "Lapsed patient";
  return ahead ? "Appointment booked" : "Patient, no activity";
}

export const deriveEnquiryStage = (e: Pick<Enquiry, "status">): ContactStage => (e.status === "Closed" || e.status === "Not converted" ? "Not converted" : "Prospect");

export function buildContacts(input: { patients: Patient[]; enquiries: Enquiry[]; appointments: Appointment[]; visits: VisitLite[]; today: string }): CrmContact[] {
  const { patients, enquiries, appointments, visits, today } = input;
  const patientIds = new Set(patients.map((p) => p.id));
  const out: CrmContact[] = [];

  for (const p of patients) {
    const linked = enquiries.filter((e) => e.patientId === p.id);
    const appts: ContactAppointment[] = appointments.filter((a) => a.patientId === p.id).map((a) => ({
      id: a.id, date: a.date, time: a.time, status: a.status, serviceId: a.serviceId, providerId: a.providerId,
      enquiryId: linked.find((e) => e.appointmentId === a.id || e.previousAppointmentIds?.includes(a.id))?.id, lost: isLostAppointment(a as never),
    })).sort((x, y) => y.date.localeCompare(x.date) || y.time.localeCompare(x.time));
    const pv = visits.filter((v) => v.patientId === p.id);
    const past = [...linked.map((e) => e.received), ...appts.filter((a) => a.date <= today).map((a) => a.date), ...pv.map((v) => v.date)].sort();
    out.push({
      key: `patient:${p.id}`, kind: "patient", name: `${p.first} ${p.last}`.trim(), phone: p.phone, email: p.email, dob: p.dob || undefined, detailsHidden: false, reach: { email: !!p.email || linked.some((e) => !!e.email), phone: !!p.phone || linked.some((e) => !!e.phone) },
      patientId: p.id, patientStatus: p.status, enquiries: linked, appointments: appts,
      stage: derivePatientStage(appts, pv, today), firstTouch: deriveFirstTouch(linked, p), consent: deriveConsent(p), lastActivity: past[past.length - 1],
    });
  }
  // A link to a patient that does not exist is treated as no link: the person stays an enquiry-only contact.
  for (const e of enquiries.filter((x) => !x.patientId || !patientIds.has(x.patientId))) {
    out.push({
      key: `enquiry:${e.id}`, kind: "enquiry-only", name: e.name, phone: e.phone, email: e.email, detailsHidden: false, reach: { email: !!e.email, phone: !!e.phone },
      enquiries: [e], appointments: [], stage: deriveEnquiryStage(e), firstTouch: deriveFirstTouch([e]), consent: deriveConsent(), lastActivity: e.received,
    });
  }
  return out.sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? "") || a.name.localeCompare(b.name));
}

/* ---------- Permissions (frontend demo behavior, not security) ---------- */
export interface ContactAccess {
  /** Phone, email and date of birth. Same rule as enquiry read-only access: needs patient data or enquiry management. */
  details: boolean;
  /** Links into patient records and the appointment panel. Needs patient data. */
  patientRecords: boolean;
}
export const contactAccess = (can: (perm: "patients" | "enquiries") => boolean): ContactAccess => ({ details: can("patients") || can("enquiries"), patientRecords: can("patients") });

/** A short opaque stand-in for a render key, so a restricted viewer never receives a record id inside it. */
const opaqueKey = (k: string) => { let h = 5381; for (let i = 0; i < k.length; i++) h = ((h * 33) ^ k.charCodeAt(i)) >>> 0; return `c-${h.toString(36)}`; };

/**
 * Removes what the viewer's role may not see, so hidden values never reach the UI at all.
 *  - Without `details`: phone, email and date of birth (on the contact and on its enquiries).
 *  - Without `patientRecords`: patient id and status, and everything about an appointment except its date, status and
 *    whether it came from an enquiry (no service, provider, time or appointment id). What remains is a conversion summary.
 */
export function maskContact(c: CrmContact, access: ContactAccess): CrmContact {
  let out = c;
  if (!access.details) out = { ...out, phone: undefined, email: undefined, dob: undefined, detailsHidden: true, enquiries: out.enquiries.map((e) => ({ ...e, phone: undefined, email: undefined })) };
  if (!access.patientRecords) {
    out = {
      ...out, key: opaqueKey(out.key), patientId: undefined, patientStatus: undefined,
      appointments: out.appointments.map((a) => ({ ...a, id: "", time: "", serviceId: "", providerId: "" })),
      enquiries: out.enquiries.map((e) => ({ ...e, patientId: undefined, appointmentId: undefined, previousAppointmentIds: undefined, appointment: e.appointment && { ...e.appointment, id: "", time: "", serviceId: "", providerId: "" } })),
    };
  }
  return out;
}

/* ---------- Search and filters ---------- */
export interface ContactFilters { q?: string; stage?: string; source?: string }
/** Search covers name, phone and email. Hidden fields are already removed by `maskContact`, so they cannot match. */
export function filterContacts(list: CrmContact[], f: ContactFilters): CrmContact[] {
  const q = (f.q ?? "").trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  return list.filter((c) => {
    if (f.stage && c.stage !== f.stage) return false;
    if (f.source && c.firstTouch.source !== f.source) return false;
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q) || (!!digits && (c.phone ?? "").replace(/\D/g, "").includes(digits));
  });
}
