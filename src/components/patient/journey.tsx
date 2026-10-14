"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Camera, ChevronDown, ClipboardCheck, CreditCard, FileSignature, Stethoscope, Syringe, type LucideIcon } from "lucide-react";
import { Badge, EmptyState, Panel, Segmented, Button } from "@/components/ui";
import { PhotoThumb } from "@/components/app/photos";
import { CompareDialog } from "@/components/app/capture";
import { useUI } from "@/components/app/ui-state";
import { useAppointments, useBilling, useFollowUps, usePhotos, useRole, useVisits } from "@/lib/hooks";
import { journeyFor, type JourneyEvent } from "@/lib/clinical";
import { fmtDate, TODAY } from "@/lib/db";
import type { PhotoAsset, Patient } from "@/lib/types";
import { cn } from "@/lib/utils";

type F = "all" | "visit" | "treatment" | "photo" | "form" | "payment" | "followup";
const ICON: Record<JourneyEvent["kind"], LucideIcon> = { visit: Stethoscope, treatment: Syringe, photo: Camera, form: FileSignature, payment: CreditCard, followup: ClipboardCheck, appointment: CalendarClock };
const TONE: Record<JourneyEvent["kind"], string> = { visit: "bg-active text-primary", treatment: "bg-[#ECECF9] text-[#40428A]", photo: "bg-[#E7F7F5] text-[#2A8577]", form: "bg-cloud text-slate-600", payment: "bg-[#FFF3DF] text-[#9A6200]", followup: "bg-[#E5F8FB] text-[#0E6577]", appointment: "bg-active text-primary" };
const LABEL: Record<JourneyEvent["kind"], string> = { visit: "Visit", treatment: "Treatment", photo: "Photo", form: "Form or consent", payment: "Invoice", followup: "Follow-up", appointment: "Booking" };
const PERM = { treatment: "notes", photo: "photos", payment: "financials" } as const;

/**
 * The patient's chronological record. Each event shows date, type, provider, status and a short description, and opens in place
 * to reach its source record. A booking appears only as an upcoming plan: it is never shown as care that took place.
 */
export function JourneyTab({ p, goto }: { p: Patient; goto: (tab: string, extra?: string) => void }) {
  useVisits(); useAppointments(); useFollowUps(); useBilling();
  const { data: photos } = usePhotos();
  const { can } = useRole();
  const router = useRouter();
  const ui = useUI();
  const [f, setF] = useState<F>("all");
  const [open, setOpen] = useState<string[]>([]);
  const [cmp, setCmp] = useState<[PhotoAsset, PhotoAsset] | null>(null);

  const events = useMemo(() => journeyFor(p.id).filter((e) => {
    const perm = (PERM as Record<string, "notes" | "photos" | "financials">)[e.kind];
    if (perm && !can(perm)) return false;
    if (f === "all") return e.kind !== "payment";
    return e.kind === f || (f === "visit" && e.kind === "appointment");
  }), [p.id, f, can, photos]); // eslint-disable-line react-hooks/exhaustive-deps

  const upcoming = events.filter((e) => e.upcoming).sort((a, b) => a.date.localeCompare(b.date));
  const past = events.filter((e) => !e.upcoming);
  const groups: { label: string; items: JourneyEvent[] }[] = [];
  past.forEach((e) => { const label = new Date(e.date + "T12:00").toLocaleDateString("en-US", { month: "long", year: "numeric" }); const g = groups.find((x) => x.label === label); if (g) g.items.push(e); else groups.push({ label, items: [e] }); });

  const toggle = (id: string) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const pair = (e: JourneyEvent): [PhotoAsset, PhotoAsset] | null => {
    const mine = (photos ?? []).filter((x) => x.patientId === p.id && x.view === "Front");
    const b = mine.find((x) => x.stage === "Before" && (e.photoIds ?? []).includes(x.id)); const a = mine.find((x) => x.stage === "After" && x.visitId === b?.visitId);
    return b && a ? [b, a] : null;
  };
  const filters: { value: F; label: string }[] = [{ value: "all", label: "All" }, { value: "visit", label: "Visits" }, ...(can("notes") ? [{ value: "treatment" as F, label: "Treatments" }] : []), ...(can("photos") ? [{ value: "photo" as F, label: "Photos" }] : []), { value: "form", label: "Forms and consents" }, ...(can("financials") ? [{ value: "payment" as F, label: "Payments" }] : []), { value: "followup", label: "Follow-ups" }];
  const tone = (e: JourneyEvent) => (e.status === "Overdue" ? "red" : ["Completed", "Paid", "Signed", "Photo consent granted"].includes(e.status) ? "mint" : e.status === "Pending" || e.status === "Photo consent not recorded" || e.status === "Photo consent denied" || e.status === "Photo consent withdrawn" ? "peach" : e.upcoming ? "blue" : "neutral");

  const renderEvent = (e: JourneyEvent) => {
    const Icon = ICON[e.kind]; const pr = e.kind === "treatment" ? pair(e) : null; const on = open.includes(e.id);
    const panel = `ev-${e.id}`;
    return (
      <li key={e.id} className="relative flex gap-3 pb-3 last:pb-0">
        <span className={cn("relative z-10 -ml-4 grid size-8 shrink-0 place-items-center rounded-full", TONE[e.kind], e.upcoming && "ring-2 ring-dashed ring-primary/30")}><Icon className="size-4" aria-hidden /></span>
        <div className={cn("min-w-0 flex-1 rounded-lg border", e.upcoming ? "border-dashed border-primary/40 bg-[#E5F8FB]/40" : "border-line bg-white")}>
          <button onClick={() => toggle(e.id)} aria-expanded={on} aria-controls={panel} className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-cloud/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><span className="text-xs font-medium text-muted">{e.date === TODAY ? "Today" : fmtDate(e.date, true)}</span><span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{LABEL[e.kind]}</span></span>
              <span className="block text-[14px] font-semibold">{e.title}</span>
              <span className="block truncate text-[13px] text-muted">{e.owner ? `${e.owner} · ` : ""}{e.sub}</span>
            </span>
            <Badge tone={tone(e)}>{e.status}</Badge>
            <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted transition-transform", on && "rotate-180")} aria-hidden />
          </button>
          {on && (
            <div id={panel} className="anim-fade space-y-2.5 border-t border-line px-3 py-2.5 text-[13px]">
              <p className="text-slate-600">{e.sub}{e.owner ? ` · ${e.owner}` : ""}</p>
              {e.photoIds && e.photoIds.length > 0 && can("photos") && (
                <div className="flex flex-wrap items-center gap-1.5">{e.photoIds.slice(0, 4).map((id) => { const ph = photos?.find((x) => x.id === id); return ph ? <PhotoThumb key={id} photo={ph} ar={1} className="size-12 rounded-md" /> : null; })}
                  {pr && <Button size="sm" variant="soft" onClick={() => setCmp(pr)}>Before and after</Button>}</div>)}
              <div className="flex flex-wrap gap-1.5">
                {e.kind === "visit" && e.href && <Button size="sm" variant="secondary" onClick={() => router.push(e.href!)}>Open visit</Button>}
                {e.kind === "treatment" && e.href && <Button size="sm" variant="secondary" onClick={() => router.push(e.href!)}>Open visit</Button>}
                {e.kind === "treatment" && !!e.plot && can("notes") && <Button size="sm" variant="soft" onClick={() => router.push(`/visits/${e.visitId}?tab=plotting`)}>View injection plot ({e.plot} points)</Button>}
                {(e.kind === "photo" || (e.kind === "treatment" && !!e.photoIds?.length)) && can("photos") && <Button size="sm" variant="secondary" onClick={() => goto("photos")}>Open photos</Button>}
                {e.kind === "form" && e.href && <Button size="sm" variant="secondary" onClick={() => router.push(e.href!)}>Open visit forms</Button>}
                {e.kind === "form" && <Button size="sm" variant="ghost" onClick={() => goto("docs")}>Documents &amp; forms</Button>}
                {e.kind === "payment" && <Button size="sm" variant="secondary" onClick={() => goto("financials", e.invoiceId)}>Open invoice</Button>}
                {e.kind === "followup" && <Button size="sm" variant="secondary" onClick={() => router.push("/follow-ups")}>Open follow-ups</Button>}
                {e.kind === "appointment" && <Button size="sm" variant="secondary" onClick={() => ui.openAppt(e.id)}>Open appointment</Button>}
              </div>
              {e.kind === "appointment" && <p className="text-xs text-muted">A booking is a plan. It becomes care history only once a visit is recorded.</p>}
            </div>)}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-full min-w-0 overflow-x-auto scroll-thin"><Segmented label="Journey filter" value={f} onChange={setF} options={filters} /></div>
        <button onClick={() => goto("appointments")} className="text-[13px] font-medium text-primary hover:underline">Looking for bookings? Open appointments</button>
      </div>
      {events.length === 0 ? <Panel><EmptyState title="No events match" text="Try another filter." /></Panel> : (
        <div className="space-y-6">
          {upcoming.length > 0 && <section aria-label="Upcoming"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">Upcoming and planned</h3><ol className="border-l border-dashed border-primary/30 pl-0 [&>li]:ml-[-1px]">{upcoming.map(renderEvent)}</ol></section>}
          {groups.map((g) => <section key={g.label} aria-label={g.label}><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{g.label}</h3><ol className="border-l border-line">{g.items.map(renderEvent)}</ol></section>)}
        </div>
      )}
      <CompareDialog open={!!cmp} onClose={() => setCmp(null)} a={cmp?.[0]} b={cmp?.[1]} />
    </div>
  );
}
