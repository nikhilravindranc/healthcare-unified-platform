import { z } from "zod";
import { ENQUIRY_SOURCES } from "./types";

export const enquirySchema = z.object({
  name: z.string().trim().min(2, "Enter the contact's name"),
  phone: z.string().trim().refine((v) => !v || v.replace(/\D/g, "").length >= 7, "Enter a valid phone number"),
  email: z.string().trim().refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email address"),
  serviceId: z.string(),
  source: z.enum(ENQUIRY_SOURCES, { error: "Select where the enquiry came from" }),
  assigneeId: z.string(),
  notes: z.string().max(500, "Keep notes under 500 characters"),
  nextFollowUp: z.string(),
}).refine((v) => v.phone || v.email, { path: ["phone"], message: "Enter a phone number or an email address" });
export type EnquiryInput = z.infer<typeof enquirySchema>;

export const taskSchema = z.object({
  due: z.string().min(1, "Choose a due date"),
  note: z.string().trim().min(2, "Describe the next action"),
  assigneeId: z.string(),
});
export type TaskInput = z.infer<typeof taskSchema>;
