import type { Campaign } from "./types";

/**
 * Sample campaigns. The names match the campaign names already used for enquiry attribution in the sample data.
 * The figures on the simulated one are SAMPLE DATA, not results. Nothing here was ever sent.
 */
export const campaigns: Campaign[] = [
  {
    id: "C-1001", name: "Autumn skin refresh", channel: "email", subject: "Refresh your skin this autumn", body: "Hello, we are offering a skin consultation this autumn. Reply to this email or call us to book a time that suits you.",
    audience: { stages: ["Active patient"], sources: [] }, status: "Simulated", createdAt: "2026-09-10", createdBy: "Marketing team", simulatedAt: "2026-09-20",
    sample: { delivered: 7, opened: 4, clicked: 2, replied: 1 }, events: [{ at: "2026-09-10", text: "Created" }, { at: "2026-09-20", text: "Run in demo mode (nothing was sent)" }],
  },
  {
    id: "C-1002", name: "New patient welcome", channel: "email", subject: "Welcome to the practice", body: "Welcome. Here is what to expect at your first visit, and how to reach us if you have questions.",
    audience: { stages: ["Appointment booked"], sources: [] }, status: "Scheduled", scheduledFor: "2026-10-20", createdAt: "2026-10-01", createdBy: "Marketing team", events: [{ at: "2026-10-01", text: "Created" }, { at: "2026-10-02", text: "Scheduled for 2026-10-20 (demo, nothing will be sent)" }],
  },
  {
    id: "C-1003", name: "Winter wellness check", channel: "sms", subject: "", body: "Book your winter wellness check with us. Reply STOP to opt out.",
    audience: { stages: [], sources: [] }, status: "Draft", createdAt: "2026-10-05", createdBy: "Marketing team", events: [{ at: "2026-10-05", text: "Created" }],
  },
];
