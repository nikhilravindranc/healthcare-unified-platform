export const ENQUIRY_STATUSES = ["New", "Contacted", "Appointment booked", "Closed", "Not converted"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];
export const ENQUIRY_SOURCES = ["Website form", "Phone call", "Walk-in", "Patient referral", "Social media", "Campaign"] as const;
export type EnquirySource = (typeof ENQUIRY_SOURCES)[number];

export interface EnquiryTask { id: string; due: string; note: string; assigneeId?: string; done: boolean }
export interface EnquiryActivity { id: string; at: string; text: string }
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
  appointmentId?: string;
  tasks: EnquiryTask[];
  history: EnquiryActivity[];
}
