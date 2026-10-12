import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().min(1, "Enter your email address").email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

const password = z
  .string()
  .min(8, "At least 8 characters")
  .regex(/[A-Z]/, "One uppercase letter")
  .regex(/[0-9]/, "One number");

export const passwordRules = [
  { label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { label: "One uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { label: "One number", test: (v: string) => /[0-9]/.test(v) },
];

export const signUpSchema = z
  .object({
    first: z.string().min(1, "Enter your first name"),
    last: z.string().min(1, "Enter your last name"),
    email: z.string().min(1, "Enter your work email").email("Enter a valid email address"),
    password,
    confirm: z.string().min(1, "Confirm your password"),
    terms: z.literal(true, { error: "Accept the terms to continue" }),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export const resetSchema = z
  .object({ password, confirm: z.string().min(1, "Confirm your password") })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export const forgotSchema = z.object({
  email: z.string().min(1, "Enter your email address").email("Enter a valid email address"),
});

export const practiceSchema = z.object({
  name: z.string().min(2, "Enter the practice name"),
  type: z.string().min(1, "Select a practice type"),
});
export const practiceDetailsSchema = z.object({
  location: z.string().min(2, "Enter a location"),
  phone: z.string().min(7, "Enter a phone number"),
  timezone: z.string().min(1),
  owner: z.string().min(2, "Enter the primary provider"),
  providers: z.string().min(1),
});

export const patientSchema = z.object({
  first: z.string().min(1, "First name is required"),
  last: z.string().min(1, "Last name is required"),
  dob: z.string().refine((v) => !v || new Date(v) < new Date("2026-10-08"), "Date of birth must be in the past"),
  phone: z.string().min(7, "Enter a valid phone number"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  gender: z.string().optional(),
  address: z.string().optional(),
  emergency: z.string().optional(),
  providerId: z.string().optional(),
  notes: z.string().optional(),
  portrait: z.string().optional(),
});

export const appointmentSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  providerId: z.string().min(1, "Select a provider"),
  serviceId: z.string().min(1, "Select a service"),
  date: z.string().min(1, "Select a date"),
  time: z.string().min(1, "Select a time"),
  duration: z.coerce.number().min(10, "Duration is required"),
  locationId: z.string().min(1, "Select a location"),
  roomId: z.string().min(1, "Select a room"),
  notes: z.string().optional(),
});
export type AppointmentInput = z.infer<typeof appointmentSchema>;
export type PatientInput = z.infer<typeof patientSchema>;
