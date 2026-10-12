import { addDays, TODAY } from "@/lib/db";
import type { Enquiry, EnquirySource, EnquiryStatus } from "./types";

/** Synthetic sample enquiries. Names, numbers and addresses are fictional. */
const FIRST = ["Maya", "Liam", "Sofia", "Noah", "Ava", "Ethan", "Isla", "Lucas", "Zoe", "Owen", "Chloe", "Henry", "Nina", "Caleb", "Ruth", "Jonah", "Tessa", "Felix", "Mira", "Arlo"];
const LAST = ["Alvarez", "Brennan", "Castillo", "Dunn", "Ellison", "Frost", "Gupta", "Hayes", "Ibrahim", "Jensen", "Kowalski", "Larsen", "Mendes", "Novak", "Okafor", "Price", "Quinn", "Reeves", "Soto", "Tran"];
const SERVICES = ["consult", "skin", "inject", "physio", "dental", "followup", "review"];
const SOURCES: EnquirySource[] = ["Website form", "Website form", "Phone call", "Phone call", "Walk-in", "Patient referral", "Social media", "Campaign", "Campaign"];
const CAMPAIGNS = ["Autumn skin refresh", "New patient welcome", "Winter wellness check"];
const USERS = ["u2", "u5", "u5", "u2", ""];
const NOTES = ["Asked about availability next week.", "Prefers afternoon appointments.", "Wants pricing information first.", "Referred by a friend of the practice.", "Asked about the first-visit process.", ""];
const rnd = (n: number) => { const x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x); };
const pick = <T,>(a: T[], n: number) => a[Math.floor(rnd(n) * a.length)];

function build(i: number): Enquiry {
  const age = Math.floor(rnd(i + 1) * rnd(i + 2) * 90 + (i < 6 ? 0 : 1)); // skews recent
  const received = addDays(TODAY, -age);
  const source = pick(SOURCES, i + 5);
  const old = age > 14, mid = age > 4;
  const r = rnd(i + 9);
  const status: EnquiryStatus = old ? (r < 0.45 ? "Appointment booked" : r < 0.62 ? "Closed" : "Not converted")
    : mid ? (r < 0.3 ? "Appointment booked" : r < 0.65 ? "Contacted" : r < 0.8 ? "Not converted" : "New")
    : (r < 0.5 ? "New" : r < 0.85 ? "Contacted" : "Appointment booked");
  const first = pick(FIRST, i + 13), last = pick(LAST, i + 17);
  const open = status === "New" || status === "Contacted";
  const assigneeId = pick(USERS, i + 21) || undefined;
  const e: Enquiry = {
    id: `E-${1001 + i}`, name: `${first} ${last}`,
    phone: rnd(i + 3) > 0.15 ? `(415) 555-${String(1000 + ((i * 37) % 900))}` : undefined,
    email: rnd(i + 4) > 0.3 ? `${first}.${last}@example.com`.toLowerCase() : undefined,
    serviceId: rnd(i + 6) > 0.12 ? pick(SERVICES, i + 7) : undefined,
    source, campaign: source === "Campaign" ? pick(CAMPAIGNS, i + 8) : undefined,
    received, status, assigneeId,
    notes: pick(NOTES, i + 11),
    tasks: [], history: [{ id: `h${i}a`, at: received, text: `Enquiry received via ${source.toLowerCase()}` }],
  };
  if (!e.phone && !e.email) e.email = `${first}.${last}@example.com`.toLowerCase();
  if (status !== "New") e.history.push({ id: `h${i}b`, at: addDays(received, 1), text: "Marked as contacted" });
  if (status === "Appointment booked") e.history.push({ id: `h${i}c`, at: addDays(received, 2), text: "Appointment booked" });
  if (status === "Not converted") e.history.push({ id: `h${i}d`, at: addDays(received, 3), text: "Marked as not converted" });
  if (open) e.tasks.push({ id: `t${i}`, due: addDays(TODAY, Math.floor(rnd(i + 31) * 8) - 2), note: status === "New" ? "Make first contact" : "Follow up on questions", assigneeId, done: false });
  return e;
}
export const enquiries: Enquiry[] = Array.from({ length: 48 }, (_, i) => build(i)).sort((a, b) => b.received.localeCompare(a.received));
