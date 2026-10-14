"use client";
import { Suspense, use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { Button, EmptyState, Input, PageTitle, Pagination, Panel, Select, Skeleton } from "@/components/ui";
import { Denied } from "@/components/patient/shared";
import { RouteGuard } from "@/platform/route-guard";
import { useRefs, useRole } from "@/lib/hooks";
import { reportBySlug, searchRows, sortRows, toCsv, type ReportFilters } from "@/lib/reports";
import { reportAllowed, useReportCtx } from "@/components/insights/report-ctx";
import { fmtDate } from "@/lib/db";

const PAGE = 15;
export default function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return <RouteGuard title="Reports" perms={["reports", "enquiries", "enquiries_view", "campaigns", "insights"]}><Suspense><Detail slug={slug} /></Suspense></RouteGuard>;
}

function Detail({ slug }: { slug: string }) {
  const def = reportBySlug(slug); const { can } = useRole(); const ctx = useReportCtx(); const { data: refs } = useRefs();
  const sp = useSearchParams(); const router = useRouter(); const path = usePathname();
  const [q, setQ] = useState(""); const [sort, setSort] = useState<{ col: number; dir: 1 | -1 } | null>(null); const [page, setPage] = useState(1);
  const f: ReportFilters = { from: sp.get("from") ?? "", to: sp.get("to") ?? "", provider: sp.get("provider") ?? "", service: sp.get("service") ?? "", location: sp.get("location") ?? "", status: sp.get("status") ?? "" };
  const set = (p: Partial<ReportFilters>) => { const n = new URLSearchParams(sp.toString()); Object.entries(p).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k))); router.replace(`${path}${n.size ? `?${n}` : ""}`, { scroll: false }); };
  useEffect(() => setPage(1), [q, sp]);

  const result = useMemo(() => (def && ctx ? def.run(ctx, f) : null), [def, ctx, sp]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => { if (!result) return []; const r = searchRows(result.rows, q); return sort ? sortRows(r, sort.col, sort.dir) : r; }, [result, q, sort]);
  if (!def) return <EmptyState title="Report not found" text="It may have moved." action={<Link href="/reports"><Button variant="secondary">Back to Reports</Button></Link>} />;
  if (!reportAllowed(def, can as never)) return <Denied what={`the ${def.title.toLowerCase()} report`} />;
  const on = Object.values(f).some(Boolean) || !!q;
  const slice = rows.slice((page - 1) * PAGE, page * PAGE);
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(result!.columns, rows)], { type: "text/csv" })); const a = document.createElement("a");
    a.href = url; a.download = `${def.slug}-${f.from || "start"}-to-${f.to || "end"}.csv`; a.click(); URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} ${rows.length === 1 ? "record" : "records"} with the filters and search applied`);
  };
  const toggle = (col: number) => setSort((s) => (s?.col === col ? (s.dir === 1 ? { col, dir: -1 } : null) : { col, dir: 1 }));

  return (
    <>
      <PageTitle crumbs={[{ label: "Reports", href: "/reports" }, { label: def.title }]} title={def.title} description={def.description}
        actions={<>
          {def.analytics && can("reports") && <Link href={`/analytics/${def.analytics}`}><Button variant="secondary">See the trend in Analytics</Button></Link>}
          <Button onClick={exportCsv} disabled={!can("exports") || !result || rows.length === 0} title={can("exports") ? "" : "Your role does not include exports"}><Download className="size-4" aria-hidden />Export CSV</Button>
        </>} />
      <div role="group" aria-label="Report filters" className="mb-3 flex flex-wrap items-center gap-2">
        {def.filters.includes("from") && <label className="flex items-center gap-1.5 text-xs text-muted">From<Input type="date" aria-label="From date" className="h-9 w-40" value={f.from} onChange={(e) => set({ from: e.target.value })} /></label>}
        {def.filters.includes("to") && <label className="flex items-center gap-1.5 text-xs text-muted">To<Input type="date" aria-label="To date" className="h-9 w-40" value={f.to} onChange={(e) => set({ to: e.target.value })} /></label>}
        {def.filters.includes("provider") && <Select sm className="w-40" aria-label="Provider" value={f.provider} onChange={(e) => set({ provider: e.target.value })}><option value="">All providers</option>{refs?.providers.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}</Select>}
        {def.filters.includes("service") && <Select sm className="w-48" aria-label="Service" value={f.service} onChange={(e) => set({ service: e.target.value })}><option value="">All services</option>{refs?.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>}
        {def.filters.includes("location") && <Select sm className="w-44" aria-label="Location" value={f.location} onChange={(e) => set({ location: e.target.value })}><option value="">All locations</option>{refs?.locations.map((l) => <option key={l.id} value={l.id}>{l.name.replace("Brightwell ", "")}</option>)}</Select>}
        {def.filters.includes("status") && <Select sm className="w-48" aria-label="Status" value={f.status} onChange={(e) => set({ status: e.target.value })}><option value="">Any status</option>{def.statusOptions?.map((s) => <option key={s}>{s}</option>)}</Select>}
        <div className="relative min-w-48 flex-1 sm:max-w-xs"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden /><Input aria-label="Search this report" className="h-9 pl-9" placeholder="Search records" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {on && <Button size="sm" variant="ghost" onClick={() => { setQ(""); router.replace(path, { scroll: false }); }}>Clear filters</Button>}
      </div>
      <p className="mb-3 text-[13px] text-slate-600" role="status">{result ? <><span className="font-medium tabular-nums">{rows.length}</span> {rows.length === 1 ? "record" : "records"}{on ? ` of ${result.rows.length}` : ""}{def.dateBasis ? <> · range applies to the {def.dateBasis}{f.from || f.to ? `: ${f.from ? fmtDate(f.from, true) : "start"} to ${f.to ? fmtDate(f.to, true) : "now"}` : ""}</> : null}</> : "Loading records…"}</p>
      <Panel>
        {!result ? <div className="p-4"><Skeleton className="h-48 w-full" /></div> : rows.length === 0 ? <EmptyState title="No records match" text={on ? "Change or clear the filters." : "There are no records of this kind yet."} action={on ? <Button variant="secondary" onClick={() => { setQ(""); router.replace(path, { scroll: false }); }}>Clear filters</Button> : undefined} /> : (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full" style={{ minWidth: Math.max(560, result.columns.length * 110) }}>
                <caption className="sr-only">{def.title} report. Select a column heading to sort.</caption>
                <thead className="border-b border-line bg-cloud/50"><tr>{result.columns.map((c, i) => (
                  <th key={c} scope="col" aria-sort={sort?.col === i ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted">
                    <button type="button" onClick={() => toggle(i)} className="inline-flex items-center gap-1 whitespace-nowrap uppercase hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">{c}{sort?.col === i && (sort.dir === 1 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}</button>
                  </th>))}</tr></thead>
                <tbody className="divide-y divide-line">{slice.map((r) => (
                  <tr key={r.key} className="hover:bg-cloud/40">{r.cells.map((c, i) => <td key={i} className="whitespace-nowrap px-3 py-2.5 text-[13px]">{r.links?.[i] && c !== "" ? <Link href={r.links[i]!} className="font-medium text-primary hover:underline">{c}</Link> : c === "" ? <span className="text-muted">—</span> : c}</td>)}</tr>))}</tbody>
              </table>
            </div>
            <Pagination page={page} pages={Math.ceil(rows.length / PAGE)} onPage={setPage} total={rows.length} />
          </>)}
      </Panel>
    </>
  );
}
