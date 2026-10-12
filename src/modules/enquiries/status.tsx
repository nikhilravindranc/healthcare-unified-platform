import { Badge } from "@/components/ui";
import type { EnquiryStatus } from "./types";

const TONE: Record<EnquiryStatus, Parameters<typeof Badge>[0]["tone"]> = { New: "lavender", Contacted: "blue", "Appointment booked": "mint", Closed: "neutral", "Not converted": "peach" };
export const EnquiryStatusBadge = ({ s }: { s: EnquiryStatus }) => <Badge tone={TONE[s]}>{s}</Badge>;
export const isOpen = (s: EnquiryStatus) => s === "New" || s === "Contacted";
