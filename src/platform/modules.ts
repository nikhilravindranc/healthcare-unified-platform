import { CalendarCheck, Contact, Megaphone, Stethoscope, type LucideIcon } from "lucide-react";
import type { PermKey } from "@/lib/clinical";

export interface ModuleNavItem { href: string; label: string; icon: LucideIcon }
export interface ModuleDef {
  id: "pms" | "crm" | "booking" | "campaigns";
  label: string; blurb: string; icon: LucideIcon;
  /** Landing route. PMS keeps its existing top-level routes for now. */
  href: string;
  /** Any one of these permissions shows the module. PMS uses per-page perms instead. */
  perms?: PermKey[];
  status: "live" | "skeleton";
}
export const MODULES: ModuleDef[] = [
  { id: "pms", label: "Practice", blurb: "Patients, visits, billing", icon: Stethoscope, href: "/overview", status: "live" },
  { id: "crm", label: "CRM", blurb: "Leads, contacts, pipeline", icon: Contact, href: "/crm", perms: ["crm"], status: "skeleton" },
  { id: "booking", label: "Booking", blurb: "Online booking engine", icon: CalendarCheck, href: "/booking", perms: ["booking", "booking_view"], status: "skeleton" },
  { id: "campaigns", label: "Campaigns", blurb: "Email and SMS campaigns", icon: Megaphone, href: "/campaigns", perms: ["campaigns", "insights"], status: "skeleton" },
];
export const PLATFORM_MODULES = MODULES.filter((m) => m.id !== "pms");
