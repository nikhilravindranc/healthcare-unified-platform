import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContacts, contactAccess, deriveConsent, deriveFirstTouch, derivePatientStage, filterContacts, mapReferral, maskContact, SOURCE_OTHER, SOURCE_UNKNOWN } from "../src/modules/crm/contacts";
import { resolveBooking } from "../src/modules/enquiries/booking-state";
import { appointments, demoEnquiries, patients } from "../src/lib/db";

const TODAY = "2026-10-07";
const pat = (id: string, over: object = {}) => ({ id, first: "Pat", last: id, dob: "1990-01-01", phone: "(415) 555-0100", email: `${id}@example.com`, status: "Active", ...over }) as never;
const enq = (id: string, over: object = {}) => ({ id, name: `Enq ${id}`, phone: "(415) 555-0100", email: "same@example.com", source: "Phone call", received: "2026-09-20", status: "New", notes: "", tasks: [], history: [], ...over }) as never;
const appt = (id: string, patientId: string, date: string, status: string) => ({ id, patientId, date, time: "09:00", status, serviceId: "consult", providerId: "pat" }) as never;
const build = (o: Partial<Parameters<typeof buildContacts>[0]>) => buildContacts({ patients: [], enquiries: [], appointments: [], visits: [], today: TODAY, ...o });

test("patients and unlinked enquiry-only people are all included", () => {
  const list = build({ patients: [pat("P-1"), pat("P-2")], enquiries: [enq("E-1", { patientId: "P-1" }), enq("E-2"), enq("E-3")] });
  assert.equal(list.length, 4);                                         // 2 patients + 2 enquiry-only (E-1 belongs to P-1)
  assert.deepEqual(list.filter((c) => c.kind === "enquiry-only").map((c) => c.enquiries[0].id).sort(), ["E-2", "E-3"]);
  assert.equal(list.find((c) => c.patientId === "P-1")!.enquiries.length, 1);
});

test("people are never merged by phone, email or name", () => {
  const same = { name: "Alex Doe", phone: "(415) 555-0100", email: "alex@example.com" };
  const list = build({ patients: [pat("P-1", { first: "Alex", last: "Doe", phone: same.phone, email: same.email })], enquiries: [enq("E-1", same), enq("E-2", same)] });
  assert.equal(list.length, 3);                                         // the patient and two separate enquiry-only contacts
  assert.equal(list.find((c) => c.patientId === "P-1")!.enquiries.length, 0);
});

test("stage is derived from enquiry, patient and appointment states", () => {
  const e = (status: string) => build({ enquiries: [enq("E-1", { status })] })[0].stage;
  assert.equal(e("New"), "Prospect");
  assert.equal(e("Contacted"), "Prospect");
  assert.equal(e("Closed"), "Not converted");
  assert.equal(e("Not converted"), "Not converted");
  assert.equal(derivePatientStage([], [], TODAY), "Patient, no activity");
  assert.equal(derivePatientStage([{ status: "confirmed", date: "2026-10-12" }], [], TODAY), "Appointment booked");
  assert.equal(derivePatientStage([{ status: "completed", date: "2026-09-01" }], [], TODAY), "Active patient");        // within 90 days
  assert.equal(derivePatientStage([{ status: "completed", date: "2026-03-01" }], [], TODAY), "Lapsed patient");
  assert.equal(derivePatientStage([{ status: "completed", date: "2026-03-01" }, { status: "scheduled", date: "2026-10-20" }], [], TODAY), "Active patient"); // booked ahead
  assert.equal(derivePatientStage([], [{ date: "2026-09-15", status: "Completed" }], TODAY), "Active patient");
});

test("cancelled and no-show appointments do not count as booked or as a visit", () => {
  assert.equal(derivePatientStage([{ status: "cancelled", date: "2026-10-20" }], [], TODAY), "Patient, no activity");
  assert.equal(derivePatientStage([{ status: "no_show", date: "2026-10-01" }], [], TODAY), "Patient, no activity");
  assert.equal(derivePatientStage([{ status: "cancelled", date: "2026-10-20" }, { status: "completed", date: "2026-03-01" }], [], TODAY), "Lapsed patient");
});

test("first-touch source uses the earliest enquiry, then the recorded referral, and keeps unknown values", () => {
  const e1 = enq("E-2", { source: "Campaign", received: "2026-09-25" }), e2 = enq("E-1", { source: "Walk-in", received: "2026-09-10" });
  assert.equal(deriveFirstTouch([e1, e2], { referral: "Social media" }).source, "Walk-in");
  assert.equal(deriveFirstTouch([e1, e2]).enquiryId, "E-1");
  assert.deepEqual(mapReferral("Website enquiry"), { source: "Website form", basis: "patient-referral", mapped: true, raw: "Website enquiry" });
  assert.equal(mapReferral("Provider referral").source, "Provider referral");
  const odd = mapReferral("Dr. Emily Carter (referral)");
  assert.equal(odd.source, SOURCE_OTHER); assert.equal(odd.raw, "Dr. Emily Carter (referral)"); assert.equal(odd.mapped, false);
  assert.equal(deriveFirstTouch([], { referral: "" }).source, SOURCE_UNKNOWN);
  assert.equal(deriveFirstTouch([], {}).basis, "none");
});

test("consent dates and sources are never invented", () => {
  assert.deepEqual(deriveConsent({ marketingConsent: true }), { status: "granted" });
  assert.deepEqual(deriveConsent({ marketingConsent: false }), { status: "not-granted" });
  assert.deepEqual(deriveConsent({}), { status: "not-recorded" });          // a missing value is not read as consent
  assert.deepEqual(deriveConsent(), { status: "not-recorded" });
  for (const c of build({ patients: [pat("P-1", { marketingConsent: true })], enquiries: [enq("E-1")] })) { assert.equal(c.consent.recordedAt, undefined); assert.equal(c.consent.source, undefined); }
});

test("Marketing sees no phone, email or date of birth, and search cannot reach them", () => {
  const can = (granted: string[]) => (p: string) => granted.includes(p);
  const marketing = contactAccess(can(["crm", "campaigns", "insights", "enquiries_view"]));
  const frontDesk = contactAccess(can(["patients", "crm", "enquiries"]));
  assert.deepEqual(marketing, { details: false, patientRecords: false });
  assert.deepEqual(frontDesk, { details: true, patientRecords: true });
  const list = build({ patients: [pat("P-1", { phone: "(415) 555-7777" })], enquiries: [enq("E-1", { phone: "(415) 555-8888", email: "secret@example.com" })] });
  const masked = list.map((c) => maskContact(c, marketing));
  assert.ok(masked.every((c) => c.detailsHidden && !c.phone && !c.email && !c.dob && c.enquiries.every((e) => !e.phone && !e.email)));
  assert.equal(filterContacts(masked, { q: "555-8888" }).length, 0);
  assert.equal(filterContacts(masked, { q: "secret@" }).length, 0);
  assert.equal(filterContacts(masked, { q: "enq" }).length, 1);              // names are still searchable
  assert.equal(filterContacts(list.map((c) => maskContact(c, frontDesk)), { q: "5558888" }).length, 1);
});

test("the detail data links enquiries, appointments and the patient, and flags lost bookings", () => {
  const lookup = (id: string) => (id === "A-1" ? ({ id, date: "2026-10-05", time: "09:00", status: "cancelled", providerId: "pat", serviceId: "consult" } as never) : undefined);
  const e = resolveBooking(enq("E-1", { patientId: "P-1", status: "Appointment booked", appointmentId: "A-1" }), lookup);
  const [c] = build({ patients: [pat("P-1")], enquiries: [e], appointments: [appt("A-1", "P-1", "2026-10-05", "cancelled"), appt("A-2", "P-1", "2026-09-01", "completed")] });
  assert.equal(c.patientId, "P-1");
  assert.equal(c.enquiries[0].bookingLost, true);                           // history is kept, the enquiry is open again
  assert.deepEqual(c.appointments.map((a) => [a.id, a.lost, a.enquiryId]), [["A-1", true, "E-1"], ["A-2", false, undefined]]);
  const only = build({ enquiries: [enq("E-9")] })[0];
  assert.equal(only.patientId, undefined); assert.equal(only.appointments.length, 0); assert.equal(only.kind, "enquiry-only");
});

test("the real demo seed gives 25 patients plus 35 enquiry-only people, with cancelled bookings reopened", () => {
  const lookup = (id: string) => { const a = appointments.find((x) => x.id === id); return a && ({ id: a.id, date: a.date, time: a.time, status: a.status, providerId: a.providerId, serviceId: a.serviceId } as never); };
  const enquiries = demoEnquiries.map((e) => resolveBooking(e, lookup));
  const list = buildContacts({ patients, enquiries, appointments, visits: [], today: TODAY });
  assert.equal(list.filter((c) => c.kind === "patient").length, 25);
  assert.equal(list.filter((c) => c.kind === "enquiry-only").length, 35);
  assert.equal(list.length, 60);
  assert.equal(list.filter((c) => c.kind === "patient" && c.enquiries.some((e) => e.bookingLost)).length, 2);
});

test("without patient-record access, patient ids and appointment detail never reach the screen", () => {
  const lookup = () => ({ id: "A-1", date: "2026-10-05", time: "09:00", status: "confirmed", providerId: "pat", serviceId: "inject" } as never);
  const e = resolveBooking(enq("E-1", { patientId: "P-1", status: "Appointment booked", appointmentId: "A-1" }), lookup);
  const [c] = build({ patients: [pat("P-1", { first: "Jo", last: "Bloggs" })], enquiries: [e], appointments: [appt("A-1", "P-1", "2026-10-05", "confirmed")] });
  const m = maskContact(c, { details: false, patientRecords: false });
  assert.notEqual(m.key, c.key); assert.equal(m.key, maskContact(c, { details: false, patientRecords: false }).key);   // opaque but stable
  assert.equal(m.patientId, undefined); assert.equal(m.patientStatus, undefined);
  assert.deepEqual(m.appointments.map((a) => [a.id, a.time, a.serviceId, a.providerId, a.date, a.status]), [["", "", "", "", "2026-10-05", "confirmed"]]);
  assert.equal(m.enquiries[0].patientId, undefined); assert.equal(m.enquiries[0].appointmentId, undefined);
  assert.equal(m.enquiries[0].appointment!.serviceId, ""); assert.equal(m.enquiries[0].appointment!.status, "confirmed");
  assert.equal(JSON.stringify(m).includes("P-1"), false);                  // the patient id appears nowhere in what the UI receives
  assert.equal(JSON.stringify(m).includes("inject"), false);               // neither does the treatment
  const full = maskContact(c, { details: true, patientRecords: true });
  assert.equal(full.patientId, "P-1"); assert.equal(full.appointments[0].serviceId, "consult");
});

test("original demo patients no longer carry an invented acquisition source", () => {
  const original = patients.filter((p) => !p.id.startsWith("P-104"));
  assert.equal(original.length, 12);
  assert.equal(original.filter((p) => p.referral).length, 1);              // only Sarah Johnson has a recorded referral
  const list = buildContacts({ patients, enquiries: demoEnquiries, appointments, visits: [], today: TODAY });
  const orig = list.filter((c) => c.kind === "patient" && original.some((p) => p.id === c.patientId));
  assert.equal(orig.filter((c) => c.firstTouch.source === SOURCE_UNKNOWN).length, 11);
  const sarah = orig.find((c) => c.patientId === "P-10248")!;
  assert.deepEqual([sarah.firstTouch.source, sarah.firstTouch.mapped, sarah.firstTouch.raw], [SOURCE_OTHER, false, "Dr. Emily Carter (referral)"]);
  assert.equal(list.filter((c) => c.firstTouch.basis === "patient-referral").length, 1);   // nobody else is credited from a referral field
});

test("only explicitly recorded demo consent is shown as granted or not granted (never as withdrawn); everything else is not recorded", () => {
  assert.equal(patients.filter((p) => p.marketingConsent === true).length, 7);     // seven recorded "yes" decisions, set explicitly in the demo seed
  assert.equal(patients.filter((p) => p.marketingConsent === false).length, 2);    // two recorded "no" decisions
  assert.equal(patients.filter((p) => p.marketingConsent === undefined).length, patients.length - 9);
  assert.ok(patients.filter((p) => p.id.startsWith("P-104")).every((p) => p.marketingConsent === undefined));   // converted patients: no consent was ever asked
  const list = buildContacts({ patients, enquiries: demoEnquiries, appointments, visits: [], today: TODAY });
  const by = (s: string) => list.filter((c) => c.consent.status === s);
  assert.deepEqual([by("granted").length, by("not-granted").length, by("not-recorded").length], [7, 2, 51]);
  assert.ok(by("granted").some((c) => c.patientId === "P-10248"));
  assert.ok(list.filter((c) => c.kind === "enquiry-only").every((c) => c.consent.status === "not-recorded"));   // an enquiry is never consent
});
