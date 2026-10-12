import { z } from "zod";
import { CONTACT_STAGES } from "../crm/contacts";
import { SMS_LIMIT } from "../comms/eligibility";
import { CAMPAIGN_CHANNELS } from "./types";

export const campaignSchema = z.object({
  name: z.string().trim().min(3, "Give the campaign a name").max(80, "Keep the name under 80 characters"),
  channel: z.enum(CAMPAIGN_CHANNELS),
  subject: z.string().trim().max(120, "Keep the subject under 120 characters"),
  body: z.string().trim().min(10, "Write the message").max(1500, "Keep the message under 1500 characters"),
  stages: z.array(z.enum(CONTACT_STAGES)),
  sources: z.array(z.string()),
  scheduledFor: z.string(),
}).superRefine((v, ctx) => {
  if (v.channel === "email" && v.subject.length < 3) ctx.addIssue({ code: "custom", path: ["subject"], message: "Add a subject for the email" });
  if (v.channel === "sms" && v.body.length > SMS_LIMIT) ctx.addIssue({ code: "custom", path: ["body"], message: `SMS is limited to ${SMS_LIMIT} characters here` });
});
export type CampaignInput = z.infer<typeof campaignSchema>;
