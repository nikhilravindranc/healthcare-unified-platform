import { demoEnquiries } from "@/lib/db";
import type { Message } from "./types";

/**
 * Sample communication history, built from the sample enquiries. It only contains what the enquiry data supports:
 * how the enquiry arrived (website form or phone), and a service reply for enquiries that have been contacted.
 * Outgoing replies are "simulated": this is a demo and nothing was delivered.
 */
function seed(): Message[] {
  const out: Message[] = [];
  demoEnquiries.forEach((e) => {
    const base = { enquiryId: e.id, patientId: e.patientId };
    if (e.source === "Website form") out.push({ ...base, id: `m-${e.id}-in`, channel: "email", direction: "incoming", status: "received", purpose: "service", subject: "Website enquiry", body: "Enquiry submitted through the website form.", at: e.received });
    if (e.source === "Phone call") out.push({ ...base, id: `m-${e.id}-call`, channel: "call", direction: "incoming", status: "logged", purpose: "service", body: "Enquiry received by phone.", at: e.received });
    if (e.status !== "New" && (e.email || e.phone)) {
      const email = !!e.email;
      out.push({
        ...base, id: `m-${e.id}-out`, channel: email ? "email" : "sms", direction: "outgoing", status: "simulated", purpose: "service", by: "Front desk",
        subject: email ? "Re: your enquiry" : undefined, body: "Thank you for getting in touch. We would be happy to help. Please reply with a good time to talk.", at: e.history.find((h) => /contacted/i.test(h.text))?.at ?? e.received,
      });
    }
  });
  return out;
}
export const messages: Message[] = seed();
