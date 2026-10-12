"use client";
import { Suspense, use } from "react";
import Link from "next/link";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import { PageHeader, Segmented } from "@/components/ui";
import { Integrations, LocationsSection, ProvidersSection, RoomsSection, ServicesSection, UsersSection } from "@/components/practice/config";
import { InventorySection } from "@/components/practice/inventory";
import { FormsSection } from "@/components/practice/forms";
import { SettingsSection } from "@/components/practice/settings";
import { Denied } from "@/components/patient/shared";
import { useRole } from "@/lib/hooks";
import type { PermKey } from "@/lib/clinical";
import { cn } from "@/lib/utils";

const NAV: [string, string, PermKey?][] = [
  ["team", "Team", "config"], ["services", "Services & treatments", "config"], ["inventory", "Inventory", "inventory"], ["locations", "Locations & rooms", "config"],
  ["forms", "Forms", "config"], ["integrations", "Integrations", "config"], ["settings", "Settings", "settings"],
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
      <div className="grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
        <nav aria-label="Practice configuration" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {NAV.filter(([, , p]) => !p || can(p)).map(([k, l]) => (
            <Link key={k} href={`/practice/${k}`} aria-current={k === section ? "page" : undefined} className={cn("whitespace-nowrap rounded-lg px-3 py-2 text-[13.5px] font-medium", k === section ? "bg-active text-primary" : "text-slate-600 hover:bg-cloud")}>{l}</Link>
          ))}
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
              {section === "settings" && <SettingsSection />}
            </>)}
        </div>
      </div>
    </>
  );
}
