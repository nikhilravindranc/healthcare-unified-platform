"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Circle, X } from "lucide-react";
import { Button, Sheet } from "@/components/ui";
import { useAppointments, usePatients, useVisits } from "@/lib/hooks";
import { useSettings } from "@/lib/settings";
import { TODAY } from "@/lib/db";
import { cn } from "@/lib/utils";
import { useUI } from "./ui-state";
import { EviPeek, EviSprite } from "./evi-mascot";

interface Step { t: string; d: string; sprite?: number; href?: string; go?: string; search?: boolean }
const STEPS: Step[] = [
  { t: "Hi, I'm EVI", d: "I'll show you around in seven short steps. You can leave any time and reopen this from Help." },
  { t: "Run the day", d: "Overview shows today's schedule and who is waiting. In Calendar, click an appointment for details or an empty slot to book.", sprite: 1, href: "/calendar", go: "Open calendar" },
  { t: "Move patients through the visit", d: "Front desk: check in, move to waiting, start the visit, then complete it. Actions change with each status.", sprite: 0, href: "/overview?view=flow", go: "Open front desk" },
  { t: "Find anything fast", d: "Ctrl K searches patients, appointments and visits. Ctrl J or Ask EVI answers questions such as “Who is waiting?”. Use + New to add patients, appointments and follow-ups.", search: true },
  { t: "Document a visit", d: "Visits has tabs for notes, treatment, forms, photos and follow-up. Injection plotting records where treatment was given.", sprite: 3, href: "/visits", go: "Open visits" },
  { t: "Keep follow-ups moving", d: "Follow-ups lists what is due, overdue and upcoming. Complete one or schedule the next appointment from the same row.", sprite: 2, href: "/follow-ups", go: "Open follow-ups" },
  { t: "Let agents help", d: "Six agents review the schedule, follow-ups, recalls, no-shows and visit history. They summarize documented information only. They never diagnose or recommend treatment.", sprite: 5, href: "/agents", go: "Open AI agents" },
  { t: "Set up your practice", d: "Providers, services, locations and rooms live under Practice in the sidebar. That's the tour. I'm in Ask EVI whenever you need me.", href: "/practice/team", go: "Open providers" },
];

export function GuidePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const ui = useUI();
  const [i, setI] = useState(0);
  useEffect(() => { if (open) setI(0); }, [open]);
  const s = STEPS[i];
  const last = i === STEPS.length - 1;
  const go = (fn: () => void) => { onClose(); fn(); };
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Quick guide" description={`Step ${i + 1} of ${STEPS.length}`} width={420}
      footer={<div className="flex w-full items-center justify-between">
        <Button variant="ghost" onClick={() => setI(i - 1)} disabled={i === 0}>Back</Button>
        <ol className="flex gap-1.5" aria-label="Progress">{STEPS.map((_, n) => <li key={n}><button aria-label={`Step ${n + 1}`} aria-current={n === i} onClick={() => setI(n)} className={cn("size-2 rounded-full", n === i ? "bg-primary" : "bg-line hover:bg-slate-300")} /></li>)}</ol>
        {last ? <Button onClick={onClose}>Done</Button> : <Button onClick={() => setI(i + 1)}>{i === 0 ? "Start tour" : "Next"}</Button>}
      </div>}>
      <div key={i} className="anim-fade">
        <div className="mb-5 grid h-44 place-items-center rounded-xl bg-gradient-to-b from-[#EAF3FB] to-white">
          {s.sprite != null ? <EviSprite index={s.sprite} width={190} /> : <EviPeek width={190} />}
        </div>
        <div className="relative rounded-xl border border-line bg-white p-4">
          <span className="absolute -top-1.5 left-10 size-3 rotate-45 border-l border-t border-line bg-white" aria-hidden />
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Step {i + 1} of {STEPS.length}</p>
          <h3 className="mt-1 text-[17px] font-semibold">{s.t}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.d}</p>
          {s.href && <button className="mt-3 text-[13px] font-medium text-primary hover:underline" onClick={() => go(() => router.push(s.href!))}>{s.go}</button>}
          {s.search && <div className="mt-3 flex gap-4 text-[13px] font-medium text-primary"><button className="hover:underline" onClick={() => go(ui.openSearch)}>Try search</button><button className="hover:underline" onClick={() => go(() => ui.evi())}>Ask EVI</button></div>}
        </div>
      </div>
    </Sheet>
  );
}

const FLAG = "pms.checklist";
export const markEviUsed = () => { try { localStorage.setItem(FLAG + ".evi", "1"); } catch {} };

export function GettingStarted() {
  const { data: patients } = usePatients();
  const { data: appts } = useAppointments();
  const { data: visits } = useVisits();
  const ui = useUI();
  const st = useSettings();
  const [hidden, setHidden] = useState(true);
  const [evi, setEvi] = useState(false);
  useEffect(() => {
    try { setHidden(localStorage.getItem(FLAG + ".hidden") === "1"); setEvi(localStorage.getItem(FLAG + ".evi") === "1"); } catch { setHidden(false); }
    const t = setInterval(() => { try { setEvi(localStorage.getItem(FLAG + ".evi") === "1"); } catch {} }, 1500);
    return () => clearInterval(t);
  }, []);
  if (hidden || !patients || !appts || !visits) return null;

  const items = [
    { k: "patient", l: "Add a patient", done: patients.length > 12, run: ui.newPatient },
    { k: "appt", l: "Book an appointment", done: appts.length > 23, run: () => ui.newAppt() },
    { k: "checkin", l: "Check a patient in", done: appts.filter((a) => a.date === TODAY && ["arrived", "waiting", "in_progress", "completed"].includes(a.status)).length > 8, href: "/overview?view=flow" },
    { k: "visit", l: "Complete a visit", done: visits.filter((v) => v.date === TODAY && v.status === "Completed").length > 3, href: "/overview?view=flow" },
    { k: "evi", l: "Ask EVI a question", done: evi, run: () => ui.evi() },
  ];
  if (st.setupPending.includes("provider")) items.unshift({ k: "prov", l: "Add a provider", done: false, href: "/practice/team" } as (typeof items)[number]);
  if (st.setupPending.includes("services")) items.unshift({ k: "svc", l: "Add services", done: false, href: "/practice/services" } as (typeof items)[number]);
  const n = items.filter((i) => i.done).length;
  const dismiss = () => { try { localStorage.setItem(FLAG + ".hidden", "1"); } catch {} setHidden(true); };

  return (
    <section aria-label="Getting started" className="mb-5 rounded-xl border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-[15px] font-semibold">Getting started</h2><p className="text-xs text-muted">{n === items.length ? "All done. Nice work." : `${n} of ${items.length} done`}</p></div>
        <div className="flex items-center gap-3">
          <button onClick={ui.guide} className="text-[13px] font-medium text-primary hover:underline">Quick guide</button>
          <button onClick={dismiss} aria-label="Dismiss getting started" className="rounded-md p-1 text-muted hover:bg-cloud"><X className="size-4" /></button>
        </div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-cloud" role="progressbar" aria-valuenow={n} aria-valuemax={items.length} aria-label="Getting started progress"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(n / items.length) * 100}%` }} /></div>
      <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((i) => (
          <li key={i.k} className="flex items-center gap-2 text-[13px]">
            {i.done ? <Check className="size-4 shrink-0 text-[#2A8577]" aria-label="Done" /> : <Circle className="size-3.5 shrink-0 text-slate-300" aria-hidden />}
            {i.done ? <span className="text-muted line-through">{i.l}</span> : i.href ? <Link href={i.href} className="font-medium hover:text-primary">{i.l}</Link> : <button onClick={i.run} className="font-medium hover:text-primary">{i.l}</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}
