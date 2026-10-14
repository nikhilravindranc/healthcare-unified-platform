import { apptStates } from "./appointment-view";
import { STAGE_LABEL, apptStage, isOpenStatus } from "./appointment-rules";
import type { PermKey } from "./clinical";
import type { Appointment, FollowUp, Invoice, Location, Patient, Payment, Provider, Service, Visit } from "./types";
import type { Enquiry } from "@/modules/enquiries/types";
import type { Campaign } from "@/modules/campaigns/types";

/**
 * Report definitions. Pure: a report turns records and filters into rows, so the table, the CSV and the counts always agree,
 * and a figure in Analytics can be traced to the rows here. Each report names the date its range applies to.
 */
export interface ReportCtx {
  today: string; appointments: Appointment[]; visits: Visit[]; followUps: FollowUp[]; patients: Patient[]; invoices: Invoice[]; payments: Payment[]; enquiries: Enquiry[]; campaigns: Campaign[];
  providers: Provider[]; services: Service[]; locations: Location[];
  docTotal: (i: Invoice) => number; invoicePaid: (id: string) => number; invoiceBalance: (i: Invoice) => number; invoiceStatus: (i: Invoice) => string;
}
export interface ReportFilters { from?: string; to?: string; provider?: string; service?: string; location?: string; status?: string }
export type FilterKey = keyof ReportFilters;
export interface Row { key: string; cells: (string | number)[]; /** column index to link target */ links?: Record<number, string | undefined> }
export interface Result { columns: string[]; rows: Row[] }
export type ReportCategory = "Appointments" | "Patients" | "Enquiries" | "Visits" | "Follow-ups" | "Services & treatments" | "Financials" | "Campaigns";
export interface ReportDef {
  slug: string; title: string; category: ReportCategory; description: string;
  /** Any one of these. */ perms: PermKey[]; /** All of these (patient names and money need their own permission). */ also?: PermKey[];
  /** What the date range applies to, or null when the report has no range. */ dateBasis: string | null;
  filters: FilterKey[]; statusOptions?: string[];
  /** The Analytics view that explains the trend behind this report. */ analytics?: string;
  run: (c: ReportCtx, f: ReportFilters) => Result;
}

const inR = (d: string, f: ReportFilters) => (!f.from || d >= f.from) && (!f.to || d <= f.to);
const nm = (c: ReportCtx, id: string) => { const p = c.patients.find((x) => x.id === id); return p ? `${p.first} ${p.last}` : id; };
const STATUS_LABEL: Record<string, string> = { scheduled: "Scheduled", confirmed: "Confirmed", arrived: "Arrived", waiting: "Waiting", in_progress: "In visit", completed: "Completed", cancelled: "Cancelled", no_show: "No-show" };
export const APPT_STATUSES = [...Object.values(STATUS_LABEL), "Cancelled or no-show"];
const money = (n: number) => Math.round(n * 100) / 100;

export const REPORTS: ReportDef[] = [
  {
    slug: "appointments", title: "Appointments", category: "Appointments", description: "Every appointment record with its booking and attendance state, provider, location and source.",
    perms: ["reports"], also: ["patients"], dateBasis: "appointment date", filters: ["from", "to", "provider", "service", "location", "status"], statusOptions: APPT_STATUSES, analytics: "appointments",
    run: (c, f) => ({
      columns: ["Appointment", "Date", "Time", "Patient ID", "Patient", "Service", "Provider", "Location", "Room", "Status", "Booking", "Attendance", "Stage", "Source", "Visit"],
      rows: c.appointments.filter((a) => inR(a.date, f) && (!f.provider || a.providerId === f.provider) && (!f.service || a.serviceId === f.service) && (!f.location || a.locationId === f.location)
        && (!f.status || (f.status === "Cancelled or no-show" ? a.status === "cancelled" || a.status === "no_show" : STATUS_LABEL[a.status] === f.status))).map((a) => {
        const st = apptStates(a, c.today);
        const enq = c.enquiries.find((e) => e.appointmentId === a.id);
        return { key: a.id, cells: [a.id, a.date, a.time, a.patientId, nm(c, a.patientId), c.services.find((s) => s.id === a.serviceId)?.name ?? "", c.providers.find((p) => p.id === a.providerId)?.short ?? "", c.locations.find((l) => l.id === a.locationId)?.name ?? "", a.roomId, STATUS_LABEL[a.status], st.booking, st.attendance, STAGE_LABEL[apptStage(a.status)], a.origin === "online" ? "Online booking" : enq ? `Enquiry ${enq.id}` : "Not recorded", a.visitId ?? ""], links: { 0: `/appointments/${a.id}`, 4: `/patients/${a.patientId}`, ...(a.visitId ? { 14: `/visits/${a.visitId}` } : {}) } };
      }),
    }),
  },
  {
    slug: "patients", title: "Patients", category: "Patients", description: "Patient list with status, last completed visit, next open appointment and open follow-ups.",
    perms: ["reports"], also: ["patients"], dateBasis: null, filters: ["provider", "status"], statusOptions: ["Active", "New", "Inactive"], analytics: "patients",
    run: (c, f) => ({
      columns: ["Patient ID", "Patient", "Status", "Preferred provider", "Last completed visit", "Next appointment", "Open follow-ups"],
      rows: c.patients.filter((p) => (!f.status || p.status === f.status) && (!f.provider || p.providerId === f.provider)).map((p) => {
        const last = c.visits.filter((v) => v.patientId === p.id && v.status === "Completed").sort((a, b) => b.date.localeCompare(a.date))[0];
        const next = c.appointments.filter((a) => a.patientId === p.id && a.date >= c.today && isOpenStatus(a.status)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
        return { key: p.id, cells: [p.id, `${p.first} ${p.last}`, p.status, c.providers.find((x) => x.id === p.providerId)?.short ?? "", last?.date ?? "", next?.date ?? "", c.followUps.filter((x) => x.patientId === p.id && x.status === "Open").length], links: { 0: `/patients/${p.id}`, 1: `/patients/${p.id}` } };
      }),
    }),
  },
  {
    slug: "enquiries", title: "Enquiries", category: "Enquiries", description: "Enquiries with source, requested service, status, assignee and the appointment they led to.",
    perms: ["enquiries", "enquiries_view"], dateBasis: "date received", filters: ["from", "to", "service", "status"], statusOptions: ["New", "Contacted", "Appointment booked", "Closed", "Not converted"], analytics: "marketing",
    run: (c, f) => ({
      columns: ["Enquiry", "Received", "Name", "Source", "Campaign", "Requested service", "Status", "Appointment", "Appointment status"],
      rows: c.enquiries.filter((e) => inR(e.received, f) && (!f.service || e.serviceId === f.service) && (!f.status || e.status === f.status)).map((e) => ({
        key: e.id, cells: [e.id, e.received, e.name, e.source, e.campaign ?? "", c.services.find((s) => s.id === e.serviceId)?.name ?? "General enquiry", e.status, e.appointment?.id ?? "", e.appointment ? STATUS_LABEL[e.appointment.status] : ""],
        links: { 0: `/enquiries/${e.id}`, 2: `/enquiries/${e.id}`, ...(e.appointment ? { 7: `/appointments/${e.appointment.id}` } : {}) } })),
    }),
  },
  {
    slug: "visits", title: "Visits", category: "Visits", description: "Visits with their type, provider, status, linked booking and any form awaiting signature.",
    perms: ["reports"], also: ["patients"], dateBasis: "visit date", filters: ["from", "to", "provider", "status"], statusOptions: ["In progress", "Completed"], analytics: "clinic",
    run: (c, f) => ({
      columns: ["Visit", "Date", "Patient ID", "Patient", "Type", "Provider", "Status", "Booking", "Forms awaiting signature", "Follow-up created"],
      rows: c.visits.filter((v) => inR(v.date, f) && (!f.provider || v.providerId === f.provider) && (!f.status || v.status === f.status)).map((v) => {
        const appt = c.appointments.find((a) => a.visitId === v.id && (!v.apptId || a.id === v.apptId));
        return { key: v.id, cells: [v.id, v.date, v.patientId, nm(c, v.patientId), v.type, c.providers.find((p) => p.id === v.providerId)?.short ?? "", v.status, appt?.id ?? "", v.forms.filter((x) => !x.signed).length, c.followUps.some((x) => x.visitId === v.id) ? "Yes" : "No"], links: { 0: `/visits/${v.id}`, 3: `/patients/${v.patientId}`, ...(appt ? { 7: `/appointments/${appt.id}` } : {}) } };
      }),
    }),
  },
  {
    slug: "follow-ups", title: "Follow-ups", category: "Follow-ups", description: "Follow-ups with type, reason, owner, due date, status and source visit.",
    perms: ["reports"], also: ["patients"], dateBasis: "due date", filters: ["from", "to", "status"], statusOptions: ["Open", "Overdue", "Completed"], analytics: "continuity",
    run: (c, f) => ({
      columns: ["Follow-up", "Due", "Patient ID", "Patient", "Type", "Reason", "Owner", "Status", "Source visit"],
      rows: c.followUps.filter((x) => inR(x.due, f) && (!f.status || (f.status === "Overdue" ? x.status === "Open" && x.due < c.today : x.status === f.status))).map((x) => ({
        key: x.id, cells: [x.id, x.due, x.patientId, nm(c, x.patientId), x.type, x.note ?? "", x.assignee, x.status === "Open" && x.due < c.today ? "Overdue" : x.status, x.visitId ?? ""], links: { 3: `/patients/${x.patientId}`, ...(x.visitId ? { 8: `/visits/${x.visitId}` } : {}) } })),
    }),
  },
  {
    slug: "services", title: "Services & treatments", category: "Services & treatments", description: "Each service with its status and the appointments, completed visits and cancellations in the range.",
    perms: ["reports"], dateBasis: "appointment date", filters: ["from", "to", "service"], analytics: "services",
    run: (c, f) => ({
      columns: ["Service", "Category", "Duration (min)", "Status", "Appointments", "Completed visits", "Cancelled", "No-shows"],
      rows: c.services.filter((s) => !f.service || s.id === f.service).map((s) => {
        const l = c.appointments.filter((a) => a.serviceId === s.id && inR(a.date, f));
        return { key: s.id, cells: [s.name, s.category, s.duration, s.status, l.length, l.filter((a) => a.visitId && c.visits.find((v) => v.id === a.visitId)?.status === "Completed").length, l.filter((a) => a.status === "cancelled").length, l.filter((a) => a.status === "no_show").length], links: { 0: "/practice/services" } };
      }),
    }),
  },
  {
    slug: "invoices", title: "Invoices", category: "Financials", description: "Invoices with total, paid, balance and status. Billing owns these records.",
    perms: ["financials"], also: ["reports"], dateBasis: "issued date", filters: ["from", "to", "status"], statusOptions: ["Draft", "Issued", "Partially paid", "Paid", "Void"], analytics: "financial",
    run: (c, f) => ({
      columns: ["Invoice", "Issued", "Due", "Patient ID", "Patient", "Total", "Paid", "Balance", "Status", "Visit"],
      rows: c.invoices.filter((i) => inR(i.issued, f) && (!f.status || c.invoiceStatus(i) === f.status)).map((i) => ({
        key: i.id, cells: [i.id, i.issued, i.due, i.patientId, nm(c, i.patientId), money(c.docTotal(i)), money(c.invoicePaid(i.id)), money(c.invoiceBalance(i)), c.invoiceStatus(i), i.visitId ?? ""], links: { 4: `/patients/${i.patientId}?tab=financials`, ...(i.visitId ? { 9: `/visits/${i.visitId}` } : {}) } })),
    }),
  },
  {
    slug: "payments", title: "Payments and refunds", category: "Financials", description: "Posted and reversed payments, deposits, credits and refunds by payment date.",
    perms: ["financials"], also: ["reports"], dateBasis: "payment date", filters: ["from", "to", "status"], statusOptions: ["payment", "deposit", "credit", "refund"], analytics: "financial",
    run: (c, f) => ({
      columns: ["Payment", "Date", "Patient ID", "Patient", "Kind", "Amount", "Method", "Invoice", "Status"],
      rows: c.payments.filter((p) => inR(p.date, f) && (!f.status || p.kind === f.status)).map((p) => ({ key: p.id, cells: [p.id, p.date, p.patientId, nm(c, p.patientId), p.kind, money(p.amount), p.method, p.invoiceId ?? "", p.status], links: { 3: `/patients/${p.patientId}?tab=financials` } })),
    }),
  },
  {
    slug: "campaigns", title: "Campaigns", category: "Campaigns", description: "Campaigns with channel, status and the number of simulated messages recorded. Nothing is delivered, so there is no delivery or response data.",
    perms: ["campaigns", "insights"], dateBasis: "date created", filters: ["from", "to", "status"], statusOptions: ["Draft", "Scheduled", "Simulated"],
    run: (c, f) => ({
      columns: ["Campaign", "Name", "Channel", "Status", "Created", "Created by", "Scheduled for", "Simulated run", "Simulated messages recorded"],
      rows: c.campaigns.filter((k) => inR(k.createdAt, f) && (!f.status || String(k.status) === f.status)).map((k) => ({ key: k.id, cells: [k.id, k.name, k.channel, String(k.status), k.createdAt, k.createdBy, k.scheduledFor ?? "", k.simulatedAt ?? "", k.simulatedRecipients ?? ""], links: { 1: "/campaigns" } })),
    }),
  },
];
export const reportBySlug = (s: string) => REPORTS.find((r) => r.slug === s);

/** Sorting by a column: numbers numerically, everything else as text. */
export function sortRows(rows: Row[], col: number, dir: 1 | -1): Row[] {
  return [...rows].sort((a, b) => { const x = a.cells[col], y = b.cells[col]; return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * dir; });
}
export const searchRows = (rows: Row[], q: string) => { const s = q.trim().toLowerCase(); return s ? rows.filter((r) => r.cells.some((c) => String(c).toLowerCase().includes(s))) : rows; };

/** CSV with every cell quoted, so commas, quotes and line breaks in a value cannot break the file. A leading =, +, - or @ is prefixed so a spreadsheet does not run it. */
export function toCsv(columns: string[], rows: Row[]): string {
  const cell = (v: string | number) => { let s = String(v); if (/^[=+\-@]/.test(s) && typeof v === "string") s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
  return [columns.map(cell).join(","), ...rows.map((r) => r.cells.map(cell).join(","))].join("\r\n");
}
