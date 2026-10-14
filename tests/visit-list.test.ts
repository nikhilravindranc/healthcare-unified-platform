import { test } from "node:test";
import assert from "node:assert/strict";
import { sortVisitRows, visitRows } from "../src/lib/visit-list";
import { appointments, followUps, visits } from "../src/lib/db";
import type { Appointment, FollowUp, Visit } from "../src/lib/types";

const v = (o: Partial<Visit>) => ({ id: "V", patientId: "P", providerId: "pat", type: "Consultation", date: "2026-09-01", status: "Completed", reason: "", forms: [], treatments: [], plot: [], notes: { subjective: "", objective: "", assessment: "", plan: "" }, ...o }) as unknown as Visit;
const a = (o: Partial<Appointment>) => ({ id: "A", patientId: "P", status: "completed", ...o }) as Appointment;

test("a booking is shown only when visit and appointment point at each other", () => {
  const rows = visitRows([v({ id: "V1", apptId: "A1" }), v({ id: "V2" }), v({ id: "V3", apptId: "A9" })], [a({ id: "A1", visitId: "V1" }), a({ id: "A2", visitId: "V2x" })], []);
  assert.equal(rows[0].appt?.id, "A1");
  assert.equal(rows[1].appt, undefined);
  assert.equal(rows[2].appt, undefined);
  assert.ok(rows[1].flags.some((f) => f.id === "no-booking" && !f.attention));
});

test("outstanding forms and an uncreated follow-up are attention flags, a missing booking is not", () => {
  const form = { id: "f", name: "Consent", kind: "Consent", signed: false };
  const [r1, r2, r3] = visitRows([v({ id: "V1", forms: [form] as Visit["forms"] }), v({ id: "V2", followUpRecommended: "Review in 2 weeks" }), v({ id: "V3" })], [], [{ id: "F", visitId: "V2", patientId: "P" } as FollowUp]);
  assert.equal(r1.attention, true);
  assert.equal(r2.attention, false);           // a follow-up exists for it
  assert.equal(r3.attention, false);           // only "no booking linked"
});

test("in-progress visits sort first, then newest", () => {
  const rows = sortVisitRows(visitRows([v({ id: "old", date: "2026-08-01" }), v({ id: "new", date: "2026-09-30" }), v({ id: "live", status: "In progress", date: "2026-08-02" })], [], []));
  assert.deepEqual(rows.map((r) => r.visit.id), ["live", "new", "old"]);
});

test("in the demo data, only visits that have a two-way link show a booking", () => {
  visitRows(visits, appointments, followUps).forEach((r) => { if (r.appt) { assert.equal(r.appt.visitId, r.visit.id); assert.equal(r.appt.patientId, r.visit.patientId); } });
});
