import { api } from "@/lib/db";
import type { Patient } from "@/lib/types";
import type { Contact } from "./contact";

/** Interim demo adapter: derives Contacts from PMS patients. Not a statement about long-term ownership. */
export function patientToContact(p: Patient): Contact {
  return {
    id: "C-" + p.id.slice(2), first: p.first, last: p.last, email: p.email, phone: p.phone, dob: p.dob,
    tags: p.tags ?? [], source: "pms",
    consents: [{ channel: "email", purpose: "marketing", status: p.marketingConsent ? "granted" : "withdrawn", at: "2026-01-01", source: "PMS intake" }],
    links: { patientId: p.id }, createdAt: "2026-01-01",
  };
}
export const contactsApi = { list: async () => (await api.patients()).map(patientToContact) };
