"use client";
import { useMemo, useState } from "react";
import { AlertCircle, ChevronDown, Link2, PhoneCall } from "lucide-react";
import { Avatar } from "@/components/ui";
import { UserRound } from "lucide-react";
import { fmtDate, TODAY } from "@/lib/db";
import { cn } from "@/lib/utils";
import { ActionMenu, StageButton, useEnquiryAccess, useEnquiryActions, type OpenFn } from "./enquiry-actions";
import { isOpen } from "./status";
import { ENQUIRY_STATUSES, type Enquiry, type EnquiryStatus } from "./types";

const STAGE: Record<EnquiryStatus, { dot: string; hint: string }> = {
  New: { dot: "bg-[#9A9CD6]", hint: "Waiting for first contact" },
  Contacted: { dot: "bg-[#2867B2]", hint: "In conversation" },
  "Appointment booked": { dot: "bg-[#2A8577]", hint: "Won" },
  Closed: { dot: "bg-slate-400", hint: "Answered, no booking needed" },
  "Not converted": { dot: "bg-[#D9A441]", hint: "Did not book" },
};
const LIMIT = 6;
const nextTask = (e: Enquiry) => e.tasks.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due))[0];

/** Pipeline view of the same enquiries: drag a card between stages, or use the card buttons and menu. */
export function EnquiryBoard({ enquiries, onOpen, onEdit }: { enquiries: Enquiry[]; onOpen: OpenFn; onEdit: (e: Enquiry) => void }) {
  const act = useEnquiryActions(onOpen);
  const { readOnly } = useEnquiryAccess();
  const [over, setOver] = useState<EnquiryStatus | null>(null);
  const [expanded, setExpanded] = useState<Set<EnquiryStatus>>(new Set());

  const by_stage = useMemo(() => Object.fromEntries(ENQUIRY_STATUSES.map((s) => [s, enquiries.filter((e) => e.status === s)])) as Record<EnquiryStatus, Enquiry[]>, [enquiries]);
  const total = enquiries.length;
  const overdue = enquiries.filter((e) => isOpen(e.status) && (nextTask(e)?.due ?? "9") < TODAY).length;
  const booked = by_stage["Appointment booked"].length;
  const rate = total ? Math.round((booked / total) * 100) : 0;
  const drop = (to: EnquiryStatus, id: string) => { setOver(null); if (readOnly) return; const e = enquiries.find((x) => x.id === id); if (e) act.move(e, to); };

  return (
    <div>
      <dl className="mb-4 grid grid-cols-2 divide-x divide-y divide-line overflow-hidden rounded-xl border border-line bg-white sm:grid-cols-4 sm:divide-y-0">
        {[["Open enquiries", by_stage.New.length + by_stage.Contacted.length], ["Follow-ups overdue", overdue], ["Appointments booked", booked], ["Enquiry to appointment", `${rate}%`]].map(([l, n]) => (
          <div key={l} className="px-4 py-3"><dd className={cn("text-xl font-semibold", l === "Follow-ups overdue" && Number(n) > 0 && "text-[#8F2D2D]")}>{n}</dd><dt className="text-xs text-muted">{l}</dt></div>))}
      </dl>
      <p className="mb-2 text-xs text-muted">{readOnly ? "View-only: you can open cards but not move them." : "Drag a card to move it. Dropping on Appointment booked starts the booking."}</p>
      <div className="scroll-thin -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-3">
        {ENQUIRY_STATUSES.map((st) => {
          const all = by_stage[st]; const open = expanded.has(st); const list = open ? all : all.slice(0, LIMIT);
          return (
            <section key={st} aria-label={`${st}, ${all.length} enquiries`}
              onDragOver={(ev) => { if (readOnly) return; ev.preventDefault(); ev.dataTransfer.dropEffect = "move"; setOver(st); }} onDragLeave={() => setOver((o) => (o === st ? null : o))} onDrop={(ev) => drop(st, ev.dataTransfer.getData("text/plain"))}
              className={cn("flex w-[260px] shrink-0 snap-start flex-col rounded-xl border bg-cloud/50 sm:w-[236px] xl:w-auto xl:min-w-[200px] xl:flex-1", over === st ? "border-primary bg-active/60" : "border-line")}>
              <header className="px-3 pb-2 pt-3"><div className="flex items-center gap-2"><span className={cn("size-2.5 rounded-full", STAGE[st].dot)} aria-hidden /><h2 className="text-[13.5px] font-semibold">{st}</h2><span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-medium text-muted">{all.length}</span></div>
                <p className="mt-0.5 pl-[18px] text-xs text-muted">{STAGE[st].hint}</p></header>
              <ul className="flex flex-1 flex-col gap-2 px-2 pb-2">
                {list.length === 0 && <li className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-muted">Nothing here</li>}
                {list.map((e) => {
                  const t = nextTask(e); const late = !!t && isOpen(e.status) && t.due < TODAY;
                  return (
                    <li key={e.id} draggable={!readOnly} onDragStart={(ev) => { ev.dataTransfer.setData("text/plain", e.id); ev.dataTransfer.effectAllowed = "move"; }}
                      className="group rounded-lg border border-line bg-white p-3 shadow-sm hover:border-primary/40">
                      <div className="flex items-start gap-2">
                        <button onClick={() => onOpen(e)} className="min-w-0 flex-1 text-left"><p className="truncate text-[13.5px] font-semibold hover:text-primary">{e.name}</p><p className="truncate text-xs text-muted">{act.svc(e.serviceId)}</p></button>
                        <ActionMenu e={e} a={act} onOpen={onOpen} onEdit={onEdit} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <span>{e.source}</span><span aria-hidden>·</span><span>{fmtDate(e.received)}</span>
                        {e.patientId && <span className="inline-flex items-center gap-1 rounded bg-[#DDF3EF] px-1.5 py-0.5 font-medium text-[#1E6B61]"><Link2 className="size-3" aria-hidden />Patient</span>}
                      </div>
                      {t && isOpen(e.status) && <p className={cn("mt-2 flex items-center gap-1.5 text-xs", late ? "font-medium text-[#8F2D2D]" : "text-slate-600")}>{late ? <AlertCircle className="size-3.5" aria-hidden /> : <PhoneCall className="size-3.5" aria-hidden />}<span className="truncate">{t.note} · {t.due === TODAY ? "today" : fmtDate(t.due)}{late && " (overdue)"}</span></p>}
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="flex shrink-0 items-center text-xs text-muted" title={act.who(e.assigneeId) ?? "Unassigned"}>{act.who(e.assigneeId) ? <Avatar name={act.who(e.assigneeId)!} size={24} /> : <span className="grid size-6 place-items-center rounded-full border border-dashed border-slate-300" aria-label="Unassigned"><UserRound className="size-3 text-slate-400" aria-hidden /></span>}</span>
                        <StageButton e={e} a={act} onOpen={onOpen} />
                      </div>
                    </li>);
                })}
              </ul>
              {all.length > LIMIT && <button onClick={() => setExpanded((x) => { const n = new Set(x); if (n.has(st)) n.delete(st); else n.add(st); return n; })} aria-expanded={open} className="flex items-center justify-center gap-1 border-t border-line px-3 py-2 text-xs font-medium text-primary hover:bg-active/50">{open ? "Show fewer" : `Show all ${all.length}`}<ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} /></button>}
            </section>);
        })}
      </div>
    </div>
  );
}
