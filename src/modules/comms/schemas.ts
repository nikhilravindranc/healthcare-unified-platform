import { z } from "zod";
import { SMS_LIMIT } from "./eligibility";
import { CHANNELS } from "./types";

export const composerSchema = z.object({
  channel: z.enum(CHANNELS),
  direction: z.enum(["incoming", "outgoing"]),
  purpose: z.enum(["service", "marketing"]),
  subject: z.string().trim().max(120, "Keep the subject under 120 characters"),
  body: z.string().trim().min(3, "Write the message").max(1500, "Keep the message under 1500 characters"),
}).superRefine((v, ctx) => {
  if (v.channel === "email" && v.direction === "outgoing" && v.subject.length < 3) ctx.addIssue({ code: "custom", path: ["subject"], message: "Add a subject for the email" });
  if (v.channel === "sms" && v.body.length > SMS_LIMIT) ctx.addIssue({ code: "custom", path: ["body"], message: `SMS is limited to ${SMS_LIMIT} characters here` });
});
export type ComposerInput = z.infer<typeof composerSchema>;
