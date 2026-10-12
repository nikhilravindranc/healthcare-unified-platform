/**
 * Campaign data access (frontend demo). A real implementation would call a campaign service.
 * `simulate` never sends anything: it records simulated messages for the eligible recipients so each
 * recipient's history shows the campaign, and marks the campaign "Simulated".
 */
import { TODAY } from "@/lib/db";
import { commsApi } from "../comms/api";
import { campaigns } from "./data";
import type { CampaignInput } from "./schemas";
import type { Campaign } from "./types";

const lag = <T,>(v: T, ms = 220) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), ms));
let seq = 1003;
const find = (id: string) => { const c = campaigns.find((x) => x.id === id); if (!c) throw new Error("not found"); return c; };
const note = (c: Campaign, text: string) => c.events.push({ at: TODAY, text });
const fields = (i: CampaignInput) => ({ name: i.name, channel: i.channel, subject: i.channel === "email" ? i.subject : "", body: i.body, audience: { stages: i.stages, sources: i.sources } });

export const campaignsApi = {
  list: () => lag(campaigns),
  async create(i: CampaignInput, by: string) {
    const c: Campaign = { id: `C-${++seq}`, ...fields(i), status: "Draft", createdAt: TODAY, createdBy: by, events: [{ at: TODAY, text: "Created" }] };
    campaigns.unshift(c); return lag(c, 300);
  },
  /** Editing a campaign that was already run is not allowed: duplicate it instead. */
  async update(id: string, i: CampaignInput, by: string) {
    const c = find(id); if (c.status === "Simulated") throw new Error("A campaign that has been run cannot be edited");
    Object.assign(c, fields(i)); c.scheduledFor = c.status === "Scheduled" ? i.scheduledFor || c.scheduledFor : undefined; note(c, `Edited by ${by}`); return lag(c, 250);
  },
  async schedule(id: string, when: string, eligibleCount: number) {
    const c = find(id); if (c.status === "Simulated") throw new Error("A campaign that has been run cannot be scheduled");
    if (eligibleCount < 1) throw new Error("No eligible recipients"); if (!when) throw new Error("Choose a date");
    c.status = "Scheduled"; c.scheduledFor = when; note(c, `Scheduled for ${when} (demo, nothing will be sent)`); return lag(c, 250);
  },
  async unschedule(id: string) { const c = find(id); if (c.status !== "Scheduled") return lag(c); c.status = "Draft"; c.scheduledFor = undefined; note(c, "Moved back to draft"); return lag(c, 200); },
  async simulate(id: string, recipients: { patientId?: string; enquiryId?: string }[], by: string) {
    const c = find(id); if (c.status === "Simulated") throw new Error("Already run in demo mode");
    if (recipients.length < 1) throw new Error("No eligible recipients");
    await commsApi.recordCampaignRun(c.id, c.channel, c.subject, c.body, recipients, by);
    c.status = "Simulated"; c.simulatedAt = TODAY; c.simulatedRecipients = recipients.length; c.scheduledFor = undefined; note(c, `Run in demo mode for ${recipients.length} recipients (nothing was sent)`);
    return lag(c, 400);
  },
  async duplicate(id: string, by: string) {
    const o = find(id); const c: Campaign = { id: `C-${++seq}`, name: `${o.name} (copy)`, channel: o.channel, subject: o.subject, body: o.body, audience: structuredClone(o.audience), status: "Draft", createdAt: TODAY, createdBy: by, events: [{ at: TODAY, text: `Copied from ${o.id}` }] };
    campaigns.unshift(c); return lag(c, 250);
  },
  async remove(id: string) { const c = find(id); if (c.status !== "Draft") throw new Error("Only drafts can be deleted"); campaigns.splice(campaigns.indexOf(c), 1); return lag(true, 200); },
};
