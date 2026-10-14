"use client";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { Input, PageTitle, Skeleton } from "@/components/ui";
import { RouteGuard } from "@/platform/route-guard";
import { useRole } from "@/lib/hooks";
import { REPORTS, type ReportCategory } from "@/lib/reports";
import { reportAllowed, useReportCtx } from "@/components/insights/report-ctx";
import { cn } from "@/lib/utils";

export default function ReportsPage() { return <RouteGuard title="Reports" perms={["reports"]}><Suspense><Catalogue /></Suspense></RouteGuard>; }

function Catalogue() {
  const { can } = useRole(); const ctx = useReportCtx();
  const [q, setQ] = useState(""); const [cat, setCat] = useState<ReportCategory | "">("");
  const allowed = REPORTS.filter((r) => reportAllowed(r, can as never));
  const cats = [...new Set(allowed.map((r) => r.category))];
  const shown = allowed.filter((r) => (!cat || r.category === cat) && (!q.trim() || `${r.title} ${r.description} ${r.category}`.toLowerCase().includes(q.trim().toLowerCase())));
  const counts = useMemo(() => Object.fromEntries(REPORTS.map((r) => [r.slug, ctx ? r.run(ctx, {}).rows.length : null])), [ctx]);
  return (
    <>
      <PageTitle title="Reports" description={<>Detailed records you can filter, sort and export. To see what is changing, use <Link href="/analytics" className="font-medium text-primary hover:underline">Analytics</Link>.</>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-sm"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden /><Input aria-label="Search reports" className="h-9 pl-9" placeholder="Search reports" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div role="group" aria-label="Report categories" className="flex flex-wrap gap-1.5">
          {[["", "All"] as const, ...cats.map((c) => [c, c] as const)].map(([v, l]) => <button key={l} type="button" aria-pressed={cat === v} onClick={() => setCat(v as ReportCategory | "")} className={cn("rounded-full border px-3 py-1 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40", cat === v ? "border-primary bg-selected text-primary" : "border-line bg-white text-slate-600 hover:bg-cloud")}>{l}</button>)}
        </div>
      </div>
      {!ctx ? <Skeleton className="h-64 w-full" /> : shown.length === 0 ? <p className="rounded-lg bg-cloud px-3 py-6 text-center text-[13px] text-muted">No report matches. Try another word, or choose All.</p> : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-white">
          {shown.map((r) => (
            <li key={r.slug}>
              <Link href={`/reports/${r.slug}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-cloud/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40">
                <span className="min-w-0"><span className="block text-[14px] font-medium">{r.title} <span className="ml-1.5 rounded bg-cloud px-1.5 py-0.5 text-[11px] font-medium text-muted">{r.category}</span></span><span className="block text-[13px] text-muted">{r.description}</span></span>
                <span className="flex shrink-0 items-center gap-3"><span className="text-[13px] tabular-nums text-slate-600">{counts[r.slug] ?? "–"} records</span><ChevronRight className="size-4 text-muted" aria-hidden /></span>
              </Link>
            </li>))}
        </ul>)}
      <p className="mt-3 text-xs text-muted">Counts are every record of that kind, before any filter. Demo records only. Export is for roles with the Exports permission.</p>
    </>
  );
}
