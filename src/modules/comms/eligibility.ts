import type { Channel, Purpose } from "./types";

/**
 * Who may be sent what. Pure and shared by the message composer and Campaign audiences, so both follow one rule.
 *
 *  - Marketing needs an explicit positive consent for the channel. "Not recorded" and "withdrawn" both block it.
 *    The data model stores a single email-marketing decision on the patient, so there is no SMS marketing consent
 *    for anyone, and SMS marketing is always blocked until that is recorded.
 *  - Service messages (about a person's own enquiry or appointment) do not need marketing consent, but they
 *    need a way to reach the person and must not contain promotional content.
 *  - Calls are only logged, never sent.
 */
export interface Reach { email: boolean; phone: boolean }
export interface ConsentState { status: "granted" | "withdrawn" | "not-recorded" }
export interface Eligibility { eligible: boolean; reasons: string[]; basis: string }

export const REASON = {
  noEmail: "No email address on record",
  noPhone: "No phone number on record",
  notRecorded: "No marketing consent recorded",
  withdrawn: "Marketing consent withdrawn",
  noSmsConsent: "No SMS marketing consent is recorded (only email marketing consent is stored)",
} as const;

export function checkEligibility(input: { channel: Channel; purpose: Purpose; reach: Reach; consent: ConsentState }): Eligibility {
  const { channel, purpose, reach, consent } = input;
  if (channel === "call") return { eligible: true, reasons: [], basis: "A call is only logged here. Nothing is sent." };
  const reasons: string[] = [];
  if (channel === "email" && !reach.email) reasons.push(REASON.noEmail);
  if (channel === "sms" && !reach.phone) reasons.push(REASON.noPhone);
  if (purpose === "marketing") {
    if (channel === "sms") reasons.push(REASON.noSmsConsent);
    else if (consent.status === "withdrawn") reasons.push(REASON.withdrawn);
    else if (consent.status !== "granted") reasons.push(REASON.notRecorded);
  }
  const basis = purpose === "marketing" ? "Marketing: needs explicit consent for this channel." : "Service message about this person's own enquiry or appointment. No promotional content.";
  return { eligible: reasons.length === 0, reasons, basis };
}

/** A patient's stored yes/no, as a consent state. A missing value is "not recorded", never a yes. */
export const consentFromFlag = (flag?: boolean): ConsentState => ({ status: flag === undefined ? "not-recorded" : flag ? "granted" : "withdrawn" });

/** SMS segments are 160 characters. Only a hint for the composer, not a delivery rule. */
export const SMS_LIMIT = 320;
