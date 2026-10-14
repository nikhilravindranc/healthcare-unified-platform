import { test } from "node:test";
import assert from "node:assert/strict";
import { appointmentInsight, capacityInsight, clinicInsight, continuityInsight, financialInsight, patientInsight, rangeFor, serviceInsight } from "../src/lib/insights";
import { appointments, followUps, patients, providers, TODAY, visits } from "../src/lib/db";
import { docTotal, invoiceBalance, invoices, payments, plans } from "../src/lib/clinical";
import type { Appointment, ApptStatus } from "../src/lib/types";

const T = "2026-10-07";
const f = { from: "2026-10-01", to: T };
const ap = (id: string, status: ApptStatus, date = T, o: Partial<Appointment> = {}) => ({ id, patientId: "P1", providerId: "pat", serviceId: "consult", date, time: "09:00", duration: 30, locationId: "dt", roomId: "r1", status, ...o }) as Appointment;

test("attendance, cancellation and no-show rates use stated denominators", () => {
  const l = [ap("1", "completed"), ap("2", "completed"), ap("3", "no_show"), ap("4", "cancelled"), ap("5", "scheduled", "2026-10-20")];
  const r = appointmentInsight(l, { from: "2026-10-01", to: "2026-10-31" }, T);
  assert.equal(r.total, 5);
  assert.equal(r.attendanceRate, 67);       // 2 attended of 3 that were attended or missed (cancelled and future ones are not in the denominator)
  assert.equal(r.noShowRate, 33);
  assert.equal(r.cancellationRate, 20);     // 1 of all 5 booked
  assert.equal(r.confirmationRate, 0);      // 0 confirmed of 1 open booking waiting for confirmation
});

test("a rate with nothing to divide is unavailable, never zero or invented", () => {
  const r = appointmentInsight([], f, T);
  assert.equal(r.attendanceRate, null); assert.equal(r.cancellationRate, null); assert.equal(r.total, 0);
});

test("rescheduled and online counts come from recorded events and origin only", () => {
  const r = appointmentInsight([ap("1", "scheduled", T, { events: [{ at: T, text: "Rescheduled from 2026-10-01 09:00 to 2026-10-07 09:00" }] }), ap("2", "scheduled", T, { origin: "online" }), ap("3", "scheduled")], f, T);
  assert.equal(r.rescheduled, 1); assert.equal(r.online, 1);
});

test("filters narrow by location, provider and service", () => {
  const l = [ap("1", "completed"), ap("2", "completed", T, { locationId: "ws" }), ap("3", "completed", T, { providerId: "rao" }), ap("4", "completed", T, { serviceId: "skin" })];
  assert.equal(appointmentInsight(l, { ...f, locationId: "ws" }, T).total, 1);
  assert.equal(appointmentInsight(l, { ...f, providerId: "rao" }, T).total, 1);
  assert.equal(appointmentInsight(l, { ...f, serviceId: "skin" }, T).total, 1);
});

test("range keys resolve to past or upcoming windows from the demo date", () => {
  assert.deepEqual(rangeFor("7", T), { from: "2026-10-01", to: T });
  assert.deepEqual(rangeFor("n7", T), { from: T, to: "2026-10-13" });
});

test("seed data: stage counts add up and the clinic overview agrees with the appointment insight", () => {
  const range = rangeFor("90", TODAY);
  const a = appointmentInsight(appointments, range, TODAY);
  assert.equal(a.total, appointments.filter((x) => x.date >= range.from && x.date <= range.to).length);
  assert.equal(a.completed + a.cancelled + a.noShow + a.open, a.total);
  const c = clinicInsight(appointments, visits, followUps, range, TODAY);
  assert.equal(c.appointments.total, a.total);
  assert.equal(c.followUps.open + c.followUps.completed, followUps.length);
});

test("patients: returning means a completed visit before the range, and inactive uses the stated threshold", () => {
  const r = patientInsight(patients, appointments, visits, rangeFor("30", TODAY), TODAY, 90);
  assert.equal(r.returning + r.firstInRecords, r.seen);
  assert.equal(r.frequency.once + r.frequency.twice + r.frequency.threePlus, r.seen);
  const strict = patientInsight(patients, appointments, visits, rangeFor("30", TODAY), TODAY, 30);
  assert.ok(strict.inactive.length >= r.inactive.length);
  r.inactive.forEach((p) => assert.ok(p.last < "2026-07-09"));
});

test("services: revenue is only counted when allowed and only from invoices tied to a visit with a booking", () => {
  const range = rangeFor("90", TODAY);
  const withRev = serviceInsight(appointments, visits, invoices, range, TODAY, docTotal, true);
  const without = serviceInsight(appointments, visits, invoices, range, TODAY, docTotal, false);
  assert.ok(without.every((s) => s.revenue === undefined));
  assert.ok(withRev.every((s) => (s.revenue ?? 0) >= 0));
  assert.equal(withRev.reduce((s, x) => s + x.appointments, 0), appointments.filter((a) => a.date >= range.from && a.date <= range.to).length);
});

test("capacity: unreadable hours give no percentage, readable hours give a bounded one", () => {
  const clinic = { breakStart: "", breakEnd: "", closedDates: "" };
  const odd = [{ ...providers[0], id: "x", hours: "by arrangement", status: "Active" as const }];
  const r1 = capacityInsight(odd, appointments, rangeFor("n7", TODAY), clinic);
  assert.equal(r1[0].utilization, null); assert.ok(r1[0].reason);
  const r2 = capacityInsight(providers, appointments, rangeFor("n7", TODAY), clinic);
  r2.forEach((r) => { if (r.utilization != null) assert.ok(r.utilization >= 0 && r.utilization <= 100); });
  const withBreak = capacityInsight([{ ...providers[0], hours: "Mon–Fri · 9:00 AM–5:00 PM", timeOff: "" }], [], { from: "2026-10-05", to: "2026-10-09" }, { breakStart: "12:00", breakEnd: "13:00", closedDates: "" });
  assert.equal(withBreak[0].available, 5 * 7 * 60);
  const closed = capacityInsight([{ ...providers[0], hours: "Mon–Fri · 9:00 AM–5:00 PM", timeOff: "" }], [], { from: "2026-10-05", to: "2026-10-09" }, { breakStart: "", breakEnd: "", closedDates: "Oct 7" });
  assert.equal(closed[0].available, 4 * 8 * 60);
});

test("financial: invoiced, collected, refunds and outstanding are separate, and collections follow payment dates", () => {
  const range = rangeFor("90", TODAY);
  const r = financialInsight(invoices, payments, range, docTotal, invoiceBalance);
  assert.equal(Math.round((r.collected - r.refunds) * 100), Math.round(r.net * 100));
  assert.ok(r.outstanding >= 0);
  const none = financialInsight(invoices, payments, { from: "2000-01-01", to: "2000-01-02" }, docTotal, invoiceBalance);
  assert.deepEqual([none.invoices, none.invoiced, none.collected], [0, 0, 0]);
});

test("continuity: completion is over follow-ups that fell due in the range, and rebooking after a visit ignores lost bookings", () => {
  const range = rangeFor("90", TODAY);
  const c = continuityInsight(followUps, visits, appointments, plans, range, TODAY);
  assert.ok(c.completedInRange <= c.dueInRange);
  assert.ok(c.rebookedAfterVisit <= c.visitsCompleted);
  const v = visits.filter((x) => x.status === "Completed")[0];
  const only = continuityInsight([], [v], [{ id: "L", patientId: v.patientId, date: "2099-01-01", status: "cancelled" } as never], [], { from: v.date, to: v.date }, TODAY);
  assert.equal(only.rebookedAfterVisit, 0);
});
