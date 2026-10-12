import { test } from "node:test";
import assert from "node:assert/strict";
import { appointments, demoEnquiries, patients } from "../src/lib/db";
import { previewAudience, recipientRefs } from "../src/modules/campaigns/audience";
import { campaignsApi } from "../src/modules/campaigns/api";
import { campaignSchema } from "../src/modules/campaigns/schemas";
import { resolveBooking } from "../src/modules/enquiries/booking-state";
import { buildContacts } from "../src/modules/crm/contacts";
import { REASON } from "../src/modules/comms/eligibility";
import { messages } from "../src/modules/comms/data";
import { messagesFor } from "../src/modules/comms/select";

const lookup = (id: string) => { const a = appointments.find((x) => x.id === id); return a && ({ id: a.id, date: a.date, time: a.time, status: a.status, providerId: a.providerId, serviceId: a.serviceId, events: a.events } as never); };
const contacts = () => buildContacts({ patients, enquiries: demoEnquiries.map((e) => resolveBooking(e, lookup)), appointments, visits: [], today: "2026-10-07" });
const anyone = { stages: [], sources: [] };

test("an email audience contains only people with an explicit consent, and says why everyone else is left out", () => {
  const p = previewAudience(contacts(), anyone, "email");
  assert.equal(p.matched.length, 60);
  assert.equal(p.eligible.length, 7);                                     // the seven recorded "yes" decisions
  assert.ok(p.eligible.every((c) => c.consent.status === "granted" && c.kind === "patient"));
  assert.equal(p.excluded.length, 53);
  assert.equal(p.reasonCounts[REASON.withdrawn], 2);
  assert.equal(p.reasonCounts[REASON.notRecorded], 51);                    // missing consent is a reason to exclude, never permission
});

test("enquiry-only people and converted patients are never in a marketing audience without a recorded consent", () => {
  const p = previewAudience(contacts(), anyone, "email");
  assert.equal(p.eligible.filter((c) => c.kind === "enquiry-only").length, 0);
  assert.equal(p.eligible.filter((c) => c.patientId?.startsWith("P-104")).length, 0);
});

test("an SMS marketing audience is empty because no SMS marketing consent exists anywhere", () => {
  const p = previewAudience(contacts(), anyone, "sms");
  assert.equal(p.eligible.length, 0);
  assert.equal(p.reasonCounts[REASON.noSmsConsent], 60);
});

test("stage and source filters narrow who matches, using the CRM's derived values", () => {
  const all = contacts();
  const active = previewAudience(all, { stages: ["Active patient"], sources: [] }, "email");
  assert.ok(active.matched.every((c) => c.stage === "Active patient"));
  assert.ok(active.eligible.length > 0 && active.eligible.length < 7 + 1);
  const walkIn = previewAudience(all, { stages: [], sources: ["Walk-in"] }, "email");
  assert.ok(walkIn.matched.every((c) => c.firstTouch.source === "Walk-in"));
  assert.equal(previewAudience(all, { stages: ["Lapsed patient"], sources: ["Unknown"] }, "email").matched.length, 0);
});

test("a simulated run records marketing messages that never claim delivery, and cannot be repeated or edited", async () => {
  const input = { name: "Test run", channel: "email" as const, subject: "Hello", body: "A marketing message for the demo.", stages: [], sources: [], scheduledFor: "" };
  const c = await campaignsApi.create(input, "Tester");
  assert.equal(c.status, "Draft");
  const refs = recipientRefs(previewAudience(contacts(), anyone, "email").eligible);
  assert.equal(refs.length, 7);
  await assert.rejects(() => campaignsApi.simulate(c.id, [], "Tester"), /No eligible recipients/);
  const done = await campaignsApi.simulate(c.id, refs, "Tester");
  assert.deepEqual([done.status, done.simulatedRecipients], ["Simulated", 7]);
  const mine = messages.filter((m) => m.campaignId === c.id);
  assert.equal(mine.length, 7);
  assert.ok(mine.every((m) => m.status === "simulated" && m.purpose === "marketing" && m.direction === "outgoing"));
  assert.ok(messagesFor(messages, { patientId: refs[0].patientId }).some((m) => m.campaignId === c.id));          // shows in the recipient's history
  await assert.rejects(() => campaignsApi.simulate(c.id, refs, "Tester"), /Already run/);
  await assert.rejects(() => campaignsApi.update(c.id, input, "Tester"), /cannot be edited/);
  await assert.rejects(() => campaignsApi.remove(c.id), /Only drafts/);
});

test("scheduling needs a date and at least one eligible person, and a draft can be deleted", async () => {
  const c = await campaignsApi.create({ name: "Schedule me", channel: "email", subject: "Hi there", body: "Another demo message here.", stages: [], sources: [], scheduledFor: "" }, "Tester");
  await assert.rejects(() => campaignsApi.schedule(c.id, "2026-10-30", 0), /No eligible/);
  await assert.rejects(() => campaignsApi.schedule(c.id, "", 5), /Choose a date/);
  assert.equal((await campaignsApi.schedule(c.id, "2026-10-30", 5)).status, "Scheduled");
  assert.equal((await campaignsApi.unschedule(c.id)).status, "Draft");
  assert.equal(await campaignsApi.remove(c.id), true);
});

test("the campaign form checks name, subject and message length", () => {
  const ok = { name: "Spring offer", channel: "email", subject: "Spring", body: "A message long enough.", stages: [], sources: [], scheduledFor: "" };
  assert.equal(campaignSchema.safeParse(ok).success, true);
  assert.equal(campaignSchema.safeParse({ ...ok, name: "ab" }).success, false);
  assert.equal(campaignSchema.safeParse({ ...ok, subject: "" }).success, false);
  assert.equal(campaignSchema.safeParse({ ...ok, channel: "sms", subject: "" }).success, true);
  assert.equal(campaignSchema.safeParse({ ...ok, channel: "sms", subject: "", body: "x".repeat(500) }).success, false);
  assert.equal(campaignSchema.safeParse({ ...ok, stages: ["Not a stage"] }).success, false);
});
