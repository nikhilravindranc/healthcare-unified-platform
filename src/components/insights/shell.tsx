"use client";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui";
import { TODAY } from "@/lib/db";
import { useRefs, useRole } from "@/lib/hooks";
import { RANGES, rangeFor, type Filters, type RangeKey } from "@/lib/insights";
import { cn } from "@/lib/utils";
import { CATEGORY_LABEL, INSIGHTS, type Category } from "./catalogue";

/** Filters live in the address, so an insight can be shared, bookmarked and reopened as it was. */
export function useInsightFilters(): { key: RangeKey; filters: Filters; provider: string; service: string; location: string; set: (p: Record<string, string>) => void } {
  const sp = useSearchParams(); const router = useRouter(); const path = usePathname();
  const raw = sp.get("range") ?? "30"; const key = (raw in RANGES ? raw : "30") as RangeKey;
  const location = sp.get("location") ?? ""; const provider = sp.get("provider") ?? ""; const service = sp.get("service") ?? "";
  const r = rangeFor(key, TODAY);
  const set = (p: Record<string, string>) => { const n = new URLSearchParams(sp.toString()); Object.entries(p).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); router.replace(`${path}${n.size ? `?${n}` : ""}`, { scroll: false }); };
  return { key, filters: { ...r, locationId: location || undefined, providerId: provider || undefined, serviceId: service || undefined }, provider, service, location, set };
}

/** Category tabs inside Insights. They are links, so each one is a real address and Back works. */
export function InsightsNav({ active, query }: { active: Category | "overview"; query: string }) {
  const { can } = useRole();
  const cats = (Object.keys(CATEGORY_LABEL) as Category[]).filter((c) => INSIGHTS.some((i) => i.category === c && i.perms.some(can)));
  const first = (c: Category) => INSIGHTS.find((i) => i.category === c && i.perms.some(can))!.slug;
  const tab = (href: string, label: string, on: boolean) => (
    <Link key={label} href={href} aria-current={on ? "page" : undefined} className={cn("relative whitespace-nowrap px-3 py-2.5 text-sm font-medium after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40", on ? "text-primary after:bg-primary" : "text-muted hover:text-ink")}>{label}</Link>);
  return <nav aria-label="Insight categories" className="scroll-thin mb-5 flex overflow-x-auto border-b border-line">{tab(`/analytics${query}`, "Overview", active === "overview")}{cats.map((c) => tab(`/analytics/${first(c)}${query}`, CATEGORY_LABEL[c], active === c))}</nav>;
}

export function FilterBar({ f, show = { location: true, provider: false, service: false }, ranges }: { f: ReturnType<typeof useInsightFilters>; show?: { location?: boolean; provider?: boolean; service?: boolean }; ranges?: RangeKey[] }) {
  const { data: refs } = useRefs();
  const keys = (ranges ?? (Object.keys(RANGES) as RangeKey[]));
  return (
    <div role="group" aria-label="Insight filters" className="mb-5 flex flex-wrap items-center gap-2">
      <Select sm className="w-40" aria-label="Date range" value={f.key} onChange={(e) => f.set({ range: e.target.value === "30" ? "" : e.target.value })}>{keys.map((k) => <option key={k} value={k}>{RANGES[k]}</option>)}</Select>
      {show.location && <Select sm className="w-44" aria-label="Location" value={f.location} onChange={(e) => f.set({ location: e.target.value })}><option value="">All locations</option>{refs?.locations.map((l) => <option key={l.id} value={l.id}>{l.name.replace("Brightwell ", "")}</option>)}</Select>}
      {show.provider && <Select sm className="w-40" aria-label="Provider" value={f.provider} onChange={(e) => f.set({ provider: e.target.value })}><option value="">All providers</option>{refs?.providers.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}</Select>}
      {show.service && <Select sm className="w-48" aria-label="Service" value={f.service} onChange={(e) => f.set({ service: e.target.value })}><option value="">All services</option>{refs?.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}
      <span className="text-xs text-muted">{f.filters.from} to {f.filters.to}</span>
    </div>
  );
}

/** One number with what it means. The definition is always visible, so nobody has to guess the denominator. */
export function Metric({ label, value, def, href, tone }: { label: string; value: React.ReactNode; def: string; href?: string; tone?: "attention" }) {
  const body = (<><span className="block text-[12px] font-medium text-muted">{label}</span><span className={cn("mt-1 block text-[26px] font-semibold leading-none tracking-tight tabular-nums", tone === "attention" && "text-[#7A4B00]")}>{value}</span><span className="mt-1.5 block text-[12px] leading-snug text-muted">{def}</span></>);
  return href ? <Link href={href} className="block min-w-0 rounded-lg px-1 py-1 hover:bg-cloud focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">{body}</Link> : <div className="min-w-0 px-1 py-1">{body}</div>;
}
export const MetricRow = ({ children }: { children: React.ReactNode }) => <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 border-b border-line pb-6 sm:grid-cols-3 lg:grid-cols-4">{children}</div>;
export const Section = ({ title, sub, children, action }: { title: string; sub?: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <section className="mb-7"><div className="mb-2.5 flex items-end justify-between gap-3"><div><h2 className="text-[15px] font-semibold">{title}</h2>{sub && <p className="text-xs text-muted">{sub}</p>}</div>{action}</div>{children}</section>);
export const Note = ({ children }: { children: React.ReactNode }) => <p className="rounded-lg bg-cloud px-3 py-2 text-[13px] text-slate-600">{children}</p>;
export const pctText = (n: number | null) => (n == null ? "Not enough data" : `${n}%`);
