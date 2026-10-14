import { test } from "node:test";
import assert from "node:assert/strict";
import { activePlan, activeVisit, consentOnFile, lastCompletedVisit, medicalHistory, nextAppointment, outstandingActions, planProgress } from "../src/lib/patient-overview";
import type { Appointment, FollowUp, FormResponse, FormTemplate, PatientDoc, TreatmentPlan, Visit } from "../src/lib/types";

const TODAY = "2026-10-07";
const appt = (o: Partial<Appointment>) => ({ id: "A", patientId: "P1", providerId: "pat", serviceId: "inject", date: TODAY, time: "10:00", duration: 30, status: "scheduled", ...o }) as Appointment;
const visit = (o: Partial<Visit>) => ({ id: "V", patientId: "P1", providerId: "pat", type: "Consultation", date: "2026-09-01", status: "Completed", reason: "", forms: [], treatments: [], plot: [], notes: { subjective: "", objective: "", assessment: "", plan: "" }, ...o }) as unknown as Visit;
const fu = (o: Partial<FollowUp>) => ({ id: "F", patientId: "P1", type: "Routine review", due: "2026-10-20", assignee: "Front desk", status: "Open", ...o }) as FollowUp;

test("the next appointment skips cancelled and no-show bookings and past dates", () => {
  const list = [appt({ id: "c", status: "cancelled", time: "09:00" }), appt({ id: "n", status: "no_show", time: "09:30" }), appt({ id: "past", date: "2026-10-01" }), appt({ id: "later", date: "2026-10-15" })];
  assert.equal(nextAppointment(list, "P1", TODAY)?.id, "later");
  assert.equal(nextAppointment(list, "P2", TODAY), undefined);
  assert.equal(nextAppointment([appt({ id: "now", status: "waiting" }), appt({ id: "later", date: "2026-10-15" })], "P1", TODAY)?.id, "later");   // a future booking wins over one already under way today
  assert.equal(nextAppointment([appt({ id: "now", status: "waiting" })], "P1", TODAY)?.id, "now");                                                   // but today's arrived appointment is still found if nothing else is booked
});

test("an in-progress visit is resumed, and completed visits are never treated as active", () => {
  assert.equal(activeVisit([visit({ id: "done", status: "Completed" })], "P1"), undefined);
  assert.equal(activeVisit([visit({ id: "done" }), visit({ id: "live", status: "In progress", date: TODAY })], "P1")?.id, "live");
  assert.equal(lastCompletedVisit([visit({ id: "a", date: "2026-08-01" }), visit({ id: "b", date: "2026-09-18" }), visit({ id: "c", status: "In progress", date: TODAY })], "P1", TODAY)?.id, "b");
});

test("consent on file needs a signed consent form or a filed consent record, and an unsigned form does not count", () => {
  const unsigned = visit({ forms: [{ id: "f1", name: "Treatment consent", kind: "Consent", signed: false }] as Visit["forms"] });
  assert.equal(consentOnFile([unsigned], [], "P1"), null);
  const signed = visit({ id: "s", date: "2026-09-10", forms: [{ id: "f2", name: "Treatment consent", kind: "Consent", signed: true }] as Visit["forms"] });
  assert.deepEqual(consentOnFile([unsigned, signed], [], "P1"), { date: "2026-09-10", where: "visit", visitId: "s" });
  const doc = { id: "d", patientId: "P1", name: "Consent", kind: "Consent record", date: "2026-09-20", by: "x", status: "Filed" } as PatientDoc;
  assert.equal(consentOnFile([signed], [doc], "P1")?.where, "document");
  assert.equal(consentOnFile([signed], [{ ...doc, status: "Needs review" }], "P1")?.where, "visit");   // a record that still needs review is not on file yet
});

test("medical history is found only from a completed intake or history form, with its review state", () => {
  const tpl = [{ id: "t1", name: "Medical history", type: "Intake" }, { id: "t2", name: "Photo release", type: "Consent" }] as FormTemplate[];
  const r = (o: Partial<FormResponse>) => ({ id: "r", patientId: "P1", templateId: "t2", templateName: "Photo release", submitted: "2026-09-01", status: "Submitted", ...o }) as FormResponse;
  assert.equal(medicalHistory([r({})], tpl, "P1"), null);
  assert.deepEqual(medicalHistory([r({ templateId: "t1", templateName: "Medical history", status: "Reviewed", submitted: "2026-09-05" })], tpl, "P1"), { date: "2026-09-05", reviewed: true, name: "Medical history" });
});

test("plan progress counts only steps recorded as completed, never booked or scheduled ones", () => {
  const plan = { id: "pl", patientId: "P1", status: "Active", steps: [{ id: "1", title: "A", status: "Completed" }, { id: "2", title: "B", status: "Scheduled" }, { id: "3", title: "C", status: "Planned" }] } as TreatmentPlan;
  assert.deepEqual(planProgress(plan), { done: 1, total: 3, next: plan.steps[1] });
  assert.equal(activePlan([{ ...plan, status: "Completed" }], "P1"), undefined);
});

test("outstanding actions are prioritised and each says why", () => {
  const base = { patientId: "P1", today: TODAY, visits: [visit({ forms: [{ id: "f", name: "Aftercare", kind: "Clinical form", signed: false }] as Visit["forms"] })], docs: [], responses: [], templates: [], nextAppt: appt({ date: "2026-10-15" }), consentRequired: true, balance: 240, canSeeFinancials: true };
  const list = outstandingActions({ ...base, followUps: [fu({ id: "late", due: "2026-10-01" }), fu({ id: "soon" })] });
  assert.deepEqual(list.map((a) => a.id), ["late", "consent", "f" + "V", "mh", "soon", "balance"]);
  assert.equal(list[0].reason, "Follow-up overdue");
  assert.ok(list.every((a) => a.reason.length > 0));
  assert.equal(outstandingActions({ ...base, followUps: [], canSeeFinancials: false }).some((a) => a.id === "balance"), false);   // balance is only for roles that may see money
  assert.equal(outstandingActions({ ...base, followUps: [], consentRequired: false }).some((a) => a.id === "consent"), false);
  assert.equal(outstandingActions({ ...base, followUps: [], nextAppt: undefined }).some((a) => a.id === "consent" || a.id === "mh"), false);   // nothing to prepare for without a booking
});

test("a plan step may be completed only from a visit that records care", async () => {
  const { hasCare } = await import("../src/lib/patient-overview");
  assert.equal(hasCare(visit({})), false);
  assert.equal(hasCare(visit({ notes: { subjective: "", objective: "", assessment: "  ", plan: "x" } })), false);
  assert.equal(hasCare(visit({ notes: { subjective: "", objective: "", assessment: "Treated", plan: "" } })), true);
  assert.equal(hasCare(visit({ plot: [{} as never] })), true);
});
