import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEligibility, consentFromFlag, REASON } from "../src/modules/comms/eligibility";
import { composerSchema } from "../src/modules/comms/schemas";
import { commsApi } from "../src/modules/comms/api";
import { messages } from "../src/modules/comms/data";
import { messagesFor } from "../src/modules/comms/select";

const reach = { email: true, phone: true };
const c = (status: "granted" | "withdrawn" | "not-recorded") => ({ status });

test("marketing needs an explicit granted consent: not recorded and withdrawn both block it", () => {
  assert.equal(checkEligibility({ channel: "email", purpose: "marketing", reach, consent: c("granted") }).eligible, true);
  const missing = checkEligibility({ channel: "email", purpose: "marketing", reach, consent: c("not-recorded") });
  assert.deepEqual([missing.eligible, missing.reasons], [false, [REASON.notRecorded]]);
  const gone = checkEligibility({ channel: "email", purpose: "marketing", reach, consent: c("withdrawn") });
  assert.deepEqual([gone.eligible, gone.reasons], [false, [REASON.withdrawn]]);
});

test("a missing consent value never becomes permission", () => {
  assert.deepEqual(consentFromFlag(undefined), { status: "not-recorded" });
  assert.deepEqual(consentFromFlag(true), { status: "granted" });
  assert.deepEqual(consentFromFlag(false), { status: "withdrawn" });
  assert.equal(checkEligibility({ channel: "email", purpose: "marketing", reach, consent: consentFromFlag(undefined) }).eligible, false);
});

test("SMS marketing stays blocked because only an email-marketing decision is stored", () => {
  const r = checkEligibility({ channel: "sms", purpose: "marketing", reach, consent: c("granted") });
  assert.equal(r.eligible, false); assert.ok(r.reasons.includes(REASON.noSmsConsent));
});

test("service messages need a way to reach the person but not marketing consent", () => {
  assert.equal(checkEligibility({ channel: "email", purpose: "service", reach, consent: c("not-recorded") }).eligible, true);
  assert.deepEqual(checkEligibility({ channel: "email", purpose: "service", reach: { email: false, phone: true }, consent: c("granted") }).reasons, [REASON.noEmail]);
  assert.deepEqual(checkEligibility({ channel: "sms", purpose: "service", reach: { email: true, phone: false }, consent: c("granted") }).reasons, [REASON.noPhone]);
  assert.equal(checkEligibility({ channel: "call", purpose: "service", reach: { email: false, phone: false }, consent: c("not-recorded") }).eligible, true);   // a call is only logged
});

test("the demo send records a simulated message, refuses ineligible ones and never claims delivery", async () => {
  const base = { channel: "email" as const, direction: "outgoing" as const, subject: "Hello", body: "A short message.", enquiryId: "E-T" };
  const ok = await commsApi.send({ ...base, purpose: "service" }, { reach, consent: c("not-recorded") }, "Tester");
  assert.equal(ok.status, "simulated");
  await assert.rejects(() => commsApi.send({ ...base, purpose: "marketing" }, { reach, consent: c("not-recorded") }, "Tester"), /No marketing consent recorded/);
  assert.equal((await commsApi.send({ ...base, purpose: "marketing" }, { reach, consent: c("granted") }, "Tester")).status, "simulated");
  assert.equal((await commsApi.saveDraft({ ...base, purpose: "service" }, "Tester")).status, "draft");
  const call = await commsApi.send({ channel: "call", direction: "incoming", purpose: "marketing", subject: "", body: "Asked about prices." }, { reach: { email: false, phone: false }, consent: c("not-recorded") }, "Tester");
  assert.deepEqual([call.status, call.purpose], ["logged", "service"]);
  assert.ok(messages.every((m) => !["sent", "delivered"].includes(m.status as string)));
});

test("sample history only contains what the sample enquiries support and no outgoing message claims delivery", () => {
  assert.ok(messages.length > 20);
  assert.ok(messages.filter((m) => m.direction === "outgoing" && m.id.startsWith("m-E-")).every((m) => m.status === "simulated" && m.purpose === "service"));
  assert.ok(messages.filter((m) => m.direction === "incoming").every((m) => m.status === "received" || m.status === "logged"));
});

test("history for a contact joins its enquiries and its patient without duplicates", () => {
  const all = [
    { id: "1", enquiryId: "E-1", at: "2026-10-01" }, { id: "2", enquiryId: "E-2", patientId: "P-1", at: "2026-10-03" },
    { id: "3", patientId: "P-1", at: "2026-10-02" }, { id: "4", enquiryId: "E-9", at: "2026-10-04" },
  ] as never;
  assert.deepEqual(messagesFor(all, { enquiryIds: ["E-1", "E-2"], patientId: "P-1" }).map((m) => m.id), ["2", "3", "1"]);
  assert.deepEqual(messagesFor(all, { enquiryId: "E-9" }).map((m) => m.id), ["4"]);
});

test("the composer checks the fields that matter for each channel", () => {
  const ok = { channel: "email", direction: "outgoing", purpose: "service", subject: "Hi there", body: "Thanks for asking." };
  assert.equal(composerSchema.safeParse(ok).success, true);
  assert.equal(composerSchema.safeParse({ ...ok, subject: "" }).success, false);                          // an email needs a subject
  assert.equal(composerSchema.safeParse({ ...ok, channel: "sms", subject: "" }).success, true);
  assert.equal(composerSchema.safeParse({ ...ok, channel: "sms", subject: "", body: "x".repeat(400) }).success, false);
  assert.equal(composerSchema.safeParse({ ...ok, body: "no" }).success, false);
});
