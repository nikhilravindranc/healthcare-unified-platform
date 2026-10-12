/**
 * Enquiries data access. Pages and hooks only talk to `enquiriesApi`,
 * so replacing the mock below with real HTTP calls does not touch any UI code.
 */
import { api as pmsApi, TODAY } from "@/lib/db";
import { logAudit } from "@/lib/clinical";
import type { PatientInput } from "@/lib/schemas";
import { enquiries } from "./data";
import type { EnquiryInput, TaskInput } from "./schemas";
import type { Enquiry, EnquiryStatus } from "./types";

const lag = <T,>(v: T, ms = 220) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), ms));
let seq = 2000;
const uid = (p: string) => `${p}-${++seq}`;
const find = (id: string) => { const e = enquiries.find((x) => x.id === id); if (!e) throw new Error("not found"); return e; };
const note = (e: Enquiry, text: string) => e.history.push({ id: uid("h"), at: TODAY, text });
const clean = (v: string) => (v ? v : undefined);

export const enquiriesApi = {
  list: () => lag(enquiries),
  async create(i: EnquiryInput, by: string) {
    const e: Enquiry = {
      id: `E-${uid("n").slice(2)}`, name: i.name, phone: clean(i.phone), email: clean(i.email), serviceId: clean(i.serviceId), source: i.source,
      received: TODAY, status: "New", assigneeId: clean(i.assigneeId), notes: i.notes, tasks: [], history: [],
    };
    note(e, `Enquiry created by ${by}`);
    if (i.nextFollowUp) e.tasks.push({ id: uid("t"), due: i.nextFollowUp, note: "Make first contact", assigneeId: e.assigneeId, done: false });
    enquiries.unshift(e); logAudit(by, "Created enquiry", e.id); return lag(e, 350);
  },
  async update(id: string, i: Partial<EnquiryInput>, by: string) {
    const e = find(id);
    if (i.name !== undefined) e.name = i.name;
    if (i.phone !== undefined) e.phone = clean(i.phone);
    if (i.email !== undefined) e.email = clean(i.email);
    if (i.serviceId !== undefined) e.serviceId = clean(i.serviceId);
    if (i.source !== undefined) e.source = i.source;
    if (i.notes !== undefined) e.notes = i.notes;
    if (i.assigneeId !== undefined && clean(i.assigneeId) !== e.assigneeId) { e.assigneeId = clean(i.assigneeId); note(e, "Assigned staff changed"); }
    note(e, `Details edited by ${by}`); return lag(e, 250);
  },
  async setStatus(id: string, status: EnquiryStatus, by: string) {
    const e = find(id); e.status = status; note(e, `Status set to ${status.toLowerCase()} by ${by}`);
    if (status === "Closed" || status === "Not converted") e.tasks.forEach((t) => (t.done = true));
    logAudit(by, "Changed enquiry status", `${e.id}: ${status}`); return lag(e, 200);
  },
  async assign(id: string, assigneeId: string, by: string) {
    const e = find(id); e.assigneeId = clean(assigneeId); note(e, `Assigned by ${by}`); return lag(e, 200);
  },
  async addTask(id: string, t: TaskInput) {
    const e = find(id); e.tasks.push({ id: uid("t"), due: t.due, note: t.note, assigneeId: clean(t.assigneeId) ?? e.assigneeId, done: false }); note(e, `Follow-up added: ${t.note}`); return lag(e, 200);
  },
  async completeTask(id: string, taskId: string) {
    const e = find(id); const t = e.tasks.find((x) => x.id === taskId); if (t) { t.done = true; note(e, `Follow-up done: ${t.note}`); } return lag(e, 150);
  },
  async linkPatient(id: string, patientId: string, by: string) {
    const e = find(id); e.patientId = patientId; note(e, `Linked to patient ${patientId} by ${by}`); logAudit(by, "Linked enquiry to patient", `${e.id} to ${patientId}`); return lag(e, 250);
  },
  /** Mock: reuses the existing PMS create-patient call. Only reachable after the user confirms no match exists. */
  async createPatientFrom(id: string, patient: PatientInput, by: string) {
    const p = await pmsApi.createPatient(patient); const e = find(id); e.patientId = p.id; note(e, `Patient ${p.id} created (demo) by ${by}`); return p;
  },
  async appointmentBooked(id: string, appointmentId: string, by: string) {
    const e = find(id); e.status = "Appointment booked"; e.appointmentId = appointmentId; e.tasks.forEach((t) => (t.done = true)); note(e, `Appointment ${appointmentId} booked by ${by}`); return lag(e, 100);
  },
};
