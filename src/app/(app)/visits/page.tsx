"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Badge, Button, EmptyState, Input, PageHeader, Panel, Segmented, SkeletonRows, Td, Th } from "@/components/ui";
import { useUI } from "@/components/app/ui-state";
import { useRefs, useVisits } from "@/lib/hooks";
import { fmtDate, pname, TODAY } from "@/lib/db";

export default function VisitsPage() {
  const { data: visits, isLoading } = useVisits();
  const { data: refs } = useRefs();
  const ui = useUI();
  const router = useRouter();
  const [tab, setTab] = useState<"all" | "progress" | "today" | "completed">("all");
  const [q, setQ] = useState("");
  const rows = useMemo(() => (visits ?? []).filter((v) =>
    (tab === "all" || (tab === "progress" && v.status === "In progress") || (tab === "today" && v.date === TODAY) || (tab === "completed" && v.status === "Completed")) &&
    (!q || `${pname(v.patientId)} ${v.type} ${v.reason}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.date.localeCompare(a.date)), [visits, tab, q]);

  return (
    <>
      <PageHeader title="Visits" subtitle="Clinical documentation for each patient visit" actions={<Button onClick={() => ui.newVisit()}><Plus className="size-4" />New visit</Button>} />
      <Panel>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
          <Segmented label="Visit filter" value={tab} onChange={setTab} options={[{ value: "all", label: "All" }, { value: "progress", label: "In progress" }, { value: "today", label: "Today" }, { value: "completed", label: "Completed" }]} />
          <div className="relative min-w-56 flex-1 sm:max-w-xs"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden /><Input aria-label="Search visits" className="h-9 pl-9" placeholder="Search visits" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        {isLoading ? <SkeletonRows /> : rows.length === 0 ? <EmptyState title="No visits found" text="Visits you start appear here." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-line bg-cloud/50"><tr><Th>Date</Th><Th>Patient</Th><Th>Visit type</Th><Th>Reason</Th><Th>Provider</Th><Th>Status</Th></tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((v) => (
                  <tr key={v.id} tabIndex={0} onClick={() => router.push(`/visits/${v.id}`)} onKeyDown={(e) => e.key === "Enter" && router.push(`/visits/${v.id}`)} className="cursor-pointer hover:bg-cloud/50 focus-visible:bg-cloud/50">
                    <Td>{v.date === TODAY ? "Today" : fmtDate(v.date, true)}</Td><Td className="font-medium">{pname(v.patientId)}</Td><Td>{v.type}</Td><Td className="text-muted">{v.reason || "—"}</Td>
                    <Td>{refs?.providers.find((p) => p.id === v.providerId)?.short}</Td><Td><Badge tone={v.status === "Completed" ? "mint" : "blue"}>{v.status}</Badge></Td>
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
