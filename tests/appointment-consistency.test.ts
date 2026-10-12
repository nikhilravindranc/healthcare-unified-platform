import { test } from "node:test";
import assert from "node:assert/strict";
import { canReschedule, isLiveStatus, isLostStatus, isOpenStatus, isUpcoming } from "../src/lib/appointment-rules";
import { api, appointments, TODAY } from "../src/lib/db";
import { existingBookingCandidates, resolveBooking } from "../src/modules/enquiries/booking-state";
import { enquiriesApi } from "../src/modules/enquiries/api";


const input = (over: object = {}) => ({ patientId: "P-10248", providerId: "pat", serviceId: "consult", date: "2026-10-20", time: "09:00", duration: 30, locationId: "dt", roomId: "r1", notes: "", ...over }) as never;
const link = (id: string) => { const a = appointments.find((x) => x.id === id)!; return { id: a.id, date: a.date, time: a.time, status: a.status, providerId: a.providerId, serviceId: a.serviceId, events: a.events } as never; };
const enq = (over: object = {}) => ({ id: "E-T1", name: "Test", source: "Phone call", received: "2026-10-01", status: "Appointment booked", notes: "", tasks: [], history: [{ id: "h", at: "2026-10-01", text: "Enquiry received" }], patientId: "P-10248", ...over }) as never;

test("one set of rules decides what cancelled, no-show, open and upcoming mean", () => {
  assert.deepEqual(["cancelled", "no_show", "completed", "scheduled"].map((s) => isLostStatus(s as never)), [true, true, false, false]);
  assert.deepEqual(["cancelled", "no_show", "completed", "waiting"].map((s) => isOpenStatus(s as never)), [false, false, false, true]);
  assert.equal(isLiveStatus("completed"), true);
  assert.equal(isUpcoming({ status: "confirmed", date: "2026-10-08" }, TODAY), true);
  assert.equal(isUpcoming({ status: "cancelled", date: "2026-10-08" }, TODAY), false);
  assert.equal(isUpcoming({ status: "no_show", date: "2026-10-08" }, TODAY), false);
  assert.equal(isUpcoming({ status: "scheduled", date: "2026-10-01" }, TODAY), false);
  assert.deepEqual(["scheduled", "arrived", "cancelled", "no_show", "completed", "in_progress"].map((s) => canReschedule(s as never)), [true, true, true, true, false, false]);
});

test("cancelling logs an event, and rescheduling a cancelled appointment keeps that history", async () => {
  const a = await api.createAppointment(input());
  await api.setStatus(a.id, "cancelled");
  assert.equal(appointments.find((x) => x.id === a.id)!.status, "cancelled");
  await api.reschedule(a.id, "2026-10-22", "10:00");
  const now = appointments.find((x) => x.id === a.id)!;
  assert.equal(now.status, "scheduled");
  assert.deepEqual(now.events!.map((e) => e.text.split(" ")[0]), ["Cancelled", "Rescheduled"]);
  assert.match(now.events![1].text, /it had been cancelled/);
});

test("a completed appointment cannot be rescheduled", async () => {
  const a = await api.createAppointment(input({ date: "2026-10-25" }));
  await api.setStatus(a.id, "completed");
  await assert.rejects(() => api.reschedule(a.id, "2026-10-26", "09:00"), /no longer be rescheduled/);
});

test("appointment events become enquiry history, so a cancel then reschedule is never silent", async () => {
  const a = await api.createAppointment(input({ date: "2026-10-27" }));
  await api.setStatus(a.id, "no_show");
  const lost = resolveBooking(enq({ appointmentId: a.id }), (id) => link(id));
  assert.equal(lost.status, "Contacted"); assert.equal(lost.bookingLost, true);
  assert.ok(lost.history.some((h) => h.derived && /no-show/.test(h.text)));
  await api.reschedule(a.id, "2026-10-28", "11:00");
  const back = resolveBooking(enq({ appointmentId: a.id }), (id) => link(id));
  assert.equal(back.status, "Appointment booked");                                  // live again, but the earlier no-show stays in the history
  assert.ok(back.history.some((h) => h.derived && /no-show/.test(h.text)));
  assert.ok(back.history.some((h) => h.derived && /Rescheduled/.test(h.text)));
});

test("an enquiry's booking can only be linked to a real appointment of the same patient", async () => {
  const stored = (await enquiriesApi.list()).find((e) => !e.patientId)!;
  await assert.rejects(() => enquiriesApi.setStatus(stored.id, "Appointment booked", "Tester"), /appointmentBooked/);   // the status alone is never enough
  await enquiriesApi.linkPatient(stored.id, "P-10248", "Tester");
  await assert.rejects(() => enquiriesApi.appointmentBooked(stored.id, "A-DOES-NOT-EXIST", "Tester"), /does not match/);
  const other = await api.createAppointment(input({ patientId: "P-10251", date: "2026-10-29" }));
  await assert.rejects(() => enquiriesApi.appointmentBooked(stored.id, other.id, "Tester"), /does not match/);        // belongs to a different patient
  const own = await api.createAppointment(input({ date: "2026-10-30" }));
  const linked = await enquiriesApi.appointmentBooked(stored.id, own.id, "Tester");
  assert.deepEqual([linked.status, linked.appointmentId], ["Appointment booked", own.id]);
  const second = await api.createAppointment(input({ date: "2026-10-31" }));                                          // rebook: the first id is kept as history
  const again = await enquiriesApi.appointmentBooked(stored.id, second.id, "Tester");
  assert.deepEqual(again.previousAppointmentIds, [own.id]);
});

test("booking from an enquiry offers an existing matching appointment instead of creating a duplicate", () => {
  const appts = [
    { id: "A-1", patientId: "P-1", serviceId: "consult", date: "2026-10-20", status: "confirmed" },
    { id: "A-2", patientId: "P-1", serviceId: "consult", date: "2026-10-21", status: "cancelled" },
    { id: "A-3", patientId: "P-1", serviceId: "inject", date: "2026-10-22", status: "scheduled" },
    { id: "A-4", patientId: "P-1", serviceId: "consult", date: "2026-10-23", status: "scheduled" },
    { id: "A-5", patientId: "P-1", serviceId: "consult", date: "2026-09-01", status: "scheduled" },
    { id: "A-6", patientId: "P-2", serviceId: "consult", date: "2026-10-20", status: "confirmed" },
  ] as never;
  const e = { id: "E-1", patientId: "P-1", serviceId: "consult" };
  assert.deepEqual(existingBookingCandidates(e, appts, [{ id: "E-9", appointmentId: "A-4" }], TODAY).map((a) => a.id), ["A-1"]);   // not cancelled, not another service, not past, not taken, not another patient
  assert.deepEqual(existingBookingCandidates({ ...e, serviceId: undefined }, appts, [], TODAY).map((a) => a.id), ["A-1", "A-3", "A-4"]);
  assert.deepEqual(existingBookingCandidates({ id: "E-1", serviceId: "consult" }, appts, [], TODAY), []);                            // no patient, nothing to offer
});
