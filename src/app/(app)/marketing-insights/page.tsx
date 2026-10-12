"use client";
import { useMemo, useState } from "react";
import { CalendarCheck, Hourglass, Inbox, TrendingUp } from "lucide-react";
import { Alert, Badge, EmptyState, PageHeader, Panel, PanelHeader, Select, Skeleton, StatGrid, StatTile, Td, Th } from "@/components/ui";
import { BarList, LineChart } from "@/components/app/charts";
import { RouteGuard } from "@/platform/route-guard";
import { TODAY } from "@/lib/db";
import { useEnquiries } from "@/modules/enquiries/hooks";
import { computeInsights } from "@/modules/enquiries/insights";

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export default function MarketingInsightsPage() {
  return <RouteGuard title="Marketing Insights" perms={["insights"]}><Insights /></RouteGuard>;
}

function Insights() {
  const { data, isLoading, isError } = useEnquiries();
  const [range, setRange] = useState("30");
  const d = useMemo(() => computeInsights(data ?? [], Number(range), TODAY), [data, range]);

  return (
    <>
      <PageHeader title="Marketing Insights" subtitle="Where enquiries come from and how many become appointments" actions={<Badge tone="peach">Demo data</Badge>} />
      <Alert tone="info" title="Demo data only">These figures are calculated from the sample enquiries and the appointments linked to them. No advertising platform, website analytics or campaign tool is connected.</Alert>
      <div className="my-4 flex flex-wrap items-center gap-2" role="group" aria-label="Insight filters">
        <Select sm className="w-40" aria-label="Period" value={range} onChange={(e) => setRange(e.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></Select>
        <span className="text-xs text-muted">Enquiries received in the selected period</span>
      </div>
      {isLoading ? <div className="grid gap-4"><Skeleton className="h-24" /><Skeleton className="h-72" /></div>
        : isError ? <EmptyState title="Couldn't load insights" text="Check your connection and try again." />
        : (
        <>
          <StatGrid>
            {([["Total enquiries", d.total, Inbox, "blue"], ["Appointments from enquiries", d.booked, CalendarCheck, "mint"], ["Enquiry to appointment", `${d.rate}%`, TrendingUp, "lavender"], ["Still open", d.open, Hourglass, "peach"]] as const).map(([l, n, icon, tone]) => <StatTile key={l} label={l} value={n} icon={icon} tone={tone} />)}
          </StatGrid>
          {d.lost > 0 && <p className="mb-4 text-xs text-muted">{d.lost} enquir{d.lost === 1 ? "y has" : "ies have"} a cancelled or missed appointment. {d.lost === 1 ? "It is" : "They are"} counted as open again, not as booked.</p>}
          {d.total === 0 ? <Panel><EmptyState title="No enquiries in this period" text="Choose a longer period." /></Panel> : (
            <div className="grid gap-5 lg:grid-cols-2">
              <Panel className="lg:col-span-2"><PanelHeader title="Enquiries over time" sub={d.series.step === 7 ? "Per week" : "Per day"} />
                <div className="p-4"><LineChart label="Enquiries over time" labels={d.series.labels} series={[{ name: "Enquiries", color: "#2867B2", v: d.series.enquiries }, { name: "Became appointments", color: "#7ACFC5", v: d.series.booked }]} /></div></Panel>
              <Panel><PanelHeader title="Enquiries by source" />
                <div className="p-4"><BarList rows={d.bySource.map((x) => ({ label: x.source, value: x.n, sub: `${x.booked} booked` }))} /></div></Panel>
              <Panel><PanelHeader title="Conversion by source" sub="Share of enquiries that reached a booked appointment" />
                <div className="overflow-x-auto"><table className="w-full min-w-[320px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>Source</Th><Th>Enquiries</Th><Th>Booked</Th><Th>Rate</Th></tr></thead>
                  <tbody className="divide-y divide-line">{d.bySource.map((x) => <tr key={x.source}><Td className="font-medium">{x.source}</Td><Td>{x.n}</Td><Td>{x.booked}</Td><Td>{pct(x.booked, x.n)}</Td></tr>)}</tbody></table></div></Panel>
              <Panel className="lg:col-span-2"><PanelHeader title="Campaign attribution" sub="Enquiries tagged with a campaign in the sample data" />
                {d.campaigns.length === 0 ? <EmptyState title="No campaign enquiries in this period" /> : (
                  <div className="overflow-x-auto"><table className="w-full min-w-[420px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>Campaign</Th><Th>Enquiries</Th><Th>Booked</Th><Th>Rate</Th></tr></thead>
                    <tbody className="divide-y divide-line">{d.campaigns.map((x) => <tr key={x.campaign}><Td className="font-medium">{x.campaign}</Td><Td>{x.n}</Td><Td>{x.booked}</Td><Td>{pct(x.booked, x.n)}</Td></tr>)}</tbody></table></div>)}
              </Panel>
            </div>)}
        </>)}
    </>
  );
}
