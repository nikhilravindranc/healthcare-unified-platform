import { test } from "node:test";
import assert from "node:assert/strict";
import { apptStage, isLostStatus, STAGE_LABEL } from "../src/lib/appointment-rules";
import type { ApptStatus } from "../src/lib/types";

test("a booked or confirmed appointment is only a booking, never attending or completed", () => {
  assert.equal(apptStage("scheduled"), "booked");
  assert.equal(apptStage("confirmed"), "booked");
  (["arrived", "waiting", "in_progress"] as ApptStatus[]).forEach((s) => assert.equal(apptStage(s), "attending"));
  assert.equal(apptStage("completed"), "completed");
});

test("cancelled and no-show are their own stage, apart from every upcoming status", () => {
  (["cancelled", "no_show"] as ApptStatus[]).forEach((s) => { assert.equal(apptStage(s), "lost"); assert.ok(isLostStatus(s)); });
  assert.equal(STAGE_LABEL.lost, "Did not take place");
  const all: ApptStatus[] = ["scheduled", "confirmed", "arrived", "waiting", "in_progress", "completed", "cancelled", "no_show"];
  all.forEach((s) => assert.equal(apptStage(s) === "lost", isLostStatus(s)));
});
