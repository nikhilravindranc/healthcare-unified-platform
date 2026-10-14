import { addDays } from "./db";
import { apptStage, isLostStatus, isOpenStatus } from "./appointment-rules";
import { dateInText, parseProviderHours, weekdayOf, daysBetween, type ClinicRules } from "./availability-rules";
import type { Appointment, FollowUp, Invoice, Patient, Payment, Provider, Visit, TreatmentPlan } from "./types";

/**
 * Insight calculations. Pure, so a number on screen can be reproduced from the records and tested.
 * Every metric names the date that drives it:
 *  - appointments: the appointment date. visits: the visit date. invoices: the issued date. payments: the payment date.
 *  - follow-ups: the due date (their completion has no date, so a completion rate is over follow-ups that fell due in the range).
 * Nothing here estimates, extrapolates or infers a cause.
 */
export interface Filters { from: string; to: string; locationId?: string; providerId?: string; serviceId?: string }
export const RANGES = { "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days", n7: "Next 7 days", n14: "Next 14 days" } as const;
export type RangeKey = keyof typeof RANGES;
export function rangeFor(key: RangeKey, today: string): { from: string; to: string } {
  if (key === "n7") return { from: today, to: addDays(today, 6) };
  if (key === "n14") return { from: today, to: addDays(today, 13) };
  return { from: addDays(today, -(Number(key) - 1)), to: today };
}
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
const inR = (d: string, f: Filters) => d >= f.from && d <= f.to;
export const apptsIn = (all: Appointment[], f: Filters) => all.filter((a) => inR(a.date, f) && (!f.locationId || a.locationId === f.locationId) && (!f.providerId || a.providerId === f.providerId) && (!f.serviceId || a.serviceId === f.serviceId));
const ATTENDED = ["arrived", "waiting", "in_progress", "completed"];

/* ---------- Appointments ---------- */
export interface ApptInsight {
  total: number; completed: number; attended: number; cancelled: number; noShow: number; open: number; pastOpen: number; confirmed: number; awaiting: number; rescheduled: number; online: number;
  attendanceRate: number | null; cancellationRate: number | null; noShowRate: number | null; confirmationRate: number | null;
  byDay: { date: string; n: number }[]; byWeekday: { label: string; n: number }[]; byHour: { label: string; n: number }[];
  byProvider: { id: string; n: number }[]; byLocation: { id: string; n: number }[];
}
export function appointmentInsight(all: Appointment[], f: Filters, today: string): ApptInsight {
  const l = apptsIn(all, f);
  const cnt = (p: (a: Appointment) => boolean) => l.filter(p).length;
  const cancelled = cnt((a) => a.status === "cancelled"), noShow = cnt((a) => a.status === "no_show");
  const attended = cnt((a) => ATTENDED.includes(a.status) && a.date <= today);
  const awaiting = cnt((a) => a.status === "scheduled"), confirmed = cnt((a) => a.status === "confirmed");
  const pastDecided = attended + noShow;
  const days: { date: string; n: number }[] = [];
  for (let d = f.from; d <= f.to && days.length < 120; d = addDays(d, 1)) days.push({ date: d, n: l.filter((a) => a.date === d).length });
  const group = <K extends string>(key: (a: Appointment) => K) => { const m = new Map<K, number>(); l.filter((a) => !isLostStatus(a.status)).forEach((a) => m.set(key(a), (m.get(key(a)) ?? 0) + 1)); return [...m.entries()]; };
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const live = l.filter((a) => !isLostStatus(a.status));
  return {
    total: l.length, completed: cnt((a) => a.status === "completed"), attended, cancelled, noShow, open: cnt((a) => isOpenStatus(a.status)), pastOpen: cnt((a) => isOpenStatus(a.status) && a.date < today),
    confirmed, awaiting, rescheduled: cnt((a) => (a.events ?? []).some((e) => e.text.startsWith("Rescheduled"))), online: cnt((a) => a.origin === "online"),
    attendanceRate: pct(attended, pastDecided), cancellationRate: pct(cancelled, l.length), noShowRate: pct(noShow, pastDecided), confirmationRate: pct(confirmed, confirmed + awaiting),
    byDay: days,
    byWeekday: wd.map((label, i) => ({ label, n: live.filter((a) => weekdayOf(a.date) === i).length })).filter((x) => x.n > 0),
    byHour: [...new Set(live.map((a) => Number(a.time.slice(0, 2))))].sort((a, b) => a - b).map((h) => ({ label: `${((h + 11) % 12) + 1}:00 ${h >= 12 ? "PM" : "AM"}`, n: live.filter((a) => Number(a.time.slice(0, 2)) === h).length })),
    byProvider: group((a) => a.providerId).map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n),
    byLocation: group((a) => a.locationId).map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n),
  };
}

/* ---------- Clinic overview ---------- */
export function clinicInsight(appts: Appointment[], visits: Visit[], fus: FollowUp[], f: Filters, today: string) {
  const a = appointmentInsight(appts, f, today);
  const v = visits.filter((x) => inR(x.date, f) && (!f.providerId || x.providerId === f.providerId));
  const unsigned = v.filter((x) => x.forms.some((fm) => !fm.signed)).length;
  const open = fus.filter((x) => x.status === "Open");
  return {
    appointments: a, visitsStarted: v.length, visitsCompleted: v.filter((x) => x.status === "Completed").length, visitsInProgress: v.filter((x) => x.status === "In progress").length,
    followUps: { open: open.length, overdue: open.filter((x) => x.due < today).length, completed: fus.length - open.length },
    exceptions: { pastOpenAppointments: a.pastOpen, visitsWithUnsignedForms: unsigned, overdueFollowUps: open.filter((x) => x.due < today).length },
  };
}

/* ---------- Patients ---------- */
export function patientInsight(patients: Patient[], appts: Appointment[], visits: Visit[], f: Filters, today: string, inactiveDays: number) {
  const done = visits.filter((v) => v.status === "Completed");
  const inRange = done.filter((v) => inR(v.date, f));
  const ids = [...new Set(inRange.map((v) => v.patientId))];
  const returning = ids.filter((id) => done.some((v) => v.patientId === id && v.date < f.from));
  const newer = ids.filter((id) => !returning.includes(id));
  const perPatient = ids.map((id) => inRange.filter((v) => v.patientId === id).length);
  const rebooked = ids.filter((id) => appts.some((a) => a.patientId === id && a.date > today && isOpenStatus(a.status)));
  const cutoff = addDays(today, -inactiveDays);
  const inactive = patients.filter((p) => p.status !== "Inactive").filter((p) => {
    const last = done.filter((v) => v.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date))[0];
    const upcoming = appts.some((a) => a.patientId === p.id && a.date >= today && isOpenStatus(a.status));
    return !!last && last.date < cutoff && !upcoming;
  }).map((p) => ({ id: p.id, name: `${p.first} ${p.last}`, last: done.filter((v) => v.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date))[0].date }));
  return {
    seen: ids.length, returning: returning.length, firstInRecords: newer.length, newRegistered: patients.filter((p) => p.status === "New").length,
    frequency: { once: perPatient.filter((n) => n === 1).length, twice: perPatient.filter((n) => n === 2).length, threePlus: perPatient.filter((n) => n >= 3).length },
    rebooked: rebooked.length, rebookingRate: pct(rebooked.length, ids.length), inactive, inactiveDays,
  };
}

/* ---------- Services ---------- */
export function serviceInsight(appts: Appointment[], visits: Visit[], invoices: Invoice[], f: Filters, today: string, docTotal: (i: Invoice) => number, includeRevenue: boolean) {
  const l = apptsIn(appts, { ...f, serviceId: undefined }).filter((a) => !f.serviceId || a.serviceId === f.serviceId);
  const ids = [...new Set(l.map((a) => a.serviceId))];
  const visitById = new Map(visits.map((v) => [v.id, v]));
  const apptOfVisit = new Map(appts.filter((a) => a.visitId).map((a) => [a.visitId!, a]));
  return ids.map((id) => {
    const mine = l.filter((a) => a.serviceId === id);
    const completedVisits = mine.filter((a) => a.visitId && visitById.get(a.visitId)?.status === "Completed").length;
    const byPatient = new Map<string, number>(); mine.filter((a) => !isLostStatus(a.status)).forEach((a) => byPatient.set(a.patientId, (byPatient.get(a.patientId) ?? 0) + 1));
    const revenue = includeRevenue ? invoices.filter((i) => i.status !== "Void" && i.status !== "Draft" && inR(i.issued, f) && i.visitId && apptOfVisit.get(i.visitId)?.serviceId === id).reduce((s, i) => s + docTotal(i), 0) : undefined;
    const decided = mine.filter((a) => (ATTENDED.includes(a.status) && a.date <= today) || a.status === "no_show").length;
    return { id, appointments: mine.length, completedVisits, cancelled: mine.filter((a) => a.status === "cancelled").length, cancellationRate: pct(mine.filter((a) => a.status === "cancelled").length, mine.length), noShow: mine.filter((a) => a.status === "no_show").length, decided, repeatPatients: [...byPatient.values()].filter((n) => n > 1).length, revenue };
  }).sort((a, b) => b.appointments - a.appointments);
}

/* ---------- Capacity ---------- */
export interface CapacityRow { id: string; booked: number; available: number | null; utilization: number | null; reason?: string }
/**
 * Booked minutes against available minutes, only for a provider whose working days and hours can be read.
 * Available time = working days in the range (not closed, not on time off) x working hours, less the practice break.
 * Anything that cannot be read is reported, never guessed, and shown without a percentage.
 */
export function capacityInsight(providers: Provider[], appts: Appointment[], f: Filters, clinic: Pick<ClinicRules, "breakStart" | "breakEnd" | "closedDates">): CapacityRow[] {
  const mins = (t: string) => (t && /^\d{2}:\d{2}$/.test(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : 0);
  const brk = mins(clinic.breakStart) && mins(clinic.breakEnd) > mins(clinic.breakStart) ? mins(clinic.breakEnd) - mins(clinic.breakStart) : 0;
  return providers.filter((p) => (!f.providerId || p.id === f.providerId) && p.status !== "Inactive").map((p) => {
    const booked = apptsIn(appts, { ...f, providerId: p.id }).filter((a) => !isLostStatus(a.status)).reduce((s, a) => s + a.duration, 0);
    const wh = parseProviderHours(p.hours);
    if (!wh.days || wh.start == null || wh.end == null) return { id: p.id, booked, available: null, utilization: null, reason: "Working days or hours cannot be read, so available time is not known." };
    let avail = 0;
    for (let i = 0; i <= daysBetween(f.from, f.to); i++) {
      const d = addDays(f.from, i);
      if (!wh.days.includes(weekdayOf(d)) || dateInText(d, clinic.closedDates) || dateInText(d, p.timeOff)) continue;
      avail += Math.max(0, wh.end - wh.start - (brk && brk < wh.end - wh.start ? brk : 0));
    }
    return { id: p.id, booked, available: avail, utilization: avail > 0 ? Math.min(100, Math.round((booked / avail) * 100)) : null, reason: avail === 0 ? "No working time in this range." : undefined };
  });
}

/* ---------- Financial ---------- */
export function financialInsight(invoices: Invoice[], payments: Payment[], f: Filters, docTotal: (i: Invoice) => number, balance: (i: Invoice) => number) {
  const inv = invoices.filter((i) => i.status !== "Void" && i.status !== "Draft" && inR(i.issued, f));
  const pays = payments.filter((p) => p.status === "Posted" && inR(p.date, f));
  const collected = pays.filter((p) => p.kind !== "refund").reduce((s, p) => s + p.amount, 0);
  const refunds = pays.filter((p) => p.kind === "refund").reduce((s, p) => s + p.amount, 0);
  return { invoices: inv.length, invoiced: inv.reduce((s, i) => s + docTotal(i), 0), collected, refunds, net: collected - refunds, outstanding: inv.reduce((s, i) => s + balance(i), 0), outstandingInvoices: inv.filter((i) => balance(i) > 0).length };
}

/* ---------- Follow-up and continuity ---------- */
export function continuityInsight(fus: FollowUp[], visits: Visit[], appts: Appointment[], plans: TreatmentPlan[], f: Filters, today: string) {
  const due = fus.filter((x) => inR(x.due, f));
  const done = due.filter((x) => x.status === "Completed").length;
  const completedVisits = visits.filter((v) => v.status === "Completed" && inR(v.date, f));
  const rebooked = completedVisits.filter((v) => appts.some((a) => a.patientId === v.patientId && a.date > v.date && !isLostStatus(a.status)));
  const open = fus.filter((x) => x.status === "Open");
  const steps = plans.filter((p) => p.status === "Active").flatMap((p) => p.steps.filter((s) => s.status === "Planned" || s.status === "Scheduled").map((s) => ({ plan: p.name, patientId: p.patientId, title: s.title, status: s.status, date: s.date })));
  return {
    overdue: open.filter((x) => x.due < today), dueInRange: due.length, completedInRange: done, completionRate: pct(done, due.length),
    visitsCompleted: completedVisits.length, rebookedAfterVisit: rebooked.length, rebookingRate: pct(rebooked.length, completedVisits.length), outstandingPlanSteps: steps,
  };
}

/** Where does an appointment stage count in the overview: a helper for labels. */
export const stageCounts = (l: Appointment[]) => ({ booked: l.filter((a) => apptStage(a.status) === "booked").length, attending: l.filter((a) => apptStage(a.status) === "attending").length, completed: l.filter((a) => apptStage(a.status) === "completed").length, lost: l.filter((a) => apptStage(a.status) === "lost").length });
