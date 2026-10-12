import { test } from "node:test";
import assert from "node:assert/strict";
import { appointments, patients, TODAY, addDays, services, providers } from "../src/lib/db";
import { bookableServices, providersForService, slotsFor } from "../src/modules/booking/availability";
import { bookingApi, SlotTakenError } from "../src/modules/booking/api";
import { bookingDetailsSchema, manageLookupSchema } from "../src/modules/booking/schemas";
import { enquiriesApi } from "../src/modules/enquiries/api";
import { resolveBooking } from "../src/modules/enquiries/booking-state";

const details = (over: object = {}) => ({ returning: false, first: "Jamie", last: "Rivera", email: "jamie.rivera@example.com", phone: "(415) 555-0199", notes: "", marketingOptIn: false, ...over });
/** The nth weekday (Mon to Fri) after the demo date, so these tests do not depend on weekday rules. */
const wk = (n: number) => { let d = TODAY, left = n; while (left > 0) { d = addDays(d, 1); const w = new Date(d + "T12:00:00").getDay(); if (w !== 0 && w !== 6) left--; } return d; };
const day = wk(3);
const consult = services.find((s) => s.id === "consult")!;
const lookup = (id: string) => { const a = appointments.find((x) => x.id === id); return a && ({ id: a.id, date: a.date, time: a.time, status: a.status, providerId: a.providerId, serviceId: a.serviceId, events: a.events } as never); };
let n = 0;
async function bookOne(over: object = {}, time?: string) {
  const slot = slotsFor(["pat"], consult.duration, day)[time ? 0 : 0];
  return bookingApi.book({ serviceId: "consult", providerId: "pat", locationId: "dt", date: day, time: time ?? slot.time, details: details({ email: `person${++n}@example.com`, last: `Tester${n}`, ...over }) as never });
}

test("only active services chosen in the booking settings are offered, and none when booking is off", () => {
  assert.equal(bookableServices(services, { enabled: true, serviceIds: null }).length, services.filter((s) => s.status === "Active").length);
  assert.deepEqual(bookableServices(services, { enabled: true, serviceIds: ["consult", "dental"] }).map((s) => s.id), ["consult", "dental"]);
  assert.equal(bookableServices(services, { enabled: false, serviceIds: null }).length, 0);
  assert.ok(providersForService(providers, consult).every((p) => p.serviceIds.includes("consult") && p.status === "Active"));
});

test("offered times use the internal conflict rules, so a booked time disappears for that provider", async () => {
  const before = slotsFor(["pat"], consult.duration, day);
  assert.ok(before.length > 0);
  const taken = before[0].time;
  await bookOne({}, taken);
  assert.equal(slotsFor(["pat"], consult.duration, day).some((s) => s.time === taken), false);
  const any = slotsFor(["pat", "rao"], consult.duration, day);
  assert.equal(new Set(any.map((s) => s.time)).size, any.length);                    // a time is listed once even with several providers
});

test("a new person's booking creates one patient, one online appointment and one enquiry that keeps the source", async () => {
  const patientsBefore = patients.length, apptsBefore = appointments.length;
  const r = await bookOne({ first: "Pat", last: "NewPerson", email: "new.person@example.com" });
  assert.equal(r.isNew, true);
  assert.equal(patients.length, patientsBefore + 1); assert.equal(appointments.length, apptsBefore + 1);
  const a = appointments.find((x) => x.id === r.reference)!;
  assert.deepEqual([a.origin, a.status, a.patientId], ["online", "scheduled", r.patientId]);
  assert.match(a.events![0].text, /Booked online/);
  const p = patients.find((x) => x.id === r.patientId)!;
  assert.equal(p.marketingConsent, undefined);                                        // no opt-in means no consent recorded, never a yes
  const e = (await enquiriesApi.list()).find((x) => x.appointmentId === r.reference)!;
  assert.deepEqual([e.source, e.status, e.patientId], ["Online booking", "Appointment booked", r.patientId]);
  assert.ok(e.history.some((h) => /Booked online/.test(h.text)));
});

test("marketing consent is recorded only when the person explicitly opts in", async () => {
  const yes = await bookOne({ marketingOptIn: true });
  assert.equal(patients.find((x) => x.id === yes.patientId)!.marketingConsent, true);
});

test("a returning patient is matched only by exact email and last name, and then no patient is created", async () => {
  const existing = patients.find((p) => p.id === "P-10248")!;
  assert.deepEqual(await bookingApi.findReturning(existing.email.toUpperCase(), ` ${existing.last} `), { id: existing.id, first: existing.first });
  assert.equal(await bookingApi.findReturning(existing.email, "Wrong"), null);        // email alone never matches
  assert.equal(await bookingApi.findReturning("someone.else@example.com", existing.last), null);
  const before = patients.length;
  const r = await bookingApi.book({ serviceId: "consult", providerId: "rao", locationId: "dt", date: wk(4), time: slotsFor(["rao"], consult.duration, wk(4))[0].time, details: details({ returning: true, first: existing.first, last: existing.last, email: existing.email }) as never });
  assert.deepEqual([r.isNew, r.patientId, patients.length], [false, existing.id, before]);
  assert.equal(patients.find((p) => p.id === existing.id)!.marketingConsent, true);   // an existing patient's consent is never changed by a booking
});

test("the same time cannot be booked twice", async () => {
  const t = slotsFor(["pat"], consult.duration, wk(5))[0].time;
  const req = (e: string) => bookingApi.book({ serviceId: "consult", providerId: "pat", locationId: "dt", date: wk(5), time: t, details: details({ email: e, last: e }) as never });
  await req("first@example.com");
  await assert.rejects(() => req("second@example.com"), SlotTakenError);
});

test("an online booking can be managed only with its reference and the matching email, and shows no clinical detail", async () => {
  const email = "manage.me@example.com";
  const r = await bookOne({ email, last: "Manage" });
  assert.equal(await bookingApi.find(r.reference, "wrong@example.com"), null);
  assert.equal(await bookingApi.find("A-1", "x@example.com"), null);                  // an ordinary internal appointment cannot be looked up here
  const view = (await bookingApi.find(r.reference.toLowerCase(), email.toUpperCase()))!;
  assert.deepEqual(Object.keys(view).sort(), ["canChange", "date", "first", "locationId", "providerId", "reference", "serviceId", "status", "time"]);
  const free = slotsFor(["pat"], consult.duration, wk(6))[0].time;
  const moved = await bookingApi.reschedule(r.reference, email, wk(6), free);
  assert.deepEqual([moved.date, moved.time, moved.status], [wk(6), free, "scheduled"]);
  const gone = await bookingApi.cancel(r.reference, email);
  assert.deepEqual([gone.status, gone.canChange], ["cancelled", false]);
  await assert.rejects(() => bookingApi.cancel(r.reference, email), /cannot be changed/);
  const e = (await enquiriesApi.list()).find((x) => x.appointmentId === r.reference)!;
  const resolved = resolveBooking(e, lookup);
  assert.equal(resolved.bookingLost, true);                                           // the patient's cancellation reopens the enquiry and keeps its history
  assert.ok(resolved.history.some((h) => /Cancelled/.test(h.text)));
});

test("the booking forms check the details people enter", () => {
  assert.equal(bookingDetailsSchema.safeParse(details()).success, true);
  assert.equal(bookingDetailsSchema.safeParse(details({ email: "nope" })).success, false);
  assert.equal(bookingDetailsSchema.safeParse(details({ phone: "12" })).success, false);
  assert.equal(bookingDetailsSchema.safeParse(details({ first: " " })).success, false);
  assert.equal(bookingDetailsSchema.safeParse(details({ notes: "x".repeat(400) })).success, false);
  assert.equal(manageLookupSchema.safeParse({ reference: "A-12", email: "a@b.co" }).success, true);
  assert.equal(manageLookupSchema.safeParse({ reference: "", email: "a@b.co" }).success, false);
});
