import { test } from "node:test";
import assert from "node:assert/strict";
import { appointments, demoEnquiries, patients } from "../src/lib/db";

test("loading only the PMS data layer already contains the converted patients and appointments", () => {
  assert.equal(patients.length, 25);                                   // 12 original + 13 created from booked enquiries
  assert.equal(appointments.filter((a) => a.id.startsWith("A-E")).length, 13);
  assert.equal(demoEnquiries.length, 48);
});

test("the enquiries module does not change the data when it is loaded afterwards (route-independent)", async () => {
  const before = { p: patients.length, a: appointments.length };
  const mod = await import("../src/modules/enquiries/data");
  assert.deepEqual({ p: patients.length, a: appointments.length }, before);
  assert.equal(mod.enquiries, demoEnquiries);                          // the same list, not a second copy
});

test("every booked enquiry points to a real patient and a real appointment for that patient", () => {
  const booked = demoEnquiries.filter((e) => e.status === "Appointment booked");
  assert.equal(booked.length, 13);
  for (const e of booked) {
    const appt = appointments.find((a) => a.id === e.appointmentId);
    assert.ok(patients.some((p) => p.id === e.patientId), `${e.id} patient`);
    assert.ok(appt, `${e.id} appointment`);
    assert.equal(appt!.patientId, e.patientId);
  }
  assert.equal(booked.filter((e) => appointments.find((a) => a.id === e.appointmentId)!.status === "cancelled").length, 2);
});

test("no enquiry other than the booked ones is linked to a patient", () => {
  assert.equal(demoEnquiries.filter((e) => e.patientId).length, 13);
});
