import type { PermKey } from "@/lib/clinical";

export type Category = "clinic" | "patients" | "acquisition" | "services" | "capacity" | "financials";
export const CATEGORY_LABEL: Record<Category, string> = { clinic: "Clinic", patients: "Patients", acquisition: "Acquisition", services: "Services", capacity: "Capacity", financials: "Financials" };

export interface InsightDef { slug: string; title: string; category: Category; question: string; perms: PermKey[]; /** Also needed, for money. */ needs?: PermKey; priority: 1 | 2; state: "available" | "unavailable"; unavailableWhy?: string }
/** The catalogue. Only insights the records can honestly support are available. Others say why not. */
export const INSIGHTS: InsightDef[] = [
  { slug: "clinic", title: "Clinic overview", category: "clinic", question: "How is the clinic day-to-day: bookings, attendance, visits, follow-ups and exceptions?", perms: ["reports"], priority: 1, state: "available" },
  { slug: "appointments", title: "Appointment analytics", category: "clinic", question: "How many appointments are booked, confirmed, attended, cancelled or missed, and when is demand?", perms: ["reports"], priority: 1, state: "available" },
  { slug: "patients", title: "Patient analytics", category: "patients", question: "Who is new or returning, how often do patients come, who rebooks, and who has gone quiet?", perms: ["reports"], priority: 1, state: "available" },
  { slug: "marketing", title: "Marketing Insights", category: "acquisition", question: "Where do enquiries come from and how many become appointments?", perms: ["insights"], priority: 1, state: "available" },
  { slug: "services", title: "Service & treatment analytics", category: "services", question: "Which services are in demand, and how do bookings, cancellations and completed visits compare?", perms: ["reports"], priority: 1, state: "available" },
  { slug: "capacity", title: "Provider & capacity analytics", category: "capacity", question: "How much of each provider's available time is booked?", perms: ["reports"], priority: 2, state: "available" },
  { slug: "financial", title: "Financial analytics", category: "financials", question: "What was invoiced, collected, refunded and is still outstanding?", perms: ["reports"], needs: "financials", priority: 2, state: "available" },
  { slug: "continuity", title: "Follow-up & care continuity analytics", category: "clinic", question: "Are follow-ups getting done, and do patients rebook after a visit?", perms: ["reports"], priority: 2, state: "available" },
  { slug: "inventory", title: "Inventory analytics", category: "services", question: "How fast is stock used and when will it run low?", perms: ["reports"], priority: 2, state: "unavailable", unavailableWhy: "The demo has only a few stock movements, not enough history to say anything reliable about usage rates." },
];
export const bySlug = (s: string) => INSIGHTS.find((i) => i.slug === s);
