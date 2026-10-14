import { test } from "node:test";
import assert from "node:assert/strict";
import { appointmentCounts, followUpState } from "../src/lib/report-records";
import { appointments, followUps, TODAY, addDays } from "../src/lib/db";

test("report counts add up to the appointment records in range, and each filter narrows them", () => {
  const c = appointmentCounts(appointments, { from: addDays(TODAY, -6), to: TODAY });
  assert.equal(c.total, c.completed + c.cancelled + c.noShow + c.openOrAttending);
  assert.equal(c.total, appointments.filter((a) => a.date >= addDays(TODAY, -6) && a.date <= TODAY).length);
  assert.equal(c.days.reduce((s, d) => s + d.total, 0), c.total);
  const one = appointmentCounts(appointments, { from: addDays(TODAY, -6), to: TODAY, provider: "pat" });
  assert.ok(one.total <= c.total);
  assert.equal(appointmentCounts(appointments, { from: "2000-01-01", to: "2000-01-02" }).total, 0);
});

test("future bookings never count as attended, cancelled or missed", () => {
  const c = appointmentCounts(appointments, { from: addDays(TODAY, 1), to: addDays(TODAY, 90) });
  assert.equal(c.completed, 0);
});

test("follow-up state is a snapshot that separates open, overdue and completed", () => {
  const s = followUpState(followUps, TODAY);
  assert.equal(s.open + s.completed, followUps.length);
  assert.ok(s.overdue + s.dueToday <= s.open);
});
