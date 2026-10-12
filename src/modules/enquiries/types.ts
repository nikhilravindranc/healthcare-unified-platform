import type { ApptStatus } from "@/lib/types";

export const ENQUIRY_STATUSES = ["New", "Contacted", "Appointment booked", "Closed", "Not converted"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];
export const ENQUIRY_SOURCES = ["Website form", "Phone call", "Walk-in", "Patient referral", "Social media", "Campaign"] as const;
export type EnquirySource = (typeof ENQUIRY_SOURCES)[number];

export interface EnquiryTask { id: string; due: string; note: string; assigneeId?: string; done: boolean }
export interface EnquiryActivity { id: string; at: string; text: string; /** Computed from the linked appointment, never stored. */ derived?: boolean }
/** Read-only summary of the PMS appointment an enquiry is linked to. */
export interface LinkedAppointment { id: string; date: string; time: string; status: ApptStatus; providerId: string; serviceId: string }
export interface Enquiry {
  id: string;
  name: string; phone?: string; email?: string;
  /** Matches a PMS service id; empty means a general enquiry. */
  serviceId?: string;
  source: EnquirySource;
  /** Demo campaign attribution (sample data only). */
  campaign?: string;
  received: string;                 // YYYY-MM-DD
  status: EnquiryStatus;
  assigneeId?: string;              // PMS user id
  notes: string;
  /** Link to an existing PMS patient. Set by a person; never inferred from phone or email alone. */
  patientId?: string;
  /** The PMS appointment created from this enquiry. */
  appointmentId?: string;
  /** Earlier appointments for this enquiry that were replaced after a cancellation. */
  previousAppointmentIds?: string[];
  /** Added by the data layer when listing: the live state of the linked appointment. */
  appointment?: LinkedAppointment;
  /** True when the linked appointment was cancelled or missed, so the enquiry is open again. */
  bookingLost?: boolean;
  tasks: EnquiryTask[];
  history: EnquiryActivity[];
}
