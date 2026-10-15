"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { isOpenStatus } from "@/lib/appointment-rules";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Moon, Sun, Sunrise, AlertTriangle, CalendarCheck, CalendarClock, CalendarPlus, Camera, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, CreditCard, FilePlus2, Hourglass, Inbox, MoreHorizontal, PlayCircle, SlidersHorizontal, UserPlus, X, type LucideIcon } from "lucide-react";
import { BannerSurface, DailyQuote } from "@/components/ui/banner";
import { Badge, Button, EmptyState, Menu, MenuContent, MenuItem, MenuTrigger, Panel, PanelHeader, Segmented, Select, SkeletonRows, StatusBadge } from "@/components/ui";
import { ApptActions } from "@/components/app/bits";
import { useUI } from "@/components/app/ui-state";
import { waitLabel } from "@/components/app/panels";
import { PatientAvatar } from "@/components/app/photos";
import { GettingStarted } from "@/components/app/guide";
import { FlowBoard } from "@/components/app/flow";
import { useAppointments, useBilling, useFollowUps, useInventory, useNow, usePatients, useRefs, useRole } from "@/lib/hooks";
import { invStatus, patientFinancials } from "@/lib/clinical";
import { addDays, fmtDate, fmtLong, fmtTime, getPatient, pname, TODAY } from "@/lib/db";
import { scheduleGaps, waitingNow } from "@/lib/insight";
import { useSession } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import { toast } from "sonner";
import { EnquiryFollowUpPanel } from "@/modules/enquiries/follow-up-panel";
import type { Appointment } from "@/lib/types";
import { cn } from "@/lib/utils";

export type TodayTab = "today" | "providers" | "rooms" | "flow";
const TAB_LABEL: Record<TodayTab, string> = { today: "Today", providers: "Providers", rooms: "Rooms", flow: "Patient flow" };
/** Soft icon surfaces for the Needs attention list. Red is reserved for exceptions that need a decision. */
const ATTN = { red: "bg-[#FBE9E9] text-[#8F2D2D]", peach: "bg-[#FFF3DF] text-[#7A4B00]", lavender: "bg-[#ECECF9] text-[#40428A]", blue: "bg-active text-primary" } as const;
/** The same statuses the summary counts use. "Arrived" means everyone who has come in, as the counts always have. */
const SF = { arrived: ["arrived", "waiting", "in_progress", "completed"], waiting: ["waiting"], progress: ["in_progress"] } as const;
type SFKey = keyof typeof SF;
const SF_LABEL: Record<SFKey, string> = { arrived: "Arrived", waiting: "Waiting", progress: "In progress" };
/** Column layouts follow the width of the schedule itself, so they hold up with the sidebar open or collapsed. */
const MID = "@min-[600px]:grid-cols-[70px_minmax(0,1fr)_112px_auto_24px]";
const FULL = "@min-[800px]:grid-cols-[70px_minmax(0,1.9fr)_minmax(0,1.1fr)_72px_80px_128px_104px_24px]";

export function TodayView({ initialTab }: { initialTab?: TodayTab }) { return <Suspense><Today initialTab={initialTab} /></Suspense>; }

function Today({ initialTab }: { initialTab?: TodayTab }) {
  const { data: appts, isLoading } = useAppointments();
  const { data: refs } = useRefs();
  const { data: fus } = useFollowUps();
  const { data: inv } = useInventory();
  const { role, can } = useRole();
  useBilling();
  const params = useSearchParams();
  const { data: patients } = usePatients();
  const session = useSession();
  const st = useSettings();
  const ui = useUI();
  const router = useRouter();
  const now = useNow();
  const [tab, setTab] = useState<TodayTab>(initialTab ?? (params.get("view") === "flow" ? "flow" : "today"));
  const [range, setRange] = useState<"day" | "week">("day");
  const [date, setDate] = useState(TODAY);
  const [f, setF] = useState({ provider: "", service: "", location: "" });
  const [sf, setSf] = useState<SFKey | "">("");
  const [showFilters, setShowFilters] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  // Role-aware defaults: front desk lands on patient flow, providers see their own schedule.
  useEffect(() => { if (role === "Front desk" && !initialTab) setTab("flow"); }, [role, initialTab]);
  useEffect(() => {
    const mine = role === "Provider" ? refs?.providers.find((x) => x.name === session?.name)?.id : undefined;
    setF((x) => ({ ...x, provider: mine ?? "" }));
  }, [role, refs, session]);

  const all = appts ?? [];
  const dayAppts = (d: string) => all.filter((a) => a.date === d && (!f.provider || a.providerId === f.provider) && (!f.service || a.serviceId === f.service) && (!f.location || a.locationId === f.location) && (!sf || (SF[sf] as readonly string[]).includes(a.status))).sort((a, b) => a.time.localeCompare(b.time));
  const todayAll = all.filter((a) => a.date === TODAY);
  const count = (...s: string[]) => todayAll.filter((a) => s.includes(a.status)).length;
  const full = range === "day" ? dayAppts(date) : Array.from({ length: 7 }, (_, i) => addDays(date, i)).flatMap(dayAppts);
  const LIMIT = 8;
  const compact = range === "day" && !showAll && full.length > LIMIT;
  // Compact view: active and upcoming appointments first (next 8), in time order
  const shown = compact ? full.filter((a) => isOpenStatus(a.status)).slice(0, LIMIT) : full;
  const waiting = waitingNow();
  const hour = Math.floor(now / 60);
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const who = session?.name.startsWith("Dr.") ? `Dr. ${session.name.split(" ").pop()}` : session?.first;
  const DayIcon = hour < 6 || hour >= 19 ? Moon : hour < 12 ? Sunrise : Sun;
  /** One line of orientation. It never repeats the counts in the tiles beside it: it names what the counts cannot, such as who has waited longest. */
  const mine = todayAll.filter((a) => !f.provider || a.providerId === f.provider);
  const live = mine.filter((a) => a.status !== "cancelled" && a.status !== "no_show");
  const nextUp = live.filter((a) => isOpenStatus(a.status)).sort((a, b) => a.time.localeCompare(b.time))[0];
  const longest = waiting.find((w) => mine.some((a) => a.id === w.a.id));
  const daySentence = live.length === 0 ? "Nothing is booked for today yet. A calm start, or a chance to fill the day."
    : longest && longest.mins >= 10 ? `${pname(longest.a.patientId)} has been waiting ${longest.mins} minutes. Worth starting there.`
    : longest ? "Patients are arriving and being seen on time."
    : !nextUp ? "Everyone has been seen. Well done."
    : "No one is waiting right now. The day is running smoothly.";
  const fOpen = (fus ?? []).filter((x) => x.status === "Open");
  const overdue = fOpen.filter((x) => x.due < TODAY);
  const cancelled = todayAll.filter((a) => a.status === "cancelled");
  const noShows = todayAll.filter((a) => a.status === "no_show");
  const gaps = scheduleGaps().sort((a, b) => b.mins - a.mins);
  const longWaits = waiting.filter((w) => w.mins >= 10);
  const lowStock = (inv?.inventory ?? []).filter((i) => ["Low", "Out"].includes(invStatus(i)));

  const owing = (patients ?? []).filter((x) => patientFinancials(x.id).outstanding > 0);
  const attention = [
    overdue.length > 0 && { id: "fu", tone: "peach", icon: CalendarClock, n: overdue.length, text: `follow-up${overdue.length > 1 ? "s" : ""} overdue`, sub: "Review and complete", href: "/follow-ups" },
    cancelled.length > 0 && { id: "ca", tone: "red", icon: CalendarCheck, n: cancelled.length, text: `appointment${cancelled.length > 1 ? "s" : ""} cancelled`, sub: `${fmtTime(cancelled[0].time)} · ${pname(cancelled[0].patientId)}`, action: "Review", run: () => ui.openAppt(cancelled[0].id) },
    longWaits.length > 0 && { id: "lw", tone: "peach", icon: AlertTriangle, n: longWaits.length, text: `patient${longWaits.length > 1 ? "s" : ""} waiting more than 10 minutes`, sub: "View waiting list", href: "/front-desk" },
    noShows.length > 0 && { id: "ns", tone: "red", icon: X, n: noShows.length, text: `no-show recorded`, sub: `${pname(noShows[0].patientId)} · ${fmtTime(noShows[0].time)}`, action: "Review", run: () => ui.openAppt(noShows[0].id) },
    lowStock[0] && { id: "stock", tone: "peach", icon: AlertTriangle, n: lowStock.length, text: `low stock alert${lowStock.length > 1 ? "s" : ""}`, sub: `${lowStock[0].name} · ${lowStock[0].qty} ${lowStock[0].unit} remaining`, href: "/practice/inventory" },
    can("financials") && owing.length > 0 && role !== "Provider" && { id: "owing", tone: "lavender", icon: CreditCard, n: owing.length, text: `patient${owing.length > 1 ? "s" : ""} with an outstanding balance`, sub: "Review in Patients", href: "/patients" },
    gaps[0] && { id: "gap", tone: "blue", icon: Clock, n: gaps.length, text: `schedule gap${gaps.length > 1 ? "s" : ""} of 45 minutes or more`, sub: `${refs?.providers.find((p) => p.id === gaps[0].providerId)?.short ?? ""} · ${fmtTime(gaps[0].from)} to ${fmtTime(gaps[0].to)}`, href: "/calendar" },
  ].filter(Boolean).filter((x) => !dismissed.includes((x as { id: string }).id)).filter((x) => { const id = (x as { id: string }).id; if (role === "Provider") return !["stock", "gap", "owing"].includes(id); if (role === "Front desk") return !["stock", "fu"].includes(id); if (role === "Staff") return !["owing"].includes(id); return true; }) as { id: string; tone: keyof typeof ATTN; icon: LucideIcon; n: number; text: string; sub: string; href?: string; action?: string; run?: () => void }[];

  const summary: { label: string; n: number; icon: LucideIcon; chip: string; key: SFKey | "" }[] = [
    { label: "Appointments", n: todayAll.length, icon: CalendarCheck, chip: "bg-[#E6F0FA] text-primary", key: "" },
    { label: "Arrived", n: count(...SF.arrived), icon: CheckCircle2, chip: "bg-[#E7F7F5] text-[#1E6B61]", key: "arrived" },
    { label: "Waiting", n: count("waiting"), icon: Hourglass, chip: "bg-[#FFF3DF] text-[#7A4B00]", key: "waiting" },
    { label: "In progress", n: count("in_progress"), icon: PlayCircle, chip: "bg-[#E5F8FB] text-primary", key: "progress" },
  ];
  const groups = useMemo(() => {
    if (tab === "today") return [{ key: "all", label: "", items: shown }];
    const keyOf = (a: Appointment) => (tab === "providers" ? a.providerId : a.roomId);
    const keys = [...new Set(shown.map(keyOf))];
    return keys.map((k) => ({ key: k, label: tab === "providers" ? refs?.providers.find((p) => p.id === k)?.name ?? k : `${refs?.rooms.find((r) => r.id === k)?.name ?? k} · ${refs?.locations.find((l) => l.id === refs?.rooms.find((r) => r.id === k)?.locationId)?.name.replace("Brightwell ", "") ?? ""}`, items: shown.filter((a) => keyOf(a) === k) }));
  }, [tab, shown, refs]);

  const tabList = (
    <div role="tablist" aria-label="Schedule view" className="flex w-max gap-1">
      {(["today", "providers", "rooms", "flow"] as TodayTab[]).map((t) => (
        <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
          className={cn("relative px-3 py-3 text-sm font-medium after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded", tab === t ? "text-primary after:bg-primary" : "text-muted hover:text-ink")}>{TAB_LABEL[t]}</button>
      ))}
    </div>
  );
  const pickSummary = (k: SFKey | "") => { setSf(k); setTab("today"); setDate(TODAY); setRange("day"); setShowAll(true); };
  const QUICK: { l: string; i: LucideIcon; tint: string; run: () => void }[] = [
    { l: "Add patient", i: UserPlus, tint: "bg-[#E6F0FA] text-primary", run: ui.newPatient },
    { l: "Book appointment", i: CalendarPlus, tint: "bg-[#E5F8FB] text-[#0E6577]", run: () => ui.newAppt() },
    { l: "Start visit", i: PlayCircle, tint: "bg-[#ECECF9] text-[#40428A]", run: () => ui.newVisit() },
  ];
  const quickCls = "group flex items-center gap-2.5 rounded-xl border border-line bg-white p-2.5 pr-3 text-left text-[13px] font-medium shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

  return (
    <div className="relative">

      <BannerSurface variant="today" aria-label="Welcome" className="anim-fade mb-5 px-5 py-5 sm:px-7 sm:py-6">
        <div className="grid items-center gap-x-6 gap-y-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,0.9fr)]">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[13px] font-medium text-slate-600"><span className="grid size-8 place-items-center rounded-full bg-white/80 text-[#B7791F] shadow-sm"><DayIcon className="size-4" aria-hidden /></span>{fmtLong(TODAY)}, 2026<span className="text-slate-400" aria-hidden>·</span>{st.clinicName}</p>
            <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">{greet}, {who}</h1>
            <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-slate-700" aria-live="polite">{isLoading ? "Getting your day ready…" : daySentence}</p>
            {!isLoading && nextUp && <button type="button" onClick={() => ui.openAppt(nextUp.id)} className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-white/85 py-1 pl-1 pr-3 text-[13px] shadow-sm ring-1 ring-white transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"><PatientAvatar id={nextUp.patientId} name={pname(nextUp.patientId)} size={26} /><span className="truncate"><span className="text-muted">Next up </span><span className="font-medium">{pname(nextUp.patientId)}</span><span className="text-muted"> · {fmtTime(nextUp.time)}</span></span></button>}
          </div>
          <div role="group" aria-label="Today's appointment counts" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
            {summary.map((s) => {
              const on = tab === "today" && s.key !== "" && sf === s.key;
              return (
                <button key={s.label} type="button" aria-pressed={on} onClick={() => pickSummary(s.key)} aria-label={`${s.label}: ${isLoading ? "loading" : s.n}. ${s.key ? `Show only ${SF_LABEL[s.key as SFKey].toLowerCase()} in the schedule` : "Show the full day"}`}
                  className={cn("flex items-center gap-2.5 rounded-xl border bg-white/75 px-3 py-2 text-left shadow-card backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40", on ? "border-primary ring-1 ring-primary/30" : "border-white/80")}>
                  <span className={cn("grid size-8 place-items-center rounded-lg", s.chip)}><s.icon className="size-4" aria-hidden /></span>
                  <span><span className="block text-lg font-semibold leading-none tabular-nums">{isLoading ? "–" : s.n}</span><span className="mt-0.5 block text-[11px] text-slate-600">{s.label}</span></span>
                </button>);
            })}
          </div>
          <DailyQuote className="lg:ml-auto lg:max-w-md" />
        </div>
      </BannerSurface>

      <GettingStarted />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {tab === "flow" ? (
            <>
              <div className="scroll-thin overflow-x-auto rounded-xl border border-line bg-white px-4">{tabList}</div>
              <FlowBoard />
            </>
          ) : (
          <Panel className="@container">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3">
              <h2 className="text-[17px] font-semibold">Today&apos;s schedule</h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="secondary" aria-label="Previous day" onClick={() => setDate(addDays(date, range === "day" ? -1 : -7))}><ChevronLeft className="size-4" /></Button>
                  <span className="min-w-24 text-center text-[13px] font-medium">{date === TODAY ? "Today" : fmtDate(date, true)}</span>
                  <Button size="sm" variant="secondary" aria-label="Next day" onClick={() => setDate(addDays(date, range === "day" ? 1 : 7))}><ChevronRight className="size-4" /></Button>
                </div>
                {date !== TODAY && <Button size="sm" variant="ghost" onClick={() => setDate(TODAY)}>Today</Button>}
                <Segmented label="Range" value={range} onChange={setRange} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }]} />
                <Button size="sm" variant={showFilters || f.provider || f.service || f.location ? "soft" : "secondary"} aria-label="Filters" aria-pressed={showFilters} onClick={() => setShowFilters((v) => !v)}><SlidersHorizontal className="size-4" /></Button>
              </div>
            </div>
            <div className="scroll-thin mt-1 overflow-x-auto border-b border-line px-4">{tabList}</div>
            {showFilters && (
              <div className="anim-fade flex flex-wrap gap-2 border-b border-line bg-cloud/60 px-4 py-2.5">
                <Select sm aria-label="Provider" className="w-40" value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}><option value="">All providers</option>{refs?.providers.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}</Select>
                <Select sm aria-label="Service" className="w-48" value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}><option value="">All services</option>{refs?.services.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
                <Select sm aria-label="Location" className="w-48" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })}><option value="">All locations</option>{refs?.locations.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
                <Button size="sm" variant="ghost" onClick={() => setF({ provider: "", service: "", location: "" })}>Clear</Button>
              </div>
            )}
            {sf && (
              <div className="flex items-center gap-2 border-b border-line bg-[#E5F8FB]/60 px-4 py-2 text-[13px]">
                <span>Showing <strong className="font-semibold">{SF_LABEL[sf].toLowerCase()}</strong> ({full.length})</span>
                <button onClick={() => setSf("")} className="font-medium text-primary hover:underline">Show the full day</button>
              </div>
            )}
            <div aria-hidden className={cn("hidden border-b border-line bg-cloud/60 px-4 py-2 text-xs font-medium text-muted @min-[800px]:grid @min-[800px]:gap-x-3", FULL)}>
              <span>Time</span><span>Patient</span><span>Service / reason</span><span>Provider</span><span>Room</span><span>Status</span><span>Action</span><span />
            </div>
            {isLoading ? <SkeletonRows rows={8} /> : shown.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="No appointments" text={sf ? "Nobody matches this status right now." : date === TODAY && !f.provider ? "Your schedule is clear." : "Nothing matches this date or filter."} action={<Button onClick={() => ui.newAppt({ date })}>New appointment</Button>} />
            ) : (
              groups.map((g) => (
                <div key={g.key}>
                  {g.label && <p className="border-b border-line bg-cloud/60 px-4 py-1.5 text-xs font-medium text-muted">{g.label}</p>}
                  <ul className="divide-y divide-line">
                    {g.items.map((a, i) => <Row key={a.id} a={a} now={now} showDate={range === "week" && (i === 0 || g.items[i - 1].date !== a.date)} current={date === TODAY && a.date === TODAY && a.status === "waiting"} onOpen={() => ui.openAppt(a.id)} router={router} />)}
                  </ul>
                </div>
              ))
            )}
            {!isLoading && range === "day" && full.length > LIMIT && (
              <div className="flex items-center justify-between border-t border-line">
                <button onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className="flex flex-1 items-center justify-between px-4 py-3 text-left text-[13.5px] font-medium text-primary hover:bg-cloud">
                  <span className="flex items-center gap-2"><CalendarCheck className="size-4" aria-hidden />{showAll ? "Show next appointments only" : `View all appointments (${full.length})`}</span><ChevronRight className={cn("size-4 transition-transform", showAll && "rotate-90")} />
                </button>
                <Link href="/calendar" className="whitespace-nowrap border-l border-line px-4 py-3 text-[13px] font-medium text-primary hover:bg-cloud">Open in Calendar</Link>
              </div>
            )}
          </Panel>
          )}

          <section aria-label="Quick actions">
            <h2 className="mb-2 text-[15px] font-semibold">Quick actions</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {QUICK.map((q) => (
                <button key={q.l} onClick={q.run} className={quickCls}>
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", q.tint)}><q.i className="size-4" aria-hidden /></span><span className="flex-1">{q.l}</span><ChevronRight className="size-4 text-slate-300 group-hover:text-primary" aria-hidden />
                </button>
              ))}
              <Menu>
                <MenuTrigger asChild><button className={quickCls}><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#FFF3DF] text-[#7A4B00]"><MoreHorizontal className="size-4" aria-hidden /></span><span className="flex-1">More actions</span><ChevronDown className="size-4 text-slate-300 group-hover:text-primary" aria-hidden /></button></MenuTrigger>
                <MenuContent align="start">
                  {can("enquiries") && <MenuItem onSelect={() => router.push("/enquiries?new=1")}><Inbox className="size-4 text-muted" />New enquiry</MenuItem>}
                  <MenuItem onSelect={() => router.push("/practice/forms")}><FilePlus2 className="size-4 text-muted" />Create form</MenuItem>
                  <MenuItem onSelect={() => { toast("Choose a patient, then open the Photos tab."); router.push("/patients"); }}><Camera className="size-4 text-muted" />Upload photos</MenuItem>
                  <MenuItem onSelect={() => { toast("Choose a patient, then open the Financials tab."); router.push("/patients"); }}><CreditCard className="size-4 text-muted" />Record payment</MenuItem>
                </MenuContent>
              </Menu>
            </div>
          </section>

          <EnquiryFollowUpPanel />
        </div>

        <div className="min-w-0 space-y-5">
          <Panel>
            <PanelHeader title={`Needs attention (${attention.length})`} />
            {attention.length === 0 ? <EmptyState icon={CheckCircle2} title="Nothing needs attention" text="Items that need a decision will appear here." /> : (
              <ul className="divide-y divide-line">
                {attention.map((x) => (
                  <li key={x.id} className="flex items-start gap-3 px-4 py-3">
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", ATTN[x.tone])}><x.icon className="size-4" aria-hidden /></span>
                    <div className="min-w-0 flex-1 text-[13px]"><p><span className="text-base font-semibold">{x.n}</span> {x.text}</p>
                      {x.href ? <Link href={x.href} className="text-xs font-medium text-primary hover:underline">{x.sub}</Link> : <p className="text-xs text-muted">{x.sub}</p>}</div>
                    {x.run && <button onClick={x.run} className="text-xs font-medium text-primary hover:underline">{x.action}</button>}
                    <button aria-label={`Dismiss: ${x.n} ${x.text}`} onClick={() => setDismissed([...dismissed, x.id])} className="rounded p-1 text-muted hover:bg-cloud"><X className="size-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title={`Waiting now (${waiting.length})`} action={<Link href="/front-desk" className="text-[13px] font-medium text-primary hover:underline">View all</Link>} />
            {isLoading ? <SkeletonRows rows={3} /> : waiting.length === 0 ? <EmptyState icon={Hourglass} title="Nobody is waiting" text="Patients appear here after check-in." /> : (
              <ul className="divide-y divide-line">
                {waiting.map(({ a, mins }) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                    <PatientAvatar id={a.patientId} name={pname(a.patientId)} size={36} />
                    <div className="min-w-0 flex-1"><Link href={`/patients/${a.patientId}`} className="block truncate text-[13.5px] font-medium hover:text-primary">{pname(a.patientId)}</Link><p className="truncate text-xs text-muted">{refs?.services.find((s) => s.id === a.serviceId)?.name}{refs?.providers.find((p) => p.id === a.providerId) ? ` · ${refs.providers.find((p) => p.id === a.providerId)!.short}` : ""}</p></div>
                    <Badge tone="peach" className={mins >= 10 ? "ring-1 ring-[#E0A23A]/70" : ""}>{mins >= 10 ? <AlertTriangle className="size-3" aria-hidden /> : <Clock className="size-3" aria-hidden />}{mins} min</Badge>
                    <ApptActions a={a} compact />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({ a, now, current, showDate, onOpen, router }: { a: Appointment; now: number; current: boolean; showDate: boolean; onOpen: () => void; router: ReturnType<typeof useRouter> }) {
  const { data: refs } = useRefs();
  const p = getPatient(a.patientId);
  const service = refs?.services.find((s) => s.id === a.serviceId)?.name;
  const prov = refs?.providers.find((x) => x.id === a.providerId)?.short;
  const room = refs?.rooms.find((r) => r.id === a.roomId)?.name;
  const past = ["completed", "no_show", "cancelled"].includes(a.status);
  const reason = a.notes && a.notes !== "Walk-in" ? a.notes : a.notes ? "Walk-in" : "";
  const tags = <>{p?.status === "New" && <Badge tone="lavender" className="relative py-0">New</Badge>}{p?.tags?.includes("VIP") && <Badge tone="peach" className="relative py-0">VIP</Badge>}</>;
  const status = a.status === "waiting" ? <Badge tone="peach"><Clock className="size-3" aria-hidden />Waiting · {waitLabel(now, a.arrivedAt)}</Badge> : <StatusBadge status={a.status} />;
  return (
    <li className={cn("relative", current && "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[#E0A23A]")}>
      {showDate && <p className="bg-cloud/60 px-4 py-1 text-xs font-medium text-muted">{fmtLong(a.date)}</p>}
      <div className={cn("grid grid-cols-[64px_minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-2 transition-colors hover:bg-cloud/60", MID, FULL, past && "opacity-80")}>
        <span className="text-[13px] font-medium tabular-nums">{fmtTime(a.time)}</span>
        <div className="flex min-w-0 items-center gap-2.5">
          <PatientAvatar id={a.patientId} size={36} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <button onClick={onOpen} aria-label={`Open appointment: ${pname(a.patientId)}, ${fmtTime(a.time)}`} className="truncate text-left text-[14px] font-semibold before:absolute before:inset-0 before:content-[''] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">{p?.first} {p?.last}</button>
              <span className="flex items-center gap-1 @min-[800px]:hidden">{tags}</span>
            </div>
            <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted"><span className="hidden @min-[800px]:inline">{a.patientId}</span><span className="hidden items-center gap-1 @min-[800px]:flex">{tags}</span><span className="@min-[800px]:hidden">{service}{prov ? ` · ${prov}` : ""}{room ? ` · ${room}` : ""}</span></p>
            <span className="mt-1 block @min-[600px]:hidden">{status}</span>
          </div>
        </div>
        <span className="hidden @min-[600px]:block @min-[800px]:hidden">{status}</span>
        <div className="hidden min-w-0 @min-[800px]:block"><p className="text-[13px] leading-snug">{service}</p>{reason && <p className="text-xs leading-snug text-muted">{reason}</p>}</div>
        <span className="hidden truncate text-[13px] @min-[800px]:block">{prov}</span>
        <span className="hidden text-[13px] leading-snug text-slate-600 @min-[800px]:block">{room}</span>
        <span className="hidden @min-[800px]:block">{status}</span>
        <div className="relative z-10 hidden sm:block"><ApptActions a={a} compact /></div>
        <div className="relative z-10">
          <Menu>
            <MenuTrigger asChild><button aria-label={`More actions for ${pname(a.patientId)}`} className="rounded-md p-1 text-muted hover:bg-white"><MoreHorizontal className="size-4" /></button></MenuTrigger>
            <MenuContent>
              <MenuItem onSelect={onOpen}>Open appointment (reschedule or cancel)</MenuItem>
              <MenuItem onSelect={() => router.push(`/patients/${a.patientId}`)}>Open patient</MenuItem>
              {a.visitId && <MenuItem onSelect={() => router.push(`/visits/${a.visitId}`)}>View visit</MenuItem>}
            </MenuContent>
          </Menu>
        </div>
      </div>
    </li>
  );
}
