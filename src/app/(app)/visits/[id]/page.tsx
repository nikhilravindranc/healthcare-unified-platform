"use client";
import { Suspense, use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Check, ChevronDown, MoreHorizontal, Sparkles, X } from "lucide-react";
import { BannerSurface } from "@/components/ui/banner";
import { Badge, Button, ConfirmDialog, EmptyState, Field, Input, Menu, MenuContent, MenuItem, MenuTrigger, Modal, Skeleton } from "@/components/ui";
import { PatientAvatar } from "@/components/app/photos";
import { useUI } from "@/components/app/ui-state";
import { Denied, ageOf } from "@/components/patient/shared";
import { PlottingTab } from "@/components/visit/plotting";
import { BeforeYouStart, BillingTab, capsFor, ConsentTab, FollowUpPanel, MeasuresTab, NotesTab, PlanTab, ProductsTab, SummaryPanel, TreatmentTab, VisitPhotos, type Patch } from "@/components/visit/tabs";
import { apiC } from "@/lib/clinical";
import { api, fmtDate, fmtTime, TODAY } from "@/lib/db";
import { useAction, useAppointments, useClinic, usePatients, usePhotos, useRefs, useRole, useVisits } from "@/lib/hooks";
import type { Visit } from "@/lib/types";
import { cn } from "@/lib/utils";

const FIELDS = ["reason", "notes", "technique", "areas", "treatmentNote", "treatments", "plot", "followUpInstructions", "followUpRecommended", "forms", "measures", "exercises"] as const;
const snap = (v: Visit) => JSON.stringify(FIELDS.map((k) => v[k] ?? null));

const TAB_ALIAS: Record<string, string> = { treatment: "notes", measures: "notes", products: "plotting", photos: "consent", plan: "followup" };

export default function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense><Workspace id={use(params).id} /></Suspense>;
}

function Workspace({ id }: { id: string }) {
  const { data: visits, isLoading } = useVisits();
  const { data: patients } = usePatients();
  const { data: refs } = useRefs();
  const { data: appts } = useAppointments();
  const { data: photos } = usePhotos();
  const { can, role } = useRole();
  const { type: clinic, config } = useClinic();
  const ui = useUI();
  const router = useRouter();
  const sp = useSearchParams();
  const saveVisit = useAction(api.updateVisit);
  const savePlot = useAction(apiC.savePlot);
  const complete = useAction(api.completeVisit);
  const consume = useAction(apiC.consumeStock);
  const [draft, setDraft] = useState<Visit | null>(null);
  const [savedAt, setSavedAt] = useState<string | undefined>();
  const [leave, setLeave] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [override, setOverride] = useState({ on: false, reason: "" });
  const [afterTab, setAfterTab] = useState<string | null>(null);
  const base = useRef("");

  const v = visits?.find((x) => x.id === id);
  useEffect(() => { if (v && (!draft || draft.id !== v.id)) { setDraft(structuredClone(v)); base.current = snap(v); } }, [v, draft]);
  const dirty = !!draft && !!v && v.status !== "Completed" && !complete.pending && !consume.pending && snap(draft) !== base.current;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const click = (e: MouseEvent) => { const a = (e.target as Element).closest?.("a[href]") as HTMLAnchorElement | null; if (a && a.origin === location.origin && !a.href.includes(`/visits/${id}`)) { e.preventDefault(); e.stopPropagation(); setLeave(a.pathname + a.search); } };
    window.addEventListener("beforeunload", warn); document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", click, true); };
  }, [dirty, id]);

  const p = patients?.find((x) => x.id === v?.patientId);
  const { id: serviceId, caps } = useMemo(() => (draft ? capsFor(draft, refs?.services) : { id: "consult", caps: capsFor({ type: "" } as Visit, undefined).caps }), [draft, refs]);
  const prior = (visits ?? []).filter((x) => x.patientId === v?.patientId && x.id !== id && x.status === "Completed" && x.date <= (v?.date ?? TODAY)).sort((a, b) => b.date.localeCompare(a.date))[0];
  const appt = appts?.find((a) => a.id === v?.apptId);
  const physio = clinic === "Physiotherapy";

  const plotCount = draft?.plot.length ?? 0;
  const hasPlot = caps.plotting && config.tabs.plotting && can("notes");
  const hasProducts = caps.products && config.tabs.products;
  const hasPhotos = config.tabs.photos && (caps.beforeAfter || caps.guided) && can("photos");
  const hasTreatment = !physio;
  const hasMeasures = config.tabs.measurements;
  const hasPlan = config.tabs.plan;
  /** Six tabs at most, in the order a visit unfolds: before (consent and photos), during (plotting and products), after (notes, follow-up, billing). */
  const tabs = useMemo(() => {
    const t: [string, string][] = [["summary", "Summary"], ["consent", hasPhotos ? "Consent & photos" : "Forms & consent"]];
    if (hasPlot || hasProducts) t.push(["plotting", hasPlot && hasProducts ? `Plotting & products${plotCount ? ` (${plotCount})` : ""}` : hasPlot ? `Injection plotting${plotCount ? ` (${plotCount})` : ""}` : "Products"]);
    t.push(["notes", hasTreatment ? `${config.notesLabel === "Notes" ? "Notes" : config.notesLabel} & ${config.treatmentLabel.toLowerCase()}` : hasMeasures ? `${config.notesLabel} & measures` : config.notesLabel]);
    t.push(["followup", hasPlan ? "Follow-up & plan" : "Follow-up"]);
    if (can("financials")) t.push(["billing", "Billing"]);
    return t;
  }, [config, can, plotCount, hasPlot, hasProducts, hasPhotos, hasTreatment, hasMeasures, hasPlan]);
  /** Older links to the tabs that were merged still land in the right place. */
  const tab = tabs.find(([k]) => k === (TAB_ALIAS[sp.get("tab") ?? ""] ?? sp.get("tab")))?.[0] ?? "summary";
  const tlRef = useRef<HTMLDivElement>(null); const [moreTabs, setMoreTabs] = useState(false);
  useEffect(() => {
    const el = tlRef.current; if (!el) return;
    const f = () => setMoreTabs(el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
    f(); el.addEventListener("scroll", f); window.addEventListener("resize", f);
    return () => { el.removeEventListener("scroll", f); window.removeEventListener("resize", f); };
  }, [tabs.length, !!draft]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (k: string) => router.replace(`/visits/${id}?tab=${k}`, { scroll: false });

  if (isLoading || (v && !draft)) return <div className="space-y-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-96 w-full" /></div>;
  if (!v || !draft || !p) return <EmptyState title="Visit not found" action={<Link href="/visits"><Button variant="secondary">Back to visits</Button></Link>} />;

  const locked = v.status === "Completed";
  const patch: Patch = (x) => setDraft((d) => ({ ...d!, ...x }));
  const mine = (photos ?? []).filter((x) => x.visitId === id);
  const requiredViews = config.photoChecklist.length ? config.photoChecklist : [];
  const hasNotes = Object.values(draft.notes).some((x) => x.trim());
  const reqs = [
    can("notes") && { label: "Clinical notes written", ok: hasNotes, tab: "notes" },
    caps.consent && { label: "Consent signed", ok: draft.forms.some((f) => f.kind === "Consent" && f.signed), tab: "consent" },
    caps.beforeAfter && config.tabs.photos && can("photos") && { label: "Before photo (front) captured", ok: mine.some((x) => x.stage === "Before" && x.view === "Front"), tab: "consent" },
    caps.plotting && config.tabs.plotting && { label: "At least one injection point documented", ok: draft.plot.length > 0, tab: "plotting" },
    caps.products && draft.plot.length > 0 && { label: "Lot recorded for every product", ok: draft.plot.every((x) => !!x.lot), tab: "plotting" },
  ].filter(Boolean) as { label: string; ok: boolean; tab: string }[];
  const missing = reqs.filter((r) => !r.ok);
  const canOverride = role === "Owner" || role === "Practice manager";

  const save = async (quiet = false) => {
    const { plot, ...rest } = draft; void rest;
    const fields = Object.fromEntries(FIELDS.filter((k) => k !== "plot").map((k) => [k, draft[k]])) as Partial<Visit>;
    await saveVisit.run(id, { ...fields, noteMeta: { savedAt: "10:" + String(20 + ((Date.now() / 60000) | 0) % 40), by: refs?.providers.find((x) => x.id === v.providerId)?.short ?? "Provider" } });
    if (JSON.stringify(plot) !== JSON.stringify(v.plot)) await savePlot.run(id, plot);
    base.current = snap(draft); setSavedAt(`just now by ${refs?.providers.find((x) => x.id === v.providerId)?.short}`);
    if (!quiet) toast.success("Draft saved");
  };
  const finish = async (next?: string) => {
    if (dirty) await save(true);
    await complete.run(id); await consume.run(id);
    toast.success("Visit completed"); setDone(false); setOverride({ on: false, reason: "" });
    if (next) go(next);
  };
  const body = () => {
    const denied = (perm: Parameters<typeof can>[0], what: string, el: React.ReactNode) => (can(perm) ? el : <Denied what={what} />);
    switch (tab) {
      case "summary": return <SummaryPanel v={draft} p={p} patch={patch} locked={locked} status={reqs} onPlot={hasPlot ? () => go("plotting") : undefined} />;
      case "consent": return <div className="space-y-5"><ConsentTab v={draft} p={p} locked={locked} patch={patch} />{hasPhotos && denied("photos", "photos", <VisitPhotos v={draft} p={p} locked={locked} required={requiredViews} />)}</div>;
      case "plotting": return <div className="space-y-5">{hasPlot && denied("notes", "injection plots", <PlottingTab v={v.status === "Completed" ? v : draft} plot={draft.plot} setPlot={(pl) => patch({ plot: pl })} locked={locked} visits={visits ?? []} />)}{hasProducts && <ProductsTab v={draft} />}</div>;
      case "notes": return denied("notes", "clinical notes", <div className="space-y-5"><NotesTab v={draft} patch={patch} locked={locked} prior={prior} clinic={clinic} saved={savedAt ?? (v.noteMeta ? `${v.noteMeta.savedAt} by ${v.noteMeta.by}` : undefined)} />{hasTreatment && <TreatmentTab v={draft} patch={patch} locked={locked} label={config.treatmentLabel} />}{hasMeasures && <MeasuresTab v={draft} patch={patch} locked={locked} />}</div>);
      case "followup": return <div className="space-y-5"><FollowUpPanel v={draft} p={p} patch={patch} locked={locked} />{hasPlan && <PlanTab v={draft} p={p} />}</div>;
      case "billing": return denied("financials", "billing", <BillingTab v={draft} p={p} serviceId={serviceId} />);
      default: return null;
    }
  };

  return (
    <>
      <BannerSurface as="header" variant="visit" className="mb-4 px-4 py-4 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button aria-label="Back to patient" onClick={() => (dirty ? setLeave(`/patients/${p.id}`) : router.push(`/patients/${p.id}`))} className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/80 bg-white/80 shadow-sm hover:bg-white"><ArrowLeft className="size-4" /></button>
          <PatientAvatar id={p.id} name={`${p.first} ${p.last}`} size={46} className="rounded-xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-[22px] font-semibold tracking-tight">{draft.type}</h1><Badge tone={locked ? "mint" : "blue"}>{locked ? "Completed · read-only" : "In progress"}</Badge>{dirty && <Badge tone="peach">Unsaved</Badge>}{(p.alerts ?? []).length > 0 && <Badge tone="peach"><AlertTriangle className="size-3" aria-hidden />{p.alerts![0].description}</Badge>}</div>
            <p className="truncate text-[13px] text-muted"><Link href={`/patients/${p.id}`} className="font-medium text-ink hover:text-primary hover:underline">{p.first} {p.last}</Link> · {p.id} · {ageOf(p.dob)} yrs · {v.date === TODAY ? "Oct 7" : fmtDate(v.date)} · {refs?.providers.find((x) => x.id === v.providerId)?.short}{appt ? ` · ${refs?.rooms.find((r) => r.id === appt.roomId)?.name}` : ""}</p>
            <p className="truncate text-xs text-muted">{appt ? <>Booking: <button onClick={() => ui.openAppt(appt.id)} className="font-medium text-primary hover:underline">{appt.date === TODAY ? "Today" : fmtDate(appt.date)}, {fmtTime(appt.time)}</button></> : "No booking is linked to this visit."}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Menu><MenuTrigger asChild><Button variant="secondary" aria-label="More visit actions"><MoreHorizontal className="size-4" /></Button></MenuTrigger>
            <MenuContent><MenuItem onSelect={() => ui.evi({ prep: { patientId: p.id, apptId: v.apptId } })}><Sparkles className="size-4 text-primary" />Prepare with EVI</MenuItem><MenuItem onSelect={() => router.push(`/patients/${p.id}`)}>Open patient</MenuItem><MenuItem onSelect={() => router.push(`/patients/${p.id}?tab=visits`)}>All visits for this patient</MenuItem></MenuContent></Menu>
          {!locked && <Button variant="secondary" disabled={!dirty} loading={saveVisit.pending || savePlot.pending} onClick={() => save()}>Save draft</Button>}
          {!locked && (
            <div className="flex">
              <Button className="rounded-r-none" onClick={() => { setOverride({ on: false, reason: "" }); setDone(true); }}><Check className="size-4" />Complete visit</Button>
              <Menu><MenuTrigger asChild><Button aria-label="More completion options" className="rounded-l-none border-l border-white/30 px-2"><ChevronDown className="size-4" /></Button></MenuTrigger>
                <MenuContent><MenuItem onSelect={() => { setAfterTab("billing"); setOverride({ on: false, reason: "" }); setDone(true); }}>Complete and go to billing</MenuItem></MenuContent></Menu>
            </div>)}
        </div>
      </div></BannerSurface>
      {!locked && <BeforeYouStart v={draft} p={p} />}

      <div className="relative mb-5">
        <div ref={tlRef} role="tablist" aria-label="Visit sections" className="flex gap-1 overflow-x-auto border-b border-line scroll-thin">
          {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => go(k)} className={cn("relative whitespace-nowrap px-3 py-2.5 text-sm font-medium after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded", tab === k ? "text-primary after:bg-primary" : "text-muted hover:text-ink")}>{l}</button>)}
        </div>
        {moreTabs && <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white to-transparent" />}
      </div>
      <div role="tabpanel">{body()}</div>

      <Modal open={done} onOpenChange={setDone} title="Complete this visit?" width={520}
        description={missing.length ? "Some configured requirements are not met yet." : `${p.first} ${p.last}'s documentation will become read-only. Stock is deducted and any recommended follow-up is created.`}
        footer={<><Button variant="secondary" onClick={() => setDone(false)}>Keep editing</Button>
          {missing.length > 0 && canOverride && !override.on && <Button variant="secondary" onClick={() => setOverride({ on: true, reason: "" })}>Complete anyway</Button>}
          <Button disabled={(missing.length > 0 && !(override.on && override.reason.trim().length > 3))} loading={complete.pending || consume.pending} onClick={() => finish(afterTab ?? undefined)}>Complete visit</Button></>}>
        <ul className="space-y-1.5">{reqs.map((r) => <li key={r.label} className="flex items-center gap-2.5 text-[13px]">{r.ok ? <Check className="size-4 text-[#2A8577]" /> : <X className="size-4 text-[#9A6200]" />}<span className={r.ok ? "text-muted" : "font-medium"}>{r.label}</span>{!r.ok && <button className="ml-auto text-xs font-medium text-primary hover:underline" onClick={() => { setDone(false); go(r.tab); }}>Fix</button>}</li>)}{reqs.length === 0 && <li className="text-[13px] text-muted">No requirements configured for this service.</li>}</ul>
        {override.on && <div className="mt-4"><Field label="Reason for completing without requirements" required><Input value={override.reason} onChange={(e) => setOverride({ ...override, reason: e.target.value })} /></Field><p className="mt-1 text-xs text-muted">This override is written to the audit log.</p></div>}
      </Modal>
      <ConfirmDialog open={!!leave} onOpenChange={(o) => !o && setLeave(null)} title="Leave without saving?" description="You have unsaved changes in this visit. Leaving now will discard them." cancelLabel="Stay on visit" confirmLabel="Discard and leave" danger
        onConfirm={() => { const to = leave!; base.current = snap(draft); setLeave(null); setTimeout(() => router.push(to), 0); }} />
    </>
  );
}
