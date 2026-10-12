import type { Message } from "./types";

/** Messages that belong to this person: those on the enquiry, plus any recorded against the linked patient. */
export const messagesFor = (all: Message[], s: { enquiryId?: string; enquiryIds?: string[]; patientId?: string }) => {
  const ids = new Set([s.enquiryId, ...(s.enquiryIds ?? [])].filter(Boolean));
  return all.filter((m) => (m.enquiryId && ids.has(m.enquiryId)) || (s.patientId && m.patientId === s.patientId)).sort((a, b) => b.at.localeCompare(a.at));
};

