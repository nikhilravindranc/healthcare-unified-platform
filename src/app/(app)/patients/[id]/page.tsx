"use client";
import { Suspense, use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, ClipboardList, Clock, MoreHorizontal, ShieldAlert, Tag } from "lucide-react";
import { Badge, Button, EmptyState, Menu, MenuContent, MenuItem, MenuTrigger, Skeleton } from "@/components/ui";
import { PatientAvatar } from "@/components/app/photos";
import { useUI } from "@/components/app/ui-state";
import { Denied, ageOf } from "@/components/patient/shared";
import { EditPatientDialog, OverviewTab, sortAlerts } from "@/components/patient/summary";
import { AppointmentsTab } from "@/components/patient/appointments-tab";
import { JourneyTab } from "@/components/patient/journey";
import { PhotosTab } from "@/components/patient/photos-tab";
import { FinancialsTab } from "@/components/patient/financials";
import { DocumentsTab, FormsTab, PlansPanel } from "@/components/patient/records";
import { api, fmtDate, fmtTime, TODAY } from "@/lib/db";
import { useAction, useAppointments, usePatients, useRole, useVisits } from "@/lib/hooks";
import { activeVisit, lastCompletedVisit, nextAppointment } from "@/lib/patient-overview";
import { cn } from "@/lib/utils";

const TABS = [["overview", "Overview"], ["appointments", "Appointments"], ["history", "Care history"], ["photos", "Photos"], ["docs", "Documents & forms"], ["financials", "Financials"]] as const;
/** Older deep links keep working. */
const ALIAS: Record<string, string> = { summary: "overview", journey: "history", visits: "history", treatments: "history", documents: "docs", forms: "docs", "follow-ups": "overview", communication: "overview", notes: "overview" };

export default function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense><Workspace id={use(params).id} /></Suspense>;
}

function Workspace({ id }: { id: string }) {
  const { data: patients, isLoading } = usePatients();
  const { data: appts } = useAppointments();
  const { data: visits } = useVisits();
  const { can } = useRole();
  const ui = useUI();
  const router = useRouter();
  const params = useSearchParams();
  const start = useAction(api.startVisit);
  const [edit, setEdit] = useState(false);
  /** Set by arrow-key tab changes so focus follows to the new tab. */
  const refocus = useRef(false);
  const [invoice, setInvoice] = useState<string | undefined>();
  const raw = params.get("tab") ?? "overview"; const tab = (TABS.find(([k]) => k === (ALIAS[raw] ?? raw))?.[0] ?? "overview") as (typeof TABS)[number][0];
  const goto = (t: string, extra?: string) => { setInvoice(extra); router.replace(`/patients/${id}?tab=${ALIAS[t] ?? t}`, { scroll: false }); };

  useEffect(() => { if (refocus.current) { document.getElementById(`ptab-${tab}`)?.focus(); refocus.current = false; } }, [tab, patients]);
  const p = patients?.find((x) => x.id === id);
  if (isLoading) return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-72 w-full" /></div>;
  if (!p) return <EmptyState title="Patient not found" text="This patient may have been removed." action={<Link href="/patients"><Button variant="secondary">Back to patients</Button></Link>} />;

  const next = nextAppointment(appts ?? [], id, TODAY);
  const last = lastCompletedVisit(visits ?? [], id, TODAY);
  const live = activeVisit(visits ?? [], id);
  const startVisit = async () => {
    const ready = (appts ?? []).find((a) => a.patientId === id && a.date === TODAY && ["scheduled", "confirmed", "arrived", "waiting"].includes(a.status));
    if (!ready) return ui.newVisit({ patientId: p.id });
    const v = await start.run(ready.id);
    toast.success("Visit started"); router.push(`/visits/${v.id}`);
  };
  const alerts = sortAlerts(p.alerts ?? []);
  const tags = (p.tags ?? []).filter((t) => t.trim());
  const primary = TABS.filter(([k]) => (k !== "financials" || can("financials")) && (k !== "photos" || can("photos")));
  const guard = (perm: Parameters<typeof can>[0], what: string, el: React.ReactNode) => (can(perm) ? el : <Denied what={what} />);

  return (
    <>
      <header className="mb-4 rounded-xl border border-line bg-white px-4 py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3.5">
            <PatientAvatar id={p.id} name={`${p.first} ${p.last}`} size={56} className="rounded-xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5"><h1 className="truncate text-[22px] font-semibold leading-tight tracking-tight">{p.first} {p.last}</h1><span className="text-[13px] text-muted">{p.id} · {ageOf(p.dob)} yrs{p.status === "Inactive" ? " · Inactive" : ""}</span></div>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-slate-600"><a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} className="hover:text-primary hover:underline">{p.phone}</a><a href={`mailto:${p.email}`} className="break-all hover:text-primary hover:underline">{p.email}</a></p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {alerts[0] ? <button onClick={() => goto("overview")} aria-label={`Safety alert: ${alerts[0].type}, ${alerts[0].description}${alerts.length > 1 ? `, and ${alerts.length - 1} more. Open safety information` : ". Open safety information"}`} className="inline-flex items-center gap-1.5 rounded-md bg-[#FFF3DF] px-2 py-0.5 text-xs font-medium text-[#7A4B00] ring-1 ring-[#F4DDAA] hover:bg-[#FFEBC8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"><ShieldAlert className="size-3.5" aria-hidden />{alerts[0].type}: {alerts[0].description}{alerts.length > 1 ? ` +${alerts.length - 1}` : ""}</button>
                  : <span className="text-xs text-muted">No alerts recorded</span>}
                {tags.slice(0, 3).map((t) => <Badge key={t} tone="lavender" className="py-0"><Tag className="size-3" aria-hidden />{t}</Badge>)}
                {tags.length > 3 && <span className="text-xs text-muted">+{tags.length - 3}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Menu><MenuTrigger asChild><Button id="patient-more" variant="secondary" aria-label="More actions"><MoreHorizontal className="size-4" /></Button></MenuTrigger><MenuContent><MenuItem onSelect={() => setEdit(true)}>Edit patient</MenuItem><MenuItem onSelect={() => ui.newFollowUp({ patientId: p.id })}>Add follow-up</MenuItem>{can("photos") && <MenuItem onSelect={() => goto("photos")}>Upload photo</MenuItem>}<MenuItem onSelect={() => toast("Messaging isn't connected. Connect EVOQ Messaging in Integrations to message patients.")}>Message (not connected)</MenuItem></MenuContent></Menu>
            <Button variant="secondary" onClick={() => ui.newAppt({ patientId: p.id })}><ClipboardList className="size-4" aria-hidden />Book appointment</Button>
            {live ? <Button id="start-visit" onClick={() => router.push(`/visits/${live.id}`)}>Resume visit</Button> : <Button id="start-visit" onClick={startVisit} loading={start.pending}>Start visit</Button>}
          </div>
        </div>
        <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-1.5 border-t border-line pt-2.5 text-[13px]">
          <div className="flex items-center gap-2"><CalendarDays className="size-4 text-muted" aria-hidden /><dt className="text-muted">Next appointment</dt><dd>{next ? <button onClick={() => ui.openAppt(next.id)} className="font-medium hover:text-primary hover:underline">{next.date === TODAY ? "Today" : fmtDate(next.date)}, {fmtTime(next.time)}</button> : <span className="text-muted">None booked</span>}</dd></div>
          <div className="flex items-center gap-2"><Clock className="size-4 text-muted" aria-hidden /><dt className="text-muted">Last visit</dt><dd>{last ? <Link href={`/visits/${last.id}`} className="font-medium hover:text-primary hover:underline">{fmtDate(last.date)}, {last.type}</Link> : <span className="text-muted">No completed visits</span>}</dd></div>
          {live && <div className="flex items-center gap-2"><dt className="text-muted">Visit in progress</dt><dd><Badge tone="blue">{live.type}</Badge></dd></div>}
        </dl>
      </header>

      <div role="tablist" aria-label="Patient workspace" onKeyDown={(e) => {
        const i = primary.findIndex(([k]) => k === tab); const n = primary.length;
        const j = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
        if (j < 0) return; e.preventDefault(); refocus.current = true; goto(primary[j][0]);
      }} className="scroll-thin mb-5 flex items-center gap-1 overflow-x-auto border-b border-line">
        {primary.map(([k, l]) => (
          <button key={k} id={`ptab-${k}`} role="tab" aria-selected={tab === k} aria-controls="ppanel" tabIndex={tab === k ? 0 : -1} onClick={() => goto(k)} className={cn("relative whitespace-nowrap px-3 py-2.5 text-sm font-medium after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40", tab === k ? "text-primary after:bg-primary" : "text-muted hover:text-ink")}>{l}</button>))}
      </div>

      <div role="tabpanel" id="ppanel" aria-labelledby={`ptab-${tab}`}>
        {tab === "overview" && <OverviewTab p={p} goto={goto} />}
        {tab === "appointments" && <AppointmentsTab p={p} goto={goto} />}
        {tab === "history" && <div className="space-y-5"><PlansPanel p={p} /><JourneyTab p={p} goto={goto} /></div>}
        {tab === "photos" && guard("photos", "patient photos", <PhotosTab p={p} />)}
        {tab === "docs" && <div className="space-y-5"><FormsTab p={p} /><DocumentsTab p={p} /></div>}
        {tab === "financials" && guard("financials", "patient financials", <FinancialsTab p={p} invoiceId={invoice} />)}
      </div>
      <EditPatientDialog key={p.id + String(edit)} p={p} open={edit} onClose={() => { setEdit(false); requestAnimationFrame(() => document.getElementById("patient-more")?.focus()); }} />
    </>
  );
}
