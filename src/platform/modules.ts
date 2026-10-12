import { CalendarCheck, Contact, LineChart, Megaphone, Stethoscope, type LucideIcon } from "lucide-react";
import type { PermKey } from "@/lib/clinical";

export interface ModuleDef {
  id: "pms" | "crm" | "booking" | "campaigns";
  label: string; blurb: string; icon: LucideIcon;
  /** Landing route. PMS keeps its existing top-level routes for now. */
  href: string;
  /** Any one of these permissions shows the module. PMS uses per-page perms instead. */
  perms?: PermKey[];
  /** Optional modules can be switched off per clinic (Practice > Integrations). */
  optional?: boolean;
  status: "live" | "preview";
}
export const MODULES: ModuleDef[] = [
  { id: "pms", label: "Practice", blurb: "Patients, visits, billing", icon: Stethoscope, href: "/overview", status: "live" },
  { id: "crm", label: "CRM", blurb: "Leads, contacts, pipeline", icon: Contact, href: "/crm", perms: ["crm"], optional: true, status: "preview" },
  { id: "booking", label: "Online Bookings", blurb: "Online booking engine", icon: CalendarCheck, href: "/booking", perms: ["booking", "booking_view"], optional: true, status: "preview" },
  { id: "campaigns", label: "Campaigns", blurb: "Email and SMS campaigns", icon: Megaphone, href: "/campaigns", perms: ["campaigns", "insights"], optional: true, status: "preview" },
];

export interface GrowthNavItem { href: string; label: string; icon: LucideIcon; perms: PermKey[]; module?: ModuleDef["id"] }
/** Healthcare-facing "Growth & Engagement" entries. They reuse the module routes where one exists. */
export const GROWTH_NAV: GrowthNavItem[] = [
  { href: "/marketing-insights", label: "Marketing Insights", icon: LineChart, perms: ["insights"] },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone, perms: ["campaigns", "insights"], module: "campaigns" },
  { href: "/booking", label: "Online Bookings", icon: CalendarCheck, perms: ["booking", "booking_view"], module: "booking" },
];
/** Standalone modules reached from the account menu rather than the everyday clinic nav. */
export const SWITCHER_MODULES = MODULES.filter((m) => m.id === "crm");

export const moduleEnabled = (id: ModuleDef["id"], modules: Record<string, boolean>) => !MODULES.find((m) => m.id === id)?.optional || modules[id] !== false;
