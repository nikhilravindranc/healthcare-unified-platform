import { Badge } from "@/components/ui";
import type { ContactStage } from "./contacts";

const TONE: Record<ContactStage, Parameters<typeof Badge>[0]["tone"]> = {
  Prospect: "lavender", "Not converted": "peach", "Appointment booked": "mint", "Active patient": "blue", "Lapsed patient": "neutral", "Patient, no activity": "neutral",
};
export const StageBadge = ({ s }: { s: ContactStage }) => <Badge tone={TONE[s]}>{s}</Badge>;
