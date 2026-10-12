"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCheck, Play } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, EmptyState, PageHeader, Panel, PanelHeader, Sheet, Td, Th } from "@/components/ui";
import { PrepCard } from "@/components/app/evi";
import { AGENT_SPRITE, EviAvatar, EviSprite } from "@/components/app/evi-mascot";
import { useUI } from "@/components/app/ui-state";
import { apiC, logAudit } from "@/lib/clinical";
import { useAction, useAiActivity, useAppointments, useFollowUps, useRole, useVisits } from "@/lib/hooks";
import { agents, prepSummary, type Finding } from "@/lib/insight";
import { saveSettings, useSettings } from "@/lib/settings";
import { fmtDate } from "@/lib/db";

const META: Record<string, { guardrail: string; perms: string; triggers: string }> = {
  prep: { guardrail: "Summarizes documented records only. No clinical recommendations. Links to the source records.", perms: "Patient data, notes, photos", triggers: "Manual · Before an appointment" },
  followup: { guardrail: "Shows matched records and reviewable actions. Never contacts patients.", perms: "Patient data", triggers: "Manual · Daily 7:00 AM" },
  appointment: { guardrail: "Never silently changes bookings. Proposes actions for a person to approve.", perms: "Patient data", triggers: "Manual · Live on Calendar and Today" },
  recall: { guardrail: "Outreach only through an approved integration (EVOQ Campaigns) and authorization.", perms: "Patient data", triggers: "Manual · Weekly" },
  noshow: { guardrail: "Reviews patterns. Rebooking and follow-up need a person to approve.", perms: "Patient data", triggers: "Manual · After each no-show" },
  insights: { guardrail: "Shows date range and data basis. No unsupported claims.", perms: "Reports", triggers: "Manual · Weekly digest" },
};
const FUTURE = [
  { id: "engagement", name: "Patient Engagement Agent", desc: "Surfaces patients or enquiries needing engagement where data exists.", guardrail: "Does not invent intent or send unauthorized messages.", why: "Needs a connected engagement tool." },
  { id: "scribe", name: "AI Scribe", desc: "Would draft visit notes from authorized input.", guardrail: "Drafts are not a record until a provider reviews and accepts them.", why: "Planned capability. Not live." },
  { id: "receptionist", name: "AI Receptionist", desc: "Would handle routine enquiries and supported booking.", guardrail: "No live voice or channel integration is claimed.", why: "Planned capability. Not live." },
];

export default function AgentsPage() { return <Suspense><Agents /></Suspense>; }

function Agents() {
  const params = useSearchParams(); const router = useRouter(); const ui = useUI(); const { can } = useRole(); const st = useSettings();
  useAppointments(); useFollowUps(); useVisits();
  const { data: activity } = useAiActivity();
  const run = useAction(apiC.runAgent); const review = useAction(apiC.reviewActivity);
  const [openId, setOpenId] = useState<string | null>(params.get("agent"));
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [prepFor, setPrepFor] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Record<string, string>>({});
  useEffect(() => { setOpenId(params.get("agent")); }, [params]);

  const agent = agents.find((a) => a.id === openId);
  const findings = useMemo(() => (agent ? agent.findings() : []), [agent, reviewed]); // eslint-disable-line react-hooks/exhaustive-deps
  const pending = findings.filter((f) => !reviewed.has(f.id));
  const close = () => { setOpenId(null); setPrepFor(null); router.replace("/agents"); };
  const open = (id: string) => { setOpenId(id); router.replace(`/agents?agent=${id}`); };

  const actions = (f: Finding) => {
    const out: { label: string; run: () => void; primary?: boolean }[] = [];
    if (f.patientId) out.push({ label: "Open patient", run: () => router.push(`/patients/${f.patientId}`) });
    if (f.action === "schedule" && f.patientId) out.unshift({ label: "Schedule appointment", primary: true, run: () => ui.newAppt({ patientId: f.patientId }) });
    if (f.action === "reschedule" && f.apptId) out.unshift({ label: "Reschedule", primary: true, run: () => ui.openAppt(f.apptId!) });
    if (f.action === "open-appt" && f.apptId) out.unshift({ label: "Open appointment", primary: true, run: () => ui.openAppt(f.apptId!) });
    if (agent?.id === "prep" && f.apptId) out.unshift({ label: prepFor === f.id ? "Hide summary" : "Prepare visit", primary: true, run: () => setPrepFor(prepFor === f.id ? null : f.id) });
    if (f.href) out.unshift({ label: f.href === "/calendar" ? "Review schedule" : "Open reports", primary: true, run: () => router.push(f.href!) });
    return out;
  };
  const runNow = async (id: string, name: string, summary: string) => {
    await run.run(name, "Dr. Patel", "Practice, today", summary); setLastRun({ ...lastRun, [id]: "Just now" }); toast.success(`${name} finished. Results await review.`);
    open(id);
  };

  return (
    <>
      <PageHeader title="Agents" subtitle="Agents review practice data and surface items for your team. Nothing changes until a person approves it. This directory is separate from the EVI chat." actions={<Button variant="secondary" onClick={() => ui.evi()}><EviAvatar size={20} />Ask EVI</Button>} />
      <div className="grid gap-4 lg:grid-cols-2">
        {agents.map((a) => {
          const enabled = st.agents[a.id] !== false; const m = META[a.id];
          return (
            <Panel key={a.id} className="flex flex-col p-4">
              <div className="flex items-start gap-3"><EviSprite index={AGENT_SPRITE[a.id]} width={72} />
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-[15px] font-semibold">{a.name}</h2><Badge tone={enabled ? "mint" : "neutral"}>{enabled ? "Enabled" : "Disabled"}</Badge></div><p className="mt-0.5 text-[13px] text-muted">{a.description}</p></div></div>
              <dl className="mt-3 grid grid-cols-[84px_1fr] gap-x-2 gap-y-1 text-[12.5px]"><dt className="text-muted">Guardrail</dt><dd>{m.guardrail}</dd><dt className="text-muted">Permissions</dt><dd>{m.perms}</dd><dt className="text-muted">Triggers</dt><dd>{m.triggers}</dd><dt className="text-muted">Last run</dt><dd>{lastRun[a.id] ?? "This morning"}</dd></dl>
              <p className="mt-3 text-sm font-medium">{enabled ? a.summary() : "Enable this agent in Settings to see results."}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-3">
                <Button size="sm" disabled={!enabled || !can("ai")} title={can("ai") ? "" : "Your role does not include AI actions"} loading={run.pending} onClick={() => runNow(a.id, a.name, a.summary())}><Play className="size-3.5" />Run now</Button>
                <Button size="sm" variant="secondary" disabled={!enabled} onClick={() => open(a.id)}>Review results</Button>
                {can("settings") && <Button size="sm" variant="ghost" onClick={() => { saveSettings({ agents: { ...st.agents, [a.id]: !enabled } }); logAudit("Meera Iyer", enabled ? "Disabled agent" : "Enabled agent", a.name); }}>{enabled ? "Disable" : "Enable"}</Button>}
              </div>
            </Panel>);
        })}
        {FUTURE.map((a) => (
          <Panel key={a.id} className="flex flex-col p-4 opacity-90"><div className="flex items-start gap-3"><EviAvatar size={40} /><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-[15px] font-semibold">{a.name}</h2><Badge>Not available yet</Badge></div><p className="mt-0.5 text-[13px] text-muted">{a.desc}</p></div></div>
            <dl className="mt-3 grid grid-cols-[84px_1fr] gap-x-2 text-[12.5px]"><dt className="text-muted">Guardrail</dt><dd>{a.guardrail}</dd><dt className="text-muted">Status</dt><dd>{a.why}</dd></dl></Panel>))}
      </div>

      <Panel className="mt-6"><PanelHeader title="Recent agent activity" sub="Who ran what, with which context, and what was approved" />
        {!activity || activity.length === 0 ? <EmptyState title="No agent activity yet" /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[720px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>When</Th><Th>Agent</Th><Th>Run by</Th><Th>Context</Th><Th>Proposed</Th><Th>Status</Th><Th /></tr></thead>
            <tbody className="divide-y divide-line">{activity.map((x) => <tr key={x.id}><Td className="whitespace-nowrap">{fmtDate(x.at.slice(0, 10))} {x.at.slice(11)}</Td><Td className="font-medium">{x.agent}</Td><Td>{x.by}</Td><Td>{x.context}</Td><Td>{x.proposed}</Td><Td><Badge tone={x.status === "Approved" ? "mint" : x.status === "Dismissed" ? "neutral" : "peach"}>{x.status}</Badge></Td>
              <Td className="text-right">{x.status === "Awaiting review" && <div className="flex justify-end gap-1"><Button size="sm" variant="soft" onClick={() => review.run(x.id, "Approved", "Dr. Patel")}>Approve</Button><Button size="sm" variant="ghost" onClick={() => review.run(x.id, "Dismissed", "Dr. Patel")}>Dismiss</Button></div>}</Td></tr>)}</tbody></table></div>)}
      </Panel>

      <Sheet open={!!agent} onOpenChange={(o) => !o && close()} width={520} title={agent?.name ?? ""} description={agent?.description}
        footer={pending.length > 0 && <Button variant="secondary" onClick={() => { setReviewed(new Set([...reviewed, ...findings.map((f) => f.id)])); toast.success("All results marked as reviewed"); }}><CheckCheck className="size-4" />Mark all as reviewed</Button>}>
        {agent && <div className="mb-4 flex items-center gap-3 rounded-lg bg-active/60 p-3"><EviSprite index={AGENT_SPRITE[agent.id]} width={64} /><p className="text-[13px] text-slate-600">{agent.summary()}. Review each item. Nothing is changed automatically.</p></div>}
        {agent && (findings.length === 0 ? <EmptyState title="Nothing to review" text="This agent found nothing that needs attention." /> : (
          <ul className="space-y-3">
            {findings.map((f) => {
              const done = reviewed.has(f.id);
              return (
                <li key={f.id} className={`rounded-lg border border-line p-3.5 ${done ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{f.title}</p><p className="text-[13px] text-muted">{f.detail}</p></div>{done && <Badge tone="mint">Reviewed</Badge>}</div>
                  {!done && <div className="mt-3 flex flex-wrap gap-2">{actions(f).map((x) => <Button key={x.label} size="sm" variant={x.primary ? "primary" : "secondary"} onClick={x.run}>{x.label}</Button>)}<Button size="sm" variant="ghost" onClick={() => setReviewed(new Set([...reviewed, f.id]))}>Mark reviewed</Button></div>}
                  {prepFor === f.id && f.patientId && <PrepCard prep={prepSummary(f.patientId, f.apptId)} />}
                </li>);
            })}
          </ul>))}
        {agent?.id === "recall" && <p className="mt-4 text-xs text-muted">Outreach to these patients is handled in Campaigns, not in the Practice module.</p>}
      </Sheet>
    </>
  );
}
