"use client";
import { Suspense, use, useState } from "react";
import { isOpenStatus } from "@/lib/appointment-rules";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, ClipboardList, MessageSquare, MoreHorizontal } from "lucide-react";
import { Badge, Button, EmptyState, Menu, MenuContent, MenuItem, MenuTrigger, Skeleton } from "@/components/ui";
import { PatientAvatar } from "@/components/app/photos";
import { useUI } from "@/components/app/ui-state";
import { Denied, ageOf } from "@/components/patient/shared";
import { EditPatientDialog, SummaryTab } from "@/components/patient/summary";
import { JourneyTab } from "@/components/patient/journey";
import { PhotosTab } from "@/components/patient/photos-tab";
import { FinancialsTab } from "@/components/patient/financials";
import { DocumentsTab, FormsTab, PlansPanel } from "@/components/patient/records";
import { api, fmtDate, fmtTime, TODAY } from "@/lib/db";
import { useAction, useAppointments, usePatients, useRole } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const TABS = [["summary", "Summary"], ["history", "Care history"], ["photos", "Photos"], ["docs", "Documents & forms"], ["financials", "Financials"]] as const;
/** Older deep links keep working. */
const ALIAS: Record<string, string> = { journey: "history", visits: "history", treatments: "history", documents: "docs", forms: "docs", "follow-ups": "summary", communication: "summary", notes: "summary" };

export default function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense><Workspace id={use(params).id} /></Suspense>;
}

function Workspace({ id }: { id: string }) {
  const { data: patients, isLoading } = usePatients();
  const { data: appts } = useAppointments();
  const { can } = useRole();
  const ui = useUI();
  const router = useRouter();
  const params = useSearchParams();
  const start = useAction(api.startVisit);
  const [edit, setEdit] = useState(false);
  const [invoice, setInvoice] = useState<string | undefined>();
  const raw = params.get("tab") ?? "summary"; const tab = (TABS.find(([k]) => k === (ALIAS[raw] ?? raw))?.[0] ?? "summary") as (typeof TABS)[number][0];
  const goto = (t: string, extra?: string) => { setInvoice(extra); router.replace(`/patients/${id}?tab=${ALIAS[t] ?? t}`, { scroll: false }); };

  const p = patients?.find((x) => x.id === id);
  if (isLoading) return <div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-72 w-full" /></div>;
  if (!p) return <EmptyState title="Patient not found" text="This patient may have been removed." action={<Link href="/patients"><Button variant="secondary">Back to patients</Button></Link>} />;

  const next = (appts ?? []).filter((a) => a.patientId === id && a.date >= TODAY && isOpenStatus(a.status)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).find((a) => a.date > TODAY || a.status === "scheduled" || a.status === "confirmed") ?? (appts ?? []).find((a) => a.patientId === id && a.date >= TODAY && isOpenStatus(a.status));
  const startVisit = async () => {
    const ready = (appts ?? []).find((a) => a.patientId === id && a.date === TODAY && ["scheduled", "confirmed", "arrived", "waiting", "in_progress"].includes(a.status));
    if (!ready) return ui.newVisit({ patientId: p.id });
    const v = await start.run(ready.id);
    toast.success("Visit started"); router.push(`/visits/${v.id}`);
  };
  const alerts = p.alerts ?? [];
  const primary = TABS.filter(([k]) => (k !== "financials" || can("financials")) && (k !== "photos" || can("photos")));
  const guard = (perm: Parameters<typeof can>[0], what: string, el: React.ReactNode) => (can(perm) ? el : <Denied what={what} />);

  return (
    <>
      <header className="relative mb-5 flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl border border-[#E3E6F5] bg-[linear-gradient(115deg,#F1EEFB_0%,#E6F1FB_38%,#DFF4F0_72%,#FFF3DC_100%)] px-5 py-4">
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-white/50 blur-2xl" />
        <div className="relative flex min-w-0 items-center gap-3.5">
          <PatientAvatar id={p.id} name={`${p.first} ${p.last}`} size={60} className="rounded-xl ring-2 ring-white shadow-sm" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-[24px] font-semibold leading-tight tracking-tight">{p.first} {p.last}</h1>{p.status === "Inactive" && <Badge>Inactive</Badge>}{(p.tags ?? []).includes("VIP") && <Badge tone="peach">VIP</Badge>}{alerts.length > 0 && <Badge tone="peach"><AlertTriangle className="size-3" aria-hidden />{alerts[0].description}{alerts.length > 1 ? ` +${alerts.length - 1}` : ""}</Badge>}</div>
            <p className="truncate text-[13px] text-slate-600">{p.id} · {ageOf(p.dob)} yrs · {p.phone} · <CalendarDays className="mb-0.5 inline size-3.5" aria-hidden /> {next ? `Next ${next.date === TODAY ? "today" : fmtDate(next.date)}, ${fmtTime(next.time)}` : "No upcoming appointment"}</p>
          </div>
        </div>
        <div className="relative flex flex-wrap items-center gap-2">
          <Menu><MenuTrigger asChild><Button variant="secondary" aria-label="More actions"><MoreHorizontal className="size-4" /></Button></MenuTrigger><MenuContent><MenuItem onSelect={() => setEdit(true)}>Edit patient</MenuItem><MenuItem onSelect={() => ui.newFollowUp({ patientId: p.id })}>Add follow-up</MenuItem>{can("photos") && <MenuItem onSelect={() => goto("photos")}>Upload photo</MenuItem>}<MenuItem onSelect={() => toast("Messaging isn't connected. Connect EVOQ Messaging in Integrations to message patients.")}><MessageSquare className="size-4 text-muted" />Message</MenuItem></MenuContent></Menu>
          <Button variant="secondary" onClick={() => ui.newAppt({ patientId: p.id })}><ClipboardList className="size-4" />Book appointment</Button>
          <Button id="start-visit" onClick={startVisit} loading={start.pending}>Start visit</Button>
        </div>
      </header>

      <div role="tablist" aria-label="Patient workspace" className="mb-5 flex items-center gap-1 overflow-x-auto border-b border-line scroll-thin">
        {primary.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => goto(k)} className={cn("relative whitespace-nowrap px-3 py-2.5 text-sm font-medium after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded", tab === k ? "text-primary after:bg-primary" : "text-muted hover:text-ink")}>{l}</button>))}
      </div>

      <div role="tabpanel">
        {tab === "summary" && <SummaryTab p={p} goto={goto} />}
        {tab === "history" && <div className="space-y-5"><PlansPanel p={p} /><JourneyTab p={p} goto={goto} /></div>}
        {tab === "photos" && guard("photos", "patient photos", <PhotosTab p={p} />)}
        {tab === "docs" && <div className="space-y-5"><DocumentsTab p={p} /><FormsTab p={p} /></div>}
        {tab === "financials" && guard("financials", "patient financials", <FinancialsTab p={p} invoiceId={invoice} />)}
      </div>
      <EditPatientDialog key={p.id + String(edit)} p={p} open={edit} onClose={() => setEdit(false)} />
    </>
  );
}
