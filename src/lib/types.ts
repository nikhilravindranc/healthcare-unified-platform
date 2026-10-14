export type ApptStatus =
  | "scheduled" | "confirmed" | "arrived" | "waiting"
  | "in_progress" | "completed" | "cancelled" | "no_show";

export interface Provider { id: string; name: string; short: string; specialty: string; title?: string; email?: string; phone?: string; timeOff?: string; status: "Active" | "On leave" | "Inactive"; serviceIds: string[]; locationIds: string[]; hours: string; color: string }
export interface Service { id: string; name: string; category: string; specialty?: string; description?: string; duration: number; providerIds: string[]; locationIds: string[]; status: "Active" | "Inactive" }
export interface Location { id: string; name: string; address: string; phone: string; timezone?: string; hours?: string; status: "Open" | "Closed" }
export interface Room { id: string; name: string; locationId: string; type: string; availability: string; capacity?: number; status?: "Active" | "Inactive" }
export interface AppUser { id: string; name: string; email: string; role: "Owner" | "Practice manager" | "Provider" | "Front desk" | "Staff" | "Marketing"; status: "Active" | "Invited" }

export interface Patient {
  id: string; first: string; last: string; dob: string; phone: string; email: string;
  gender?: string; address?: string; emergency?: string; providerId?: string; notes?: string;
  status: "Active" | "Inactive" | "New";
  tags?: string[];
  portrait?: string;
  referral?: string;
  marketingConsent?: boolean;
  alerts?: PatientAlert[];
}
export interface PatientAlert { id: string; type: "Allergy" | "Medical" | "Skin" | "Other"; description: string; severity?: "Low" | "Moderate" | "High"; source: string; date: string; author: string }
/** Short, human-readable log of what happened to an appointment (cancelled, rescheduled). Keeps history when a record is reused. */
export interface AppointmentEvent { at: string; text: string }
export interface Appointment {
  id: string; patientId: string; providerId: string; serviceId: string;
  date: string; time: string; duration: number; locationId: string; roomId: string;
  status: ApptStatus; notes?: string; arrivedAt?: number; visitId?: string; events?: AppointmentEvent[];
  /** Set when the patient booked it themselves through the online booking page (demo). */
  origin?: "online";
}
export interface PlotPoint { id: string; x: number; y: number; product: string; units: number; note: string; area?: string; lot?: string; view?: "front" | "left" | "right" }
export interface PlotVersion { version: number; author: string; at: string; points: PlotPoint[] }
export interface TreatmentLine { id: string; service: string; area: string; product: string; units: number; notes: string }
export interface Visit {
  id: string; patientId: string; apptId?: string; providerId: string; type: string; date: string;
  status: "In progress" | "Completed";
  reason: string;
  notes: { subjective: string; objective: string; assessment: string; plan: string };
  treatments: TreatmentLine[];
  plot: PlotPoint[];
  plotVersions?: PlotVersion[];
  technique?: string;
  areas?: string;
  treatmentNote?: string;
  noteMeta?: { savedAt: string; by: string };
  measures?: { id: string; label: string; value: string }[];
  exercises?: { id: string; name: string; dose: string }[];
  serviceId?: string;
  forms: { id: string; name: string; kind: "Consent" | "Clinical form" | "Document"; signed: boolean }[];
  followUpInstructions: string;
  followUpRecommended: string;
}
export type FollowUpType = "Post-treatment" | "Routine review" | "Treatment continuation" | "Recall" | "Other";
export interface FollowUp {
  id: string; patientId: string; visitId?: string; type: FollowUpType; due: string;
  assignee: string; status: "Open" | "Completed";
  /** Why this follow-up exists, in the person's own words. Never filled in for older records. Distinct from `type`, which is only the category. */
  note?: string;
}
export interface Notification { id: string; text: string; time: string; read: boolean; href: string }

/* ---------- Clinical media, billing, inventory ---------- */
export type PhotoView = "Front" | "Left profile" | "Right profile" | "Close-up (eyes)" | "Close-up (lips)";
export interface PhotoAsset {
  id: string; patientId: string; visitId?: string; date: string; author: string;
  view: PhotoView; area: string; stage: "Before" | "During" | "After" | "Other";
  source: "captured" | "uploaded" | "demo"; consent: PhotoConsent; notes: string;
  /** Stock portrait key (demo) or an uploaded/captured data URL. Originals are never overwritten. */
  key?: string; uri?: string;
}
export interface InvoiceLine { id: string; desc: string; qty: number; unit: number; discount: number; taxRate: number; treatment?: string }
export interface Invoice { id: string; patientId: string; visitId?: string; issued: string; due: string; lines: InvoiceLine[]; status: "Draft" | "Issued" | "Paid" | "Partially paid" | "Void"; currency: string; notes?: string }
export interface Estimate { id: string; patientId: string; date: string; expiry: string; lines: InvoiceLine[]; status: "Draft" | "Sent" | "Accepted" | "Expired"; notes?: string }
export interface Payment { id: string; patientId: string; invoiceId?: string; kind: "payment" | "deposit" | "refund" | "credit"; date: string; amount: number; method: string; reference: string; by: string; status: "Posted" | "Reversed"; reason?: string }
export interface InventoryItem { id: string; name: string; sku: string; category: string; supplier: string; locationId: string; qty: number; unit: string; reorder: number; lot?: string; expiry?: string; price: number; status: "Active" | "Low" | "Out" | "Archived" }
export interface InventoryMove { id: string; itemId: string; date: string; delta: number; reason: string; by: string; visitId?: string }
export interface AuditEntry { id: string; at: string; who: string; action: string; target: string }
export interface FormField { id: string; type: "short" | "long" | "number" | "date" | "select" | "multi" | "checkbox" | "yesno" | "instructions" | "file"; label: string; helper?: string; required: boolean; options?: string[] }
export interface FormTemplate { id: string; name: string; type: "Consent" | "Clinical form" | "Intake"; specialty: string; description: string; version: number; status: "Draft" | "Published" | "Archived"; owner: string; fields: FormField[] }

export interface PlanStep { id: string; title: string; status: "Planned" | "Scheduled" | "Completed" | "Deferred" | "Cancelled"; date?: string; note?: string }
export interface TreatmentPlan { id: string; patientId: string; name: string; providerId: string; created: string; goal: string; review: string; status: "Active" | "Completed" | "On hold"; steps: PlanStep[]; notes: string }
export interface PatientDoc { id: string; patientId: string; name: string; kind: "Referral" | "Lab/Outside record" | "Attachment" | "Consent record"; date: string; by: string; status: "Filed" | "Needs review" }
export interface FormResponse { id: string; patientId: string; visitId?: string; templateId: string; templateName: string; version: number; submitted: string; by: string; status: "Submitted" | "Reviewed"; answers: Record<string, string> }

/** Consent to take and keep this clinical photo. "Not recorded" means nobody has recorded a decision, which is not permission. Use in marketing or education is a separate permission that is not modelled here. */
export type PhotoConsent = "Granted" | "Denied" | "Withdrawn" | "Not recorded";
