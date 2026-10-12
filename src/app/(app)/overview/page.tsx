"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarCheck, ChevronDown, CalendarClock, CalendarPlus, Camera, CheckCircle2, ChevronLeft, ChevronRight, Clock, CreditCard, FilePlus2, Hourglass, MoreHorizontal, PlayCircle, SlidersHorizontal, UserPlus, X } from "lucide-react";
import { Badge, Button, EmptyState, Menu, MenuContent, MenuItem, MenuTrigger, Panel, PanelHeader, Segmented, Select, SkeletonRows, StatusBadge } from "@/components/ui";
import { ApptActions } from "@/components/app/bits";
import { useUI } from "@/components/app/ui-state";
import { waitLabel } from "@/components/app/panels";
import { PatientAvatar } from "@/components/app/photos";
import { GettingStarted } from "@/components/app/guide";
import { FlowBoard } from "@/components/app/flow";
import { useAppointments, useBilling, useFollowUps, useInventory, useNow, usePatients, useRefs, useRole } from "@/lib/hooks";
import { invStatus, patientFinancials } from "@/lib/clinical";
import { addDays, fmtDate, fmtLong, fmtTime, getPatient, pname, TODAY, toMin } from "@/lib/db";
import { scheduleGaps, waitingNow } from "@/lib/insight";
import { useSession } from "@/lib/auth";
import { toast } from "sonner";
import type { Appointment } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "today" | "providers" | "rooms" | "flow";
const TAB_LABEL: Record<Tab, string> = { today: "Today", providers: "Providers", rooms: "Rooms", flow: "Patient flow" };

export default function TodayPage() { return <Suspense><Today /></Suspense>; }

function Today() {
  const { data: appts, isLoading } = useAppointments();
  const { data: refs } = useRefs();
  const { data: fus } = useFollowUps();
  const { data: inv } = useInventory();
  const { role, can } = useRole();
  useBilling();
  const params = useSearchParams();
  const { data: patients } = usePatients();
  const session = useSession();
  const ui = useUI();
  const router = useRouter();
  const now = useNow();
  const [tab, setTab] = useState<Tab>(params.get("view") === "flow" ? "flow" : "today");
  const [range, setRange] = useState<"day" | "week">("day");
  const [date, setDate] = useState(TODAY);
  const [f, setF] = useState({ provider: "", service: "", location: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  // Role-aware defaults: front desk lands on patient flow, providers see their own schedule.
  useEffect(() => { if (role === "Front desk") setTab("flow"); }, [role]);
  useEffect(() => {
    const mine = role === "Provider" ? refs?.providers.find((x) => x.name === session?.name)?.id : undefined;
    setF((x) => ({ ...x, provider: mine ?? "" }));
  }, [role, refs, session]);

  const all = appts ?? [];
  const dayAppts = (d: string) => all.filter((a) => a.date === d && (!f.provider || a.providerId === f.provider) && (!f.service || a.serviceId === f.service) && (!f.location || a.locationId === f.location)).sort((a, b) => a.time.localeCompare(b.time));
  const todayAll = all.filter((a) => a.date === TODAY);
  const count = (...s: string[]) => todayAll.filter((a) => s.includes(a.status)).length;
  const full = range === "day" ? dayAppts(date) : Array.from({ length: 7 }, (_, i) => addDays(date, i)).flatMap(dayAppts);
  const LIMIT = 7;
  const compact = range === "day" && !showAll && full.length > LIMIT;
  // Compact view: active and upcoming appointments first (next 7), in time order
  const shown = compact ? full.filter((a) => !["completed", "cancelled", "no_show"].includes(a.status)).slice(0, LIMIT) : full;
  const waiting = waitingNow();
  const hour = Math.floor(now / 60);
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const who = session?.name.startsWith("Dr.") ? `Dr. ${session.name.split(" ").pop()}` : session?.first;
  const fOpen = (fus ?? []).filter((x) => x.status === "Open");
  const overdue = fOpen.filter((x) => x.due < TODAY);
  const cancelled = todayAll.filter((a) => a.status === "cancelled");
  const noShows = todayAll.filter((a) => a.status === "no_show");
  const gaps = scheduleGaps().sort((a, b) => b.mins - a.mins);
  const longWaits = waiting.filter((w) => w.mins >= 10);
  const lowStock = (inv?.inventory ?? []).filter((i) => ["Low", "Out"].includes(invStatus(i)));

  const owing = (patients ?? []).filter((x) => patientFinancials(x.id).outstanding > 0);
  const attention = [
    overdue.length > 0 && { id: "fu", icon: CalendarClock, n: overdue.length, text: `follow-up${overdue.length > 1 ? "s" : ""} overdue`, sub: "Review follow-ups", href: "/follow-ups" },
    cancelled.length > 0 && { id: "ca", icon: CalendarCheck, n: cancelled.length, text: `appointment${cancelled.length > 1 ? "s" : ""} cancelled`, sub: `${fmtTime(cancelled[0].time)} · ${pname(cancelled[0].patientId)}`, action: "Review", run: () => ui.openAppt(cancelled[0].id) },
    longWaits.length > 0 && { id: "lw", icon: AlertTriangle, n: longWaits.length, text: `patient${longWaits.length > 1 ? "s" : ""} waiting more than 10 minutes`, sub: "View waiting list", href: "/overview?view=flow" },
    noShows.length > 0 && { id: "ns", icon: X, n: noShows.length, text: `no-show recorded`, sub: `${pname(noShows[0].patientId)} · ${fmtTime(noShows[0].time)}`, action: "Review", run: () => ui.openAppt(noShows[0].id) },
    lowStock[0] && { id: "stock", icon: AlertTriangle, n: lowStock.length, text: `low stock alert${lowStock.length > 1 ? "s" : ""}`, sub: `${lowStock[0].name} · ${lowStock[0].qty} ${lowStock[0].unit} remaining`, href: "/practice/inventory" },
    can("financials") && owing.length > 0 && role !== "Provider" && { id: "owing", icon: CreditCard, n: owing.length, text: `patient${owing.length > 1 ? "s" : ""} with an outstanding balance`, sub: "Review in Patients", href: "/patients" },
    gaps[0] && { id: "gap", icon: Clock, n: gaps.length, text: `schedule gap${gaps.length > 1 ? "s" : ""} of 45 minutes or more`, sub: `${refs?.providers.find((p) => p.id === gaps[0].providerId)?.short ?? ""} · ${fmtTime(gaps[0].from)} to ${fmtTime(gaps[0].to)}`, href: "/calendar" },
  ].filter(Boolean).filter((x) => !dismissed.includes((x as { id: string }).id)).filter((x) => { const id = (x as { id: string }).id; if (role === "Provider") return !["stock", "gap", "owing"].includes(id); if (role === "Front desk") return !["stock", "fu"].includes(id); if (role === "Staff") return !["owing"].includes(id); return true; }) as { id: string; icon: typeof Clock; n: number; text: string; sub: string; href?: string; action?: string; run?: () => void }[];

  const summary = [
    { label: "Appointments", n: todayAll.length, icon: CalendarCheck, tone: "bg-active text-primary" },
    { label: "Arrived", n: count("arrived", "waiting", "in_progress", "completed"), icon: CheckCircle2, tone: "bg-[#E7F7F5] text-[#2A8577]" },
    { label: "Waiting", n: count("waiting"), icon: Hourglass, tone: "bg-[#FFF3DF] text-[#9A6200]" },
    { label: "In progress", n: count("in_progress"), icon: PlayCircle, tone: "bg-[#ECECF9] text-[#40428A]" },
  ];
  const groups = useMemo(() => {
    if (tab === "today") return [{ key: "all", label: "", items: shown }];
    const keyOf = (a: Appointment) => (tab === "providers" ? a.providerId : a.roomId);
    const keys = [...new Set(shown.map(keyOf))];
    return keys.map((k) => ({ key: k, label: tab === "providers" ? refs?.providers.find((p) => p.id === k)?.name ?? k : `${refs?.rooms.find((r) => r.id === k)?.name ?? k} · ${refs?.locations.find((l) => l.id === refs?.rooms.find((r) => r.id === k)?.locationId)?.name.replace("Brightwell ", "") ?? ""}`, items: shown.filter((a) => keyOf(a) === k) }));
  }, [tab, shown, refs]);

  const tabList = (
              <div role="tablist" aria-label="Schedule view" className="flex gap-1">
                {(["today", "providers", "rooms", "flow"] as Tab[]).map((t) => (
                  <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                    className={cn("relative px-3 py-3.5 text-sm font-medium after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded", tab === t ? "text-primary after:bg-primary" : "text-muted hover:text-ink")}>{TAB_LABEL[t]}</button>
                ))}
              </div>
  );

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">{greet}, {who}</h1>
          <p className="mt-0.5 text-sm text-muted">{fmtLong(TODAY)}, 2026</p>
        </div>
        <dl className="flex divide-x divide-line overflow-hidden rounded-xl border border-line bg-white" aria-label="Daily summary">
          {summary.map((s) => (
            <div key={s.label} className="flex items-center gap-2.5 px-3.5 py-2">
              <span className={cn("grid size-8 place-items-center rounded-lg", s.tone)}><s.icon className="size-4" aria-hidden /></span>
              <div><dd className="text-lg font-semibold leading-none">{isLoading ? "–" : s.n}</dd><dt className="mt-0.5 text-[11px] text-muted">{s.label}</dt></div>
            </div>
          ))}
        </dl>
      </div>

      <GettingStarted />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          {tab === "flow" ? (
            <>
              <div className="rounded-xl border border-line bg-white px-4">{tabList}</div>
              <FlowBoard />
            </>
          ) : (
          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4">
              {tabList}
              <div className="flex flex-wrap items-center gap-2 py-2">
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="secondary" aria-label="Previous day" onClick={() => setDate(addDays(date, range === "day" ? -1 : -7))}><ChevronLeft className="size-4" /></Button>
                  <span className="min-w-28 text-center text-[13px] font-medium">{date === TODAY ? "Today" : fmtDate(date, true)}</span>
                  <Button size="sm" variant="secondary" aria-label="Next day" onClick={() => setDate(addDays(date, range === "day" ? 1 : 7))}><ChevronRight className="size-4" /></Button>
                </div>
                {date !== TODAY && <Button size="sm" variant="ghost" onClick={() => setDate(TODAY)}>Today</Button>}
                <Segmented label="Range" value={range} onChange={setRange} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }]} />
                <Button size="sm" variant={showFilters || f.provider || f.service || f.location ? "soft" : "secondary"} aria-label="Filters" aria-pressed={showFilters} onClick={() => setShowFilters((v) => !v)}><SlidersHorizontal className="size-4" /></Button>
              </div>
            </div>
            {showFilters && (
              <div className="anim-fade flex flex-wrap gap-2 border-b border-line bg-cloud/40 px-4 py-2.5">
                <Select sm aria-label="Provider" className="w-40" value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}><option value="">All providers</option>{refs?.providers.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}</Select>
                <Select sm aria-label="Service" className="w-48" value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}><option value="">All services</option>{refs?.services.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
                <Select sm aria-label="Location" className="w-48" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })}><option value="">All locations</option>{refs?.locations.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
                <Button size="sm" variant="ghost" onClick={() => setF({ provider: "", service: "", location: "" })}>Clear</Button>
              </div>
            )}
            {isLoading ? <SkeletonRows rows={8} /> : shown.length === 0 ? (
              <EmptyState title="No appointments" text={date === TODAY && !f.provider ? "Your schedule is clear." : "Nothing matches this date or filter."} action={<Button onClick={() => ui.newAppt({ date })}>New appointment</Button>} />
            ) : (
              groups.map((g) => (
                <div key={g.key}>
                  {g.label && <p className="border-b border-line bg-cloud/50 px-4 py-1.5 text-xs font-medium text-muted">{g.label}</p>}
                  <ul className="divide-y divide-line">
                    {g.items.map((a, i) => <Row key={a.id} a={a} now={now} showDate={range === "week" && (i === 0 || g.items[i - 1].date !== a.date)} current={date === TODAY && a.date === TODAY && a.status === "waiting"} onOpen={() => ui.openAppt(a.id)} router={router} />)}
                  </ul>
                </div>
              ))
            )}
            {!isLoading && range === "day" && full.length > LIMIT && (
              <div className="flex items-center justify-between border-t border-line">
              <button onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className="flex flex-1 items-center justify-between px-4 py-3 text-left text-[13.5px] font-medium text-primary hover:bg-active/40">
                <span className="flex items-center gap-2"><CalendarCheck className="size-4" aria-hidden />{showAll ? "Show next appointments only" : `View all appointments (${full.length})`}</span><ChevronRight className={cn("size-4 transition-transform", showAll && "rotate-90")} />
              </button>
                <Link href={`/calendar`} className="whitespace-nowrap border-l border-line px-4 py-3 text-[13px] font-medium text-primary hover:bg-active/40">Open in Calendar</Link>
              </div>
            )}
          </Panel>
          )}

          <section aria-label="Quick actions">
            <h2 className="mb-2 text-[15px] font-semibold">Quick actions</h2>
            <div className="flex flex-wrap gap-2">
              {[{ l: "Add patient", i: UserPlus, run: ui.newPatient }, { l: "Book appointment", i: CalendarPlus, run: () => ui.newAppt() }, { l: "Start visit", i: PlayCircle, run: () => ui.newVisit() }].map((q) => (
                <button key={q.l} onClick={q.run} className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2 text-left text-[13px] font-medium hover:border-primary/40 hover:bg-active/50">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-active text-primary"><q.i className="size-4" aria-hidden /></span>{q.l}
                </button>
              ))}
              <Menu>
                <MenuTrigger asChild><button className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2 text-left text-[13px] font-medium hover:border-primary/40 hover:bg-active/50"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-active text-primary"><MoreHorizontal className="size-4" aria-hidden /></span>More actions<ChevronDown className="size-4 text-muted" aria-hidden /></button></MenuTrigger>
                <MenuContent align="start">
                  <MenuItem onSelect={() => router.push("/practice/forms")}><FilePlus2 className="size-4 text-muted" />Create form</MenuItem>
                  <MenuItem onSelect={() => { toast("Choose a patient, then open the Photos tab."); router.push("/patients"); }}><Camera className="size-4 text-muted" />Upload photos</MenuItem>
                  <MenuItem onSelect={() => { toast("Choose a patient, then open the Financials tab."); router.push("/patients"); }}><CreditCard className="size-4 text-muted" />Record payment</MenuItem>
                </MenuContent>
              </Menu>
            </div>
          </section>
        </div>

        <div className="space-y-5">

          <Panel>
            <PanelHeader title={`Needs attention (${attention.length})`} />
            {attention.length === 0 ? <EmptyState title="Nothing needs attention" text="The agents will flag items here." /> : (
              <ul className="divide-y divide-line">
                {attention.map((x) => (
                  <li key={x.id} className="flex items-start gap-3 px-4 py-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#FBE9E9] text-[#8F2D2D]"><x.icon className="size-4" aria-hidden /></span>
                    <div className="min-w-0 flex-1 text-[13px]"><p><span className="text-base font-semibold">{x.n}</span> {x.text}</p>
                      {x.href ? <Link href={x.href} className="text-xs font-medium text-primary hover:underline">{x.sub}</Link> : <p className="text-xs text-muted">{x.sub}</p>}</div>
                    {x.run && <button onClick={x.run} className="text-xs font-medium text-primary hover:underline">{x.action}</button>}
                    <button aria-label="Dismiss" onClick={() => setDismissed([...dismissed, x.id])} className="rounded p-1 text-muted hover:bg-cloud"><X className="size-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title={`Waiting now (${waiting.length})`} action={<Link href="/overview?view=flow" className="text-[13px] font-medium text-primary hover:underline">View all</Link>} />
            {isLoading ? <SkeletonRows rows={3} /> : waiting.length === 0 ? <EmptyState title="Nobody is waiting" text="Patients appear here after check-in." /> : (
              <ul className="divide-y divide-line">
                {waiting.map(({ a, mins }) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                    <PatientAvatar id={a.patientId} name={pname(a.patientId)} size={38} />
                    <div className="min-w-0 flex-1"><Link href={`/patients/${a.patientId}`} className="block truncate text-[13.5px] font-medium hover:text-primary">{pname(a.patientId)}</Link><p className="truncate text-xs text-muted">{refs?.services.find((s) => s.id === a.serviceId)?.name}</p></div>
                    <Badge tone="peach" className={mins >= 10 ? "" : "opacity-90"}><Clock className="size-3" aria-hidden />{mins} min</Badge>
                    <ApptActions a={a} compact />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function Row({ a, now, current, showDate, onOpen, router }: { a: Appointment; now: number; current: boolean; showDate: boolean; onOpen: () => void; router: ReturnType<typeof useRouter> }) {
  const { data: refs } = useRefs();
  const p = getPatient(a.patientId);
  const service = refs?.services.find((s) => s.id === a.serviceId)?.name;
  const prov = refs?.providers.find((x) => x.id === a.providerId)?.short;
  const room = refs?.rooms.find((r) => r.id === a.roomId)?.name;
  const past = ["completed", "no_show", "cancelled"].includes(a.status);
  const toMinNow = toMin(a.time) <= now && a.date === TODAY && !past;
  return (
    <li className={cn("relative", current && "bg-active/60 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-primary")}>
      {showDate && <p className="bg-cloud/50 px-4 py-1 text-xs font-medium text-muted">{fmtLong(a.date)}</p>}
      <div className={cn("flex items-center gap-3 px-4 py-2.5 hover:bg-cloud/40", past && "opacity-80")}>
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Open appointment: ${pname(a.patientId)}, ${fmtTime(a.time)}`}>
          <span className="w-[70px] shrink-0 text-[13px] font-medium tabular-nums">{fmtTime(a.time)}</span>
          <PatientAvatar id={a.patientId} size={42} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5"><span className="truncate text-[14px] font-semibold">{p?.first} {p?.last}</span>
              {p?.status === "New" && <Badge tone="lavender" className="py-0">New patient</Badge>}{p?.tags?.includes("VIP") && <Badge tone="peach" className="py-0">VIP</Badge>}</span>
            <span className="mt-1 block xl:hidden">{a.status === "waiting" ? <Badge tone="peach"><Clock className="size-3" aria-hidden />Waiting · {waitLabel(now, a.arrivedAt)}</Badge> : <StatusBadge status={a.status} />}</span>
            <span className="block truncate text-[12.5px] text-muted">{service}{a.notes && a.notes !== "Walk-in" ? ` · ${a.notes}` : a.notes ? " · Walk-in" : ""}</span>
          </span>
          <span className="hidden min-w-0 shrink-0 text-[12.5px] text-muted xl:block xl:w-32"><span className="block truncate text-ink">{prov}</span><span className="block truncate">{room}</span></span>
          <span className="hidden shrink-0 xl:block">{a.status === "waiting" ? <Badge tone="peach"><Clock className="size-3" aria-hidden />Waiting · {waitLabel(now, a.arrivedAt)}</Badge> : <StatusBadge status={a.status} />}</span>
        </button>
        <div className="hidden shrink-0 sm:block" data-now={toMinNow}><ApptActions a={a} compact /></div>
        <Menu>
          <MenuTrigger2 />
          <MenuContent>
            <MenuItem onSelect={onOpen}>Open appointment</MenuItem>
            <MenuItem onSelect={() => router.push(`/patients/${a.patientId}`)}>Open patient</MenuItem>
            {a.visitId && <MenuItem onSelect={() => router.push(`/visits/${a.visitId}`)}>View visit</MenuItem>}
          </MenuContent>
        </Menu>
      </div>
    </li>
  );
}
function MenuTrigger2() {
  return <MenuTrigger asChild><button aria-label="More actions" className="rounded-md p-1.5 text-muted hover:bg-cloud"><MoreHorizontal className="size-4" /></button></MenuTrigger>;
}
