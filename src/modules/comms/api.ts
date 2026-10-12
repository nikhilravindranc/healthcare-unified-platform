/**
 * Communication data access (frontend demo). A real implementation would call a messaging service.
 * `send` records a SIMULATED message: it never delivers anything and the status says so.
 */
import { TODAY } from "@/lib/db";
import { checkEligibility, type Reach, type ConsentState } from "./eligibility";
import { messages } from "./data";
import type { Channel, Direction, Message, Purpose } from "./types";

const lag = <T,>(v: T, ms = 200) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), ms));
let seq = 0;

export interface ComposeInput { channel: Channel; direction: Direction; purpose: Purpose; subject: string; body: string; enquiryId?: string; patientId?: string; appointmentId?: string; campaignId?: string }
export interface Recipient { reach: Reach; consent: ConsentState }

export const commsApi = {
  list: () => lag(messages),
  /** Saves a draft. Drafts are never sent. */
  async saveDraft(i: ComposeInput, by: string) {
    const m: Message = { id: `m-new-${++seq}`, channel: i.channel, direction: "outgoing", status: "draft", purpose: i.purpose, subject: i.subject || undefined, body: i.body, at: TODAY, by, enquiryId: i.enquiryId, patientId: i.patientId, appointmentId: i.appointmentId, campaignId: i.campaignId };
    messages.unshift(m); return lag(m);
  },
  /** Demo send. Refuses when the eligibility rule fails, so the rule cannot be bypassed by the UI. */
  async send(i: ComposeInput, to: Recipient, by: string) {
    if (i.channel === "call") {
      const m: Message = { id: `m-new-${++seq}`, channel: "call", direction: i.direction, status: "logged", purpose: "service", body: i.body, at: TODAY, by, enquiryId: i.enquiryId, patientId: i.patientId, appointmentId: i.appointmentId };
      messages.unshift(m); return lag(m);
    }
    const check = checkEligibility({ channel: i.channel, purpose: i.purpose, reach: to.reach, consent: to.consent });
    if (!check.eligible) throw new Error(check.reasons.join("; "));
    const m: Message = { id: `m-new-${++seq}`, channel: i.channel, direction: "outgoing", status: "simulated", purpose: i.purpose, subject: i.subject || undefined, body: i.body, at: TODAY, by, enquiryId: i.enquiryId, patientId: i.patientId, appointmentId: i.appointmentId, campaignId: i.campaignId };
    messages.unshift(m); return lag(m, 350);
  },
  /** Records one simulated message per eligible recipient of a campaign run. */
  async recordCampaignRun(campaignId: string, channel: Channel, subject: string, body: string, recipients: { enquiryId?: string; patientId?: string }[], by: string) {
    const made = recipients.map((r): Message => ({ id: `m-new-${++seq}`, channel, direction: "outgoing", status: "simulated", purpose: "marketing", subject: subject || undefined, body, at: TODAY, by, campaignId, ...r }));
    messages.unshift(...made); return lag(made.length, 250);
  },
};
