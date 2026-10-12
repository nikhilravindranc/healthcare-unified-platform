/**
 * Campaign audience preview. Pure.
 * Everyone matching the filters is "matched". Only people who pass the shared marketing-eligibility rule
 * (explicit consent for the channel, and a way to reach them) are "eligible". The rest are excluded with a reason.
 */
import { checkEligibility } from "../comms/eligibility";
import type { CrmContact } from "../crm/contacts";
import type { AudienceCriteria, CampaignChannel } from "./types";

export interface ExcludedContact { contact: CrmContact; reasons: string[] }
export interface AudiencePreview {
  matched: CrmContact[];
  eligible: CrmContact[];
  excluded: ExcludedContact[];
  /** How many matched people each reason applies to. A person can have more than one reason. */
  reasonCounts: Record<string, number>;
}

export function matchesCriteria(c: CrmContact, a: AudienceCriteria): boolean {
  return (a.stages.length === 0 || a.stages.includes(c.stage)) && (a.sources.length === 0 || a.sources.includes(c.firstTouch.source));
}

export function previewAudience(contacts: CrmContact[], criteria: AudienceCriteria, channel: CampaignChannel): AudiencePreview {
  const matched = contacts.filter((c) => matchesCriteria(c, criteria));
  const eligible: CrmContact[] = [], excluded: ExcludedContact[] = [], reasonCounts: Record<string, number> = {};
  for (const c of matched) {
    const r = checkEligibility({ channel, purpose: "marketing", reach: c.reach, consent: c.consent });
    if (r.eligible) eligible.push(c);
    else { excluded.push({ contact: c, reasons: r.reasons }); r.reasons.forEach((x) => { reasonCounts[x] = (reasonCounts[x] ?? 0) + 1; }); }
  }
  return { matched, eligible, excluded, reasonCounts };
}

/** The ids a simulated run is recorded against: the patient when there is one, otherwise the enquiry. */
export function recipientRefs(eligible: CrmContact[]) {
  return eligible.map((c) => (c.kind === "patient" ? { patientId: c.patientId, enquiryId: c.enquiries[0]?.id } : { enquiryId: c.enquiries[0]?.id }));
}
