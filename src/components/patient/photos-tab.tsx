"use client";
import { useMemo, useState } from "react";
import { Camera, GitCompare } from "lucide-react";
import { Badge, Button, EmptyState, Modal, Panel, Select } from "@/components/ui";
import { PhotoThumb } from "@/components/app/photos";
import { CaptureSheet, CompareDialog } from "@/components/app/capture";
import { useClinic, usePhotos, useVisits } from "@/lib/hooks";
import { fmtDate } from "@/lib/db";
import type { Patient, PhotoAsset } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PhotosTab({ p }: { p: Patient }) {
  const { data: photos, isLoading } = usePhotos();
  const { data: visits } = useVisits();
  const { config } = useClinic();
  const [f, setF] = useState({ stage: "", view: "", visit: "" });
  const [sel, setSel] = useState<string[]>([]);
  const [capture, setCapture] = useState(false);
  const [cmp, setCmp] = useState(false);
  const [detail, setDetail] = useState<PhotoAsset | null>(null);

  const mine = useMemo(() => (photos ?? []).filter((x) => x.patientId === p.id), [photos, p.id]);
  const rows = mine.filter((x) => (!f.stage || x.stage === f.stage) && (!f.view || x.view === f.view) && (!f.visit || x.visitId === f.visit)).sort((a, b) => b.date.localeCompare(a.date));
  const count = (s: string) => mine.filter((x) => x.stage === s).length;
  const picked = sel.map((id) => mine.find((x) => x.id === id)).filter(Boolean) as PhotoAsset[];
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 2 ? [s[1], id] : [...s, id]));
  const visitIds = [...new Set(mine.map((x) => x.visitId).filter(Boolean))] as string[];

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold">Photos</h2>
            {(["", "Before", "During", "After"] as const).map((s) => (
              <button key={s || "all"} aria-pressed={f.stage === s} onClick={() => setF({ ...f, stage: s })} className={cn("rounded-full px-3 py-1 text-[13px] font-medium", f.stage === s ? "bg-active text-primary" : "text-muted hover:bg-cloud")}>
                {s || "All"} ({s ? count(s) : mine.length})
              </button>))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select sm aria-label="View or area" className="w-40" value={f.view} onChange={(e) => setF({ ...f, view: e.target.value })}><option value="">All views</option>{["Front", "Left profile", "Right profile", "Close-up (eyes)", "Close-up (lips)"].map((v) => <option key={v}>{v}</option>)}</Select>
            <Select sm aria-label="Visit" className="w-36" value={f.visit} onChange={(e) => setF({ ...f, visit: e.target.value })}><option value="">All visits</option>{visitIds.map((v) => <option key={v} value={v}>{fmtDate(visits?.find((x) => x.id === v)?.date ?? "2026-10-07")}</option>)}</Select>
            <Button size="sm" variant="secondary" disabled={picked.length !== 2} onClick={() => setCmp(true)} title={picked.length === 2 ? "" : "Select two photos to compare"}><GitCompare className="size-4" />Compare{picked.length ? ` (${picked.length})` : ""}</Button>
            <Button size="sm" onClick={() => setCapture(true)}><Camera className="size-4" />Capture or upload</Button>
          </div>
        </div>
        {isLoading ? <div className="p-4 text-sm text-muted">Loading photos…</div> : rows.length === 0 ? (
          <EmptyState title={mine.length ? "No photos match these filters" : "No photos yet"} text={mine.length ? "Clear a filter to see more." : "Use guided capture to add the first set."} action={<Button onClick={() => setCapture(true)}>Capture or upload</Button>} />
        ) : (
          <ul className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-5">
            {rows.map((ph) => (
              <li key={ph.id}>
                <div className={cn("relative overflow-hidden rounded-xl border", sel.includes(ph.id) ? "border-primary ring-2 ring-primary/30" : "border-line")}>
                  <button onClick={() => setDetail(ph)} className="block w-full" aria-label={`${ph.stage} ${ph.view}, ${fmtDate(ph.date)}. Open details`}><PhotoThumb photo={ph} ar={4 / 5} /></button>
                  <label className="absolute left-2 top-2 flex cursor-pointer items-center rounded bg-white/90 p-1 shadow-sm"><input type="checkbox" checked={sel.includes(ph.id)} onChange={() => toggle(ph.id)} aria-label={`Select ${ph.view} ${ph.stage} for comparison`} /></label>
                  <span className={cn("absolute right-2 top-2 rounded px-1.5 py-0.5 text-[11px] font-medium", ph.stage === "Before" ? "bg-white/90 text-slate-700" : ph.stage === "After" ? "bg-primary text-white" : "bg-[#FFF3DF] text-[#7A4B00]")}>{ph.stage}</span>
                </div>
                <p className="mt-1.5 text-[13px] font-medium">{ph.view}</p><p className="text-xs text-muted">{fmtDate(ph.date)}{ph.source === "demo" ? " · Demo" : ""}</p>
              </li>))}
          </ul>)}
      </Panel>
      <p className="text-xs text-muted">Photos are stored as captured; originals are never overwritten or retouched. Demo portraits are illustrative stock images, not real patients.</p>
      <CaptureSheet open={capture} onClose={() => setCapture(false)} patientId={p.id} visitId={undefined} stage="Before" key={config.photoChecklist.join()} />
      <CompareDialog open={cmp} onClose={() => setCmp(false)} a={picked[0]} b={picked[1]} />
      <Modal open={!!detail} onOpenChange={(o) => !o && setDetail(null)} title="Photo details" width={520} footer={<Button variant="secondary" onClick={() => setDetail(null)}>Close</Button>}>
        {detail && (
          <div className="grid grid-cols-[160px_1fr] gap-4">
            <PhotoThumb photo={detail} ar={4 / 5} className="rounded-lg" />
            <dl className="grid grid-cols-[88px_1fr] gap-y-1.5 text-[13px]">
              <dt className="text-muted">Patient ID</dt><dd>{detail.patientId}</dd><dt className="text-muted">Stage</dt><dd>{detail.stage}</dd><dt className="text-muted">View</dt><dd>{detail.view}</dd><dt className="text-muted">Area</dt><dd>{detail.area}</dd>
              <dt className="text-muted">Captured</dt><dd>{fmtDate(detail.date, true)}</dd><dt className="text-muted">Author</dt><dd>{detail.author}</dd><dt className="text-muted">Visit</dt><dd>{detail.visitId ?? "Not linked"}</dd>
              <dt className="text-muted">Source</dt><dd>{detail.source === "demo" ? "Demo image" : detail.source === "captured" ? "Captured in app" : "Uploaded"}</dd>
              <dt className="text-muted">Consent</dt><dd><Badge tone={detail.consent === "Granted" ? "mint" : "peach"}>{detail.consent}</Badge></dd><dt className="text-muted">Notes</dt><dd>{detail.notes || "—"}</dd>
            </dl>
          </div>)}
      </Modal>
    </div>
  );
}
