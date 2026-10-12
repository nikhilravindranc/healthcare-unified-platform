import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveBooking } from "../src/modules/enquiries/booking-state";
import { computeInsights } from "../src/modules/enquiries/insights";

const appt = (id: string, status: string) => ({ id, date: "2026-10-05", time: "09:00", status, providerId: "pat", serviceId: "consult" }) as never;
const enq = (id: string, over: object = {}) => ({ id, name: id, source: "Phone call", received: "2026-10-03", status: "Appointment booked", notes: "", tasks: [], history: [{ id: "h1", at: "2026-10-03", text: "Enquiry received" }], ...over }) as never;
const lookup = (m: Record<string, string>) => (id: string) => (m[id] ? appt(id, m[id]) : undefined);

test("a booked enquiry with a live appointment stays booked", () => {
  const e = resolveBooking(enq("E1", { appointmentId: "A1" }), lookup({ A1: "confirmed" }));
  assert.equal(e.status, "Appointment booked");
  assert.equal(e.bookingLost, undefined);
});

test("a cancelled appointment reopens the enquiry and keeps its history", () => {
  const e = resolveBooking(enq("E1", { appointmentId: "A1" }), lookup({ A1: "cancelled" }));
  assert.equal(e.status, "Contacted");
  assert.equal(e.bookingLost, true);
  assert.equal(e.history[0].text, "Enquiry received");                 // stored history untouched
  assert.ok(e.history.some((h) => h.derived && h.text.includes("cancelled")));
});

test("a booked enquiry with no appointment record is not counted as booked", () => {
  assert.equal(resolveBooking(enq("E1", { appointmentId: "GONE" }), lookup({})).status, "Contacted");
});

test("earlier cancelled appointments stay in the history after a rebook", () => {
  const e = resolveBooking(enq("E1", { appointmentId: "A2", previousAppointmentIds: ["A1"] }), lookup({ A1: "no_show", A2: "completed" }));
  assert.equal(e.status, "Appointment booked");
  assert.ok(e.history.some((h) => h.id === "d-A1"));
});

test("insights count real appointments and leave cancelled ones out", () => {
  const list = [
    resolveBooking(enq("E1", { appointmentId: "A1" }), lookup({ A1: "completed" })),
    resolveBooking(enq("E2", { appointmentId: "A2" }), lookup({ A2: "cancelled" })),
    resolveBooking(enq("E3", { status: "Contacted" }), lookup({})),
    resolveBooking(enq("E4", { appointmentId: "A9" }), lookup({})),               // status says booked, no appointment exists
  ];
  const r = computeInsights(list, 30, "2026-10-07");
  assert.equal(r.total, 4);
  assert.equal(r.booked, 1);
  assert.equal(r.lost, 2);
  assert.equal(r.rate, 25);
});
