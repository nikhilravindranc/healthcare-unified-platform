import { z } from "zod";

/** What a person tells us when booking online. No clinical details are collected. */
export const bookingDetailsSchema = z.object({
  returning: z.boolean(),
  first: z.string().trim().min(1, "Enter your first name"),
  last: z.string().trim().min(1, "Enter your last name"),
  email: z.string().trim().min(1, "Enter your email address").email("Enter a valid email address"),
  phone: z.string().trim().refine((v) => v.replace(/\D/g, "").length >= 7, "Enter a valid phone number"),
  notes: z.string().trim().max(300, "Keep this under 300 characters"),
  /** Only used for a new patient. It is an explicit, optional opt-in and defaults to off. */
  marketingOptIn: z.boolean(),
});
export type BookingDetails = z.infer<typeof bookingDetailsSchema>;

export const manageLookupSchema = z.object({
  reference: z.string().trim().min(3, "Enter your booking reference"),
  email: z.string().trim().min(1, "Enter the email you booked with").email("Enter a valid email address"),
});
export type ManageLookup = z.infer<typeof manageLookupSchema>;
