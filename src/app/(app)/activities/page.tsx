"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Phone, Plus, Search, StickyNote, Users } from "lucide-react";
import { toast } from "sonner";
import { Alert, Badge, Button, EmptyState, Field, Input, Modal, PageTitle, Pagination, Panel, Segmented, Select, Sheet, SkeletonRows, Td, Textarea, Th } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { fmtDate, pname, TODAY } from "@/lib/db";
import { useAction, useFollowUps, usePatients, useRefs, useRole } from "@/lib/hooks";
import { activitiesApi } from "@/modules/activities/api";
import { useActivities } from "@/modules/activities/hooks";
import { buildActivityRows, inView, isDueSoon, isOverdue, sortRows, type ActivityView } from "@/modules/activities/rows";
import { ACTIVITY_TYPES, TYPE_LABEL, type ActivityRow, type ActivityType, type Priority } from "@/modules/activities/types";
import { commsApi } from "@/modules/comms/api";
import { useMessages } from "@/modules/comms/hooks";
import { enquiriesApi } from "@/modules/enquiries/api";
import { useEnquiries } from "@/modules/enquiries/hooks";
import { cn } from "@/lib/utils";

const PAGE = 12;
const ICON: Record<ActivityType, typeof Phone> = { call: Phone, task: StickyNote, meeting: Users, other: CalendarClock };
const VIEWS: { value: ActivityView; label: string }[] = [{ value: "all", label: "All" }, { value: "mine", label: "My activities" }, { value: "upcoming", label: "Upcoming" }, { value: "overdue", label: "Overdue" }, { value: "completed", label: "Completed" }];

export default function ActivitiesPage() { return <Suspense><Activities /></Suspense>; }

function Activities() {
  const { can } = useRole(); const session = useSession();
  const { data: acts, isLoading } = useActivities(); const { data: enquiries } = useEnquiries(); const { data: messages } = useMessages(); const { data: refs } = useRefs();
  const canEnq = can("enquiries") || can("enquiries_view");
  const [view, setView] = useState<ActivityView>("all"); const [q, setQ] = useState("");
  const [f, setF] = useState({ type: "", status: "", owner: "", from: "", to: "" });
  const [page, setPage] = useState(1); const [open, setOpen] = useState<ActivityRow | null>(null); const [logging, setLogging] = useState(false);
  useEffect(() => setPage(1), [view, q, f]);

  const rows = useMemo(() => sortRows(buildActivityRows({
    activities: acts ?? [], enquiries: canEnq ? enquiries ?? [] : [], messages: (messages ?? []).filter((m) => canEnq || !!m.patientId),
    userName: (id) => refs?.users.find((u) => u.id === id)?.name, personName: (id) => (id ? pname(id) : undefined),
  }), TODAY), [acts, enquiries, messages, refs, canEnq]);
  const shown = rows.filter((r) => inView(r, view, TODAY, session?.name)
    && (!q.trim() || `${r.subject} ${r.link?.label ?? ""} ${r.owner ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()))
    && (!f.type || r.type === f.type) && (!f.status || r.status === f.status) && (!f.owner || r.owner === f.owner)
    && (!f.from || (r.due ?? r.date) >= f.from) && (!f.to || (r.due ?? r.date) <= f.to));
  const pages = Math.ceil(shown.length / PAGE); const slice = shown.slice((page - 1) * PAGE, page * PAGE);
  const owners = [...new Set(rows.map((r) => r.owner).filter(Boolean))] as string[];
  const overdueN = rows.filter((r) => isOverdue(r, TODAY)).length;
  const on = Object.values(f).some(Boolean) || !!q;

  return (
    <>
      <PageTitle title="Activities" description="Calls, tasks and meetings in one place: what was done and what is planned. Follow-ups stay in Follow-ups."
        actions={<Button onClick={() => setLogging(true)}><Plus className="size-4" aria-hidden />Log activity</Button>} />
      {overdueN > 0 && <p className="mb-3 text-[13px] text-[#7A4B00]" role="status">{overdueN} planned {overdueN === 1 ? "activity is" : "activities are"} overdue.</p>}
      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="max-w-full overflow-x-auto scroll-thin"><Segmented label="Activity view" value={view} onChange={setView} options={VIEWS} /></div>
          <div className="relative min-w-52 flex-1 sm:max-w-xs"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden /><Input aria-label="Search activities" className="h-9 pl-9" placeholder="Subject, person or owner" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-line bg-cloud/40 px-3 py-2.5">
          <Select sm className="w-32" aria-label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="">All types</option>{ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</Select>
          <Select sm className="w-36" aria-label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">Any status</option><option>Planned</option><option>Completed</option><option>Cancelled</option></Select>
          <Select sm className="w-40" aria-label="Owner" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}><option value="">Any owner</option>{owners.map((o) => <option key={o}>{o}</option>)}</Select>
          <label className="flex items-center gap-1.5 text-xs text-muted">From<Input type="date" aria-label="From date" className="h-8 w-36" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
          <label className="flex items-center gap-1.5 text-xs text-muted">To<Input type="date" aria-label="To date" className="h-8 w-36" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
          {on && <Button size="sm" variant="ghost" onClick={() => { setF({ type: "", status: "", owner: "", from: "", to: "" }); setQ(""); }}>Clear filters</Button>}
        </div>
        {isLoading ? <SkeletonRows rows={6} /> : shown.length === 0 ? (
          <EmptyState title={rows.length === 0 ? "No activities yet" : "No activities match"} text={rows.length === 0 ? "Log a call, task or meeting to start the list." : "Change the view or clear the filters."} action={<Button onClick={() => setLogging(true)}>Log activity</Button>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <caption className="sr-only">Activities, overdue first. Open a row for details.</caption>
                <thead className="border-b border-line"><tr><Th>Activity</Th><Th>Linked to</Th><Th className="hidden md:table-cell">Owner</Th><Th>When</Th><Th>Status</Th><Th className="hidden lg:table-cell">Outcome</Th></tr></thead>
                <tbody className="divide-y divide-line">
                  {slice.map((r) => {
                    const Icon = ICON[r.type]; const late = isOverdue(r, TODAY); const soon = isDueSoon(r, TODAY);
                    return (
                      <tr key={r.key} className="hover:bg-cloud/40">
                        <Td><button onClick={() => setOpen(r)} className="flex items-center gap-2.5 text-left font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"><span className="grid size-7 shrink-0 place-items-center rounded-md bg-cloud text-slate-600"><Icon className="size-3.5" aria-hidden /></span><span className="min-w-0"><span className="block truncate">{r.subject}</span><span className="block text-xs font-normal text-muted">{TYPE_LABEL[r.type]}{r.direction ? ` · ${r.direction === "incoming" ? "Incoming" : "Outgoing"}` : ""}</span></span></button></Td>
                        <Td>{r.link ? <Link href={r.link.href} className="text-primary hover:underline">{r.link.label}</Link> : <span className="text-muted">Not linked</span>}</Td>
                        <Td className="hidden md:table-cell">{r.owner ?? <span className="text-muted">Unassigned</span>}</Td>
                        <Td className="whitespace-nowrap">{r.due ? <span className={cn(late && "font-medium text-[#8F2D2D]", soon && "font-medium text-[#7A4B00]")}>{late ? "Overdue · " : soon ? "Due soon · " : "Due "}{fmtDate(r.due, true)}</span> : fmtDate(r.date, true)}</Td>
                        <Td><Badge tone={r.status === "Completed" ? "mint" : r.status === "Cancelled" ? "neutral" : "blue"}>{r.status}</Badge></Td>
                        <Td className="hidden max-w-[220px] truncate text-muted lg:table-cell">{r.outcome ?? "—"}</Td>
                      </tr>);
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pages} onPage={setPage} total={shown.length} />
          </>)}
      </Panel>
      <ActivitySheet row={open} onClose={() => setOpen(null)} />
      <LogActivity open={logging} onClose={() => setLogging(false)} />
    </>
  );
}

function ActivitySheet({ row: r, onClose }: { row: ActivityRow | null; onClose: () => void }) {
  const { data: fus } = useFollowUps();
  const complete = useAction(activitiesApi.complete, "Activity completed"); const doneTask = useAction(enquiriesApi.completeTask, "Task completed");
  const [outcome, setOutcome] = useState(""); const [editing, setEditing] = useState(false); const [subject, setSubject] = useState(""); const [due, setDue] = useState(""); const [notes, setNotes] = useState("");
  const update = useAction(activitiesApi.update, "Activity updated"); const cancel = useAction(activitiesApi.update, "Activity cancelled");
  useEffect(() => { setOutcome(""); setEditing(false); if (r) { setSubject(r.subject); setDue(r.due ?? ""); setNotes(r.notes ?? ""); } }, [r?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const fu = r?.followUpId ? fus?.find((x) => x.id === r.followUpId) : undefined;
  const mine = r?.source === "activity";
  return (
    <Sheet open={!!r} onOpenChange={(o) => !o && onClose()} width={460} title={r?.subject ?? "Activity"} description={r ? `${TYPE_LABEL[r.type]} · ${r.status}` : undefined}
      footer={r && r.status === "Planned" && (
        <div className="flex w-full flex-wrap justify-between gap-2">
          {mine ? <Button variant="secondary" onClick={() => setEditing((x) => !x)} aria-expanded={editing}>Edit</Button> : <span />}
          <div className="flex gap-2">
            {mine && <Button variant="secondary" loading={cancel.pending} onClick={async () => { await cancel.run(r.ref.activityId!, { status: "Cancelled" }); onClose(); }}>Cancel activity</Button>}
            <Button loading={complete.pending || doneTask.pending} onClick={async () => { if (mine) await complete.run(r.ref.activityId!, outcome); else await doneTask.run(r.ref.enquiryId!, r.ref.taskId!); onClose(); }}>Mark complete</Button>
          </div>
        </div>)}>
      {r && (
        <div className="space-y-4 text-[13px]">
          <dl className="grid grid-cols-[110px_1fr] gap-y-2">
            <dt className="text-muted">Linked to</dt><dd>{r.link ? <Link className="text-primary hover:underline" href={r.link.href}>{r.link.label}</Link> : "Not linked"}</dd>
            <dt className="text-muted">Owner</dt><dd>{r.owner ?? "Unassigned"}</dd>
            <dt className="text-muted">{r.status === "Planned" ? "Planned for" : "Date"}</dt><dd>{fmtDate(r.date, true)}{r.time ? `, ${r.time}` : ""}</dd>
            {r.due && <><dt className="text-muted">Due</dt><dd>{fmtDate(r.due, true)}</dd></>}
            {r.priority && <><dt className="text-muted">Priority</dt><dd>{r.priority}</dd></>}
            {r.outcome && <><dt className="text-muted">Outcome</dt><dd>{r.outcome}</dd></>}
            <dt className="text-muted">Record</dt><dd>{r.source === "call-log" ? "Call log. Nothing is dialled or recorded by the app." : r.source === "enquiry-task" ? "Task on an enquiry" : "Activity"}</dd>
          </dl>
          {r.notes && <p className="whitespace-pre-wrap rounded-lg bg-cloud px-3 py-2">{r.notes}</p>}
          {fu && <Alert tone="info" title={`Linked follow-up: ${fu.type}`}>Due {fmtDate(fu.due, true)}, {fu.status}. Completing this activity does not complete the follow-up. <Link className="font-medium text-primary hover:underline" href="/follow-ups">Open follow-ups</Link></Alert>}
          {r.status === "Planned" && mine && editing && (
            <div className="space-y-3 rounded-lg border border-line p-3">
              <Field label="Subject"><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
              <Field label="Due"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
              <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
              <Button size="sm" loading={update.pending} disabled={!subject.trim()} onClick={async () => { await update.run(r.ref.activityId!, { subject: subject.trim(), due: due || undefined, notes }); setEditing(false); onClose(); }}>Save changes</Button>
            </div>)}
          {r.status === "Planned" && mine && !editing && <Field label="Outcome (optional)"><Input value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="What happened" /></Field>}
        </div>)}
    </Sheet>
  );
}

function LogActivity({ open, onClose }: { open: boolean; onClose: () => void }) {
  const session = useSession(); const { data: patients } = usePatients(); const { data: enquiries } = useEnquiries(); const { data: refs } = useRefs(); const { data: fus } = useFollowUps(); const { can } = useRole();
  const blank = { type: "call" as ActivityType, subject: "", link: "none" as "none" | "patient" | "enquiry", patientId: "", enquiryId: "", owner: "", date: TODAY, due: "", priority: "Normal" as Priority, direction: "outgoing" as "incoming" | "outgoing", state: "done" as "done" | "planned", followUpId: "", notes: "" };
  const [v, setV] = useState(blank); const [err, setErr] = useState("");
  const createAct = useAction(activitiesApi.create); const addTask = useAction(enquiriesApi.addTask); const logCall = useAction(commsApi.send);
  useEffect(() => { if (open) { setV({ ...blank, owner: session?.name ?? "" }); setErr(""); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const canEnq = can("enquiries");
  const users = refs?.users.filter((u) => u.status === "Active") ?? [];
  const myFus = (fus ?? []).filter((x) => v.patientId && x.patientId === v.patientId && x.status === "Open");
  const set = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));

  const save = async () => {
    if (!v.subject.trim() && v.type !== "call") return setErr("Add a subject.");
    if (v.type === "call" && v.link === "none") return setErr("Link the call to a patient or an enquiry, so it appears on their record.");
    if (v.link === "patient" && !v.patientId) return setErr("Choose a patient.");
    if (v.link === "enquiry" && !v.enquiryId) return setErr("Choose an enquiry.");
    const by = session?.name ?? "Staff"; const patientId = v.link === "patient" ? v.patientId : undefined; const enquiryId = v.link === "enquiry" ? v.enquiryId : undefined;
    if (v.type === "call") await logCall.run({ channel: "call", direction: v.direction, purpose: "service", subject: v.subject.trim(), body: v.notes, patientId, enquiryId }, { reach: { email: false, phone: false }, consent: { status: "not-recorded" } }, by);
    else if (v.type === "task" && enquiryId) { const owner = users.find((u) => u.name === v.owner); await addTask.run(enquiryId, { due: v.due || TODAY, note: v.subject.trim(), assigneeId: owner?.id ?? "" }); }
    else await createAct.run({ type: v.type as Exclude<ActivityType, "call">, subject: v.subject.trim(), patientId, enquiryId, followUpId: v.followUpId || undefined, owner: v.owner || by, date: v.date, due: v.type === "task" ? v.due || undefined : undefined, priority: v.type === "task" ? v.priority : undefined, status: v.type === "task" ? "Planned" : v.state === "done" ? "Completed" : "Planned", notes: v.notes || undefined });
    toast.success(v.type === "call" ? "Call logged" : "Activity saved");
    onClose();
  };
  const busy = createAct.pending || addTask.pending || logCall.pending;
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Log activity" description="Record a call, task or meeting. Nothing is dialled, recorded or sent." width={560}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Save activity</Button></>}>
      <div className="space-y-4">
        <Field label="Type"><Select value={v.type} onChange={(e) => set({ type: e.target.value as ActivityType })}>{ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</Select></Field>
        <Field label={v.type === "call" ? "Outcome" : "Subject"} required={v.type !== "call"} error={err.startsWith("Add") ? err : undefined}><Input value={v.subject} onChange={(e) => set({ subject: e.target.value })} placeholder={v.type === "call" ? "e.g. Booked a consultation" : v.type === "task" ? "e.g. Collect referral letter" : "What is it about"} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Linked to"><Select value={v.link} onChange={(e) => set({ link: e.target.value as typeof v.link })}><option value="none">Nothing</option><option value="patient">Patient</option>{canEnq && <option value="enquiry">Enquiry</option>}</Select></Field>
          {v.link === "patient" && <Field label="Patient"><Select value={v.patientId} onChange={(e) => set({ patientId: e.target.value, followUpId: "" })}><option value="">Choose a patient</option>{patients?.map((p) => <option key={p.id} value={p.id}>{p.first} {p.last} · {p.id}</option>)}</Select></Field>}
          {v.link === "enquiry" && <Field label="Enquiry"><Select value={v.enquiryId} onChange={(e) => set({ enquiryId: e.target.value })}><option value="">Choose an enquiry</option>{enquiries?.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.id}</option>)}</Select></Field>}
        </div>
        {v.type === "call" && <Field label="Direction"><Select value={v.direction} onChange={(e) => set({ direction: e.target.value as typeof v.direction })}><option value="outgoing">Outgoing</option><option value="incoming">Incoming</option></Select></Field>}
        {v.type !== "call" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Owner"><Select value={v.owner} onChange={(e) => set({ owner: e.target.value })}>{users.map((u) => <option key={u.id}>{u.name}</option>)}</Select></Field>
            {v.type === "task" ? <Field label="Due"><Input type="date" value={v.due} onChange={(e) => set({ due: e.target.value })} /></Field> : <Field label="Date"><Input type="date" value={v.date} onChange={(e) => set({ date: e.target.value })} /></Field>}
            {v.type === "task" && <Field label="Priority"><Select value={v.priority} onChange={(e) => set({ priority: e.target.value as Priority })}><option>Low</option><option>Normal</option><option>High</option></Select></Field>}
            {v.type !== "task" && <Field label="Status"><Select value={v.state} onChange={(e) => set({ state: e.target.value as typeof v.state })}><option value="done">Held or done</option><option value="planned">Scheduled</option></Select></Field>}
          </div>)}
        {myFus.length > 0 && v.type !== "call" && <Field label="Related follow-up (optional)" hint="Links only. Completing this activity does not complete the follow-up."><Select value={v.followUpId} onChange={(e) => set({ followUpId: e.target.value })}><option value="">None</option>{myFus.map((x) => <option key={x.id} value={x.id}>{x.type}, due {fmtDate(x.due, true)}</option>)}</Select></Field>}
        <Field label="Notes"><Textarea value={v.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
        {err && !err.startsWith("Add") && <p role="alert" className="text-xs text-danger">{err}</p>}
        {v.type === "task" && v.link === "enquiry" && <p className="text-xs text-muted">A task on an enquiry is saved on that enquiry, so it is not stored twice.</p>}
      </div>
    </Modal>
  );
}
