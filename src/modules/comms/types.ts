/**
 * Communication history (frontend demo model). Nothing here is delivered anywhere.
 * An outgoing message created in the app is only ever "simulated": the UI must never say sent or delivered.
 */
export const CHANNELS = ["email", "sms", "call"] as const;
export type Channel = (typeof CHANNELS)[number];
export const CHANNEL_LABEL: Record<Channel, string> = { email: "Email", sms: "SMS", call: "Phone call" };

export type Direction = "incoming" | "outgoing";
/** draft: saved, not sent. simulated: demo send, not delivered. received: an incoming message that was logged. logged: a call that was logged. */
export type MessageStatus = "draft" | "simulated" | "received" | "logged";
export const STATUS_LABEL: Record<MessageStatus, string> = { draft: "Draft, not sent", simulated: "Demo only, not delivered", received: "Received (logged)", logged: "Call logged" };

/** service: about the person's own enquiry or appointment. marketing: promotional, needs explicit consent. Kept apart on purpose. */
export type Purpose = "service" | "marketing";

export interface Message {
  id: string;
  channel: Channel;
  direction: Direction;
  status: MessageStatus;
  purpose: Purpose;
  subject?: string;
  body: string;
  /** YYYY-MM-DD. The demo has no real timestamps. */
  at: string;
  by?: string;
  enquiryId?: string;
  patientId?: string;
  appointmentId?: string;
  campaignId?: string;
}
