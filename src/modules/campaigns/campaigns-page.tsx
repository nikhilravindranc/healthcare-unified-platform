"use client";
import { useMemo, useState } from "react";
import { Mail, MessageSquare, Plus, Megaphone, Pencil, CalendarClock, PlayCircle } from "lucide-react";
import { Alert, Badge, Button, EmptyState, PageHeader, Panel, Segmented, SkeletonRows, StatGrid, StatTile, Td, Th } from "@/components/ui";
import { fmtDate } from "@/lib/db";
import { useRole } from "@/lib/hooks";
import { useCrmContacts } from "../crm/hooks";
import { previewAudience } from "./audience";
import { CampaignSheet } from "./campaign-sheet";
import { useCampaigns } from "./hooks";
import type { Campaign, CampaignStatus } from "./types";

type Filter = "all" | CampaignStatus;
const TONE: Record<CampaignStatus, Parameters<typeof Badge>[0]["tone"]> = { Draft: "neutral", Scheduled: "blue", Simulated: "peach" };
const STATUS_TEXT: Record<CampaignStatus, string> = { Draft: "Draft", Scheduled: "Scheduled (demo)", Simulated: "Run in demo mode" };

export function CampaignsPage() {
  const { data, isLoading, isError, refetch } = useCampaigns();
  const { contacts, loading: contactsLoading } = useCrmContacts();
  const { can } = useRole();
  const manage = can("campaigns");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => (data ?? []).filter((c) => filter === "all" || c.status === filter).map((c) => ({ c, p: previewAudience(contacts, c.audience, c.channel) })), [data, filter, contacts]);
  const open = data?.find((c) => c.id === openId);
  const when = (c: Campaign) => (c.status === "Scheduled" ? `For ${fmtDate(c.scheduledFor!, true)}` : c.status === "Simulated" ? `Run ${fmtDate(c.simulatedAt!, true)}` : `Created ${fmtDate(c.createdAt, true)}`);
  const channel = (c: Campaign) => <span className="inline-flex items-center gap-1.5">{c.channel === "email" ? <Mail className="size-4 text-muted" aria-hidden /> : <MessageSquare className="size-4 text-muted" aria-hidden />}{c.channel === "email" ? "Email" : "SMS"}</span>;
  const audience = (p: ReturnType<typeof previewAudience>) => (contactsLoading ? "…" : <><span className="font-medium">{p.eligible.length}</span> eligible <span className="text-muted">of {p.matched.length}</span></>);
  const newBtn = manage ? <Button onClick={() => setCreating(true)}><Plus className="size-4" />New campaign</Button> : null;

  return (
    <>
      <PageHeader title="Campaigns" subtitle="Plan marketing messages and see who is eligible to receive them" actions={<><Badge tone="peach">Demo mode</Badge>{newBtn}</>} />
      <StatGrid>
        {([["all", "All campaigns", (data ?? []).length, "Planned so far", Megaphone, "blue"], ["Draft", "Drafts", (data ?? []).filter((c) => c.status === "Draft").length, "Not scheduled", Pencil, "slate"], ["Scheduled", "Scheduled", (data ?? []).filter((c) => c.status === "Scheduled").length, "Demo schedule", CalendarClock, "cyan"], ["Simulated", "Run in demo mode", (data ?? []).filter((c) => c.status === "Simulated").length, "Nothing was delivered", PlayCircle, "peach"]] as const).map(([k, l, n, hint, icon, tone]) => (
          <StatTile key={k} label={l} value={isLoading ? "–" : n} hint={hint} icon={icon} tone={tone} active={filter === k} onClick={() => setFilter(k as Filter)} />))}
      </StatGrid>
      <Alert tone="info" title="Nothing is sent from this screen">No email or SMS provider is connected, so campaigns can only be configured, scheduled for the demo and simulated. Marketing goes only to people with explicit consent. Appointment confirmations and reminders belong to Practice Management.</Alert>
      <div className="mb-3 mt-4"><Segmented label="Campaign status" value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, { value: "Draft", label: "Drafts" }, { value: "Scheduled", label: "Scheduled" }, { value: "Simulated", label: "Run in demo" }]} /></div>
      <Panel>
        {isLoading ? <SkeletonRows rows={4} /> : isError ? <EmptyState title="Couldn't load campaigns" text="Check your connection and try again." action={<Button variant="secondary" onClick={() => refetch()}>Try again</Button>} />
          : rows.length === 0 ? <EmptyState title={data?.length ? "No campaigns in this view" : "No campaigns yet"} text={data?.length ? "Try another status." : "Create a campaign to choose an audience and write a message."} action={data?.length ? undefined : newBtn} /> : (
          <>
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[720px]">
              <thead className="border-b border-line bg-cloud/50"><tr><Th>Campaign</Th><Th>Channel</Th><Th>Status</Th><Th>Audience</Th><Th>Schedule</Th></tr></thead>
              <tbody className="divide-y divide-line">{rows.map(({ c, p }) => (
                <tr key={c.id} tabIndex={0} onClick={() => setOpenId(c.id)} onKeyDown={(e) => e.key === "Enter" && setOpenId(c.id)} className="cursor-pointer hover:bg-cloud/50 focus-visible:bg-cloud/50">
                  <Td><p className="font-medium">{c.name}</p><p className="text-xs text-muted">{c.id}{c.sample ? " · has sample figures" : ""}</p></Td>
                  <Td>{channel(c)}</Td><Td><Badge tone={TONE[c.status]}>{STATUS_TEXT[c.status]}</Badge></Td><Td>{audience(p)}</Td><Td className="text-muted">{when(c)}</Td></tr>))}</tbody></table></div>
            <ul className="divide-y divide-line md:hidden">{rows.map(({ c, p }) => (
              <li key={c.id}><button onClick={() => setOpenId(c.id)} className="block w-full px-4 py-3 text-left">
                <div className="flex items-start justify-between gap-2"><p className="font-medium">{c.name}</p><Badge tone={TONE[c.status]}>{STATUS_TEXT[c.status]}</Badge></div>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">{channel(c)}<span aria-hidden>·</span>{audience(p)}<span aria-hidden>·</span>{when(c)}</p></button></li>))}</ul>
          </>)}
      </Panel>
      <CampaignSheet campaign={open} creating={creating} canManage={manage} contacts={contacts} onClose={() => { setOpenId(null); setCreating(false); }} onOpen={(id) => { setCreating(false); setOpenId(id); }} />
    </>
  );
}
