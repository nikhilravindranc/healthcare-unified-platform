"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge, Button, EmptyState, PageHeader, Panel, Select, SkeletonRows, Td, Th } from "@/components/ui";
import { AgentHint, PatientLink } from "@/components/app/bits";
import { useUI } from "@/components/app/ui-state";
import { useAction, useFollowUps } from "@/lib/hooks";
import { api, fmtDate, TODAY } from "@/lib/db";
import { agents } from "@/lib/insight";
import { cn } from "@/lib/utils";

type Tab = "today" | "overdue" | "upcoming" | "completed";
const TABS: { v: Tab; l: string }[] = [{ v: "today", l: "Due today" }, { v: "overdue", l: "Overdue" }, { v: "upcoming", l: "Upcoming" }, { v: "completed", l: "Completed" }];

type FU = import("@/lib/types").FollowUp;
const match = (t: Tab, f: FU) =>
  t === "completed" ? f.status === "Completed" : f.status === "Open" && (t === "today" ? f.due === TODAY : t === "overdue" ? f.due < TODAY : f.due > TODAY);

export default function FollowUpsPage() {
  const { data: fus, isLoading, isError, refetch } = useFollowUps();
  const ui = useUI();
  const complete = useAction(api.completeFollowUp, "Follow-up completed");
  const [tab, setTab] = useState<Tab>("today");
  const [type, setType] = useState("");

  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.v, (fus ?? []).filter((f) => match(t.v, f)).length])) as Record<Tab, number>, [fus]);
  const rows = (fus ?? []).filter((f) => match(tab, f) && (!type || f.type === type)).sort((a, b) => a.due.localeCompare(b.due));
  const agentN = agents[0].findings().length;

  return (
    <>
      <PageHeader title="Follow-ups" subtitle="Patients who need to return or be contacted" actions={<Button onClick={() => ui.newFollowUp()}><Plus className="size-4" />New follow-up</Button>} />
      <AgentHint agent={0} text={`Follow-up Agent found ${agentN} patients needing attention.`} action="Review follow-ups" href="/agents?agent=followup" />
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3 pt-1">
          <div role="tablist" aria-label="Follow-up status" className="flex gap-1">
            {TABS.map((t) => (
              <button key={t.v} role="tab" aria-selected={tab === t.v} onClick={() => setTab(t.v)}
                className={cn("relative px-3 py-3 text-sm font-medium after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded", tab === t.v ? "text-primary after:bg-primary" : "text-muted hover:text-ink")}>
                {t.l} <span className={cn("ml-1 rounded-full px-1.5 py-0.5 text-xs", t.v === "overdue" && counts.overdue ? "bg-[#FBE9E9] text-[#8F2D2D]" : "bg-cloud text-muted")}>{counts[t.v] ?? 0}</span>
              </button>
            ))}
          </div>
          <Select sm className="mb-1 w-48" aria-label="Follow-up type" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{["Post-treatment", "Routine review", "Treatment continuation", "Recall", "Other"].map((t) => <option key={t}>{t}</option>)}</Select>
        </div>
        {isLoading ? <SkeletonRows /> : isError ? <EmptyState title="Couldn't load follow-ups" action={<Button variant="secondary" onClick={() => refetch()}>Try again</Button>} />
          : rows.length === 0 ? <EmptyState title={tab === "completed" ? "No completed follow-ups" : tab === "today" ? "No follow-ups due" : "Nothing here"} text="There are no follow-ups requiring attention." /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead className="border-b border-line bg-cloud/50"><tr><Th>Patient</Th><Th>Previous visit</Th><Th>Follow-up type</Th><Th>Due date</Th><Th>Assigned to</Th><Th>Status</Th><Th className="text-right">Actions</Th></tr></thead>
                <tbody className="divide-y divide-line">
                  {rows.map((f) => (
                    <tr key={f.id} className="hover:bg-cloud/40">
                      <Td><PatientLink id={f.patientId} /></Td>
                      <Td>{f.visitId ? <Link href={`/visits/${f.visitId}`} className="text-primary hover:underline">Open visit</Link> : "—"}</Td>
                      <Td>{f.type}</Td>
                      <Td>{f.due === TODAY ? "Today" : fmtDate(f.due, true)}</Td>
                      <Td>{f.assignee}</Td>
                      <Td>{f.status === "Completed" ? <Badge tone="mint">Completed</Badge> : f.due < TODAY ? <Badge tone="red">Overdue</Badge> : f.due === TODAY ? <Badge tone="peach">Due today</Badge> : <Badge>Upcoming</Badge>}</Td>
                      <Td className="text-right"><div className="flex justify-end gap-1.5">
                        <Link href={`/patients/${f.patientId}`}><Button size="sm" variant="ghost">Open patient</Button></Link>
                        {f.status === "Open" && <>
                          <Button size="sm" variant="secondary" onClick={() => ui.newAppt({ patientId: f.patientId })}>Schedule appointment</Button>
                          <Button size="sm" variant="soft" loading={complete.pending} onClick={() => complete.run(f.id)}>Complete</Button></>}
                      </div></Td>
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
