import { test } from "node:test";
import assert from "node:assert/strict";
import { appointments, followUps, patients, visits } from "../src/lib/db";
import { documents, invoices, journeyFor, photos, responses } from "../src/lib/clinical";

const visitById = (id: string) => visits.find((v) => v.id === id);
const patientIds = new Set(patients.map((p) => p.id));

test("every record that points at a visit points at a real visit of the same patient", () => {
  const refs: { kind: string; id: string; patientId: string; visitId?: string }[] = [
    ...invoices.map((r) => ({ kind: "invoice", ...r })), ...photos.map((r) => ({ kind: "photo", ...r })),
    ...responses.map((r) => ({ kind: "form response", ...r })), ...followUps.map((r) => ({ kind: "follow-up", ...r })), ...appointments.map((r) => ({ kind: "appointment", ...r })),
  ];
  refs.filter((r) => r.visitId).forEach((r) => {
    const v = visitById(r.visitId!);
    assert.ok(v, `${r.kind} ${r.id} points at missing visit ${r.visitId}`);
    assert.equal(v.patientId, r.patientId, `${r.kind} ${r.id} points at another patient's visit`);
  });
});

test("an appointment and its visit point at each other", () => {
  appointments.filter((a) => a.visitId).forEach((a) => assert.equal(visitById(a.visitId!)?.apptId, a.id, `appointment ${a.id}`));
  visits.filter((v) => v.apptId).forEach((v) => {
    const a = appointments.find((x) => x.id === v.apptId);
    assert.ok(a, `visit ${v.id} points at missing appointment`);
    assert.equal(a.visitId, v.id); assert.equal(a.patientId, v.patientId);
  });
});

test("every patient's timeline links open a record that belongs to that patient", () => {
  patients.forEach((p) => journeyFor(p.id).forEach((e) => {
    if (e.href?.startsWith("/visits/")) assert.equal(visitById(e.href.split("/")[2].split("?")[0])?.patientId, p.id, `${p.id} event ${e.id}`);
    if (e.kind === "payment") assert.equal(invoices.find((i) => i.id === e.invoiceId)?.patientId, p.id);
    (e.photoIds ?? []).forEach((id) => assert.equal(photos.find((x) => x.id === id)?.patientId, p.id));
  }));
});

test("documents, photos, invoices and responses belong to known patients", () => {
  [...documents, ...photos, ...invoices, ...responses].forEach((r) => assert.ok(patientIds.has(r.patientId), `${r.id} has unknown patient ${r.patientId}`));
});

test("past visits without a booking record are not given an invented one", () => {
  const sarah = appointments.filter((a) => a.patientId === "P-10248");
  assert.ok(sarah.every((a) => a.status !== "completed"));
  assert.ok(visits.filter((v) => v.patientId === "P-10248" && v.status === "Completed").every((v) => !v.apptId));
});
