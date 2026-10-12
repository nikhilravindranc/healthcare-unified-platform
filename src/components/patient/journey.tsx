"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Camera, ClipboardCheck, CreditCard, FileSignature, Stethoscope, Syringe, type LucideIcon } from "lucide-react";
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
const TONE: Record<JourneyEvent["kind"], string> = { visit: "bg-active text-primary", treatment: "bg-[#ECECF9] text-[#40428A]", photo: "bg-[#E7F7F5] text-[#2A8577]", form: "bg-cloud text-slate-600", payment: "bg-[#FFF3DF] text-[#9A6200]", followup: "bg-[#DDF4F8] text-[#0E6577]", appointment: "bg-active text-primary" };
const PERM = { treatment: "notes", photo: "photos", payment: "financials" } as const;

export function JourneyTab({ p, goto }: { p: Patient; goto: (tab: string, extra?: string) => void }) {
  useVisits(); useAppointments(); useFollowUps(); useBilling();
  const { data: photos } = usePhotos();
  const { can } = useRole();
  const router = useRouter();
  const ui = useUI();
  const [f, setF] = useState<F>("all");
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

  const open = (e: JourneyEvent) => {
    if (e.kind === "payment") return goto("financials", e.invoiceId);
    if (e.kind === "photo" || (e.photoIds?.length && !e.href)) return goto("photos");
    if (e.kind === "appointment") return ui.openAppt(e.id);
    if (e.href) router.push(e.href);
  };
  const pair = (e: JourneyEvent): [PhotoAsset, PhotoAsset] | null => {
    const mine = (photos ?? []).filter((x) => x.patientId === p.id && x.view === "Front");
    const b = mine.find((x) => x.stage === "Before" && (e.photoIds ?? []).includes(x.id)); const a = mine.find((x) => x.stage === "After" && x.visitId === b?.visitId);
    return b && a ? [b, a] : null;
  };
  const filters: { value: F; label: string }[] = [{ value: "all", label: "All" }, { value: "visit", label: "Visits" }, ...(can("notes") ? [{ value: "treatment" as F, label: "Treatments" }] : []), ...(can("photos") ? [{ value: "photo" as F, label: "Photos" }] : []), { value: "form", label: "Forms and consents" }, ...(can("financials") ? [{ value: "payment" as F, label: "Payments" }] : []), { value: "followup", label: "Follow-ups" }];

  const renderEvent = (e: JourneyEvent) => {
    const Icon = ICON[e.kind]; const pr = e.kind === "treatment" ? pair(e) : null;
    return (
      <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
        <span className={cn("relative z-10 -ml-4 grid size-8 shrink-0 place-items-center rounded-full", TONE[e.kind], e.upcoming && "ring-2 ring-dashed ring-primary/30")}><Icon className="size-4" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <button onClick={() => open(e)} className={cn("block w-full rounded-lg border px-3 py-2.5 text-left hover:border-primary/40 hover:bg-active/40", e.upcoming ? "border-dashed border-primary/40 bg-active/30" : "border-line bg-white")}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><span className="text-xs font-medium text-muted">{e.date === TODAY ? "Today" : fmtDate(e.date, true)}</span><span className="text-[14px] font-semibold">{e.title}</span><Badge tone={e.status === "Overdue" ? "red" : e.status === "Completed" || e.status === "Paid" || e.status === "Signed" || e.status === "Consent on file" ? "mint" : e.upcoming ? "blue" : "neutral"}>{e.status}</Badge></div>
            <p className="mt-0.5 text-[13px] text-muted">{e.sub}{e.owner ? ` · ${e.owner}` : ""}</p>
          </button>
          {e.photoIds && e.photoIds.length > 0 && can("photos") && (
            <div className="mt-1.5 flex items-center gap-1.5">{e.photoIds.slice(0, 4).map((id) => { const ph = photos?.find((x) => x.id === id); return ph ? <PhotoThumb key={id} photo={ph} ar={1} className="size-10 rounded-md" /> : null; })}
              {pr && <Button size="sm" variant="soft" onClick={() => setCmp(pr)}>Before and after</Button>}</div>)}
          {e.kind === "treatment" && !!e.plot && can("notes") && <Button size="sm" variant="soft" className="mt-1.5" onClick={() => router.push(`/visits/${e.visitId}?tab=plotting`)}>View injection plot ({e.plot} points)</Button>}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <Segmented label="Journey filter" value={f} onChange={setF} options={filters} />
      {events.length === 0 ? <Panel><EmptyState title="No events match" text="Try another filter." /></Panel> : (
        <div className="space-y-6">
          {upcoming.length > 0 && <section aria-label="Upcoming"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">Upcoming</h3><ol className="border-l border-dashed border-primary/30 pl-0 [&>li]:ml-[-1px]">{upcoming.map(renderEvent)}</ol></section>}
          {groups.map((g) => <section key={g.label} aria-label={g.label}><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{g.label}</h3><ol className="border-l border-line">{g.items.map(renderEvent)}</ol></section>)}
        </div>
      )}
      <CompareDialog open={!!cmp} onClose={() => setCmp(null)} a={cmp?.[0]} b={cmp?.[1]} />
    </div>
  );
}
