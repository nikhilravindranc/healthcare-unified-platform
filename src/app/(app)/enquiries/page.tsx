"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, GitFork, Inbox, KanbanSquare, List, Plus, Search } from "lucide-react";
import { Badge, Button, EmptyState, Input, PageHeader, Pagination, Panel, Select, SkeletonRows, Td, Th } from "@/components/ui";
import { RouteGuard } from "@/platform/route-guard";
import { fmtDate, TODAY } from "@/lib/db";
import { useRefs } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { useEnquiries } from "@/modules/enquiries/hooks";
import { EnquiryFormSheet } from "@/modules/enquiries/enquiry-form";
import { useEnquiryAccess } from "@/modules/enquiries/enquiry-actions";
import { EnquiryBoard } from "@/modules/enquiries/enquiry-board";
import { EnquiryFlow } from "@/modules/enquiries/enquiry-flow";
import { EnquiryDetailSheet } from "@/modules/enquiries/enquiry-detail";
import { EnquiryStatusBadge, isOpen } from "@/modules/enquiries/status";
import { ENQUIRY_SOURCES, ENQUIRY_STATUSES, type Enquiry } from "@/modules/enquiries/types";

const PAGE = 10;
type Tab = "all" | (typeof ENQUIRY_STATUSES)[number];
const nextTask = (e: Enquiry) => e.tasks.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due))[0];

export default function EnquiriesPage() {
  return <RouteGuard title="Enquiries" perms={["enquiries", "enquiries_view"]}><Suspense><Enquiries /></Suspense></RouteGuard>;
}

function Enquiries() {
  const { data, isLoading, isError, refetch } = useEnquiries();
  const { data: refs } = useRefs();
  const { readOnly } = useEnquiryAccess();
  const router = useRouter(); const params = useSearchParams();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [f, setF] = useState({ source: "", assignee: "" });
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [needPatient, setNeedPatient] = useState(false);
  const [view, setViewState] = useState<"list" | "board" | "flow">("list");
  useEffect(() => { try { const v = localStorage.getItem("enq.view"); if (v === "board" || v === "flow") setViewState(v); } catch {} }, []);
  const setView = (v: "list" | "board" | "flow") => { setViewState(v); try { localStorage.setItem("enq.view", v); } catch {} };
  const [form, setForm] = useState<{ open: boolean; enquiry?: Enquiry }>({ open: false });
  useEffect(() => { if (params.get("new")) { if (!readOnly) setForm({ open: true }); router.replace("/enquiries"); } const o = params.get("open"); if (o) { setOpenId(o); router.replace("/enquiries"); } }, [params, router, readOnly]);
  useEffect(() => setPage(1), [q, tab, f]);

  const svc = (id?: string) => refs?.services.find((s) => s.id === id)?.name ?? "General enquiry";
  const who = (id?: string) => refs?.users.find((u) => u.id === id)?.name;
  const counts = useMemo(() => Object.fromEntries(["all", ...ENQUIRY_STATUSES].map((t) => [t, (data ?? []).filter((e) => t === "all" || e.status === t).length])) as Record<Tab, number>, [data]);
  const matches = (e: Enquiry, withTab: boolean) => {
    const s = q.trim().toLowerCase();
    if (s && ![e.name, e.phone ?? "", e.email ?? "", e.id].some((x) => x.toLowerCase().includes(s))) return false;
    if (withTab && tab !== "all" && e.status !== tab) return false;
    if (f.source && e.source !== f.source) return false;
    if (f.assignee === "none" ? !!e.assigneeId : f.assignee && e.assigneeId !== f.assignee) return false;
    return true;
  };
  const rows = useMemo(() => (data ?? []).filter((e) => matches(e, true)), [data, q, tab, f]); // eslint-disable-line react-hooks/exhaustive-deps
  const boardRows = useMemo(() => (data ?? []).filter((e) => matches(e, false)), [data, q, f]); // eslint-disable-line react-hooks/exhaustive-deps
  const slice = rows.slice((page - 1) * PAGE, page * PAGE);
  const open = data?.find((e) => e.id === openId);
  const newBtn = readOnly ? null : <Button onClick={() => setForm({ open: true })}><Plus className="size-4" />New enquiry</Button>;
  const due = (e: Enquiry) => { const t = nextTask(e); if (!t || !isOpen(e.status)) return <span className="text-muted">—</span>; return <span className={t.due < TODAY ? "font-medium text-[#8F2D2D]" : ""}>{t.due === TODAY ? "Today" : fmtDate(t.due)}{t.due < TODAY && <span className="ml-1 text-xs">overdue</span>}</span>; };

  const filters = (
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-56 flex-1 sm:max-w-xs"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden /><Input aria-label="Search enquiries" className="h-9 pl-9" placeholder="Search by name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select sm className="w-40" aria-label="Source" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}><option value="">All sources</option>{ENQUIRY_SOURCES.map((s) => <option key={s}>{s}</option>)}</Select>
          <Select sm className="w-44" aria-label="Assigned staff" value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })}><option value="">All staff</option><option value="none">Unassigned</option>{refs?.users.filter((u) => u.status === "Active").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
          {(q || f.source || f.assignee) && <Button size="sm" variant="ghost" onClick={() => { setQ(""); setF({ source: "", assignee: "" }); }}>Clear</Button>}
        </div>
  );

  return (
    <>
      <PageHeader title="Enquiries" subtitle="People who have asked about your services, from first contact to booked appointment" actions={<>
        <div role="radiogroup" aria-label="View" className="inline-flex rounded-lg bg-cloud p-0.5">{([["list", "List", List], ["board", "Board", KanbanSquare], ["flow", "Flow", GitFork]] as const).map(([v, l, I]) => <button key={v} role="radio" aria-checked={view === v} onClick={() => setView(v)} className={cn("inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors", view === v ? "bg-white text-primary shadow-sm" : "text-muted hover:text-ink")}><I className="size-4" aria-hidden />{l}</button>)}</div>
        {newBtn}</>} />
      {readOnly && <p className="mb-3 flex items-center gap-1.5 rounded-lg border border-line bg-cloud/60 px-3 py-2 text-[13px] text-slate-600"><Eye className="size-4 shrink-0" aria-hidden />View-only access. Contact details are hidden and changes are turned off for your role.</p>}
      {view !== "list" ? (
        <>
          <Panel className="mb-4">{filters}</Panel>
          {isLoading ? <Panel><SkeletonRows rows={6} /></Panel> : isError ? <Panel><EmptyState title="Couldn't load enquiries" text="Check your connection and try again." action={<Button variant="secondary" onClick={() => refetch()}>Try again</Button>} /></Panel>
            : boardRows.length === 0 ? <Panel><EmptyState title={data?.length ? "No enquiries match" : "No enquiries yet"} text={data?.length ? "Try another search or filter." : "New enquiries will appear on the board."} action={data?.length ? undefined : newBtn} /></Panel>
            : view === "flow" ? <EnquiryFlow enquiries={boardRows} onOpen={(e, o) => { setNeedPatient(!!o?.needPatient); setOpenId(e.id); }} onEdit={(e) => setForm({ open: true, enquiry: e })} />
            : <EnquiryBoard enquiries={boardRows} onOpen={(e, o) => { setNeedPatient(!!o?.needPatient); setOpenId(e.id); }} onEdit={(e) => setForm({ open: true, enquiry: e })} />}
        </>
      ) : (
      <Panel>
        <div className="flex gap-1 overflow-x-auto border-b border-line px-3 pt-2" role="tablist" aria-label="Enquiry status">
          {(["all", ...ENQUIRY_STATUSES] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium", tab === t ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink")}>
              {t === "all" ? "All" : t} <span className="ml-1 text-xs text-muted">{counts[t]}</span></button>))}
        </div>
        {filters}
        {isLoading ? <SkeletonRows rows={8} /> : isError ? <EmptyState title="Couldn't load enquiries" text="Check your connection and try again." action={<Button variant="secondary" onClick={() => refetch()}>Try again</Button>} />
          : rows.length === 0 ? <EmptyState title={data?.length ? "No enquiries match" : "No enquiries yet"} text={data?.length ? "Try another search, status or filter." : "New enquiries from calls, walk-ins and your website will appear here."} action={data?.length ? undefined : newBtn} /> : (
          <>
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[820px]">
              <thead className="border-b border-line bg-cloud/50"><tr><Th>Contact</Th><Th>Requested service</Th><Th>Source</Th><Th>Received</Th><Th>Status</Th><Th>Assigned to</Th><Th>Next follow-up</Th></tr></thead>
              <tbody className="divide-y divide-line">{slice.map((e) => (
                <tr key={e.id} tabIndex={0} onClick={() => { setNeedPatient(false); setOpenId(e.id); }} onKeyDown={(k) => k.key === "Enter" && setOpenId(e.id)} className="cursor-pointer hover:bg-cloud/50 focus-visible:bg-cloud/50">
                  <Td><p className="font-medium">{e.name}</p><p className="text-xs text-muted">{readOnly ? "Contact details hidden" : e.phone ?? e.email}</p></Td>
                  <Td>{svc(e.serviceId)}</Td><Td>{e.source}</Td><Td>{fmtDate(e.received)}</Td><Td><EnquiryStatusBadge s={e.status} /></Td>
                  <Td>{who(e.assigneeId) ?? <span className="text-muted">Unassigned</span>}</Td><Td>{due(e)}</Td></tr>))}</tbody></table></div>
            <ul className="divide-y divide-line md:hidden">{slice.map((e) => (
              <li key={e.id}><button onClick={() => setOpenId(e.id)} className="block w-full px-4 py-3 text-left">
                <div className="flex items-start justify-between gap-2"><p className="font-medium">{e.name}</p><EnquiryStatusBadge s={e.status} /></div>
                <p className="mt-0.5 text-xs text-muted">{svc(e.serviceId)} · {e.source} · {fmtDate(e.received)}</p>
                <p className="mt-0.5 text-xs text-muted">{who(e.assigneeId) ?? "Unassigned"}{isOpen(e.status) && nextTask(e) ? <> · Follow-up {due(e)}</> : null}</p></button></li>))}</ul>
            <Pagination page={page} pages={Math.ceil(rows.length / PAGE)} onPage={setPage} total={rows.length} />
          </>)}
      </Panel>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><Inbox className="size-3.5" aria-hidden />Sample data for demonstration. <Badge tone="neutral">Demo</Badge></p>
      <EnquiryDetailSheet enquiry={open} needPatient={needPatient} onClose={() => { setOpenId(null); setNeedPatient(false); }} onEdit={(e) => { setOpenId(null); setForm({ open: true, enquiry: e }); }} />
      <EnquiryFormSheet open={form.open && !readOnly} enquiry={form.enquiry} onClose={() => setForm({ open: false })} onSaved={(e) => setOpenId(e.id)} />
    </>
  );
}
