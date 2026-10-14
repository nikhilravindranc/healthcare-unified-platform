import { test } from "node:test";
import assert from "node:assert/strict";
import { apptActions, apptStates, inQuickView, needsAttention } from "../src/lib/appointment-view";
import type { ApptStatus } from "../src/lib/types";

const T = "2026-10-07";
const a = (status: ApptStatus, o: object = {}) => ({ status, date: T, ...o }) as never;

test("booking and attendance are stated apart and never overclaim", () => {
  assert.deepEqual(apptStates(a("scheduled"), T), { booking: "Awaiting confirmation", attendance: "Not yet arrived" });
  assert.deepEqual(apptStates(a("confirmed"), T), { booking: "Confirmed", attendance: "Not yet arrived" });
  assert.equal(apptStates(a("arrived"), T).booking, "Booked");   // confirmation is not recorded once someone has arrived
  assert.equal(apptStates(a("in_progress"), T).attendance, "In visit");
  assert.equal(apptStates(a("cancelled"), T).attendance, "Did not take place");
  assert.equal(apptStates(a("no_show"), T).attendance, "No-show");
  assert.equal(apptStates(a("confirmed", { date: "2026-10-01" }), T).attendance, "No attendance recorded");
});

test("no contradictory actions: finished and lost appointments are not confirmed, checked in or cancelled", () => {
  for (const s of ["completed", "cancelled", "no_show"] as ApptStatus[]) {
    const acts = apptActions(a(s, { visitId: s === "completed" ? "V" : undefined }), T);
    ["confirm", "check-in", "cancel", "no-show", "start-visit"].forEach((x) => assert.ok(!acts.includes(x as never), `${s} offers ${x}`));
  }
  assert.ok(apptActions(a("cancelled"), T).includes("reschedule"));
  assert.ok(!apptActions(a("completed", { visitId: "V" }), T).includes("reschedule"));
  assert.ok(apptActions(a("completed", { visitId: "V" }), T).includes("open-visit"));
  assert.ok(!apptActions(a("completed"), T).includes("open-visit"));          // no visit linked, nothing to open
});

test("confirm is only for an unconfirmed booking; check-in is not offered for a future date", () => {
  assert.ok(apptActions(a("scheduled"), T).includes("confirm"));
  assert.ok(!apptActions(a("confirmed"), T).includes("confirm"));
  assert.ok(!apptActions(a("scheduled", { date: "2026-10-20" }), T).includes("check-in"));
  assert.ok(apptActions(a("scheduled", { date: "2026-10-20" }), T).includes("cancel"));
});

test("an in-progress visit resumes and does not offer a second start", () => {
  const acts = apptActions(a("in_progress", { visitId: "V-9001" }), T);
  assert.ok(acts.includes("open-visit")); assert.ok(!acts.includes("start-visit"));
});

test("quick views follow the shared status rules", () => {
  assert.equal(inQuickView(a("cancelled", { date: "2026-10-20" }), "upcoming", T), false);
  assert.equal(inQuickView(a("cancelled", { date: "2026-10-20" }), "lost", T), true);
  assert.equal(inQuickView(a("completed", { date: "2026-10-01" }), "past", T), true);
  assert.equal(inQuickView(a("no_show", { date: "2026-10-01" }), "past", T), false);
});

test("needs attention: an open booking in the past, or a long wait", () => {
  assert.equal(needsAttention(a("scheduled", { date: "2026-10-01" }), T, 600), true);
  assert.equal(needsAttention(a("completed", { date: "2026-10-01" }), T, 600), false);
  assert.equal(needsAttention(a("waiting", { arrivedAt: 580 }), T, 600), true);
  assert.equal(needsAttention(a("waiting", { arrivedAt: 595 }), T, 600), false);
});
