"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Stethoscope, PlayCircle, CalendarCheck, CheckCircle2 } from "lucide-react";
import { Banner, BannerStat } from "@/components/ui/banner";
import { Badge, Button, EmptyState, Input, Panel, Segmented, SkeletonRows, Td, Th } from "@/components/ui";
import { useUI } from "@/components/app/ui-state";
import { useAppointments, useFollowUps, useRefs, useVisits } from "@/lib/hooks";
import { fmtDate, fmtTime, pname, TODAY } from "@/lib/db";
import { sortVisitRows, visitRows } from "@/lib/visit-list";

type Tab = "all" | "progress" | "today" | "completed" | "attention";

export default function VisitsPage() {
  const { data: visits, isLoading } = useVisits();
  const { data: appts } = useAppointments();
  const { data: fus } = useFollowUps();
  const { data: refs } = useRefs();
  const ui = useUI();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const all = useMemo(() => sortVisitRows(visitRows(visits ?? [], appts ?? [], fus ?? [])), [visits, appts, fus]);
  const attentionN = all.filter((r) => r.attention).length;
  const rows = all.filter(({ visit: v, attention }) =>
    (tab === "all" || (tab === "progress" && v.status === "In progress") || (tab === "today" && v.date === TODAY) || (tab === "completed" && v.status === "Completed") || (tab === "attention" && attention)) &&
    (!q || `${pname(v.patientId)} ${v.type} ${v.reason}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <Banner variant="visits" title="Visits" subtitle="Care delivered, and its documentation" actions={<Button onClick={() => ui.newVisit()}><Plus className="size-4" />New visit</Button>}
        stats={<>{[
          { k: "all" as const, label: "All visits", n: all.length, hint: "On record", icon: Stethoscope, tone: "blue" as const },
          { k: "progress" as const, label: "In progress", n: all.filter((r) => r.visit.status === "In progress").length, hint: "Still being documented", icon: PlayCircle, tone: "lavender" as const },
          { k: "today" as const, label: "Today", n: all.filter((r) => r.visit.date === TODAY).length, hint: "Started today", icon: CalendarCheck, tone: "cyan" as const },
          { k: "completed" as const, label: "Completed", n: all.filter((r) => r.visit.status === "Completed").length, hint: "Documentation locked", icon: CheckCircle2, tone: "mint" as const },
        ].map((x) => <BannerStat key={x.k} label={x.label} value={isLoading ? "–" : x.n} title={x.hint} icon={x.icon} tone={x.tone} active={tab === x.k} onClick={() => setTab(x.k)} />)}</>} />
      <Panel>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
          <div className="max-w-full overflow-x-auto scroll-thin"><Segmented label="Visit filter" value={tab} onChange={setTab} options={[{ value: "all", label: "All" }, { value: "progress", label: "In progress" }, { value: "today", label: "Today" }, { value: "completed", label: "Completed" }, { value: "attention", label: `Needs attention (${attentionN})` }]} /></div>
          <div className="relative min-w-56 flex-1 sm:max-w-xs"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden /><Input aria-label="Search visits" className="h-9 pl-9" placeholder="Search visits" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        {isLoading ? <SkeletonRows /> : rows.length === 0 ? <EmptyState title="No visits found" text={tab === "attention" ? "Nothing needs attention right now." : "Visits you start appear here."} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <caption className="sr-only">Visits, in-progress first. Open a row to see the visit.</caption>
              <thead className="border-b border-line bg-cloud/50"><tr><Th>Date</Th><Th>Patient</Th><Th>Visit</Th><Th>Provider</Th><Th>Status</Th><Th>Booking</Th></tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ visit: v, appt, flags }) => (
                  <tr key={v.id} tabIndex={0} onClick={() => router.push(`/visits/${v.id}`)} onKeyDown={(e) => e.target === e.currentTarget && e.key === "Enter" && router.push(`/visits/${v.id}`)} className="cursor-pointer hover:bg-cloud/50 focus-visible:bg-cloud/50">
                    <Td>{v.date === TODAY ? "Today" : fmtDate(v.date, true)}</Td>
                    <Td className="font-medium">{pname(v.patientId)}</Td>
                    <Td><span className="font-medium">{v.type}</span><span className="block max-w-[260px] truncate text-xs text-muted">{v.reason || "No reason recorded"}</span></Td>
                    <Td>{refs?.providers.find((p) => p.id === v.providerId)?.short}</Td>
                    <Td>
                      <Badge tone={v.status === "Completed" ? "mint" : "blue"}>{v.status === "In progress" ? "In progress · resume" : v.status}</Badge>
                      {flags.filter((f) => f.attention).map((f) => <span key={f.id} className="mt-1 block text-xs font-medium text-[#7A4B00]">{f.label}</span>)}
                    </Td>
                    <Td>{appt ? <button onClick={(e) => { e.stopPropagation(); ui.openAppt(appt.id); }} className="text-[13px] font-medium text-primary hover:underline">{appt.date === TODAY ? "Today" : fmtDate(appt.date, true)}, {fmtTime(appt.time)}</button> : <span className="text-xs text-muted">No booking linked</span>}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
