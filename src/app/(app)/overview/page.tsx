"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { isOpenStatus } from "@/lib/appointment-rules";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, CalendarCheck, ChevronDown, CalendarClock, CalendarPlus, Camera, CheckCircle2, ChevronLeft, ChevronRight, Clock, CreditCard, FilePlus2, Hourglass, MoreHorizontal, PlayCircle, SlidersHorizontal, UserPlus, X } from "lucide-react";
import { Badge, Button, EmptyState, Menu, MenuContent, MenuItem, MenuTrigger, Panel, PanelHeader, Segmented, Select, SkeletonRows, StatGrid, StatTile, StatusBadge } from "@/components/ui";
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
import { EnquiryFollowUpPanel } from "@/modules/enquiries/follow-up-panel";
import { Inbox } from "lucide-react";
import type { Appointment } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "today" | "providers" | "rooms" | "flow";
const ATTN = { red: "bg-[#FBE9E9] text-[#8F2D2D]", peach: "bg-[#FFF1D6] text-[#7A4B00]", lavender: "bg-[#ECECF9] text-[#40428A]", blue: "bg-active text-primary" } as const;
const QUICK = ["bg-active text-primary", "bg-[#DDF4F8] text-[#0E6577]", "bg-[#ECECF9] text-[#40428A]", "bg-[#DDF3EF] text-[#1E6B61]", "bg-[#FFF1D6] text-[#7A4B00]"];
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
  const LIMIT = 9;
  const compact = range === "day" && !showAll && full.length > LIMIT;
  // Compact view: active and upcoming appointments first (next 9), in time order
  const shown = compact ? full.filter((a) => isOpenStatus(a.status)).slice(0, LIMIT) : full;
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
    overdue.length > 0 && { id: "fu", tone: "peach", icon: CalendarClock, n: overdue.length, text: `follow-up${overdue.length > 1 ? "s" : ""} overdue`, sub: "Review follow-ups", href: "/follow-ups" },
    cancelled.length > 0 && { id: "ca", tone: "red", icon: CalendarCheck, n: cancelled.length, text: `appointment${cancelled.length > 1 ? "s" : ""} cancelled`, sub: `${fmtTime(cancelled[0].time)} · ${pname(cancelled[0].patientId)}`, action: "Review", run: () => ui.openAppt(cancelled[0].id) },
    longWaits.length > 0 && { id: "lw", tone: "peach", icon: AlertTriangle, n: longWaits.length, text: `patient${longWaits.length > 1 ? "s" : ""} waiting more than 10 minutes`, sub: "View waiting list", href: "/overview?view=flow" },
    noShows.length > 0 && { id: "ns", tone: "red", icon: X, n: noShows.length, text: `no-show recorded`, sub: `${pname(noShows[0].patientId)} · ${fmtTime(noShows[0].time)}`, action: "Review", run: () => ui.openAppt(noShows[0].id) },
    lowStock[0] && { id: "stock", tone: "peach", icon: AlertTriangle, n: lowStock.length, text: `low stock alert${lowStock.length > 1 ? "s" : ""}`, sub: `${lowStock[0].name} · ${lowStock[0].qty} ${lowStock[0].unit} remaining`, href: "/practice/inventory" },
    can("financials") && owing.length > 0 && role !== "Provider" && { id: "owing", tone: "lavender", icon: CreditCard, n: owing.length, text: `patient${owing.length > 1 ? "s" : ""} with an outstanding balance`, sub: "Review in Patients", href: "/patients" },
    gaps[0] && { id: "gap", tone: "blue", icon: Clock, n: gaps.length, text: `schedule gap${gaps.length > 1 ? "s" : ""} of 45 minutes or more`, sub: `${refs?.providers.find((p) => p.id === gaps[0].providerId)?.short ?? ""} · ${fmtTime(gaps[0].from)} to ${fmtTime(gaps[0].to)}`, href: "/calendar" },
  ].filter(Boolean).filter((x) => !dismissed.includes((x as { id: string }).id)).filter((x) => { const id = (x as { id: string }).id; if (role === "Provider") return !["stock", "gap", "owing"].includes(id); if (role === "Front desk") return !["stock", "fu"].includes(id); if (role === "Staff") return !["owing"].includes(id); return true; }) as { id: string; tone: keyof typeof ATTN; icon: typeof Clock; n: number; text: string; sub: string; href?: string; action?: string; run?: () => void }[];

  const arrivedN = count("arrived", "waiting", "in_progress", "completed");
  const toCome = count("scheduled", "confirmed");
  const longest = waiting.reduce((m, w) => Math.max(m, w.mins), 0);
  const summary = [
    { label: "Appointments", n: todayAll.length, hint: `${toCome} still to come`, icon: CalendarCheck, tone: "blue" as const },
    { label: "Arrived", n: arrivedN, hint: todayAll.length ? `${Math.round((arrivedN / todayAll.length) * 100)}% of today` : "None yet", icon: CheckCircle2, tone: "mint" as const },
    { label: "Waiting", n: count("waiting"), hint: longest ? `Longest wait ${longest} min` : "Nobody waiting", icon: Hourglass, tone: "peach" as const },
    { label: "In progress", n: count("in_progress"), hint: "Visits under way", icon: PlayCircle, tone: "lavender" as const },
  ];
  // Status colours for the progress bar, checked for colour-blind separation. "Still to come" is the empty track, not a colour.
  const progress = [
    { label: "Completed", n: count("completed"), color: "#1FA08D" },
    { label: "In visit", n: count("in_progress"), color: "#2867B2" },
    { label: "Waiting", n: count("waiting"), color: "#E0A23A" },
    { label: "Arrived", n: count("arrived"), color: "#26B9CF" },
    { label: "Cancelled or no-show", n: count("cancelled", "no_show"), color: "#B4403F" },
  ];
  const nextUp = todayAll.filter((a) => ["scheduled", "confirmed"].includes(a.status) && toMin(a.time) >= now && (!f.provider || a.providerId === f.provider)).sort((a, b) => a.time.localeCompare(b.time))[0];
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
      <section className="relative mb-5 overflow-hidden rounded-2xl border border-[#E3E6F5] bg-[linear-gradient(115deg,#F1EEFB_0%,#E6F1FB_38%,#DFF4F0_72%,#FFF3DC_100%)] px-5 py-6 sm:px-7">
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-white/50 blur-2xl" />
        <span aria-hidden className="pointer-events-none absolute -bottom-28 right-40 size-64 rounded-full bg-[#DCDDF5]/60 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-slate-600">{fmtLong(TODAY)}, 2026</p>
            <h1 className="mt-0.5 text-[28px] font-semibold tracking-tight">{greet}, {who}</h1>
            <p className="mt-1.5 text-sm text-slate-600">
              {isLoading ? "Loading your day…" : nextUp ? <>Next up: <button onClick={() => ui.openAppt(nextUp.id)} className="font-semibold text-ink underline-offset-2 hover:underline">{pname(nextUp.patientId)}</button> at {fmtTime(nextUp.time)} · {refs?.services.find((x) => x.id === nextUp.serviceId)?.name}</> : todayAll.length ? "No more appointments are waiting to start today." : "Your schedule is clear today."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="border-white/70 bg-white/80 backdrop-blur hover:bg-white" onClick={ui.newPatient}><UserPlus className="size-4" aria-hidden />Add patient</Button>
            <Button onClick={() => ui.newAppt()}><CalendarPlus className="size-4" aria-hidden />Book appointment</Button>
          </div>
        </div>
      </section>

      <StatGrid>
        {summary.map((x) => <StatTile key={x.label} label={x.label} value={isLoading ? "–" : x.n} hint={isLoading ? undefined : x.hint} icon={x.icon} tone={x.tone} />)}
      </StatGrid>

      <GettingStarted />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
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

          <Panel>
            <PanelHeader title="Waiting now" sub={waiting.length ? `${waiting.length} patient${waiting.length === 1 ? "" : "s"} checked in` : undefined} action={<Link href="/overview?view=flow" className="text-[13px] font-medium text-primary hover:underline">View all</Link>} />
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

          <section aria-label="Quick actions">
            <h2 className="mb-2 text-[15px] font-semibold">Quick actions</h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
              {[{ l: "Add patient", i: UserPlus, run: ui.newPatient }, { l: "Book appointment", i: CalendarPlus, run: () => ui.newAppt() }, ...(can("enquiries") ? [{ l: "New enquiry", i: Inbox, run: () => router.push("/enquiries?new=1") }] : []), { l: "Start visit", i: PlayCircle, run: () => ui.newVisit() }].map((q, i) => (
                <button key={q.l} onClick={q.run} className="group flex flex-col items-start gap-3 rounded-xl border border-line bg-white p-3.5 text-left text-[13px] font-medium shadow-[0_1px_2px_rgba(38,56,75,0.04)] transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", QUICK[i % QUICK.length])}><q.i className="size-[18px]" aria-hidden /></span>
                  <span className="flex w-full items-center justify-between gap-1">{q.l}<ArrowRight className="size-3.5 text-slate-300 transition-colors group-hover:text-primary" aria-hidden /></span>
                </button>
              ))}
              <Menu>
                <MenuTrigger asChild><button className="group flex flex-col items-start gap-3 rounded-xl border border-line bg-white p-3.5 text-left text-[13px] font-medium shadow-[0_1px_2px_rgba(38,56,75,0.04)] transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"><span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", QUICK[4])}><MoreHorizontal className="size-[18px]" aria-hidden /></span><span className="flex w-full items-center justify-between gap-1">More actions<ChevronDown className="size-3.5 text-muted" aria-hidden /></span></button></MenuTrigger>
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
            <PanelHeader title="Today&apos;s progress" sub={isLoading ? undefined : `${count("completed")} of ${todayAll.length} completed`} />
            <div className="space-y-3.5 p-4">
              <div role="img" aria-label={`Appointments today: ${progress.map((x) => `${x.n} ${x.label.toLowerCase()}`).join(", ")}, ${toCome} still to come`} className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-cloud">
                {progress.filter((x) => x.n > 0).map((x) => <span key={x.label} title={`${x.label}: ${x.n}`} className="h-full" style={{ flex: x.n, background: x.color }} />)}
                {toCome > 0 && <span title={`Still to come: ${toCome}`} style={{ flex: toCome }} />}
              </div>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
                {progress.slice(0, 4).map((x) => <li key={x.label} className="flex items-center gap-2"><span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: x.color }} /><span className="min-w-0 flex-1 truncate text-slate-600">{x.label}</span><span className="font-semibold tabular-nums">{isLoading ? "–" : x.n}</span></li>)}
                <li className="flex items-center gap-2"><span aria-hidden className="size-2.5 shrink-0 rounded-full border-2 border-slate-300 bg-white" /><span className="min-w-0 flex-1 truncate text-slate-600">Still to come</span><span className="font-semibold tabular-nums">{isLoading ? "–" : toCome}</span></li>
                <li className="col-span-2 flex items-center gap-2"><span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: progress[4].color }} /><span className="min-w-0 flex-1 text-slate-600">{progress[4].label}</span><span className="font-semibold tabular-nums">{isLoading ? "–" : progress[4].n}</span></li>
              </ul>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Needs attention" action={<Badge tone={attention.length ? "peach" : "mint"}>{attention.length ? `${attention.length} to review` : "All clear"}</Badge>} />
            {attention.length === 0 ? <EmptyState title="Nothing needs attention" text="The agents will flag items here." /> : (
              <ul className="divide-y divide-line">
                {attention.map((x) => (
                  <li key={x.id} className="flex items-start gap-3 px-4 py-3">
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", ATTN[x.tone])}><x.icon className="size-4" aria-hidden /></span>
                    <div className="min-w-0 flex-1 text-[13px]"><p><span className="text-base font-semibold">{x.n}</span> {x.text}</p>
                      {x.href ? <Link href={x.href} className="text-xs font-medium text-primary hover:underline">{x.sub}</Link> : <p className="text-xs text-muted">{x.sub}</p>}</div>
                    {x.run && <button onClick={x.run} className="text-xs font-medium text-primary hover:underline">{x.action}</button>}
                    <button aria-label="Dismiss" onClick={() => setDismissed([...dismissed, x.id])} className="rounded p-1 text-muted hover:bg-cloud"><X className="size-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <EnquiryFollowUpPanel />

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
    <li className={cn("relative before:absolute before:inset-y-0 before:left-0 before:w-[3px]", current ? "bg-[#FFF9EC] before:bg-[#E0A23A]" : a.status === "in_progress" ? "bg-active/40 before:bg-primary" : a.status === "arrived" ? "before:bg-cyan" : a.status === "completed" ? "before:bg-mint" : "before:bg-transparent")}>
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
