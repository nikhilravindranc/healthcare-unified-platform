import { test } from "node:test";
import assert from "node:assert/strict";
import { availabilityIssues, dateInText, onlineWindowIssue, parseDateRanges, parseProviderHours } from "../src/lib/availability-rules";
import { addDays, appointments, checkConflicts, TODAY, toMin } from "../src/lib/db";
import { bookingApi, SlotTakenError } from "../src/modules/booking/api";
import { dayNote, onlineIssue, slotsFor } from "../src/modules/booking/availability";

// The demo date is a Wednesday, so Saturday is +3 and Sunday is +4.
const SAT = addDays(TODAY, 3), SUN = addDays(TODAY, 4), MON = addDays(TODAY, 5), TUE = addDays(TODAY, 6);
const clinic = { breakStart: "", breakEnd: "", closedDates: "" };
const details = { returning: false, first: "Rule", last: "Tester", email: "rule.tester@example.com", phone: "(415) 555-0100", notes: "", marketingOptIn: false } as never;

const store: Record<string, string> = {};
Object.assign(globalThis, { localStorage: { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } } });
const configure = (s: object) => { store["pms.settings"] = JSON.stringify(s); };
const open = { leadHours: 0, windowDays: 0 };

test("provider hours are read as days and times, and unreadable parts mean no rule", () => {
  assert.deepEqual(parseProviderHours("Mon–Fri · 8:30 AM–5:00 PM"), { days: [1, 2, 3, 4, 5], start: 510, end: 1020 });
  assert.deepEqual(parseProviderHours("Mon–Sat · 9:00 AM–5:00 PM").days, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(parseProviderHours("Mon, Wed, Fri · 9:00 AM–1:00 PM").days, [1, 3, 5]);
  assert.deepEqual(parseProviderHours("Fri–Mon · 9:00 AM–1:00 PM").days, [5, 6, 0, 1]);
  assert.equal(parseProviderHours("By arrangement").days, null);           // not understood: no weekday rule is invented
  assert.equal(parseProviderHours("By arrangement").start, null);
});

test("dates are read from ISO dates and ranges, with unreadable entries reported and never guessed", () => {
  const r = parseDateRanges("2026-12-25, 2026-12-31 to 2027-01-02\nOct 20 to Oct 24; sometime soon", 2026);
  assert.deepEqual(r.ranges, [{ from: "2026-12-25", to: "2026-12-25" }, { from: "2026-12-31", to: "2027-01-02" }, { from: "2026-10-20", to: "2026-10-24" }]);
  assert.deepEqual(r.invalid, ["sometime soon"]);
  assert.equal(dateInText("2026-10-22", "Oct 20 to Oct 24"), true);
  assert.equal(dateInText("2026-10-25", "Oct 20 to Oct 24"), false);
  assert.equal(dateInText("2027-01-01", "Dec 30 to Jan 3"), true);          // a range may run over the new year
  assert.equal(dateInText(TODAY, ""), false);
});

test("weekday, time off, break and closed-date rules each give a plain reason", () => {
  const prov = { short: "Dr. Patel", hours: "Mon–Fri · 8:30 AM–5:00 PM", timeOff: "2026-10-13 to 2026-10-14" };
  const ask = (date: string, start: number, c = clinic) => availabilityIssues({ date, start, duration: 30, provider: prov, clinic: c }).map((i) => i.text);
  assert.deepEqual(ask(MON, 600), []);
  assert.match(ask(SAT, 600)[0], /does not work on Saturdays/);
  assert.match(ask("2026-10-13", 600)[0], /time off/);
  assert.match(ask(MON, 600, { ...clinic, closedDates: MON })[0], /closed/);
  assert.match(ask(MON, 12 * 60 + 15, { ...clinic, breakStart: "12:00", breakEnd: "13:00" })[0], /break/);
  assert.deepEqual(ask(MON, 13 * 60, { ...clinic, breakStart: "12:00", breakEnd: "13:00" }), []);   // ends exactly when the break starts or starts when it ends is fine
  assert.deepEqual(ask(MON, 600, { ...clinic, breakStart: "13:00", breakEnd: "12:00" }), []);       // an impossible break is ignored
});

test("the notice period and booking window are measured from the demo clock", () => {
  const base = { nowDate: TODAY, nowMinutes: 10 * 60, windowDays: 30 };
  assert.match(onlineWindowIssue({ ...base, date: TODAY, time: "11:00", leadHours: 2 })!, /2 hours notice/);
  assert.equal(onlineWindowIssue({ ...base, date: TODAY, time: "12:00", leadHours: 2 }), null);
  assert.match(onlineWindowIssue({ ...base, date: addDays(TODAY, 1), time: "09:00", leadHours: 24 })!, /24 hours notice/);
  assert.equal(onlineWindowIssue({ ...base, date: addDays(TODAY, 1), time: "11:00", leadHours: 24 }), null);
  assert.match(onlineWindowIssue({ ...base, date: addDays(TODAY, 31), time: "09:00", leadHours: 0 })!, /30 days ahead/);
  assert.equal(onlineWindowIssue({ ...base, date: addDays(TODAY, 90), time: "09:00", leadHours: 0, windowDays: 0 }), null);   // 0 means no limit
});

test("online times follow provider weekdays, time off, the break and closed dates, and a booking cannot get around them", async () => {
  configure({});
  assert.equal(slotsFor(["pat"], 30, SAT, open).length, 0);                 // Dr. Patel works Monday to Friday
  assert.ok(slotsFor(["meh"], 30, SAT, open).length > 0);                   // Dr. Mehta works Monday to Saturday
  assert.equal(slotsFor(["meh"], 30, SUN, open).length, 0);
  assert.match(dayNote([{ short: "Dr. Patel", hours: "Mon–Fri · 8:30 AM–5:00 PM" }], SAT, open)!, /does not work on Saturdays/);
  assert.equal(dayNote([{ short: "A", hours: "Mon–Fri" }, { short: "B", hours: "Mon–Fri" }], SAT, open), "None of the providers are working on this date.");
  await assert.rejects(() => bookingApi.book({ serviceId: "consult", providerId: "pat", locationId: "dt", date: SAT, time: "10:00", details }), (e: Error) => e instanceof SlotTakenError && /does not work on Saturdays/.test(e.message));

  configure({ breakStart: "12:00", breakEnd: "13:00" });
  const times = slotsFor(["pat"], 30, MON, open).map((s) => toMin(s.time));
  assert.ok(times.length > 0 && times.every((t) => t + 30 <= 720 || t >= 780));
  configure({ closedDates: MON });
  assert.equal(slotsFor(["pat"], 30, MON, open).length, 0);
  assert.equal(dayNote([], MON, open), "The practice is closed on this date.");
  assert.ok(checkConflicts({ providerId: "pat", roomId: "", date: MON, time: "10:00", duration: 30 }).some((c) => /closed/.test(c.text)));   // staff booking the same time are warned too
  configure({});
});

test("the buffer between visits keeps the provider's neighbouring times free", async () => {
  configure({});
  const first = slotsFor(["rao"], 30, TUE, open)[0].time;
  await bookingApi.book({ serviceId: "consult", providerId: "rao", locationId: "dt", date: TUE, time: first, details: { ...(details as object), email: "buffer.tester@example.com" } as never });
  const next = String(Math.floor((toMin(first) + 30) / 60)).padStart(2, "0") + ":" + String((toMin(first) + 30) % 60).padStart(2, "0");
  assert.ok(slotsFor(["rao"], 30, TUE, open).some((s) => s.time === next));             // no buffer: the next visit can follow straight away
  configure({ bufferMin: 15 });
  assert.equal(slotsFor(["rao"], 30, TUE, open).some((s) => s.time === next), false);   // a 15 minute buffer closes the gap
  assert.ok(appointments.length > 0);
  configure({});
});

test("a booking is refused when it is too soon or too far ahead", async () => {
  configure({ booking: { enabled: true, serviceIds: null, leadHours: 48, windowDays: 10 } });
  assert.match(onlineIssue(addDays(TODAY, 1), "16:00")!, /48 hours notice/);
  assert.match(onlineIssue(addDays(TODAY, 20), "10:00")!, /10 days ahead/);
  assert.equal(onlineIssue(addDays(TODAY, 7), "10:00"), null);
  await assert.rejects(() => bookingApi.book({ serviceId: "consult", providerId: "pat", locationId: "dt", date: addDays(TODAY, 20), time: "10:00", details }), SlotTakenError);
  configure({});
});
