"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download, CalendarCheck, CheckCircle2, CalendarX, UserX, Repeat } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, PageHeader, Panel, PanelHeader, Select, Skeleton, StatGrid, StatTile, Td, Th } from "@/components/ui";
import { AgentHint } from "@/components/app/bits";
import { Denied } from "@/components/patient/shared";
import { useBilling, useInventory, useRefs, useRole } from "@/lib/hooks";
import { docTotal, invoiceBalance, invoicePaid, invStatus, money } from "@/lib/clinical";
import { addDays, fmtDate, TODAY } from "@/lib/db";

/** Deterministic demo data so the same filters always give the same numbers. */
const rnd = (n: number) => { const x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x); };
const SHARE: Record<string, number> = { pat: 0.42, rao: 0.33, meh: 0.25 };
const SVC_SHARE: Record<string, number> = { consult: 0.17, followup: 0.2, skin: 0.15, inject: 0.14, physio: 0.15, dental: 0.07, review: 0.12 };
const LOC_SHARE: Record<string, number> = { dt: 0.62, ws: 0.38 };

export default function ReportsPage() {
  const { data: refs } = useRefs();
  const { can } = useRole();
  const { data: bill } = useBilling();
  const { data: inv } = useInventory();
  const [f, setF] = useState({ range: "30", provider: "", service: "", location: "" });
  const [busy, setBusy] = useState(true);
  useEffect(() => { const t = setTimeout(() => setBusy(false), 450); return () => clearTimeout(t); }, []);

  const d = useMemo(() => {
    const n = Number(f.range);
    const scale = (f.provider ? SHARE[f.provider] : 1) * (f.service ? SVC_SHARE[f.service] : 1) * (f.location ? LOC_SHARE[f.location] : 1);
    const days = Array.from({ length: n }, (_, i) => {
      const date = addDays(TODAY, -(n - 1 - i));
      const wd = new Date(date + "T12:00:00").getDay();
      const base = wd === 0 ? 0 : wd === 6 ? 18 : 40 + Math.round(rnd(i + 3) * 10);
      const total = Math.round(base * scale);
      const ns = Math.round(total * (0.04 + rnd(i + 11) * 0.05));
      const ca = Math.round(total * (0.06 + rnd(i + 21) * 0.05));
      return { date, total, ns, ca, done: Math.max(0, total - ns - ca - (date === TODAY ? 10 : 0)) };
    });
    const sum = (k: "total" | "ns" | "ca" | "done") => days.reduce((s, x) => s + x[k], 0);
    const provs = (refs?.providers ?? []).filter((p) => !f.provider || p.id === f.provider).map((p) => {
      const total = Math.round(sum("total") * (f.provider ? 1 : SHARE[p.id]));
      const ns = Math.round(sum("ns") * (f.provider ? 1 : SHARE[p.id]));
      return { id: p.id, name: p.short, total, ns, done: Math.round(total * 0.84), util: Math.round(68 + rnd(p.id.length + p.name.length) * 22) };
    });
    const svcs = (refs?.services ?? []).filter((s) => !f.service || s.id === f.service).map((s) => ({ name: s.name, n: Math.round(sum("total") * (f.service ? 1 : SVC_SHARE[s.id])) })).sort((a, b) => b.n - a.n);
    return { days, total: sum("total"), done: sum("done"), ns: sum("ns"), ca: sum("ca"), provs, svcs, newP: Math.round(n * 1.4 * scale + 3), ret: Math.round(n * 9 * scale), fu: Math.round(78 + rnd(n) * 8) };
  }, [f, refs]);

  const exportCsv = () => {
    const rows = ["date,appointments,completed,cancellations,no_shows", ...d.days.map((x) => `${x.date},${x.total},${x.done},${x.ca},${x.ns}`)].join("\n");
    const url = URL.createObjectURL(new Blob([rows], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `practice-report-${TODAY}.csv`; a.click(); URL.revokeObjectURL(url);
    toast.success("Report exported");
  };

  if (!can("reports")) return <Denied what="reports" />;
  return (
    <>
      <PageHeader title="Reports" subtitle="Operational performance of the practice" actions={<><Link href="/agents"><Button variant="ghost">Agents</Button></Link><Button variant="secondary" onClick={exportCsv}><Download className="size-4" />Export</Button></>} />
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Report filters">
        <Select sm className="w-40" aria-label="Date range" value={f.range} onChange={(e) => setF({ ...f, range: e.target.value })}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></Select>
        <Select sm className="w-40" aria-label="Provider" value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}><option value="">All providers</option>{refs?.providers.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}</Select>
        <Select sm className="w-48" aria-label="Service" value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}><option value="">All services</option>{refs?.services.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Select sm className="w-48" aria-label="Location" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })}><option value="">All locations</option>{refs?.locations.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <span className="self-center text-xs text-muted">{fmtDate(d.days[0].date)} – {fmtDate(TODAY, true)}</span>
      </div>
      <AgentHint agent={5} text="Practice Insights Agent: no-shows are highest on Mondays. Reminders the day before may help." action="Open agent" href="/agents?agent=insights" />

      {busy ? <div className="grid gap-4"><Skeleton className="h-24" /><Skeleton className="h-72" /></div> : (
        <>
          <StatGrid cols={5}>
            {([["Appointments", d.total, CalendarCheck, "blue"], ["Completed", d.done, CheckCircle2, "mint"], ["Cancellations", d.ca, CalendarX, "peach"], ["No-shows", d.ns, UserX, "red"], ["Follow-up completion", `${d.fu}%`, Repeat, "lavender"]] as const).map(([l, n, icon, tone]) => <StatTile key={l} label={l} value={typeof n === "number" ? n.toLocaleString() : n} icon={icon} tone={tone} />)}
          </StatGrid>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel><PanelHeader title="Appointment trend" sub="Daily appointments and completed" />
              <div className="p-4"><LineChart label="Appointment trend" days={d.days.map((x) => x.date)} series={[{ name: "Appointments", color: "#2867B2", v: d.days.map((x) => x.total) }, { name: "Completed", color: "#7ACFC5", v: d.days.map((x) => x.done) }]} /></div></Panel>
            <Panel><PanelHeader title="No-show trend" sub="Daily no-shows and cancellations" />
              <div className="p-4"><LineChart label="No-show trend" days={d.days.map((x) => x.date)} series={[{ name: "No-shows", color: "#B4403F", v: d.days.map((x) => x.ns) }, { name: "Cancellations", color: "#9A9CD6", v: d.days.map((x) => x.ca) }]} /></div></Panel>
            <Panel><PanelHeader title="Provider utilization" sub="Booked time as a share of available time" />
              <ul className="space-y-4 p-4">{d.provs.map((p) => (
                <li key={p.id}><div className="mb-1 flex justify-between text-[13px]"><span className="font-medium">{p.name}</span><span>{p.util}%</span></div>
                  <div className="h-2 rounded-full bg-cloud" role="img" aria-label={`${p.name} utilization ${p.util}%`}><div className="h-2 rounded-full bg-primary" style={{ width: `${p.util}%` }} /></div></li>))}</ul></Panel>
            <Panel><PanelHeader title="Service volume" />
              <ul className="space-y-2.5 p-4">{d.svcs.map((s) => (
                <li key={s.name} className="grid grid-cols-[150px_1fr_40px] items-center gap-3 text-[13px]"><span className="truncate">{s.name}</span>
                  <div className="h-2 rounded-full bg-cloud"><div className="h-2 rounded-full bg-cyan" style={{ width: `${(s.n / (d.svcs[0].n || 1)) * 100}%` }} /></div><span className="text-right tabular-nums">{s.n}</span></li>))}</ul></Panel>
            <Panel className="lg:col-span-2"><PanelHeader title="Provider activity" />
              <table className="w-full"><thead className="border-b border-line bg-cloud/50"><tr><Th>Provider</Th><Th>Appointments</Th><Th>Completed</Th><Th>No-shows</Th><Th>Utilization</Th></tr></thead>
                <tbody className="divide-y divide-line">{d.provs.map((p) => <tr key={p.id}><Td className="font-medium">{p.name}</Td><Td>{p.total}</Td><Td>{p.done}</Td><Td>{p.ns}</Td><Td>{p.util}%</Td></tr>)}</tbody></table></Panel>
            <Panel className="lg:col-span-2"><PanelHeader title="Patient activity" />
              <dl className="grid grid-cols-3 divide-x divide-line text-center">{[["New patients", d.newP], ["Returning visits", d.ret], ["Follow-ups completed", `${d.fu}%`]].map(([l, n]) => <div key={l} className="px-4 py-4"><dd className="text-xl font-semibold">{n}</dd><dt className="text-xs text-muted">{l}</dt></div>)}</dl></Panel>
          </div>
          {can("financials") && bill && (
            <Panel className="mt-5"><PanelHeader title="Billing summary" sub="Invoices, collections, refunds and discounts across all patients" />
              <dl className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-5 sm:divide-y-0">{[["Invoices", String(bill.invoices.filter((i) => i.status !== "Void").length)], ["Invoiced", money(bill.invoices.filter((i) => i.status !== "Void").reduce((s, i) => s + docTotal(i), 0))], ["Collected", money(bill.invoices.reduce((s, i) => s + invoicePaid(i.id), 0))], ["Outstanding", money(bill.invoices.reduce((s, i) => s + invoiceBalance(i), 0))], ["Refunds", money(bill.payments.filter((p) => p.kind === "refund" && p.status === "Posted").reduce((s, p) => s + p.amount, 0))]].map(([l, n]) => <div key={l} className="px-4 py-3"><dd className="text-[16px] font-semibold">{n}</dd><dt className="text-xs text-muted">{l}</dt></div>)}</dl>
              <p className="border-t border-line px-4 py-2 text-xs text-muted">Discounts given: {money(bill.invoices.reduce((s, i) => s + i.lines.reduce((t, l) => t + l.qty * l.unit * (l.discount / 100), 0), 0))}. Based on posted records; not a substitute for accounting reports.</p></Panel>)}
          {can("inventory") && inv && (
            <Panel className="mt-5"><PanelHeader title="Inventory" sub="Stock status and usage recorded from completed visits" />
              <ul className="divide-y divide-line">{inv.inventory.map((i) => { const used = inv.moves.filter((m) => m.itemId === i.id && m.delta < 0).reduce((s, m) => s + -m.delta, 0); return <li key={i.id} className="flex items-center justify-between px-4 py-2.5 text-[13px]"><span className="font-medium">{i.name}</span><span className="text-muted">{i.qty} {i.unit} in stock · {used} {i.unit} used</span><Badge tone={invStatus(i) === "Active" ? "mint" : invStatus(i) === "Low" ? "peach" : "red"}>{invStatus(i)}</Badge></li>; })}</ul></Panel>)}
          <p className="mt-4 text-xs text-muted">Appointment charts are illustrative demo data generated from your filters. Billing and inventory figures come from live records. Data as of Oct 7, 2026, 10:20 AM.</p>
        </>
      )}
    </>
  );
}

function LineChart({ days, series, label }: { days: string[]; series: { name: string; color: string; v: number[] }[]; label: string }) {
  const W = 560, H = 210, L = 30, B = 24, T = 8, R = 8;
  const max = Math.max(5, ...series.flatMap((s) => s.v));
  const top = Math.ceil(max / 10) * 10;
  const x = (i: number) => L + (i / Math.max(1, days.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}. ${series.map((s) => `${s.name}: total ${s.v.reduce((a, b) => a + b, 0)}`).join(", ")}`} className="w-full">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(top * t)} y2={y(top * t)} stroke="#E2E7EB" strokeWidth="1" /><text x={L - 6} y={y(top * t) + 3} fontSize="10" fill="#64748B" textAnchor="end">{Math.round(top * t)}</text></g>)}
        {[0, Math.floor((days.length - 1) / 2), days.length - 1].map((i) => <text key={i} x={x(i)} y={H - 6} fontSize="10" fill="#64748B" textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"}>{fmtDate(days[i])}</text>)}
        {series.map((s) => <polyline key={s.name} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" points={s.v.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />)}
      </svg>
      <figcaption className="mt-1 flex gap-4 text-xs text-muted">{series.map((s) => <span key={s.name} className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: s.color }} />{s.name}</span>)}</figcaption>
    </figure>
  );
}
