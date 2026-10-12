"use client";
import { useMemo, useState } from "react";
import { Alert, Badge, EmptyState, PageHeader, Panel, PanelHeader, Select, Skeleton, Td, Th } from "@/components/ui";
import { BarList, LineChart } from "@/components/app/charts";
import { RouteGuard } from "@/platform/route-guard";
import { addDays, TODAY } from "@/lib/db";
import { useEnquiries } from "@/modules/enquiries/hooks";
import { ENQUIRY_SOURCES } from "@/modules/enquiries/types";

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export default function MarketingInsightsPage() {
  return <RouteGuard title="Marketing Insights" perms={["insights"]}><Insights /></RouteGuard>;
}

function Insights() {
  const { data, isLoading, isError } = useEnquiries();
  const [range, setRange] = useState("30");
  const d = useMemo(() => {
    const n = Number(range);
    const from = addDays(TODAY, -(n - 1));
    const list = (data ?? []).filter((e) => e.received >= from && e.received <= TODAY);
    const booked = list.filter((e) => e.status === "Appointment booked");
    const step = n > 31 ? 7 : 1;                     // weekly points for 90 days
    const labels: string[] = [], enq: number[] = [], appts: number[] = [];
    for (let i = 0; i < n; i += step) {
      const a = addDays(from, i), b = addDays(from, Math.min(n - 1, i + step - 1));
      const w = list.filter((e) => e.received >= a && e.received <= b);
      labels.push(a); enq.push(w.length); appts.push(w.filter((e) => e.status === "Appointment booked").length);
    }
    const bySource = ENQUIRY_SOURCES.map((s) => { const l = list.filter((e) => e.source === s); return { s, n: l.length, b: l.filter((e) => e.status === "Appointment booked").length }; }).sort((x, y) => y.n - x.n);
    const campaigns = [...new Set(list.map((e) => e.campaign).filter(Boolean))].map((c) => { const l = list.filter((e) => e.campaign === c); return { c: c as string, n: l.length, b: l.filter((e) => e.status === "Appointment booked").length }; }).sort((x, y) => y.n - x.n);
    const open = list.filter((e) => e.status === "New" || e.status === "Contacted").length;
    return { list, booked, labels, enq, appts, bySource, campaigns, open, step };
  }, [data, range]);

  return (
    <>
      <PageHeader title="Marketing Insights" subtitle="Where enquiries come from and how many become appointments" actions={<Badge tone="peach">Demo data</Badge>} />
      <Alert tone="info" title="Demo data only">These figures are calculated from the sample enquiries. No advertising platform, website analytics or campaign tool is connected.</Alert>
      <div className="my-4 flex flex-wrap items-center gap-2" role="group" aria-label="Insight filters">
        <Select sm className="w-40" aria-label="Period" value={range} onChange={(e) => setRange(e.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></Select>
        <span className="text-xs text-muted">Enquiries received in the selected period</span>
      </div>
      {isLoading ? <div className="grid gap-4"><Skeleton className="h-24" /><Skeleton className="h-72" /></div>
        : isError ? <EmptyState title="Couldn't load insights" text="Check your connection and try again." />
        : (
        <>
          <dl className="mb-5 grid grid-cols-2 divide-x divide-y divide-line overflow-hidden rounded-xl border border-line bg-white sm:grid-cols-4 sm:divide-y-0">
            {[["Total enquiries", d.list.length], ["Appointments from enquiries", d.booked.length], ["Enquiry to appointment", pct(d.booked.length, d.list.length)], ["Still open", d.open]].map(([l, n]) => (
              <div key={l} className="px-4 py-3"><dd className="text-xl font-semibold">{n}</dd><dt className="text-xs text-muted">{l}</dt></div>))}
          </dl>
          {d.list.length === 0 ? <Panel><EmptyState title="No enquiries in this period" text="Choose a longer period." /></Panel> : (
            <div className="grid gap-5 lg:grid-cols-2">
              <Panel className="lg:col-span-2"><PanelHeader title="Enquiries over time" sub={d.step === 7 ? "Per week" : "Per day"} />
                <div className="p-4"><LineChart label="Enquiries over time" labels={d.labels} series={[{ name: "Enquiries", color: "#2867B2", v: d.enq }, { name: "Became appointments", color: "#7ACFC5", v: d.appts }]} /></div></Panel>
              <Panel><PanelHeader title="Enquiries by source" />
                <div className="p-4"><BarList rows={d.bySource.map((x) => ({ label: x.s, value: x.n, sub: `${x.b} booked` }))} /></div></Panel>
              <Panel><PanelHeader title="Conversion by source" sub="Share of enquiries that reached a booked appointment" />
                <div className="overflow-x-auto"><table className="w-full min-w-[320px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>Source</Th><Th>Enquiries</Th><Th>Booked</Th><Th>Rate</Th></tr></thead>
                  <tbody className="divide-y divide-line">{d.bySource.map((x) => <tr key={x.s}><Td className="font-medium">{x.s}</Td><Td>{x.n}</Td><Td>{x.b}</Td><Td>{pct(x.b, x.n)}</Td></tr>)}</tbody></table></div></Panel>
              <Panel className="lg:col-span-2"><PanelHeader title="Campaign attribution" sub="Enquiries tagged with a campaign in the sample data" />
                {d.campaigns.length === 0 ? <EmptyState title="No campaign enquiries in this period" /> : (
                  <div className="overflow-x-auto"><table className="w-full min-w-[420px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>Campaign</Th><Th>Enquiries</Th><Th>Booked</Th><Th>Rate</Th></tr></thead>
                    <tbody className="divide-y divide-line">{d.campaigns.map((x) => <tr key={x.c}><Td className="font-medium">{x.c}</Td><Td>{x.n}</Td><Td>{x.b}</Td><Td>{pct(x.b, x.n)}</Td></tr>)}</tbody></table></div>)}
              </Panel>
            </div>)}
        </>)}
    </>
  );
}
