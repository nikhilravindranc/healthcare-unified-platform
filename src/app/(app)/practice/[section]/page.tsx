"use client";
import { Suspense, use } from "react";
import Link from "next/link";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import { UsersRound, Layers, Package, MapPin, FileText, Plug, Settings as Cog, Palette, type LucideIcon } from "lucide-react";
import { PageHeader, Segmented } from "@/components/ui";
import { ThemesSection } from "@/components/practice/themes";
import { Integrations, LocationsSection, ProvidersSection, RoomsSection, ServicesSection, UsersSection } from "@/components/practice/config";
import { InventorySection } from "@/components/practice/inventory";
import { FormsSection } from "@/components/practice/forms";
import { SettingsSection } from "@/components/practice/settings";
import { Denied } from "@/components/patient/shared";
import { useRole } from "@/lib/hooks";
import type { PermKey } from "@/lib/clinical";
import { cn } from "@/lib/utils";

const NAV: [string, string, PermKey | undefined, LucideIcon, string][] = [
  ["team", "Team", "config", UsersRound, "Providers, users and permissions"], ["services", "Services & treatments", "config", Layers, "What you offer and for how long"], ["inventory", "Inventory", "inventory", Package, "Stock and supplies"], ["locations", "Locations & rooms", "config", MapPin, "Sites, rooms and resources"],
  ["forms", "Forms", "config", FileText, "Intake and consent forms"], ["integrations", "Integrations", "config", Plug, "Connected tools and modules"], ["themes", "Themes", "settings", Palette, "Colours for your practice"], ["settings", "Settings", "settings", Cog, "Practice rules and preferences"],
];
/** Older links keep working. */
const ALIAS: Record<string, string> = { providers: "team", users: "team", rooms: "locations" };

export default function PracticePage({ params }: { params: Promise<{ section: string }> }) {
  return <Suspense><Practice raw={use(params).section} /></Suspense>;
}

function Practice({ raw }: { raw: string }) {
  const section = ALIAS[raw] ?? raw;
  const { can } = useRole();
  const router = useRouter();
  const sp = useSearchParams();
  if (!NAV.some(([k]) => k === section)) notFound();
  const [, title, perm] = NAV.find(([k]) => k === section)!;
  const view = raw === "users" ? "users" : sp.get("v") === "users" ? "users" : "providers";
  return (
    <>
      <PageHeader title={title} subtitle="Practice configuration" />
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Practice configuration" className="flex gap-2 overflow-x-auto pb-1 lg:sticky lg:top-24 lg:flex-col lg:gap-1 lg:self-start lg:overflow-visible lg:rounded-2xl lg:border lg:border-line lg:bg-white lg:p-2 lg:shadow-card">
          {NAV.filter(([, , p]) => !p || can(p)).map(([k, l, , Icon, hint]) => { const on = k === section; return (
            <Link key={k} href={`/practice/${k}`} aria-current={on ? "page" : undefined} className={cn("group relative flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors", on ? "bg-active text-primary ring-1 ring-primary/15 lg:before:absolute lg:before:-left-2 lg:before:top-2.5 lg:before:h-7 lg:before:w-1 lg:before:rounded-r-full lg:before:bg-primary" : "text-slate-700 hover:bg-cloud")}>
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg transition-colors", on ? "bg-primary text-white shadow-sm" : "bg-cloud text-slate-500 group-hover:bg-white")}><Icon className="size-[18px]" strokeWidth={1.8} aria-hidden /></span>
              <span className="min-w-0"><span className={cn("block whitespace-nowrap text-[13.5px] leading-tight", on ? "font-semibold" : "font-medium")}>{l}</span><span className="mt-0.5 hidden text-xs leading-snug text-muted lg:block">{hint}</span></span>
            </Link>); })}
        </nav>
        <div className="min-w-0 space-y-5">
          {perm && !can(perm) ? <Denied what={title.toLowerCase()} /> : (
            <>
              {section === "team" && (
                <>
                  <Segmented label="Team view" value={view} onChange={(v) => router.replace(`/practice/team?v=${v}`, { scroll: false })} options={[{ value: "providers", label: "Providers" }, { value: "users", label: "Users & permissions" }]} />
                  {view === "providers" ? <ProvidersSection /> : <UsersSection />}
                </>
              )}
              {section === "services" && <ServicesSection />}
              {section === "inventory" && <InventorySection />}
              {section === "locations" && <><LocationsSection /><RoomsSection /></>}
              {section === "forms" && <FormsSection />}
              {section === "integrations" && <Integrations />}
              {section === "themes" && <ThemesSection />}
              {section === "settings" && <SettingsSection />}
            </>)}
        </div>
      </div>
    </>
  );
}
