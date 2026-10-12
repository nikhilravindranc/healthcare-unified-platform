"use client";
import { useMemo, useState } from "react";
import { Crosshair, History, Minus, MousePointer2, Plus, Trash2 } from "lucide-react";
import { Alert, Badge, Button, EmptyState, Field, Input, Panel, PanelHeader, Segmented, Select, Textarea } from "@/components/ui";
import { AREAS, PlotCanvas, PRODUCT_COLOR, usePlotSource, VIEWS, type PlotView } from "@/components/app/plot";
import { CaptureSheet } from "@/components/app/capture";
import { FacePhoto } from "@/components/app/photos";
import { useUI } from "@/components/app/ui-state";
import { inventory, PATIENT_FACE } from "@/lib/clinical";
import { fmtDate, pname } from "@/lib/db";
import type { PlotPoint, Visit } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRODUCTS = inventory.filter((i) => i.category !== "Consumables" && i.category !== "Physio equipment").map((i) => i.name);
const isUnits = (p: string) => /toxin|bio/i.test(p);
const round = (n: number) => Math.round(n * 10) / 10;

export function PlottingTab({ v, plot, setPlot, locked, visits }: { v: Visit; plot: PlotPoint[]; setPlot: (p: PlotPoint[]) => void; locked: boolean; visits: Visit[] }) {
  const ui = useUI();
  const [view, setView] = useState<PlotView>("full");
  const [tool, setTool] = useState<"add" | "move">("add");
  const [sel, setSel] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [cmpId, setCmpId] = useState<string>("");
  const [showHist, setShowHist] = useState(false);
  const [histView, setHistView] = useState<number | null>(null);
  const [cap, setCap] = useState(false);
  const source = usePlotSource(v.patientId);

  const prevs = useMemo(() => visits.filter((x) => x.patientId === v.patientId && x.id !== v.id && x.plot.length && x.date <= v.date).sort((a, b) => b.date.localeCompare(a.date)), [visits, v]);
  const prev = prevs.find((x) => x.id === (cmpId || prevs[0]?.id));
  const viewing = histView !== null ? v.plotVersions?.find((x) => x.version === histView) : undefined;
  const points = viewing ? viewing.points : plot;
  const ro = locked || !!viewing;
  const selected = points.find((p) => p.id === sel);
  const plane = VIEWS.find((x) => x.id === view)!.plane;
  const upd = (id: string, ch: Partial<PlotPoint>) => setPlot(plot.map((p) => (p.id === id ? { ...p, ...ch } : p)));
  const add = (x: number, y: number, pl: "front" | "left" | "right") => {
    const last = plot.at(-1);
    const prod = last?.product ?? PRODUCTS[0];
    const p: PlotPoint = { id: `p${Date.now()}`, x: round(x), y: round(y), product: prod, units: last?.units ?? 2, note: "", area: last?.area ?? "", lot: inventory.find((i) => i.name === prod)?.lot, view: pl };
    setPlot([...plot, p]); setSel(p.id); setTool("move");
  };
  const remove = (id: string) => { setPlot(plot.filter((p) => p.id !== id)); setSel(null); };
  const rows = useMemo(() => { const m = new Map<string, { area: string; product: string; units: number; lot?: string }>(); points.forEach((p) => { const k = `${p.area}|${p.product}`; const r = m.get(k) ?? { area: p.area || "Unassigned", product: p.product, units: 0, lot: p.lot }; r.units += p.units; m.set(k, r); }); return [...m.values()]; }, [points]);
  const totU = round(rows.filter((r) => isUnits(r.product)).reduce((s, r) => s + r.units, 0)), totM = round(rows.filter((r) => !isUnits(r.product)).reduce((s, r) => s + r.units, 0));

  return (
    <div className="grid gap-5 xl:grid-cols-[210px_minmax(0,1fr)_340px]">
      <Panel className="p-3">
        <Segmented label="Template" value="face" onChange={() => {}} options={[{ value: "face", label: "Face" }]} />
        <p className="mt-1 text-[11px] text-muted">Body and custom templates are not enabled for this service.</p>
        <ul className="mt-3 space-y-1.5" aria-label="Views">
          {VIEWS.map((x) => (
            <li key={x.id}><button onClick={() => setView(x.id)} aria-current={view === x.id} className={cn("flex w-full items-center gap-2.5 rounded-lg border p-1.5 text-left", view === x.id ? "border-primary bg-active" : "border-transparent hover:bg-cloud")}>
              <span className="size-11 shrink-0 overflow-hidden rounded-md bg-cloud">{x.plane === "front" && PATIENT_FACE[v.patientId] ? <FacePhoto faceKey={PATIENT_FACE[v.patientId]} ar={1} tf={x.id === "upper" ? 1.3 : x.id === "lower" ? 1.3 : 0.9} yBias={x.id === "lower" ? 0.2 : x.id === "upper" ? 0.75 : 0.5} mode={x.id === "lower" ? "lips" : x.id === "upper" ? "eyes" : "face"} className="size-full" /> : <span className="grid size-full place-items-center text-[10px] text-muted">{x.plane === "left" ? "L" : "R"}</span>}</span>
              <span><span className="block text-[13px] font-medium">{x.label}</span><span className="block text-[11px] text-muted">{x.sub}</span></span>
            </button></li>))}
        </ul>
      </Panel>

      <div className="min-w-0 space-y-3">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
            <div className="flex items-center gap-2">
              {!ro && (
                <div role="radiogroup" aria-label="Tool" className="inline-flex rounded-lg bg-cloud p-0.5">
                  {([["add", "Add point", Crosshair], ["move", "Move / edit", MousePointer2]] as const).map(([k, l, I]) => <button key={k} role="radio" aria-checked={tool === k} onClick={() => setTool(k)} className={cn("flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium", tool === k ? "bg-white text-primary shadow-sm" : "text-muted")}><I className="size-3.5" />{l}</button>)}
                </div>)}
              {ro && <Badge tone={viewing ? "lavender" : "mint"}>{viewing ? `Viewing version ${viewing.version}` : "Read-only"}</Badge>}
              <div className="flex items-center gap-1"><Button size="sm" variant="secondary" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(1, round(z - 0.25)))}><Minus className="size-4" /></Button><Button size="sm" variant="secondary" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(2, round(z + 0.25)))}><Plus className="size-4" /></Button></div>
            </div>
            <div className="flex items-center gap-2">
              {!locked && <Button size="sm" variant="ghost" onClick={() => setCap(true)}>{source.kind === "none" ? "Add front photo" : "Update photo"}</Button>}
              {prevs.length > 0 && <Select sm aria-label="Compare with previous plot" className="w-44" value={cmpId} onChange={(e) => setCmpId(e.target.value)}><option value="">Compare: {fmtDate(prevs[0].date)}</option>{prevs.map((x) => <option key={x.id} value={x.id}>{fmtDate(x.date, true)} · {x.type}</option>)}<option value="none">No comparison</option></Select>}
              <Button size="sm" variant="ghost" onClick={() => setShowHist((s) => !s)} aria-pressed={showHist}><History className="size-4" />Versions</Button>
            </div>
          </div>
          <div className="p-3">
            <div className="mx-auto w-full max-w-[520px]">
              <PlotCanvas patientId={v.patientId} view={view} points={points} previous={cmpId === "none" ? undefined : prev?.plot} selectedId={sel} readOnly={ro} tool={tool} zoom={zoom} onAdd={add} onSelect={(id) => { setSel(id); if (id && tool === "add") setTool("move"); }}
                onMove={(id, x, y) => upd(id, { x: round(x), y: round(y) })} />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted">
              <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-[#2867B2]" />Neuromodulator</span><span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-[#8B5CF6]" />Filler</span>
              {prev && cmpId !== "none" && <span className="flex items-center gap-1.5"><span className="size-3 rounded-full border border-dashed border-[#8F94D6]" />Previous ({fmtDate(prev.date)})</span>}
              {!ro && <span>{tool === "add" ? `Select the ${plane === "front" ? "face" : "profile"} to add a point` : "Drag to move. Arrow keys nudge the selected point."}</span>}
            </div>
          </div>
        </Panel>
        {showHist && (
          <Panel><PanelHeader title="Plot versions" sub="Every saved change keeps its author and time" />
            {(v.plotVersions ?? []).length === 0 ? <p className="p-4 text-[13px] text-muted">No saved versions yet. Save the draft to create version 1.</p> : (
              <ul className="divide-y divide-line">{[...(v.plotVersions ?? [])].reverse().map((x) => <li key={x.version} className="flex items-center justify-between px-4 py-2.5 text-[13px]"><span><span className="font-medium">Version {x.version}</span> · {x.points.length} points · {x.author} · {x.at.replace("T", " ")}</span><Button size="sm" variant={histView === x.version ? "primary" : "secondary"} onClick={() => setHistView(histView === x.version ? null : x.version)}>{histView === x.version ? "Back to current" : "View"}</Button></li>)}</ul>)}
          </Panel>)}
        {source.kind === "none" && !locked && <Alert tone="warn" title="No front photo for this patient" action={<Button size="sm" onClick={() => setCap(true)}>Add front photo</Button>}>Plot on the patient&apos;s own photo. Upload one or capture a front view. You can also set a photo when editing the patient.</Alert>}
        <Alert tone="info" title="Documentation tool">Record where treatment was given. Placement and dosage are the provider&apos;s decision. EVI only summarizes previously documented plots. <button className="font-medium text-primary underline" onClick={() => ui.evi({ prep: { patientId: v.patientId, apptId: v.apptId } })}>Summarize previous plot</button></Alert>
      </div>

      <div className="space-y-5">
        <Panel>
          <PanelHeader title={selected ? `Point ${points.indexOf(selected) + 1}` : "Point details"} action={selected && !ro && <Button size="sm" variant="ghost" onClick={() => remove(selected.id)}><Trash2 className="size-4" />Delete</Button>} />
          {selected ? (
            <div className="space-y-3 p-4">
              <Field label="Anatomical area"><Select disabled={ro} value={selected.area ?? ""} onChange={(e) => upd(selected.id, { area: e.target.value })}><option value="">Select area</option>{AREAS.map((a) => <option key={a}>{a}</option>)}</Select></Field>
              <Field label="Product"><Select disabled={ro} value={selected.product} onChange={(e) => upd(selected.id, { product: e.target.value, lot: inventory.find((i) => i.name === e.target.value)?.lot })}>{PRODUCTS.map((p) => <option key={p}>{p}</option>)}</Select></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={isUnits(selected.product) ? "Units" : "Volume (ml)"}><Input disabled={ro} type="number" min={0} step="0.1" value={selected.units} onChange={(e) => upd(selected.id, { units: Number(e.target.value) })} /></Field>
                <Field label="Lot / batch"><Input disabled={ro} value={selected.lot ?? ""} onChange={(e) => upd(selected.id, { lot: e.target.value })} /></Field>
              </div>
              <Field label="Notes"><Textarea disabled={ro} value={selected.note} onChange={(e) => upd(selected.id, { note: e.target.value })} /></Field>
            </div>) : <EmptyState title="No point selected" text={ro ? "Select a point to view it." : "Select a point, or add a new one."} />}
        </Panel>
        <Panel>
          <PanelHeader title="Products and injections" />
          {rows.length === 0 ? <p className="p-4 text-[13px] text-muted">No points documented yet.</p> : (
            <table className="w-full text-[13px]"><thead className="border-b border-line bg-cloud/50 text-left text-xs text-muted"><tr><th className="px-4 py-2 font-medium">Area / product</th><th className="px-2 py-2 font-medium">Units / vol.</th><th className="px-4 py-2 font-medium">Lot</th></tr></thead>
              <tbody className="divide-y divide-line">{rows.map((r) => <tr key={r.area + r.product}><td className="px-4 py-2"><span className="flex items-start gap-2"><span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: PRODUCT_COLOR(r.product) }} /><span><span className="block font-medium">{r.area}</span><span className="text-xs text-muted">{r.product}</span></span></span></td><td className="px-2">{round(r.units)} {isUnits(r.product) ? "units" : "ml"}</td><td className="px-4 text-muted">{r.lot || "—"}</td></tr>)}</tbody>
              <tfoot><tr className="border-t border-line font-semibold"><td className="px-4 py-2">Total</td><td className="px-2 py-2" colSpan={2}>{[totU ? `${totU} units` : "", totM ? `${totM} ml` : ""].filter(Boolean).join(" · ") || "—"}</td></tr></tfoot></table>)}
        </Panel>
        <p className="text-xs text-muted">{pname(v.patientId)} · saved plots are versioned with author and time.</p>
      </div>
    <CaptureSheet open={cap} onClose={() => setCap(false)} patientId={v.patientId} visitId={v.id} stage="Before" key={String(cap)} />
    </div>
  );
}
