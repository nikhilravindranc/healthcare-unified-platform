"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Camera, Check, ChevronDown, Circle, FileSignature, Plus, Sparkles, Trash2, X, Minus } from "lucide-react";
import { Alert, Badge, Button, EmptyState, Field, Input, Modal, Panel, PanelHeader, Select, Textarea } from "@/components/ui";
import { PhotoThumb } from "@/components/app/photos";
import { PlotCanvas } from "@/components/app/plot";
import { CaptureSheet } from "@/components/app/capture";
import { useUI } from "@/components/app/ui-state";
import { FormFields } from "@/components/patient/records";
import { NewInvoiceDialog } from "@/components/patient/financials";
import { apiC, CLINIC_CONFIG, docTotal, inventory, invoices, money, SERVICE_CAPS, SERVICE_PRICE, type ClinicType } from "@/lib/clinical";
import { useAction, useBilling, useExtras, usePhotos, useRefs, useTemplates, useVisits } from "@/lib/hooks";
import { addDays, api, fmtDate, TODAY } from "@/lib/db";
import { prepSummary } from "@/lib/insight";
import type { Invoice, InvoiceLine, Patient, TreatmentLine, Visit } from "@/lib/types";
import { cn } from "@/lib/utils";

export type Patch = (p: Partial<Visit>) => void;
export const capsFor = (v: Visit, services: { id: string; name: string }[] | undefined) => {
  const id = v.serviceId ?? services?.find((s) => s.name === v.type)?.id ?? "consult";
  return { id, caps: SERVICE_CAPS[id] ?? SERVICE_CAPS.consult };
};

/* ---------- Before you start ---------- */
export function BeforeYouStart({ v, p }: { v: Visit; p: Patient }) {
  const [open, setOpen] = useState(false);
  const ui = useUI();
  useVisits(); usePhotos();
  const s = prepSummary(p.id, v.apptId);
  const consentOk = v.forms.some((f) => f.kind === "Consent" && f.signed);
  return (
    <section className="mb-4 rounded-xl border border-line bg-white" aria-label="Before you start">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between px-4 py-2.5 text-left"><span className="text-[14px] font-semibold">Before you start</span><span className="flex items-center gap-3 text-xs text-muted">{!open && `${s.visits[0] ? `Last visit ${s.visits[0].label.split(" · ")[0]}` : "No previous visits"} · consent ${consentOk ? "signed" : "pending"} · ${s.photos} photos`}<ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} /></span></button>
      {open && (
        <div className="grid gap-4 border-t border-line px-4 py-3 text-[13px] md:grid-cols-4">
          <div><p className="text-xs font-medium uppercase text-muted">Alerts</p>{(p.alerts ?? []).length ? p.alerts!.map((a) => <p key={a.id}>{a.type}: {a.description}</p>) : <p className="text-muted">None recorded</p>}</div>
          <div><p className="text-xs font-medium uppercase text-muted">Last visit</p>{s.visits[0] ? <><p>{s.visits[0].label}</p><p className="text-muted">{s.visits[0].sub}</p></> : <p className="text-muted">No previous visits</p>}{s.treatments[0] && <p className="text-muted">{s.treatments[0]}</p>}</div>
          <div><p className="text-xs font-medium uppercase text-muted">Forms and consent</p><p className="flex items-center gap-1.5">{consentOk ? <Check className="size-4 text-[#2A8577]" /> : <Circle className="size-3.5 text-[#9A6200]" />}{consentOk ? "Consent signed" : "Consent not yet signed"}</p><p className="text-muted">{s.photos} photos on file{s.plot ? ` · previous plot ${fmtDate(s.plot.date)}` : ""}</p></div>
          <div><p className="text-xs font-medium uppercase text-muted">Follow-up</p>{s.followUps[0] ? <p>{s.followUps[0]}</p> : <p className="text-muted">None</p>}<button className="mt-1 text-xs font-medium text-primary hover:underline" onClick={() => ui.evi({ prep: { patientId: p.id, apptId: v.apptId } })}><Sparkles className="mr-1 inline size-3" />Summarize with EVI</button></div>
        </div>)}
    </section>
  );
}

/* ---------- Summary ---------- */
export function SummaryPanel({ v, p, patch, locked, status, onPlot }: { v: Visit; p: Patient; patch: Patch; locked: boolean; status: { label: string; ok: boolean }[]; onPlot?: () => void }) {
  const { data: refs } = useRefs();
  const prov = refs?.providers.find((x) => x.id === v.providerId);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {onPlot && (
        /* A card, not a button: the preview holds its own point markers, and a button cannot contain buttons. The real button is the action on the right. */
        <div onClick={onPlot} className="group flex cursor-pointer items-center gap-4 rounded-xl border border-primary/30 bg-active/50 p-4 text-left hover:border-primary hover:bg-active lg:col-span-2">
          <div inert aria-hidden className="w-16 shrink-0 overflow-hidden rounded-lg border border-line bg-white"><PlotCanvas patientId={v.patientId} view="full" points={v.plot} readOnly labels={false} /></div>
          <div className="flex-1"><p className="text-[15px] font-semibold">Injection plotting</p><p className="text-[13px] text-muted">{v.plot.length ? `${v.plot.length} points documented${locked ? "" : ". Continue plotting."}` : locked ? "No points were documented." : "Document where treatment is given on the patient's photo."}</p></div>
          <button type="button" onClick={(e) => { e.stopPropagation(); onPlot(); }} aria-label="Open injection plotting" className="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-white group-hover:bg-primary-hover">{locked ? "View plot" : v.plot.length ? "Continue" : "Start plotting"}</button>
        </div>)}
      <Panel><PanelHeader title="Visit summary" />
        <dl className="grid grid-cols-[120px_1fr] gap-y-2 p-4 text-[13px]"><dt className="text-muted">Patient</dt><dd><Link href={`/patients/${p.id}`} className="text-primary hover:underline">{p.first} {p.last}</Link></dd><dt className="text-muted">Service</dt><dd>{v.type}</dd><dt className="text-muted">Provider</dt><dd>{prov?.name}</dd><dt className="text-muted">Started</dt><dd>{fmtDate(v.date, true)}</dd><dt className="text-muted">Status</dt><dd>{v.status}</dd></dl>
        <div className="border-t border-line p-4"><Field label="Reason for visit"><Textarea disabled={locked} value={v.reason} onChange={(e) => patch({ reason: e.target.value })} placeholder="Why is the patient here today?" /></Field></div></Panel>
      {(() => {
        const unmet = status.filter((x) => !x.ok).length;
        const sub = !locked ? "Configured for this service" : unmet ? `Completed with ${unmet} item${unmet === 1 ? "" : "s"} not recorded` : "Everything was recorded";
        return (
          <Panel><PanelHeader title="Completion checklist" sub={sub} />
            <ul className="divide-y divide-line">{status.map((s) => <li key={s.label} className="flex items-center gap-2.5 px-4 py-2.5 text-[13px]">
              {s.ok ? <Check className="size-4 text-[#2A8577]" /> : locked ? <Minus className="size-4 text-slate-400" /> : <X className="size-4 text-[#9A6200]" />}
              <span className={s.ok || locked ? "text-muted" : "font-medium"}>{s.label}</span>
              {!s.ok && locked && <span className="ml-auto text-xs text-muted">Not recorded when completed</span>}</li>)}{status.length === 0 && <li className="px-4 py-3 text-[13px] text-muted">No requirements configured.</li>}</ul></Panel>);
      })()}
    </div>
  );
}

/* ---------- Notes ---------- */
const NOTE_TPL: Record<string, [string, string, string, string]> = {
  "Standard visit note": ["Reason and history", "Findings", "Assessment", "Plan and instructions"],
  "Injectable treatment note": ["Reason and history", "Findings before treatment", "Treatment summary", "Aftercare and plan"],
  "Follow-up note": ["Interval history", "Findings", "Progress", "Plan"],
  "Physiotherapy session": ["Subjective", "Objective measures", "Intervention", "Plan and home programme"],
};
const AFTERCARE = ["Avoid strenuous exercise for 24 hours. Contact the practice if swelling or redness persists.", "Avoid touching or massaging the treated area for 6 hours. Use sunscreen daily.", "Mild tenderness is expected for 24 to 48 hours. Contact the practice if it worsens."];
/** The note template a visit uses by default, so the same section names show on the visit and on the patient's Notes tab. */
export const defaultNoteTemplate = (type: string, clinic: ClinicType) => (clinic === "Physiotherapy" ? "Physiotherapy session" : type === "Follow-up" ? "Follow-up note" : /inject/i.test(type) ? "Injectable treatment note" : "Standard visit note");
export const noteLabelsFor = (type: string, clinic: ClinicType) => NOTE_TPL[defaultNoteTemplate(type, clinic)];
export function NotesTab({ v, patch, locked, prior, clinic, saved }: { v: Visit; patch: Patch; locked: boolean; prior?: Visit; clinic: ClinicType; saved?: string }) {
  const def = defaultNoteTemplate(v.type, clinic);
  const [tpl, setTpl] = useState(def); const [showPrior, setShowPrior] = useState(false);
  const labels = NOTE_TPL[tpl]; const keys = ["subjective", "objective", "assessment", "plan"] as const;
  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div><h2 className="text-[15px] font-semibold">{CLINIC_CONFIG[clinic].notesLabel}</h2><p className="text-xs text-muted">{locked ? "Visit completed. Notes are read-only." : saved ? `Last saved ${saved}` : "Draft not saved yet"}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <Select sm aria-label="Note template" className="w-52" disabled={locked} value={tpl} onChange={(e) => setTpl(e.target.value)}>{Object.keys(NOTE_TPL).map((t) => <option key={t}>{t}</option>)}</Select>
            {!locked && <Select sm aria-label="Insert approved aftercare" className="w-48" value="" onChange={(e) => { if (e.target.value) patch({ notes: { ...v.notes, plan: [v.notes.plan, e.target.value].filter(Boolean).join("\n") } }); }}><option value="">Insert approved aftercare…</option>{AFTERCARE.map((a, i) => <option key={i} value={a}>{a.slice(0, 44)}…</option>)}</Select>}
            {prior && <Button size="sm" variant="secondary" onClick={() => setShowPrior(!showPrior)}>{showPrior ? "Hide" : "Show"} prior note</Button>}
          </div>
        </div>
        <div className="grid gap-4 p-4 md:grid-cols-2">{keys.map((k, i) => <Field key={k} label={labels[i]}><Textarea disabled={locked} className="min-h-28" value={v.notes[k]} onChange={(e) => patch({ notes: { ...v.notes, [k]: e.target.value } })} /></Field>)}</div>
      </Panel>
      {showPrior && prior && <Panel><PanelHeader title={`Prior note · ${fmtDate(prior.date, true)} · ${prior.type}`} /><dl className="grid gap-3 p-4 text-[13px] md:grid-cols-2">{keys.map((k, i) => <div key={k}><dt className="text-xs text-muted">{labels[i]}</dt><dd>{prior.notes[k] || "—"}</dd></div>)}</dl></Panel>}
      <p className="text-xs text-muted">Providers own clinical decisions and approve documentation. EVI can summarize documented history but does not write or recommend treatment.</p>
    </div>
  );
}

/* ---------- Treatment (details + lines) ---------- */
export function TreatmentTab({ v, patch, locked, label }: { v: Visit; patch: Patch; locked: boolean; label: string }) {
  const { data: refs } = useRefs();
  const [adding, setAdding] = useState(false); const [t, setT] = useState({ service: v.type, area: "", product: "", units: "", notes: "" }); const [err, setErr] = useState("");
  const add = () => {
    if (!t.area.trim() || !t.product.trim()) return setErr("Area and product are required");
    const line: TreatmentLine = { id: `t${Date.now()}`, service: t.service, area: t.area, product: t.product, units: Number(t.units) || 0, notes: t.notes };
    patch({ treatments: [...v.treatments, line] }); setAdding(false); setT({ service: v.type, area: "", product: "", units: "", notes: "" }); setErr("");
  };
  return (
    <div className="space-y-5">
      <Panel><PanelHeader title={`${label} details`} />
        <div className="grid gap-4 p-4 md:grid-cols-3">
          <Field label={label}><Input disabled value={v.type} readOnly /></Field>
          <Field label="Treatment area"><Input disabled={locked} value={v.areas ?? ""} onChange={(e) => patch({ areas: e.target.value })} placeholder="e.g. Forehead, glabella" /></Field>
          <Field label="Technique"><Select disabled={locked} value={v.technique ?? ""} onChange={(e) => patch({ technique: e.target.value })}><option value="">Not specified</option><option>Standard protocol</option><option>Modified protocol</option><option>Provider-specific</option></Select></Field>
          <Field label="Notes" className="md:col-span-3"><Textarea disabled={locked} value={v.treatmentNote ?? ""} onChange={(e) => patch({ treatmentNote: e.target.value })} /></Field>
        </div></Panel>
      <Panel><PanelHeader title="Treatment lines" action={!locked && <Button size="sm" onClick={() => setAdding(true)}><Plus className="size-4" />Add</Button>} />
        {v.treatments.length === 0 && !adding ? <EmptyState title="No lines documented" text="Add services, areas and products used." /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-[13px]"><thead className="border-b border-line bg-cloud/50 text-left text-xs text-muted"><tr><th className="px-4 py-2 font-medium">Service</th><th className="px-4 py-2 font-medium">Area</th><th className="px-4 py-2 font-medium">Product</th><th className="px-4 py-2 font-medium">Units</th><th className="px-4 py-2 font-medium">Notes</th><th /></tr></thead>
            <tbody className="divide-y divide-line">{v.treatments.map((x) => <tr key={x.id}><td className="px-4 py-2.5">{x.service}</td><td className="px-4 py-2.5">{x.area}</td><td className="px-4 py-2.5">{x.product}</td><td className="px-4 py-2.5">{x.units}</td><td className="px-4 py-2.5 text-muted">{x.notes || "—"}</td><td className="px-4 py-2.5 text-right">{!locked && <button aria-label="Remove line" className="rounded p-1 text-muted hover:text-danger" onClick={() => patch({ treatments: v.treatments.filter((y) => y.id !== x.id) })}><Trash2 className="size-4" /></button>}</td></tr>)}</tbody></table></div>)}
        {adding && <div className="anim-fade space-y-3 border-t border-line bg-cloud/40 p-4"><div className="grid gap-3 md:grid-cols-4">
          <Field label="Service"><Select value={t.service} onChange={(e) => setT({ ...t, service: e.target.value })}>{refs?.services.map((s) => <option key={s.id}>{s.name}</option>)}</Select></Field>
          <Field label="Area" required><Input value={t.area} onChange={(e) => setT({ ...t, area: e.target.value })} /></Field><Field label="Product" required><Input value={t.product} onChange={(e) => setT({ ...t, product: e.target.value })} /></Field>
          <Field label="Units"><Input type="number" min={0} step="0.1" value={t.units} onChange={(e) => setT({ ...t, units: e.target.value })} /></Field></div>
          <Field label="Notes"><Input value={t.notes} onChange={(e) => setT({ ...t, notes: e.target.value })} /></Field>{err && <p role="alert" className="text-xs text-danger">{err}</p>}
          <div className="flex justify-end gap-2"><Button size="sm" variant="secondary" onClick={() => setAdding(false)}>Cancel</Button><Button size="sm" onClick={add}>Add line</Button></div></div>}
      </Panel>
    </div>
  );
}

/* ---------- Products ---------- */
export function ProductsTab({ v }: { v: Visit }) {
  const rows = useMemo(() => { const m = new Map<string, { product: string; units: number; lot?: string }>(); v.plot.forEach((p) => { const r = m.get(p.product) ?? { product: p.product, units: 0, lot: p.lot }; r.units += p.units; m.set(p.product, r); }); v.treatments.forEach((t) => { if (t.product && !m.has(t.product)) m.set(t.product, { product: t.product, units: t.units }); }); return [...m.values()]; }, [v.plot, v.treatments]);
  return (
    <Panel><PanelHeader title="Products used" sub="Totals come from the plot and treatment lines. Stock is deducted when the visit is completed." />
      {rows.length === 0 ? <EmptyState title="No products documented" text="Add injection points or treatment lines first." /> : (
        <table className="w-full text-[13px]"><thead className="border-b border-line bg-cloud/50 text-left text-xs text-muted"><tr><th className="px-4 py-2 font-medium">Product</th><th className="px-4 py-2 font-medium">Quantity</th><th className="px-4 py-2 font-medium">Lot</th><th className="px-4 py-2 font-medium">In stock</th></tr></thead>
          <tbody className="divide-y divide-line">{rows.map((r) => { const it = inventory.find((i) => i.name === r.product); const unit = /toxin|bio/i.test(r.product) ? "units" : "ml"; return <tr key={r.product}><td className="px-4 py-2.5 font-medium">{r.product}</td><td className="px-4 py-2.5">{Math.round(r.units * 10) / 10} {unit}</td><td className="px-4 py-2.5">{r.lot || it?.lot || <Badge tone="peach">Missing</Badge>}</td><td className="px-4 py-2.5">{it ? <span className={it.qty <= it.reorder ? "font-medium text-[#9A6200]" : ""}>{it.qty} {it.unit}{it.qty <= it.reorder ? " (low)" : ""}</span> : "—"}</td></tr>; })}</tbody></table>)}
    </Panel>
  );
}

/* ---------- Photos ---------- */
export function VisitPhotos({ v, p, locked, required }: { v: Visit; p: Patient; locked: boolean; required: string[] }) {
  const { data: photos } = usePhotos(); const [cap, setCap] = useState<null | "Before" | "During" | "After">(null);
  const mine = (photos ?? []).filter((x) => x.visitId === v.id);
  return (
    <div className="space-y-5">
      <Panel><PanelHeader title="Guided capture checklist" action={!locked && <Button size="sm" onClick={() => setCap("Before")}><Camera className="size-4" />Capture or upload</Button>} />
        <ul className="grid gap-2 p-4 sm:grid-cols-5">{required.map((view) => { const got = mine.filter((x) => x.view === view && x.stage === "Before").length > 0; return <li key={view} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px]", got ? "border-[#C5E8E1] bg-[#EAF7F4]" : "border-line")}>{got ? <Check className="size-4 text-[#2A8577]" /> : <Circle className="size-3.5 text-muted" />}<span>{view}<span className="block text-[11px] text-muted">{got ? "Captured" : "Missing"}</span></span></li>; })}</ul>
        {required.length === 0 && <p className="p-4 text-[13px] text-muted">No photo checklist is configured for this service.</p>}</Panel>
      {(["Before", "During", "After"] as const).map((st) => <Panel key={st}><PanelHeader title={st} action={!locked && <Button size="sm" variant="secondary" onClick={() => setCap(st)}>Add</Button>} />
        {mine.filter((x) => x.stage === st).length === 0 ? <p className="p-4 text-[13px] text-muted">No {st.toLowerCase()} photos.</p> : <ul className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-6">{mine.filter((x) => x.stage === st).map((x) => <li key={x.id}><PhotoThumb photo={x} ar={4 / 5} className="rounded-lg" /><p className="mt-1 text-xs text-muted">{x.view}</p></li>)}</ul>}</Panel>)}
      <CaptureSheet open={!!cap} onClose={() => setCap(null)} patientId={p.id} visitId={v.id} stage={cap ?? "Before"} key={cap ?? "x"} />
    </div>
  );
}

/* ---------- Consent ---------- */
export function ConsentTab({ v, p, locked, patch }: { v: Visit; p: Patient; locked: boolean; patch: Patch }) {
  const { data: tpls } = useTemplates(); const submit = useAction(apiC.submitForm, "Form submitted");
  const [tid, setTid] = useState<string | null>(null); const [vals, setVals] = useState<Record<string, string>>({}); const [err, setErr] = useState<Record<string, string>>({});
  const tpl = tpls?.find((t) => t.id === tid);
  const send = async () => {
    const e: Record<string, string> = {}; tpl!.fields.forEach((f) => { if (f.required && f.type !== "instructions" && (f.type === "checkbox" ? vals[f.id] !== "true" : !(vals[f.id] ?? "").trim())) e[f.id] = "Required"; }); setErr(e); if (Object.keys(e).length) return;
    await submit.run({ patientId: p.id, visitId: v.id, templateId: tpl!.id, templateName: tpl!.name, version: tpl!.version, submitted: TODAY, by: `${p.first} ${p.last}`, status: "Submitted", answers: vals });
    patch({ forms: [...v.forms.filter((f) => f.name !== tpl!.name), { id: `f${Date.now()}`, name: tpl!.name, kind: tpl!.type === "Consent" ? "Consent" : "Clinical form", signed: true }] }); setTid(null);
  };
  return (
    <Panel><PanelHeader title="Forms and consent" action={!locked && <Select sm className="w-48" aria-label="Complete a form" value="" onChange={(e) => { setTid(e.target.value); setVals({}); setErr({}); }}><option value="">Complete a form…</option>{(tpls ?? []).filter((t) => t.status === "Published").map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>} />
      {v.forms.length === 0 ? <EmptyState title="No forms attached" text="Add the consent or clinical form this service requires." /> : <ul className="divide-y divide-line">{v.forms.map((f) => <li key={f.id} className="flex items-center gap-3 px-4 py-3 text-[13px]"><FileSignature className="size-4 text-muted" /><span className="flex-1"><span className="font-medium">{f.name}</span><br /><span className="text-muted">{f.kind}</span></span><Badge tone={f.signed ? "mint" : "peach"}>{f.signed ? "Signed" : "Awaiting signature"}</Badge></li>)}</ul>}
      <Modal open={!!tpl} onOpenChange={(o) => !o && setTid(null)} width={560} title={tpl?.name ?? ""} description={tpl?.description} footer={<><Button variant="secondary" onClick={() => setTid(null)}>Cancel</Button><Button loading={submit.pending} onClick={send}>Submit form</Button></>}>{tpl && <FormFields fields={tpl.fields} v={vals} set={(id, val) => setVals({ ...vals, [id]: val })} err={err} />}</Modal>
    </Panel>
  );
}

/* ---------- Follow-up ---------- */
export function FollowUpPanel({ v, p, patch, locked }: { v: Visit; p: Patient; patch: Patch; locked: boolean }) {
  const ui = useUI(); const { data: refs } = useRefs();
  const create = useAction(api.createFollowUp, "Follow-up task created");
  const [f, setF] = useState({ type: "Post-treatment", due: addDays(TODAY, 14), assignee: refs?.providers.find((x) => x.id === v.providerId)?.short ?? "Dr. Patel" });
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel><PanelHeader title="Instructions and recommendation" /><div className="space-y-4 p-4">
        <Field label="Patient instructions"><Textarea disabled={locked} value={v.followUpInstructions} onChange={(e) => patch({ followUpInstructions: e.target.value })} /></Field>
        <Field label="Recommended follow-up"><Input disabled={locked} placeholder="e.g. Post-treatment review in 2 weeks" value={v.followUpRecommended} onChange={(e) => patch({ followUpRecommended: e.target.value })} /></Field></div></Panel>
      <Panel><PanelHeader title="Follow-up task and next appointment" /><div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3"><Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{["Post-treatment", "Routine review", "Treatment continuation", "Recall", "Other"].map((t) => <option key={t}>{t}</option>)}</Select></Field><Field label="Due"><Input type="date" min={TODAY} value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field></div>
        <Field label="Owner"><Select value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })}>{["Dr. Patel", "Dr. Rao", "Dr. Mehta", "Tom Reyes", "Meera Iyer"].map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" loading={create.pending} onClick={() => create.run({ patientId: p.id, visitId: v.id, type: f.type as never, due: f.due, assignee: f.assignee })}>Create follow-up task</Button><Button onClick={() => ui.newAppt({ patientId: p.id, providerId: v.providerId })}>Book next appointment</Button></div></div></Panel>
    </div>
  );
}

/* ---------- Treatment plan ---------- */
export function PlanTab({ v, p }: { v: Visit; p: Patient }) {
  const { data: extras } = useExtras(); const setStep = useAction(apiC.setPlanStep, "Plan updated");
  const plans = (extras?.plans ?? []).filter((x) => x.patientId === p.id);
  return plans.length === 0 ? <Panel><EmptyState title="No treatment plan" text="Create one from the patient's Treatments tab." action={<Link href={`/patients/${p.id}?tab=treatments`}><Button variant="secondary">Open treatments</Button></Link>} /></Panel> : (
    <div className="space-y-4">{plans.map((pl) => <Panel key={pl.id}><PanelHeader title={pl.name} sub={pl.goal} />
      <ol className="space-y-1.5 p-4">{pl.steps.map((s, i) => <li key={s.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-[13px]"><span className="grid size-5 place-items-center rounded-full bg-cloud text-[11px]">{i + 1}</span><span className="flex-1 font-medium">{s.title}{s.date && <span className="font-normal text-muted"> · {fmtDate(s.date)}</span>}</span><Badge tone={s.status === "Completed" ? "mint" : s.status === "Scheduled" ? "blue" : s.status === "Deferred" ? "peach" : "neutral"}>{s.status}</Badge>
        {s.status !== "Completed" && <Button size="sm" variant="secondary" onClick={() => setStep.run(pl.id, s.id, "Completed")}>Mark completed</Button>}</li>)}</ol></Panel>)}
      <p className="text-xs text-muted">Visit {v.id} can complete steps of the provider-authored plan. EVI never proposes a plan.</p></div>
  );
}

/* ---------- Billing ---------- */
export function BillingTab({ v, p, serviceId }: { v: Visit; p: Patient; serviceId: string }) {
  const { data: refs } = useRefs(); useBilling();
  const [dlg, setDlg] = useState(false);
  const svc = refs?.services.find((s) => s.id === serviceId);
  const seed = useMemo<InvoiceLine[]>(() => {
    const out: InvoiceLine[] = [{ id: "d0", desc: svc?.name ?? v.type, qty: 1, unit: SERVICE_PRICE[serviceId] ?? 100, discount: 0, taxRate: 0 }];
    const m = new Map<string, number>(); v.plot.forEach((x) => m.set(x.product, (m.get(x.product) ?? 0) + x.units));
    [...m.entries()].forEach(([prod, qty], i) => { const it = inventory.find((x) => x.name === prod); if (it) out.push({ id: `d${i + 1}`, desc: `${prod} (${it.unit})`, qty: Math.round(qty * 10) / 10, unit: it.price, discount: 0, taxRate: 0 }); });
    return out;
  }, [v.plot, svc, serviceId, v.type]);
  const existing = invoices.filter((i) => i.visitId === v.id);
  return (
    <div className="space-y-5">
      <Panel><PanelHeader title="Draft charges" sub="From the configured service price and documented products" action={<Button size="sm" onClick={() => setDlg(true)}>Review and create invoice</Button>} />
        <table className="w-full text-[13px]"><thead className="border-b border-line bg-cloud/50 text-left text-xs text-muted"><tr><th className="px-4 py-2 font-medium">Item</th><th className="px-4 py-2 font-medium">Qty</th><th className="px-4 py-2 font-medium">Unit price</th><th className="px-4 py-2 text-right font-medium">Total</th></tr></thead>
          <tbody className="divide-y divide-line">{seed.map((l) => <tr key={l.id}><td className="px-4 py-2.5">{l.desc}</td><td className="px-4 py-2.5">{l.qty}</td><td className="px-4 py-2.5">{money(l.unit)}</td><td className="px-4 py-2.5 text-right">{money(l.qty * l.unit)}</td></tr>)}</tbody>
          <tfoot><tr className="border-t border-line font-semibold"><td className="px-4 py-2" colSpan={3}>Estimated total</td><td className="px-4 py-2 text-right">{money(docTotal({ lines: seed }))}</td></tr></tfoot></table></Panel>
      {existing.length > 0 && <Panel><PanelHeader title="Invoices for this visit" /><ul className="divide-y divide-line">{existing.map((i: Invoice) => <li key={i.id} className="flex justify-between px-4 py-2.5 text-[13px]"><Link href={`/patients/${p.id}?tab=financials`} className="text-primary hover:underline">{i.id}</Link><span>{money(docTotal(i))} · {i.status}</span></li>)}</ul></Panel>}
      <Alert tone="info">Prices come from the service catalogue and inventory. Taxes follow your Billing settings. Issue the invoice, then take payment from the patient&apos;s Financials.</Alert>
      <NewInvoiceDialog p={p} open={dlg} onClose={() => setDlg(false)} visitId={v.id} seed={seed} />
    </div>
  );
}

/* ---------- Physiotherapy measures and exercises ---------- */
export function MeasuresTab({ v, patch, locked }: { v: Visit; patch: Patch; locked: boolean }) {
  const [m, setM] = useState({ label: "", value: "" }); const [e, setE] = useState({ name: "", dose: "" });
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel><PanelHeader title="Progress measurements" />
        <ul className="divide-y divide-line">{(v.measures ?? []).map((x) => <li key={x.id} className="flex justify-between px-4 py-2.5 text-[13px]"><span>{x.label}</span><span className="font-medium">{x.value}{!locked && <button aria-label="Remove" className="ml-3 text-muted hover:text-danger" onClick={() => patch({ measures: v.measures!.filter((y) => y.id !== x.id) })}>×</button>}</span></li>)}{!(v.measures ?? []).length && <li className="px-4 py-3 text-[13px] text-muted">No measurements recorded.</li>}</ul>
        {!locked && <form className="flex gap-2 border-t border-line p-3" onSubmit={(ev) => { ev.preventDefault(); if (!m.label.trim() || !m.value.trim()) return; patch({ measures: [...(v.measures ?? []), { id: `m${Date.now()}`, ...m }] }); setM({ label: "", value: "" }); }}><Input aria-label="Measure" placeholder="e.g. Knee flexion" value={m.label} onChange={(x) => setM({ ...m, label: x.target.value })} /><Input aria-label="Value" placeholder="e.g. 112 degrees" value={m.value} onChange={(x) => setM({ ...m, value: x.target.value })} /><Button type="submit" variant="secondary">Add</Button></form>}</Panel>
      <Panel><PanelHeader title="Exercise and home-care plan" />
        <ul className="divide-y divide-line">{(v.exercises ?? []).map((x) => <li key={x.id} className="flex justify-between px-4 py-2.5 text-[13px]"><span>{x.name}</span><span className="text-muted">{x.dose}{!locked && <button aria-label="Remove" className="ml-3 hover:text-danger" onClick={() => patch({ exercises: v.exercises!.filter((y) => y.id !== x.id) })}>×</button>}</span></li>)}{!(v.exercises ?? []).length && <li className="px-4 py-3 text-[13px] text-muted">No exercises assigned.</li>}</ul>
        {!locked && <form className="flex gap-2 border-t border-line p-3" onSubmit={(ev) => { ev.preventDefault(); if (!e.name.trim()) return; patch({ exercises: [...(v.exercises ?? []), { id: `e${Date.now()}`, ...e }] }); setE({ name: "", dose: "" }); }}><Input aria-label="Exercise" placeholder="Exercise" value={e.name} onChange={(x) => setE({ ...e, name: x.target.value })} /><Input aria-label="Dose" placeholder="3 x 10" value={e.dose} onChange={(x) => setE({ ...e, dose: x.target.value })} /><Button type="submit" variant="secondary">Add</Button></form>}</Panel>
    </div>
  );
}
