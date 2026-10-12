"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { ArrowUp, Bot, Maximize2, Minimize2, RotateCcw, X } from "lucide-react";
import { Badge, Button, Skeleton } from "@/components/ui";
import { askEvi, prepSummary, type EviAnswer, type PrepSummary } from "@/lib/insight";
import { api, fmtDate } from "@/lib/db";
import { useAction, useRole, useVisits } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { useUI, type EviOpen } from "./ui-state";
import { markEviUsed } from "./guide";
import { EviAvatar, EviPeek } from "./evi-mascot";
import { toast } from "sonner";

type Msg = { role: "user"; text: string } | { role: "evi"; answer: EviAnswer } | { role: "pending" };
let HISTORY: Msg[] = []; // conversation history survives closing and reopening the panel

function Sec({ t, items, empty }: { t: string; items: string[]; empty: string }) {
  return (
    <div><p className="text-[11px] font-medium uppercase tracking-wide text-muted">{t}</p>
      {items.length ? <ul className="mt-0.5 space-y-0.5">{items.map((i) => <li key={i} className="text-[13px]">{i}</li>)}</ul> : <p className="text-[13px] text-muted">{empty}</p>}</div>
  );
}
export function PrepCard({ prep }: { prep: PrepSummary }) {
  const router = useRouter();
  return (
    <div className="mt-3 space-y-3 rounded-lg border border-line bg-white p-3.5">
      {prep.reason && <p className="text-[13px] font-medium">{prep.reason}</p>}
      <Sec t="Previous visits" items={prep.visits.map((v) => `${v.label}${v.sub ? ` — ${v.sub}` : ""}`)} empty="No previous visits" />
      <Sec t="Treatments" items={prep.treatments} empty="No documented treatments" />
      <Sec t="Recent notes" items={prep.notes} empty="No notes on file" />
      <Sec t="Forms and documents" items={prep.forms} empty="No forms on file" />
      <Sec t="Photos and injection plot" items={[`${prep.photos} photo${prep.photos === 1 ? "" : "s"} on file`, prep.plot ? `Previous plot: ${prep.plot.points} points on ${fmtDate(prep.plot.date)}` : "No previous plot"]} empty="" />
      <Sec t="Follow-up history" items={prep.followUps} empty="No follow-ups" />
      <p className="border-t border-line pt-2 text-[11px] text-muted">Summary of documented information only. It does not include diagnosis or treatment recommendations.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => router.push(`/patients/${prep.patientId}?tab=journey`)}>Open journey</Button>
        {prep.plot && <Button size="sm" variant="secondary" onClick={() => router.push(`/visits/${prep.plot!.visitId}?tab=plotting`)}>View previous plot</Button>}
      </div>
    </div>
  );
}

function useContext_() {
  const path = usePathname();
  const { data: visits } = useVisits();
  return useMemo(() => {
    const pm = path.match(/^\/patients\/([^/]+)/); const vm = path.match(/^\/visits\/([^/]+)/);
    const visit = vm ? visits?.find((v) => v.id === vm[1]) : undefined;
    const patientId = pm?.[1] ?? visit?.patientId;
    if (vm) return { label: "Visit", patientId, sugg: ["Prepare this visit", "Summarize the previous visit", "What forms are still missing?"] };
    if (pm) return { label: "Patient", patientId, sugg: ["Summarize recent visits", "Show follow-up history", "What is the outstanding balance?"] };
    if (path.startsWith("/follow-ups")) return { label: "Follow-ups", patientId, sugg: ["Show today's follow-ups", "Which patients have not returned after treatment?"] };
    if (path.startsWith("/practice/inventory")) return { label: "Inventory", patientId, sugg: ["What is running low?"] };
    if (path.startsWith("/overview?view=flow") || path.startsWith("/overview") || path.startsWith("/calendar")) return { label: path.startsWith("/overview") ? "Today" : path.startsWith("/calendar") ? "Calendar" : "Front desk", patientId, sugg: ["Who is waiting now?", "What needs attention today?", "Show today's no-shows", "Prepare my next visit"] };
    return { label: "Practice", patientId, sugg: ["Who is waiting now?", "What needs attention today?", "Show today's follow-ups", "Prepare my next visit"] };
  }, [path, visits]);
}

export function EviDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial: EviOpen }) {
  const router = useRouter();
  const ui = useUI();
  const { can } = useRole();
  const ctx = useContext_();
  const [msgs, setMsgsState] = useState<Msg[]>(HISTORY);
  const setMsgs = (f: (m: Msg[]) => Msg[]) => setMsgsState((m) => { const n = f(m); HISTORY = n; return n; });
  const [q, setQ] = useState("");
  const [wide, setWide] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const start = useAction(api.startVisit);

  const ask = (text: string, answer?: EviAnswer) => {
    if (!text.trim()) return;
    markEviUsed();
    setMsgs((m) => [...m, { role: "user", text }, { role: "pending" }]);
    setQ("");
    setTimeout(() => setMsgs((m) => [...m.filter((x) => x.role !== "pending"), { role: "evi", answer: answer ?? askEvi(text, { can, patientId: ctx.patientId }) }]), 600);
  };
  useEffect(() => {
    if (!open) return;
    if (initial.prep) {
      const prep = prepSummary(initial.prep.patientId, initial.prep.apptId);
      setTimeout(() => ask(`Prepare this visit: ${prep.name}`, { kind: "summary", source: "Visits, notes, forms, photos and plots on file", text: `Visit Preparation summary for ${prep.name}.`, prep, links: [{ label: "Open patient", href: `/patients/${prep.patientId}` }, ...(initial.prep!.apptId ? [{ label: "Start visit", startAppt: initial.prep!.apptId }] : [])] }), 0);
    } else if (initial.prompt) setTimeout(() => ask(initial.prompt!), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, open]);
  const go = (href: string) => { router.push(href); };
  const empty = msgs.length === 0;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()} modal={false}>
      <Dialog.Portal>
        <Dialog.Content onInteractOutside={(e) => e.preventDefault()} onOpenAutoFocus={(e) => { e.preventDefault(); document.getElementById("evi-input")?.focus(); }}
          className={cn("anim-panel fixed bottom-0 right-0 top-0 z-[55] flex max-w-full flex-col border-l border-line bg-white shadow-2xl focus:outline-none", wide ? "w-[min(760px,100vw)]" : "w-[min(440px,100vw)]")}>
          <Dialog.Title className="sr-only">Ask EVI</Dialog.Title>
          <Dialog.Description className="sr-only">Conversation with EVI about your practice. Context: {ctx.label}</Dialog.Description>
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <EviAvatar size={30} />
            <div className="min-w-0"><p className="text-sm font-semibold leading-tight">EVI</p><p className="text-xs text-muted">Practice assistant</p></div>
            <Badge tone="blue" className="ml-1" aria-label={`Context: ${ctx.label}`}>Context · {ctx.label}</Badge>
            <div className="ml-auto flex items-center gap-0.5">
              {!empty && <button onClick={() => { setMsgs(() => []); }} className="rounded-md p-1.5 text-muted hover:bg-cloud" aria-label="New conversation" title="New conversation"><RotateCcw className="size-4" /></button>}
              <button onClick={() => ui.openAgents()} className="rounded-md p-1.5 text-muted hover:bg-cloud" aria-label="Open agents directory" title="Agents directory"><Bot className="size-4" /></button>
              <button onClick={() => setWide((w) => !w)} className="hidden rounded-md p-1.5 text-muted hover:bg-cloud sm:block" aria-label={wide ? "Collapse panel" : "Expand panel"}>{wide ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}</button>
              <Dialog.Close className="rounded-md p-1.5 text-muted hover:bg-cloud" aria-label="Close EVI"><X className="size-4" /></Dialog.Close>
            </div>
          </div>
          <div className="scroll-thin flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
            {empty && (
              <div className="rounded-xl bg-[#EAF3FB]/70 pl-4 pt-3"><div className="flex items-end justify-between gap-3"><p className="pb-3 text-sm"><span className="font-semibold">Hi, I&apos;m EVI.</span><br /><span className="text-muted">Ask about today&apos;s schedule, waiting patients, follow-ups or documented patient history. I use the screen you are on as context.</span></p><EviPeek width={100} className="shrink-0" /></div></div>)}
            {msgs.map((m, i) =>
              m.role === "user" ? <div key={i} className="flex justify-end"><p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-white">{m.text}</p></div>
              : m.role === "pending" ? <div key={i} className="space-y-2" aria-label="EVI is thinking"><Skeleton className="w-3/5" /><Skeleton className="w-2/5" /></div>
              : (
                <div key={i} className="max-w-[96%]">
                  {m.answer.kind && <Badge tone={m.answer.kind === "facts" ? "mint" : "lavender"} className="mb-1.5">{m.answer.kind === "facts" ? "Documented facts" : "Generated summary"}</Badge>}
                  <p className="text-sm">{m.answer.text}</p>
                  {m.answer.prep && <PrepCard prep={m.answer.prep} />}
                  {m.answer.rows && m.answer.rows.length > 0 && (
                    <ul className="mt-2.5 divide-y divide-line overflow-hidden rounded-lg border border-line">
                      {m.answer.rows.map((r, j) => (
                        <li key={j} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                          <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium">{r.title}</p>{r.meta && <p className="truncate text-xs text-muted">{r.meta}</p>}</div>
                          {r.right && <span className="text-xs font-medium text-[#7A4B00]">{r.right}</span>}
                          {r.patientId && <button className="text-[13px] font-medium text-primary hover:underline" onClick={() => go(`/patients/${r.patientId}`)}>Open patient</button>}
                          {r.apptId && <button className="text-[13px] font-medium text-primary hover:underline" onClick={() => ui.openAppt(r.apptId!)}>Appointment</button>}
                          {r.href && <button className="text-[13px] font-medium text-primary hover:underline" onClick={() => go(r.href!)}>Open</button>}
                        </li>))}
                    </ul>)}
                  {m.answer.links && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {m.answer.links.map((l) => (
                        <Button key={l.label} size="sm" variant="secondary" onClick={async () => {
                          if (l.href) go(l.href);
                          else if (l.prep) ask("Summarize visits", { kind: "summary", source: "Visits, notes, forms, photos and plots on file", text: "Documented history", prep: prepSummary(l.prep.patientId, l.prep.apptId) });
                          else if (l.startAppt) { const v = await start.run(l.startAppt); toast.success("Visit started"); go(`/visits/${v.id}`); }
                          else ask(l.label);
                        }}>{l.label}</Button>))}
                    </div>)}
                  {m.answer.source && <p className="mt-2 text-[11px] text-muted">Source: {m.answer.source}</p>}
                </div>))}
            <div ref={end} />
          </div>
          <div className="border-t border-line p-3">
            <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Suggested prompts">{ctx.sugg.map((s) => <button key={s} onClick={() => ask(s)} className="rounded-full border border-line px-2.5 py-1 text-xs hover:border-primary/50 hover:bg-active/50">{s}</button>)}</div>
            <form className="flex items-center gap-2 rounded-lg border border-line px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
              <input id="evi-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask EVI about your practice..." aria-label="Ask EVI" className="h-11 flex-1 bg-transparent text-sm outline-none" />
              <button type="submit" disabled={!q.trim()} aria-label="Send" className="grid size-7 place-items-center rounded-md bg-primary text-white disabled:opacity-40"><ArrowUp className="size-4" /></button>
            </form>
            <p className="mt-1.5 text-[11px] text-muted">EVI summarizes documented records. It does not diagnose or recommend treatment, placement or dosage.</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
