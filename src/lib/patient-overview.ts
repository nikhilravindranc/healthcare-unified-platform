/**
 * Pure rules behind the patient Overview: what is next, what is active, what is missing and what still needs doing.
 * Everything here reads recorded facts only. A booking is never treated as care that took place, and a missing record is
 * reported as missing, never assumed. No dates or values are invented.
 */
import { isOpenStatus } from "./appointment-rules";
import type { Appointment, FollowUp, FormResponse, FormTemplate, PatientDoc, TreatmentPlan, Visit } from "./types";

/** The next booking to prepare for: open and not in the past. A future date wins over an appointment that has already arrived today. */
export function nextAppointment(appts: Appointment[], patientId: string, today: string): Appointment | undefined {
  const open = appts.filter((a) => a.patientId === patientId && a.date >= today && isOpenStatus(a.status)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return open.find((a) => a.date > today || a.status === "scheduled" || a.status === "confirmed") ?? open[0];
}

/** A visit that is under way for this patient. The header resumes it instead of starting a second one. */
export const activeVisit = (visits: Visit[], patientId: string): Visit | undefined =>
  visits.filter((v) => v.patientId === patientId && v.status === "In progress").sort((a, b) => b.date.localeCompare(a.date))[0];

export const lastCompletedVisit = (visits: Visit[], patientId: string, today: string): Visit | undefined =>
  visits.filter((v) => v.patientId === patientId && v.status === "Completed" && v.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0];

/** The latest signed consent we can point to: a signed consent form in a visit, or a filed consent record. */
export function consentOnFile(visits: Visit[], docs: PatientDoc[], patientId: string): { date: string; where: "visit" | "document"; visitId?: string } | null {
  const found: { date: string; where: "visit" | "document"; visitId?: string }[] = [];
  visits.filter((v) => v.patientId === patientId).forEach((v) => { if (v.forms.some((f) => f.kind === "Consent" && f.signed)) found.push({ date: v.date, where: "visit", visitId: v.id }); });
  docs.filter((d) => d.patientId === patientId && d.kind === "Consent record" && d.status === "Filed").forEach((d) => found.push({ date: d.date, where: "document" }));
  return found.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

/** The latest completed medical-history or intake form, with its review state. Null means none is on file. */
export function medicalHistory(responses: FormResponse[], templates: FormTemplate[], patientId: string): { date: string; reviewed: boolean; name: string } | null {
  const isHistory = (r: FormResponse) => { const t = templates.find((x) => x.id === r.templateId); return t?.type === "Intake" || /medical|history|intake/i.test(r.templateName); };
  const r = responses.filter((x) => x.patientId === patientId && isHistory(x)).sort((a, b) => b.submitted.localeCompare(a.submitted))[0];
  return r ? { date: r.submitted, reviewed: r.status === "Reviewed", name: r.templateName } : null;
}

export const unsignedForms = (visits: Visit[], patientId: string) =>
  visits.filter((v) => v.patientId === patientId).flatMap((v) => v.forms.filter((f) => !f.signed).map((f) => ({ id: f.id + v.id, name: f.name, visitId: v.id, date: v.date })));

export const activePlan = (plans: TreatmentPlan[], patientId: string): TreatmentPlan | undefined => plans.find((p) => p.patientId === patientId && p.status === "Active");
/** Progress counts only steps recorded as Completed. A scheduled step is not progress. */
export const planProgress = (plan: TreatmentPlan) => ({ done: plan.steps.filter((s) => s.status === "Completed").length, total: plan.steps.length, next: plan.steps.find((s) => s.status === "Scheduled" || s.status === "Planned") });

export interface OutstandingAction {
  id: string; label: string; reason: string; tone: "red" | "peach" | "blue" | "neutral";
  due?: string; owner?: string;
  /** Where to act on it: a patient tab, a visit, or a screen. */
  go: { tab: string } | { href: string };
}

export function outstandingActions(i: {
  patientId: string; today: string; followUps: FollowUp[]; visits: Visit[]; docs: PatientDoc[]; responses: FormResponse[]; templates: FormTemplate[];
  nextAppt?: Appointment; consentRequired: boolean; balance: number; canSeeFinancials: boolean;
}): OutstandingAction[] {
  const out: OutstandingAction[] = [];
  const fus = i.followUps.filter((f) => f.patientId === i.patientId && f.status === "Open").sort((a, b) => a.due.localeCompare(b.due));
  fus.filter((f) => f.due < i.today).forEach((f) => out.push({ id: f.id, label: f.type, reason: "Follow-up overdue", tone: "red", due: f.due, owner: f.assignee, go: { href: "/follow-ups" } }));
  if (i.nextAppt && i.consentRequired && !consentOnFile(i.visits, i.docs, i.patientId)) out.push({ id: "consent", label: "Signed consent", reason: "None on file for the next appointment", tone: "peach", due: i.nextAppt.date, go: { tab: "docs" } });
  unsignedForms(i.visits, i.patientId).forEach((f) => out.push({ id: f.id, label: f.name, reason: "Awaiting signature", tone: "peach", due: f.date, go: { href: `/visits/${f.visitId}?tab=consent` } }));
  i.docs.filter((d) => d.patientId === i.patientId && d.status === "Needs review").forEach((d) => out.push({ id: d.id, label: d.name, reason: "Document needs review", tone: "peach", due: d.date, go: { tab: "docs" } }));
  i.responses.filter((r) => r.patientId === i.patientId && r.status === "Submitted").forEach((r) => out.push({ id: r.id, label: r.templateName, reason: "Submitted, awaiting review", tone: "blue", due: r.submitted, go: { tab: "docs" } }));
  if (i.nextAppt && !medicalHistory(i.responses, i.templates, i.patientId)) out.push({ id: "mh", label: "Medical history", reason: "No medical history form on file", tone: "peach", go: { tab: "docs" } });
  fus.filter((f) => f.due >= i.today).forEach((f) => out.push({ id: f.id, label: f.type, reason: "Follow-up open", tone: "neutral", due: f.due, owner: f.assignee, go: { href: "/follow-ups" } }));
  if (i.canSeeFinancials && i.balance > 0) out.push({ id: "balance", label: "Outstanding balance", reason: "Unpaid invoice", tone: "peach", go: { tab: "financials" } });
  return out;
}

/** A plan step can be marked done only when the visit records care: treatment lines, injection points or an assessment. A booking alone is not care. */
export const hasCare = (v: Pick<Visit, "treatments" | "plot" | "notes">) => v.treatments.length > 0 || v.plot.length > 0 || !!v.notes.assessment.trim();
