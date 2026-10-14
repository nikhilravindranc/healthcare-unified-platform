import { test } from "node:test";
import assert from "node:assert/strict";
import { buildActivityRows, inView, isDueSoon, isOverdue, sortRows } from "../src/modules/activities/rows";
import { activitiesApi, activities } from "../src/modules/activities/api";
import type { Enquiry } from "../src/modules/enquiries/types";
import type { Message } from "../src/modules/comms/types";

const T = "2026-10-07";
const enq = { id: "E-1", name: "Jo", tasks: [{ id: "t1", due: "2026-10-01", note: "Call back", done: false }, { id: "t2", due: "2026-10-02", note: "Sent info", done: true }] } as unknown as Enquiry;
const msgs = [{ id: "m1", channel: "call", direction: "incoming", status: "logged", purpose: "service", body: "Asked about prices", at: "2026-10-05", by: "Meera", enquiryId: "E-1" }, { id: "m2", channel: "email", direction: "outgoing", status: "simulated", purpose: "service", body: "x", at: T }] as Message[];
const input = (over = {}) => ({ activities: [], enquiries: [enq], messages: msgs, userName: () => "Meera", personName: () => "Sarah", ...over });

test("each underlying record appears once, and emails are not activities", () => {
  const rows = buildActivityRows(input());
  assert.deepEqual(rows.map((r) => r.source).sort(), ["call-log", "enquiry-task", "enquiry-task"]);
  assert.equal(rows.filter((r) => r.type === "call").length, 1);
  assert.ok(rows.every((r) => r.link));
});

test("a logged call is completed, never planned, and an enquiry task keeps its own status", () => {
  const rows = buildActivityRows(input());
  assert.equal(rows.find((r) => r.source === "call-log")!.status, "Completed");
  assert.deepEqual(rows.filter((r) => r.source === "enquiry-task").map((r) => r.status).sort(), ["Completed", "Planned"]);
});

test("overdue and due-soon are defined on planned items only", () => {
  assert.equal(isOverdue({ status: "Planned", due: "2026-10-01" }, T), true);
  assert.equal(isOverdue({ status: "Completed", due: "2026-10-01" }, T), false);
  assert.equal(isDueSoon({ status: "Planned", due: "2026-10-09" }, T), true);
  assert.equal(isDueSoon({ status: "Planned", due: "2026-10-20" }, T), false);
  const rows = buildActivityRows(input());
  assert.equal(rows.filter((r) => inView(r, "overdue", T)).length, 1);
  assert.equal(rows.filter((r) => inView(r, "upcoming", T)).length, 0);
  assert.equal(rows.filter((r) => inView(r, "completed", T)).length, 2);
  assert.equal(rows.filter((r) => inView(r, "mine", T, "Meera")).length, 3);
});

test("overdue work sorts first, completed last", () => {
  const rows = sortRows(buildActivityRows(input()), T);
  assert.equal(rows[0].status, "Planned"); assert.equal(rows[rows.length - 1].status, "Completed");
});

test("completing an activity completes only that activity and records its outcome; a subject is required", async () => {
  await assert.rejects(() => activitiesApi.create({ type: "task", subject: " ", owner: "Meera", date: T }));
  const a = await activitiesApi.create({ type: "task", subject: "Collect referral letter", owner: "Meera", date: T, due: T, followUpId: "F-8" });
  assert.equal(a.status, "Planned");
  const done = await activitiesApi.complete(a.id, "Letter received");
  assert.equal(done.status, "Completed"); assert.equal(done.outcome, "Letter received"); assert.equal(done.followUpId, "F-8");
  assert.equal(activities.length, 1);
});
