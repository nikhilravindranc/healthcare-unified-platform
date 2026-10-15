"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarDays, Clock, CalendarPlus, MoreHorizontal, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Banner, BannerStat } from "@/components/ui/banner";
import { Button, ConfirmDialog, EmptyState, Input, Menu, MenuContent, MenuItem, MenuSep, MenuTrigger, Pagination, Panel, Segmented, Select, SkeletonRows, StatusBadge, Td, Th } from "@/components/ui";
import { useUI } from "@/components/app/ui-state";
import { apptActions, apptStates, inQuickView, needsAttention, type QuickView } from "@/lib/appointment-view";
import { api, fmtDate, fmtTime, nowMin, pname, TODAY } from "@/lib/db";
import { useAction, useAppointments, useRefs } from "@/lib/hooks";
import { useEnquiries } from "@/modules/enquiries/hooks";
import type { Appointment } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE = 12;
const VIEWS: { value: QuickView; label: string }[] = [{ value: "all", label: "All" }, { value: "upcoming", label: "Upcoming" }, { value: "today", label: "Today" }, { value: "past", label: "Past" }, { value: "lost", label: "Cancelled / no-show" }];
const BOOKING = ["Awaiting confirmation", "Confirmed", "Booked", "Cancelled"];
const ATTENDANCE = ["Not yet arrived", "Arrived", "Waiting", "In visit", "Completed", "No-show", "No attendance recorded"];

export default function AppointmentsPage() { return <Suspense><Appointments /></Suspense>; }

function Appointments() {
  const { data, isLoading, isError, refetch } = useAppointments();
  const { data: refs } = useRefs();
  const { data: enquiries } = useEnquiries();
  const ui = useUI(); const router = useRouter(); const params = useSearchParams();
  const setStatus = useAction(api.setStatus);
  const [view, setView] = useState<QuickView>((params.get("view") as QuickView) || "upcoming");
  const [attention, setAttention] = useState(params.get("filter") === "attention");
  const [awaiting, setAwaiting] = useState(params.get("filter") === "awaiting");
  const [q, setQ] = useState("");
  const [f, setF] = useState({ provider: params.get("provider") ?? "", service: params.get("service") ?? "", location: params.get("location") ?? "", source: "", booking: "", attendance: "", from: params.get("from") ?? "", to: params.get("to") ?? "" });
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(!!(params.get("from") || params.get("provider") || params.get("service") || params.get("location")));
  const [cancel, setCancel] = useState<Appointment | null>(null);
  useEffect(() => setPage(1), [view, q, f, attention, awaiting]);

  const enquiryOf = useMemo(() => new Map((enquiries ?? []).filter((e) => e.appointmentId).map((e) => [e.appointmentId!, e.id])), [enquiries]);
  const source = (a: Appointment) => (a.origin === "online" ? "Online booking" : enquiryOf.has(a.id) ? "Enquiry" : "Not recorded");
  const all = data ?? [];
  const now = nowMin();
  const counts = {
    today: all.filter((a) => a.date === TODAY).length,
    awaiting: all.filter((a) => a.status === "scheduled" && a.date >= TODAY).length,
    attention: all.filter((a) => needsAttention(a, TODAY, now)).length,
  };

  const rows = useMemo(() => all.filter((a) => {
    if (!inQuickView(a, view, TODAY)) return false;
    if (attention && !needsAttention(a, TODAY, now)) return false;
    if (awaiting && !(a.status === "scheduled" && a.date >= TODAY)) return false;
    const s = q.trim().toLowerCase();
    if (s && ![pname(a.patientId), a.patientId, a.id].some((x) => x.toLowerCase().includes(s))) return false;
    if (f.provider && a.providerId !== f.provider) return false;
    if (f.service && a.serviceId !== f.service) return false;
    if (f.location && a.locationId !== f.location) return false;
    if (f.source && source(a) !== f.source) return false;
    const st = apptStates(a, TODAY);
    if (f.booking && st.booking !== f.booking) return false;
    if (f.attendance && st.attendance !== f.attendance) return false;
    if (f.from && a.date < f.from) return false;
    if (f.to && a.date > f.to) return false;
    return true;
  }).sort((a, b) => { const k = (x: Appointment) => x.date + x.time; return view === "upcoming" || view === "today" ? k(a).localeCompare(k(b)) : k(b).localeCompare(k(a)); }), [all, view, attention, awaiting, q, f, enquiryOf]); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = Math.ceil(rows.length / PAGE); const slice = rows.slice((page - 1) * PAGE, page * PAGE);
  const filtersOn = Object.values(f).some(Boolean) || !!q || attention || awaiting;
  const clear = () => { setF({ provider: "", service: "", location: "", source: "", booking: "", attendance: "", from: "", to: "" }); setQ(""); setAttention(false); setAwaiting(false); };

  const act = async (a: Appointment, what: "confirm" | "check-in" | "no-show") => {
    const name = pname(a.patientId);
    if (what === "confirm") { await setStatus.run(a.id, "confirmed"); toast.success(`Booking confirmed for ${name}`); }
    if (what === "check-in") { await setStatus.run(a.id, "arrived"); toast.success(`${name} checked in`); }
    if (what === "no-show") { await setStatus.run(a.id, "no_show"); toast.success(`${name} marked as a no-show`); }
  };

  return (
    <>
      <Banner variant="appointments" title="Appointments" subtitle="Review and manage scheduled visits."
        actions={<><Link href="/calendar"><Button variant="secondary"><CalendarDays className="size-4" aria-hidden />Open calendar</Button></Link><Button onClick={() => ui.newAppt()}><CalendarPlus className="size-4" aria-hidden />New appointment</Button></>}
        statsLabel="Quick filters"
        stats={<>
          <BannerStat label="Today" value={isLoading ? "–" : counts.today} icon={CalendarDays} tone="blue" active={view === "today" && !attention && !awaiting} onClick={() => { setView("today"); setAttention(false); setAwaiting(false); }} />
          <BannerStat label="Awaiting confirmation" value={isLoading ? "–" : counts.awaiting} icon={Clock} tone="peach" active={awaiting} onClick={() => { setAwaiting((x) => !x); setAttention(false); setView("upcoming"); }} />
          <BannerStat label="Needs attention" value={isLoading ? "–" : counts.attention} icon={AlertTriangle} tone="red" active={attention} onClick={() => { setAttention((x) => !x); setAwaiting(false); setView("all"); }} />
        </>} />

      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="max-w-full overflow-x-auto scroll-thin"><Segmented label="Appointment view" value={view} onChange={(v) => { setView(v); setAttention(false); setAwaiting(false); }} options={VIEWS} /></div>
          <div className="relative min-w-52 flex-1 sm:max-w-xs"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden /><Input aria-label="Search appointments" className="h-9 pl-9" placeholder="Patient, patient ID or appointment ID" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Button size="sm" variant={showFilters || Object.values(f).some(Boolean) ? "soft" : "secondary"} aria-expanded={showFilters} onClick={() => setShowFilters((x) => !x)}><SlidersHorizontal className="size-4" aria-hidden />Filters{Object.values(f).filter(Boolean).length ? ` (${Object.values(f).filter(Boolean).length})` : ""}</Button>
        </div>
        {showFilters && <div className="anim-fade flex flex-wrap gap-2 border-b border-line bg-cloud/40 px-3 py-2.5">
          <Select sm className="w-36" aria-label="Provider" value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}><option value="">All providers</option>{refs?.providers.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}</Select>
          <Select sm className="w-44" aria-label="Service" value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}><option value="">All services</option>{refs?.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          <Select sm className="w-40" aria-label="Location" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })}><option value="">All locations</option>{refs?.locations.map((l) => <option key={l.id} value={l.id}>{l.name.replace("Brightwell ", "")}</option>)}</Select>
          <Select sm className="w-40" aria-label="Booking source" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}><option value="">Any source</option><option>Online booking</option><option>Enquiry</option><option>Not recorded</option></Select>
          <Select sm className="w-48" aria-label="Booking status" value={f.booking} onChange={(e) => setF({ ...f, booking: e.target.value })}><option value="">Any booking status</option>{BOOKING.map((s) => <option key={s}>{s}</option>)}</Select>
          <Select sm className="w-52" aria-label="Attendance status" value={f.attendance} onChange={(e) => setF({ ...f, attendance: e.target.value })}><option value="">Any attendance</option>{ATTENDANCE.map((s) => <option key={s}>{s}</option>)}</Select>
          <label className="flex items-center gap-1.5 text-xs text-muted">From<Input type="date" aria-label="From date" className="h-8 w-36" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
          <label className="flex items-center gap-1.5 text-xs text-muted">To<Input type="date" aria-label="To date" className="h-8 w-36" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
          {filtersOn && <Button size="sm" variant="ghost" onClick={clear}>Clear filters</Button>}
        </div>}

        {isLoading ? <SkeletonRows rows={8} /> : isError ? <EmptyState title="Couldn't load appointments" text="Try again." action={<Button variant="secondary" onClick={() => refetch()}>Try again</Button>} />
          : rows.length === 0 ? <EmptyState title="No appointments match" text={filtersOn ? "Change or clear the filters." : "Nothing in this view."} action={filtersOn ? <Button variant="secondary" onClick={clear}>Clear filters</Button> : undefined} /> : (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <caption className="sr-only">Appointments. Open a row to see the appointment.</caption>
                <thead className="border-b border-line bg-white"><tr><Th>When</Th><Th>Patient</Th><Th>Service</Th><Th className="hidden lg:table-cell">Provider</Th><Th className="hidden xl:table-cell">Location</Th><Th>Status</Th><Th className="hidden xl:table-cell">Source</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
                <tbody className="divide-y divide-line">
                  {slice.map((a) => {
                    const st = apptStates(a, TODAY); const acts = apptActions(a, TODAY);
                    const room = refs?.rooms.find((r) => r.id === a.roomId)?.name; const loc = refs?.locations.find((l) => l.id === a.locationId)?.name.replace("Brightwell ", "");
                    return (
                      <tr key={a.id} className="hover:bg-cloud/40">
                        <Td className="whitespace-nowrap"><Link href={`/appointments/${a.id}`} className="font-medium hover:text-primary hover:underline">{a.date === TODAY ? "Today" : fmtDate(a.date, true)}</Link><span className="block text-xs text-muted">{fmtTime(a.time)} · {a.duration} min</span></Td>
                        <Td><Link href={`/patients/${a.patientId}`} className="font-medium hover:text-primary hover:underline">{pname(a.patientId)}</Link><span className="block text-xs text-muted">{a.patientId} · {a.id}</span></Td>
                        <Td>{refs?.services.find((s) => s.id === a.serviceId)?.name}</Td>
                        <Td className="hidden lg:table-cell">{refs?.providers.find((p) => p.id === a.providerId)?.short}</Td>
                        <Td className="hidden xl:table-cell">{loc}{room && <span className="block text-xs text-muted">{room}</span>}</Td>
                        <Td><StatusBadge status={a.status} /><span className="mt-0.5 block text-xs text-muted">{st.booking} · {st.attendance}</span></Td>
                        <Td className="hidden xl:table-cell text-muted">{source(a)}</Td>
                        <Td className="text-right">
                          <Menu><MenuTrigger asChild><button aria-label={`Actions for ${pname(a.patientId)}, ${fmtDate(a.date)} ${fmtTime(a.time)}`} className="rounded-md p-1.5 text-muted hover:bg-cloud focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"><MoreHorizontal className="size-4" /></button></MenuTrigger>
                            <MenuContent>
                              <MenuItem onSelect={() => router.push(`/appointments/${a.id}`)}>Open appointment</MenuItem>
                              {acts.includes("confirm") && <MenuItem onSelect={() => act(a, "confirm")}>Confirm booking</MenuItem>}
                              {acts.includes("check-in") && <MenuItem onSelect={() => act(a, "check-in")}>Check in</MenuItem>}
                              {acts.includes("open-visit") && <MenuItem onSelect={() => router.push(`/visits/${a.visitId}`)}>Open visit</MenuItem>}
                              {acts.includes("reschedule") && <MenuItem onSelect={() => ui.openAppt(a.id)}>Reschedule</MenuItem>}
                              {acts.includes("no-show") && <MenuItem onSelect={() => act(a, "no-show")}>Mark no-show</MenuItem>}
                              <MenuSep />
                              <MenuItem onSelect={() => router.push(`/patients/${a.patientId}`)}>Open patient</MenuItem>
                              {acts.includes("cancel") && <MenuItem onSelect={() => setCancel(a)}>Cancel appointment</MenuItem>}
                            </MenuContent></Menu>
                        </Td>
                      </tr>);
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pages} onPage={setPage} total={rows.length} />
          </>)}
      </Panel>
      <ConfirmDialog open={!!cancel} onOpenChange={(o) => !o && setCancel(null)} title="Cancel appointment?" description={cancel && `${pname(cancel.patientId)}, ${fmtDate(cancel.date)} at ${fmtTime(cancel.time)}. The record is kept and shown as cancelled.`}
        cancelLabel="Keep appointment" confirmLabel="Cancel appointment" danger loading={setStatus.pending}
        onConfirm={async () => { const a = cancel!; await setStatus.run(a.id, "cancelled"); setCancel(null); toast.success("Appointment cancelled"); }} />
    </>
  );
}
