import { test } from "node:test";
import assert from "node:assert/strict";
import { agents } from "../src/lib/insight";
import { appointments, followUps, patients, TODAY, visits } from "../src/lib/db";
import { isUpcoming } from "../src/lib/appointment-rules";

test("every agent finding says which fixed rule fired, what is recorded, and links to a source record", () => {
  agents.forEach((a) => a.findings().forEach((f) => {
    assert.ok(f.why, `${a.id}/${f.id} has no explanation`);
    assert.ok(f.why.rule.length > 10 && f.why.recorded.length > 5);
    assert.ok(f.why.sources.length > 0);
    f.why.sources.forEach((s) => assert.ok(s.href.startsWith("/"), s.href));
  }));
});

test("source links in an explanation point at records that exist", () => {
  agents.forEach((a) => a.findings().forEach((f) => f.why?.sources.forEach((s) => {
    const m = s.href.match(/^\/(patients|visits)\/([^/?]+)/);
    if (m) assert.ok((m[1] === "patients" ? patients : visits).some((x) => x.id === m[2]), `${s.href} does not exist`);
  })));
});

test("an explanation does not claim a source visit or reason that is not recorded", () => {
  const f = agents.find((a) => a.id === "followup")!.findings().find((x) => x.followUpId);
  if (!f) return;
  const fu = followUps.find((x) => x.id === f.followUpId)!;
  assert.equal(f.why!.sources.some((s) => s.label.startsWith("Source visit")), !!fu.visitId);
  if (!fu.visitId) assert.match(f.why!.limits ?? "", /cannot be established/);
  if (!fu.note) assert.match(f.why!.recorded, /Reason: not recorded/);
});

test("a cancelled or no-show booking is not a next appointment for the recall and follow-up agents", () => {
  const recall = agents.find((a) => a.id === "recall")!.findings().map((f) => f.patientId);
  recall.forEach((pid) => assert.equal(appointments.some((a) => a.patientId === pid && isUpcoming(a, TODAY)), false));
});
