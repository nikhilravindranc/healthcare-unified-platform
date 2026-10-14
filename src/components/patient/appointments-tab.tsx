"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, ChevronDown } from "lucide-react";
import { Button, EmptyState, Panel, PanelHeader, Segmented, SkeletonRows, StatusBadge } from "@/components/ui";
import { useUI } from "@/components/app/ui-state";
import { isOpenStatus } from "@/lib/appointment-rules";
import { fmtDate, fmtTime, TODAY } from "@/lib/db";
import { useAppointments, useRefs, useVisits } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { Appointment, Patient } from "@/lib/types";

type F = "all" | "upcoming" | "attended" | "cancelled" | "no_show";
/** What a booking tells you. A booking is a plan: only a recorded visit shows that care took place. */
function outcome(a: Appointment): string {
  switch (a.status) {
    case "completed": return a.visitId ? "Attended. A visit is recorded." : "Marked completed. No visit is linked.";
    case "cancelled": return "Cancelled. Did not take place.";
    case "no_show": return "Did not attend.";
    case "in_progress": return "Visit under way.";
    case "arrived": case "waiting": return "Arrived, not yet seen.";
    default: return a.date < TODAY ? "Booked, but no attendance was recorded." : "Booked. Not yet attended.";
  }
}

/** The patient's whole booking history in one place. Rescheduling and cancelling stay in the appointment panel, which keeps the rules in one place. */
export function AppointmentsTab({ p, goto }: { p: Patient; goto?: (tab: string) => void }) {
  const { data: appts, isLoading } = useAppointments();
  const { data: visits } = useVisits();
  const { data: refs } = useRefs();
  const router = useRouter();
  const ui = useUI();
  const [f, setF] = useState<F>("all");
  const mine = useMemo(() => (appts ?? []).filter((a) => a.patientId === p.id), [appts, p.id]);
  const isUpcoming = (a: Appointment) => a.date >= TODAY && isOpenStatus(a.status);
  const groups = {
    upcoming: mine.filter(isUpcoming).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    attended: mine.filter((a) => a.status === "completed"),
    cancelled: mine.filter((a) => a.status === "cancelled"),
    no_show: mine.filter((a) => a.status === "no_show"),
  };
  /** Completed visits with no booking record behind them. Their attendance is shown in Care history; no booking is implied. */
  const unbooked = (visits ?? []).filter((v) => v.patientId === p.id && v.status === "Completed" && !mine.some((a) => a.visitId === v.id || v.apptId === a.id)).length;
  const rows = mine.filter((a) => f === "all" || (f === "upcoming" ? isUpcoming(a) : a.status === (f === "attended" ? "completed" : f)));
  const upcoming = rows.filter(isUpcoming).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const earlier = rows.filter((a) => !isUpcoming(a)).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const opts: { value: F; label: string }[] = [{ value: "all", label: `All (${mine.length})` }, { value: "upcoming", label: `Upcoming (${groups.upcoming.length})` }, { value: "attended", label: `Attended (${groups.attended.length})` }, { value: "cancelled", label: `Cancelled (${groups.cancelled.length})` }, { value: "no_show", label: `No-show (${groups.no_show.length})` }];

  const row = (a: Appointment) => {
    const service = refs?.services.find((s) => s.id === a.serviceId)?.name ?? "Appointment";
    const prov = refs?.providers.find((x) => x.id === a.providerId)?.short;
    const room = refs?.rooms.find((r) => r.id === a.roomId)?.name;
    return (
      <li key={a.id} className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="w-28 shrink-0 text-[13px]"><p className="font-medium">{a.date === TODAY ? "Today" : fmtDate(a.date, true)}</p><p className="text-muted">{fmtTime(a.time)}</p></div>
          <div className="min-w-0 flex-1 text-[13px]"><p className="font-semibold">{service}</p><p className="text-muted">{prov}{room ? ` · ${room}` : ""}{a.origin === "online" ? " · Booked online (demo)" : ""}</p><p className="text-xs text-slate-600">{outcome(a)}</p></div>
          <StatusBadge status={a.status} />
          <div className="flex gap-1.5"><Button size="sm" variant="secondary" onClick={() => ui.openAppt(a.id)}>Open</Button>{a.visitId && <Button size="sm" variant="soft" onClick={() => router.push(`/visits/${a.visitId}`)}>View visit</Button>}</div>
        </div>
        {a.events && a.events.length > 0 && (
          <details className="group mt-1.5 text-[13px]">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">History ({a.events.length})<ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden /></summary>
            <ul className="mt-1.5 space-y-0.5 border-l border-line pl-3 text-xs text-slate-600">{a.events.map((e, i) => <li key={i}><span className="text-muted">{fmtDate(e.at, true)}</span> · {e.text}</li>)}</ul>
          </details>)}
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Appointment filter" value={f} onChange={setF} options={opts} />
        <Button onClick={() => ui.newAppt({ patientId: p.id })}><CalendarPlus className="size-4" aria-hidden />Book appointment</Button>
      </div>
      {isLoading ? <Panel><SkeletonRows rows={4} /></Panel> : mine.length === 0 ? (
        <Panel><EmptyState title="No appointments yet" text="Bookings for this patient, past and future, appear here." action={<Button onClick={() => ui.newAppt({ patientId: p.id })}>Book appointment</Button>} /></Panel>
      ) : rows.length === 0 ? <Panel><EmptyState title="No appointments match" text="Choose another filter." /></Panel> : (
        <>
          {upcoming.length > 0 && <Panel aria-label="Upcoming appointments"><PanelHeader title="Upcoming" sub="Booked, not yet attended" /><ul className="divide-y divide-line">{upcoming.map(row)}</ul></Panel>}
          {earlier.length > 0 && <Panel aria-label="Earlier appointments"><PanelHeader title="Earlier" sub="Attended, cancelled, missed and past bookings" /><ul className={cn("divide-y divide-line")}>{earlier.map(row)}</ul></Panel>}
        </>)}
      {unbooked > 0 && <p className="rounded-lg bg-cloud px-3 py-2 text-[13px] text-slate-600">{unbooked} completed {unbooked === 1 ? "visit has" : "visits have"} no booking record, so {unbooked === 1 ? "it does" : "they do"} not appear here. {goto ? <button onClick={() => goto("history")} className="font-medium text-primary hover:underline">See Care history</button> : "See Care history"} for what took place.</p>}
      <p className="text-xs text-muted">A booking is a plan, not proof that care took place. Check a visit record for what was done. Reschedule or cancel from the appointment panel. Online bookings are demo data and no confirmations are sent.</p>
    </div>
  );
}
