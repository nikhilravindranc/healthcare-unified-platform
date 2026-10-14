"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Button, Segmented, Select, Skeleton, StatusDot, STATUS } from "@/components/ui";
import { AgentHint } from "@/components/app/bits";
import { useUI } from "@/components/app/ui-state";
import { useAppointments, useNow, useRefs } from "@/lib/hooks";
import { addDays, fmtDate, fmtTime, fromMin, getPatient, TODAY, toMin } from "@/lib/db";
import { scheduleGaps } from "@/lib/insight";
import { apptStage, isLostStatus, STAGE_LABEL } from "@/lib/appointment-rules";
import { PatientAvatar } from "@/components/app/photos";
import type { Appointment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const H0 = 8, H1 = 18, PX = 1.5; // hour range and pixels per minute
type View = "day" | "week" | "month";

const t12 = (x: string) => { const m = x.match(/(\d+):(\d+) ([AP]M)/); if (!m) return 0; return ((Number(m[1]) % 12) + (m[3] === "PM" ? 12 : 0)) * 60 + Number(m[2]); };
const parseHours = (h?: string): [number, number] | null => { const m = h?.match(/(\d+:\d+ [AP]M)\s*[–-]\s*(\d+:\d+ [AP]M)/); return m ? [t12(m[1]), t12(m[2])] : null; };
const monday = (d: string) => { const x = new Date(d + "T12:00:00"); const k = (x.getDay() + 6) % 7; return addDays(d, -k); };
const longDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

interface Col { key: string; label: string; sub?: string; date: string; providerId?: string; appts: Appointment[]; today?: boolean }

export default function CalendarPage() {
  const { data: appts, isLoading } = useAppointments();
  const { data: refs } = useRefs();
  const ui = useUI();
  const router = useRouter();
  const now = useNow();
  const [view, setView] = useState<View>("day");
  const [date, setDate] = useState(TODAY);
  const [f, setF] = useState({ provider: "", service: "", location: "", room: "" });
  const [gaps, setGaps] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const active = [f.provider, f.service, f.location, f.room].filter(Boolean).length;
  const gridRef = useRef<HTMLDivElement>(null);
  const refocus = useRef(false);
  useEffect(() => { if (refocus.current) { refocus.current = false; gridRef.current?.focus(); } }, [view, date]);

  const filtered = useMemo(() => (appts ?? []).filter((a) =>
    (!f.provider || a.providerId === f.provider) && (!f.service || a.serviceId === f.service) && (!f.location || a.locationId === f.location) && (!f.room || a.roomId === f.room)), [appts, f]);

  const step = view === "day" ? 1 : view === "week" ? 7 : 30;
  const shift = (dir: number) => setDate(view === "month" ? addDays(date.slice(0, 8) + "01", dir * 31).slice(0, 8) + "01" : addDays(date, dir * step));

  const cols: Col[] = useMemo(() => {
    if (view === "day") return (refs?.providers ?? []).filter((p) => !f.provider || p.id === f.provider).map((p) => ({
      key: p.id, label: p.short, sub: p.specialty, date, providerId: p.id, appts: filtered.filter((a) => a.date === date && a.providerId === p.id) }));
    if (view === "week") return Array.from({ length: 6 }, (_, i) => addDays(monday(date), i)).map((d) => ({
      key: d, label: new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }), sub: fmtDate(d), date: d, today: d === TODAY, appts: filtered.filter((a) => a.date === d) }));
    return [];
  }, [view, refs, filtered, date, f.provider]);

  const gapCount = scheduleGaps().length;
  const title = view === "month" ? new Date(date + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" }) : view === "week" ? `${fmtDate(monday(date))} – ${fmtDate(addDays(monday(date), 5), true)}` : longDate(date);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[#E3E6F5] bg-[linear-gradient(115deg,#F1EEFB_0%,#E6F1FB_38%,#DFF4F0_72%,#FFF3DC_100%)] px-4 py-3 sm:px-5">
        <h1 className="mr-2 text-[26px] font-semibold tracking-tight">Calendar</h1>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="secondary" aria-label="Previous" onClick={() => shift(-1)}><ChevronLeft className="size-4" /></Button>
          <Button size="sm" variant="secondary" onClick={() => setDate(TODAY)}>Today</Button>
          <Button size="sm" variant="secondary" aria-label="Next" onClick={() => shift(1)}><ChevronRight className="size-4" /></Button>
        </div>
        <p className="text-[15px] font-medium" aria-live="polite">{title}</p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Segmented label="Calendar view" value={view} onChange={setView} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
          <Button size="sm" variant={showFilters || active ? "soft" : "secondary"} aria-pressed={showFilters} onClick={() => setShowFilters((v) => !v)}><SlidersHorizontal className="size-4" />Filters{active ? ` (${active})` : ""}</Button>
          <Button size="sm" onClick={() => ui.newAppt({ date })}><CalendarPlus className="size-4" />New appointment</Button>
        </div>
      </div>
      {showFilters && <div className="anim-fade mb-4 flex flex-wrap gap-2 rounded-xl border border-line bg-cloud/40 p-2.5" role="group" aria-label="Calendar filters">
        <Select sm aria-label="Provider" className="w-40" value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}><option value="">All providers</option>{refs?.providers.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}</Select>
        <Select sm aria-label="Service" className="w-48" value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}><option value="">All services</option>{refs?.services.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Select sm aria-label="Location" className="w-48" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value, room: "" })}><option value="">All locations</option>{refs?.locations.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        <Select sm aria-label="Room" className="w-44" value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })}><option value="">All rooms</option>{refs?.rooms.filter((r) => !f.location || r.locationId === f.location).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        {(f.provider || f.service || f.location || f.room) && <Button size="sm" variant="ghost" onClick={() => setF({ provider: "", service: "", location: "", room: "" })}>Clear filters</Button>}
      </div>}

      {view === "day" && date === TODAY && gapCount > 0 && (
        <AgentHint agent={1} text={`Appointment Agent found ${gapCount} schedule gaps today.`} action={gaps ? "Hide gaps" : "Review gaps"} onAction={() => setGaps((g) => !g)} />
      )}

      <div ref={gridRef} tabIndex={-1} role="region" aria-label={`Calendar, ${view} view. Press left or right arrow for the previous or next ${view}, T for today.`} className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === "ArrowLeft") { e.preventDefault(); shift(-1); } else if (e.key === "ArrowRight") { e.preventDefault(); shift(1); } else if (e.key === "t" || e.key === "T") { e.preventDefault(); setDate(TODAY); } }}>
      {isLoading ? <Skeleton className="h-[560px] w-full" /> : view === "month" ? (
        <MonthGrid date={date} appts={filtered} onPick={(d) => { refocus.current = true; setDate(d); setView("day"); }} />
      ) : cols.length === 0 ? null : (
        <TimeGrid cols={cols} now={now} showNow={cols.some((c) => c.date === TODAY)} gaps={gaps}
          onOpen={(id) => ui.openAppt(id)} onSlot={(c, t) => ui.newAppt({ date: c.date, time: t, providerId: c.providerId ?? (f.provider || "") })} view={view}
          onDay={(d) => { refocus.current = true; setDate(d); setView("day"); }} />
      )}
      </div>
      <Legend />
      <p className="mt-2 text-xs text-muted">Select an appointment to open details. Select an empty slot to schedule. <button className="underline" onClick={() => router.push("/agents?agent=appointment")}>Appointment Agent</button></p>
    </>
  );
}

function TimeGrid({ cols, now, showNow, gaps, onOpen, onSlot, view, onDay }: { cols: Col[]; now: number; showNow: boolean; gaps: boolean; onOpen: (id: string) => void; onSlot: (c: Col, time: string) => void; view: View; onDay: (d: string) => void }) {
  const { data: refs } = useRefs();
  const hours = Array.from({ length: H1 - H0 }, (_, i) => H0 + i);
  const height = (H1 - H0) * 60 * PX;
  const gapList = scheduleGaps();
  return (
    <div className="scroll-thin overflow-auto rounded-xl border border-line bg-white" style={{ maxHeight: "calc(100vh - 290px)", minHeight: 420 }}>
      <div className="grid min-w-[760px]" style={{ gridTemplateColumns: `56px repeat(${cols.length}, minmax(150px, 1fr))` }}>
        <div className="sticky top-0 z-10 border-b border-line bg-white" />
        {cols.map((c) => (
          <div key={c.key} className="sticky top-0 z-10 border-b border-l border-line bg-white px-3 py-2.5">
            {view === "week" ? <button className="text-left" onClick={() => onDay(c.date)}><p className={cn("text-[13px] font-semibold", c.today && "text-primary")}>{c.label} <span className="font-normal text-muted">{c.sub}</span></p></button>
              : <><p className="text-[13px] font-semibold">{c.label}</p><p className="text-xs text-muted">{c.sub}</p></>}
          </div>
        ))}
        <div className="relative" style={{ height }}>
          {hours.map((h) => <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted" style={{ top: (h - H0) * 60 * PX + (h === H0 ? 8 : 0) }}>{h === H0 ? "" : fmtTime(fromMin(h * 60)).replace(":00", "")}</span>)}
        </div>
        {cols.map((c) => (
          <div key={c.key} className="relative border-l border-line" style={{ height }}
            onClick={(e) => { if (e.target !== e.currentTarget) return; const y = e.nativeEvent.offsetY; const m = H0 * 60 + Math.floor(y / PX / 15) * 15; onSlot(c, fromMin(m)); }}>
            {hours.map((h) => <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-line/70" style={{ top: (h - H0) * 60 * PX }} />)}
            {c.providerId && (() => { const hrs = parseHours(refs?.providers.find((x) => x.id === c.providerId)?.hours); if (!hrs) return null; return (<>
              {hrs[0] > H0 * 60 && <div className="pointer-events-none absolute inset-x-0 top-0 bg-[repeating-linear-gradient(135deg,#F2F4F6_0_6px,#fff_6px_12px)]" style={{ height: (hrs[0] - H0 * 60) * PX }} title="Unavailable: outside provider hours" />}
              {hrs[1] < H1 * 60 && <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[repeating-linear-gradient(135deg,#F2F4F6_0_6px,#fff_6px_12px)]" style={{ height: (H1 * 60 - hrs[1]) * PX }} title="Unavailable: outside provider hours" />}</>); })()}
            {gaps && c.providerId && gapList.filter((g) => g.providerId === c.providerId).map((g) => (
              <button key={g.from} onClick={() => onSlot(c, g.from)} className="absolute inset-x-1 rounded-md border border-dashed border-primary/50 bg-active/70 text-[11px] font-medium text-primary hover:bg-active"
                style={{ top: (toMin(g.from) - H0 * 60) * PX + 1, height: g.mins * PX - 2 }}>Open · {g.mins} min</button>
            ))}
            {c.appts.map((a) => {
              const top = (toMin(a.time) - H0 * 60) * PX;
              const h = Math.max(a.duration * PX - 3, 30);
              const p = getPatient(a.patientId);
              const prov = refs?.providers.find((x) => x.id === a.providerId);
              const inactive = a.status === "cancelled" || a.status === "no_show";
              return (
                <button key={a.id} onClick={() => onOpen(a.id)} aria-label={`${p?.first} ${p?.last}, ${fmtTime(a.time)}, ${STAGE_LABEL[apptStage(a.status)]}: ${STATUS[a.status].label}`}
                  className={cn("absolute inset-x-1 overflow-hidden rounded-md border bg-white px-2 py-1 text-left shadow-[0_1px_0_rgba(38,56,75,.04)] transition hover:shadow-md focus-visible:z-10", inactive && "bg-cloud/70 opacity-70", apptStage(a.status) === "booked" && "border-dashed")}
                  style={{ top: top + 1, height: h, borderColor: apptStage(a.status) === "booked" ? "#B8C2CC" : "#E2E7EB", borderLeft: `3px solid ${prov?.color ?? "#2867B2"}` }}>
                  <span className="flex items-center gap-1.5">{h >= 40 && view === "day" && <PatientAvatar id={a.patientId} size={18} />}<StatusDot status={a.status} /><span className={cn("truncate text-[12.5px] font-medium", inactive && "line-through")}>{view === "week" ? `${fmtTime(a.time).replace(" ", "")} ` : ""}{p?.first} {p?.last}</span>{inactive && <span className="shrink-0 text-[11px] font-medium text-[#8F2D2D]">{STATUS[a.status].label}</span>}</span>
                  {h >= 40 && <span className="mt-0.5 block truncate text-[11.5px] text-muted">{refs?.services.find((s) => s.id === a.serviceId)?.name}</span>}
                  {h >= 58 && <span className="block truncate text-[11px] text-muted">{STATUS[a.status].label}{view === "week" ? ` · ${prov?.short}` : ""}</span>}
                </button>
              );
            })}
            {showNow && c.date === TODAY && now >= H0 * 60 && now <= H1 * 60 && (
              <div className="pointer-events-none absolute inset-x-0 z-[5] flex items-center" style={{ top: (now - H0 * 60) * PX }}><span className="-ml-1 size-2 rounded-full bg-cyan" /><span className="h-px flex-1 bg-cyan" /></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthGrid({ date, appts, onPick }: { date: string; appts: Appointment[]; onPick: (d: string) => void }) {
  const first = date.slice(0, 8) + "01";
  const start = monday(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const month = date.slice(5, 7);
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="grid grid-cols-7 border-b border-line bg-cloud/50 text-center text-xs font-medium text-muted">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-2">{d}</div>)}</div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const all = appts.filter((a) => a.date === d);
          const list = all.filter((a) => !isLostStatus(a.status));
          const lost = all.length - list.length;
          const other = d.slice(5, 7) !== month;
          return (
            <button key={d} onClick={() => onPick(d)} aria-label={`${fmtDate(d)}, ${list.length} appointment${list.length === 1 ? "" : "s"}${lost ? `, ${lost} cancelled or missed` : ""}`} className={cn("min-h-24 border-b border-l border-line p-1.5 text-left align-top hover:bg-active/50", other && "bg-cloud/40 text-muted")}>
              <span className={cn("inline-grid size-6 place-items-center rounded-full text-xs font-medium", d === TODAY && "bg-primary text-white")}>{Number(d.slice(8))}</span>
              {list.length > 0 && <p className="mt-1 text-[11px] font-medium text-primary">{list.length} appointment{list.length > 1 ? "s" : ""}</p>}
              {lost > 0 && <p className="text-[11px] text-[#8F2D2D]">{lost} cancelled or missed</p>}
              {list.slice(0, 2).map((a) => <p key={a.id} className="mt-0.5 hidden truncate text-[11px] text-muted sm:block">{fmtTime(a.time).replace(" ", "")} {getPatient(a.patientId)?.last}</p>)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** What each marker means. Booking state and attendance state are kept apart, and colour is never the only cue. */
function Legend() {
  const groups: { stage: ReturnType<typeof apptStage>; statuses: Appointment["status"][] }[] = [
    { stage: "booked", statuses: ["scheduled", "confirmed"] }, { stage: "attending", statuses: ["arrived", "waiting", "in_progress"] },
    { stage: "completed", statuses: ["completed"] }, { stage: "lost", statuses: ["cancelled", "no_show"] }];
  return (
    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-xs">
    <dl aria-label="Appointment status key" className="contents">
      {groups.map((g) => (
        <div key={g.stage} className="flex flex-wrap items-center gap-x-2"><dt className="font-medium text-slate-600">{STAGE_LABEL[g.stage]}</dt>{g.statuses.map((s) => <dd key={s} className="flex items-center gap-1 text-muted"><StatusDot status={s} />{STATUS[s].label}</dd>)}</div>))}
    </dl>
      <p className="text-muted">Dashed outline: booked only, nobody has arrived.</p>
    </div>
  );
}
