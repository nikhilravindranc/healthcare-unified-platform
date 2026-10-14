"use client";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { PageTitle } from "@/components/ui";
import { RouteGuard } from "@/platform/route-guard";
import { useRole } from "@/lib/hooks";
import { CATEGORY_LABEL, INSIGHTS, type Category } from "@/components/insights/catalogue";
import { FilterBar, InsightsNav, Section, useInsightFilters } from "@/components/insights/shell";
import { ClinicView } from "@/components/insights/views";

export default function InsightsPage() {
  return <RouteGuard title="Analytics" perms={["reports", "insights"]}><Suspense><Landing /></Suspense></RouteGuard>;
}

function Landing() {
  const f = useInsightFilters(); const { can } = useRole();
  const sp = useSearchParams(); const query = sp.toString() ? `?${sp}` : "";
  const list = INSIGHTS.filter((i) => i.perms.some(can) && (!i.needs || can(i.needs)));
  const cats = (Object.keys(CATEGORY_LABEL) as Category[]).filter((c) => list.some((i) => i.category === c));
  return (
    <>
      <PageTitle title="Analytics" description="Understand clinic performance, patient activity, and growth." />
      <InsightsNav active="overview" query={query} />
      <FilterBar f={f} show={{ location: true }} />
      {can("reports") && <Section title="Clinic overview" sub="From the appointment, visit and follow-up records in the range. Each figure says how it is worked out."><ClinicView f={f} compact /></Section>}
      <Section title="Analytics" sub="Each one answers a specific question. Nothing is shown that the records cannot support.">
        <div className="space-y-6">
          {cats.map((c) => (
            <div key={c}>
              <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">{CATEGORY_LABEL[c]}</h3>
              <ul className="divide-y divide-line rounded-xl border border-line bg-white">
                {list.filter((i) => i.category === c).map((i) => (
                  <li key={i.slug}>
                    {i.state === "unavailable" ? (
                      <div className="px-4 py-3"><p className="text-[14px] font-medium text-slate-600">{i.title} <span className="ml-1.5 rounded bg-cloud px-1.5 py-0.5 text-[11px] font-medium text-muted">Not available yet</span></p><p className="text-[13px] text-muted">{i.unavailableWhy}</p></div>
                    ) : (
                      <Link href={`/analytics/${i.slug}${query}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-cloud/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40">
                        <span className="min-w-0"><span className="block text-[14px] font-medium">{i.title}</span><span className="block text-[13px] text-muted">{i.question}</span></span>
                        <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
                      </Link>)}
                  </li>))}
              </ul>
            </div>))}
        </div>
      </Section>
    </>
  );
}
