"use client";
import { useRef } from "react";
import { FacePhoto } from "./photos";
import { PATIENT_FACE } from "@/lib/clinical";
import { getPatient } from "@/lib/db";
import { usePhotos } from "@/lib/hooks";
import type { PlotPoint, Visit } from "@/lib/types";
import { cn } from "@/lib/utils";

export type PlotView = "full" | "upper" | "lower" | "left" | "right";
export const VIEWS: { id: PlotView; label: string; sub: string; plane: "front" | "left" | "right" }[] = [
  { id: "full", label: "Full face", sub: "Anterior view", plane: "front" },
  { id: "left", label: "Left profile", sub: "Lateral view", plane: "left" },
  { id: "right", label: "Right profile", sub: "Lateral view", plane: "right" },
  { id: "upper", label: "Upper face", sub: "Forehead, eyes", plane: "front" },
  { id: "lower", label: "Lower face", sub: "Lips, chin, jawline", plane: "front" },
];
export const AREAS = ["Forehead", "Glabella", "Crow's feet (L)", "Crow's feet (R)", "Under eyes", "Cheeks", "Nasolabial folds", "Smile lines", "Lips", "Chin", "Masseter (L)", "Masseter (R)", "Jawline", "Temple"];
/** Faint anatomical zones for the front plane (percent of the canvas). */
const ZONES = [
  { l: "Forehead", cx: 50, cy: 19, rx: 21, ry: 7 }, { l: "Glabella", cx: 50, cy: 31, rx: 7, ry: 5.5 }, { l: "Crow's feet", cx: 29, cy: 38, rx: 6, ry: 6.5 }, { l: "Crow's feet", cx: 72, cy: 38, rx: 6, ry: 6.5 },
  { l: "Lips", cx: 50, cy: 58, rx: 11, ry: 5 }, { l: "Chin", cx: 50, cy: 70, rx: 8, ry: 5 }, { l: "Masseter", cx: 33, cy: 65, rx: 6, ry: 8 }, { l: "Masseter", cx: 67, cy: 65, rx: 6, ry: 8 },
];
export const PRODUCT_COLOR = (p: string) => (/toxin/i.test(p) ? "#2867B2" : /filler|hyaluron/i.test(p) ? "#8B5CF6" : /bio/i.test(p) ? "#14A38B" : "#E0A23A");

function Profile({ side }: { side: "left" | "right" }) {
  return (
    <svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full bg-[#F8FAFB]" aria-hidden>
      <g transform={side === "left" ? "translate(100 0) scale(-1 1)" : undefined} fill="#fff" stroke="#9AA9B8" strokeWidth=".6" strokeLinejoin="round" strokeLinecap="round">
        <path d="M40 8C58 6 70 16 71 34C72 40 73 44 77 52L74 56C73 58 74 59 75 60L72 66C74 68 73 70 71 71C73 73 72 76 69 80C66 86 62 90 56 91L54 112L30 112L32 90C22 80 20 60 24 40C26 22 32 10 40 8Z" />
        <ellipse cx="42" cy="54" rx="5" ry="9" fill="none" /><path d="M58 40Q62 38 66 40" fill="none" /><path d="M68 70L71 70" fill="none" />
      </g>
    </svg>
  );
}

/** Image used as the plotting canvas: latest uploaded or captured front photo, then the patient photo, then the demo portrait. */
export function usePlotSource(patientId: string): { uri?: string; stock?: string; kind: "photo" | "portrait" | "demo" | "none" } {
  const { data: photos } = usePhotos();
  const front = (photos ?? []).filter((x) => x.patientId === patientId && x.view === "Front" && x.uri).sort((a, b) => b.date.localeCompare(a.date))[0];
  const portrait = getPatient(patientId)?.portrait;
  if (front?.uri) return { uri: front.uri, kind: "photo" };
  if (portrait) return { uri: portrait, kind: "portrait" };
  if (PATIENT_FACE[patientId]) return { stock: PATIENT_FACE[patientId], kind: "demo" };
  return { kind: "none" };
}

interface Props {
  patientId: string; view: PlotView; points: PlotPoint[]; previous?: PlotPoint[]; selectedId?: string | null; readOnly?: boolean; tool?: "add" | "move";
  zoom?: number; onAdd?: (x: number, y: number, plane: "front" | "left" | "right") => void; onSelect?: (id: string | null) => void;
  onMove?: (id: string, x: number, y: number) => void; onCommit?: () => void; labels?: boolean; className?: string;
}

/** Plotting canvas: patient photo (front views) or an anatomical template (profiles). Coordinates are percent of the canvas. */
export function PlotCanvas({ patientId, view, points, previous, selectedId, readOnly, tool = "move", zoom = 1, onAdd, onSelect, onMove, onCommit, labels = true, className }: Props) {
  const inner = useRef<HTMLDivElement>(null);
  const drag = useRef<string | null>(null);
  const v = VIEWS.find((x) => x.id === view)!;
  const z = (view === "upper" || view === "lower" ? 1.9 : 1) * zoom;
  const origin = view === "lower" ? "50% 64%" : view === "upper" ? "50% 24%" : "50% 40%";
  const here = (p: PlotPoint) => (p.view ?? "front") === v.plane;
  const local = (e: { clientX: number; clientY: number }) => {
    const r = inner.current!.getBoundingClientRect();
    return { x: Math.min(98, Math.max(2, ((e.clientX - r.left) / r.width) * 100)), y: Math.min(98, Math.max(2, ((e.clientY - r.top) / r.height) * 100)) };
  };
  const mine = points.filter(here);
  const groups = new Map<string, { x: number; y: number; n: number; units: number; product: string }>();
  mine.forEach((p) => { if (!p.area) return; const g = groups.get(p.area) ?? { x: 0, y: 0, n: 0, units: 0, product: p.product }; g.x += p.x; g.y += p.y; g.n++; g.units += p.units; groups.set(p.area, g); });
  const src = usePlotSource(patientId);
  return (
    <div className={cn("relative aspect-[5/6] w-full touch-none select-none overflow-hidden rounded-xl bg-[#F8FAFB]", tool === "add" && !readOnly && "cursor-crosshair", className)}
      role="application" aria-label={`Injection plotting canvas, ${v.label}`}
      onPointerDown={(e) => { if (readOnly) return; if (tool === "add") { const p = local(e); onAdd?.(p.x, p.y, v.plane); } else onSelect?.(null); }}
      onPointerMove={(e) => { if (drag.current) { const p = local(e); onMove?.(drag.current, p.x, p.y); } }}
      onPointerUp={() => { if (drag.current) { drag.current = null; onCommit?.(); } }} onPointerLeave={() => { if (drag.current) { drag.current = null; onCommit?.(); } }}>
      <div ref={inner} className="absolute inset-0 transition-transform duration-200" style={{ transform: `scale(${z})`, transformOrigin: origin }}>
        {v.plane === "front" ? (src.uri ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={src.uri} alt="" draggable={false} className="absolute inset-0 size-full object-cover" /> : src.stock ? <FacePhoto faceKey={src.stock} ar={5 / 6} tf={0.62} yBias={0.46} className="absolute inset-0 size-full" /> : <div className="absolute inset-0 grid place-items-center bg-cloud px-6 text-center text-xs text-muted">No front photo yet. Add one to plot on the patient.</div>) : <Profile side={v.plane} />}
        {v.plane === "front" && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
            {ZONES.map((zn, i) => <ellipse key={i} cx={zn.cx} cy={zn.cy} rx={zn.rx} ry={zn.ry} fill="#fff" fillOpacity=".08" stroke="#fff" strokeOpacity=".8" strokeWidth=".35" strokeDasharray="1.2 1" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 1 }} />)}
            <line x1="50" x2="50" y1="4" y2="96" stroke="#fff" strokeOpacity=".4" strokeDasharray="1 1.4" vectorEffect="non-scaling-stroke" />
          </svg>)}
        {(previous ?? []).filter(here).map((p) => <span key={p.id} aria-hidden title={`Previous: ${p.product}, ${p.units}`} className="pointer-events-none absolute grid size-3.5 place-items-center rounded-full border-2 border-dashed border-[#8F94D6] bg-white/40" style={{ left: `${p.x}%`, top: `${p.y}%`, transform: `translate(-50%,-50%) scale(${1 / z})` }}><span className="size-1 rounded-full bg-[#8F94D6]" /></span>)}
        {mine.map((p) => {
          const idx = points.indexOf(p) + 1; const sel = p.id === selectedId;
          return (
            <button key={p.id} type="button" aria-label={`Point ${idx}: ${p.area || "no area"}, ${p.product}, ${p.units}${sel ? ", selected" : ""}`}
              className={cn("absolute grid size-[18px] place-items-center rounded-full border-2 border-white text-[10px] font-semibold text-white shadow focus-visible:ring-2 focus-visible:ring-primary", !readOnly && "cursor-grab active:cursor-grabbing", sel && "ring-2 ring-cyan ring-offset-1")}
              style={{ left: `${p.x}%`, top: `${p.y}%`, background: PRODUCT_COLOR(p.product), transform: `translate(-50%,-50%) scale(${1 / z})` }}
              onPointerDown={(e) => { e.stopPropagation(); onSelect?.(p.id); if (!readOnly) drag.current = p.id; }} onFocus={() => onSelect?.(p.id)}
              onKeyDown={(e) => { if (readOnly) return; const d = e.shiftKey ? 3 : 1; const m: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }; if (m[e.key]) { e.preventDefault(); onMove?.(p.id, p.x + m[e.key][0], p.y + m[e.key][1]); onCommit?.(); } }}>
              {idx}
            </button>);
        })}
        {labels && [...groups.entries()].map(([area, g]) => {
          const cx = g.x / g.n, cy = g.y / g.n, right = cx >= 50;
          return <span key={area} className="pointer-events-none absolute whitespace-nowrap rounded-md bg-white/90 px-1.5 py-0.5 text-[10.5px] font-medium leading-tight text-ink shadow-sm" style={{ left: `${right ? Math.min(cx + 14, 80) : Math.max(cx - 14, 20)}%`, top: `${cy}%`, transform: `translate(${right ? "0" : "-100%"}, -50%) scale(${1 / z})`, transformOrigin: right ? "left center" : "right center" }}>{area}<br /><span className="font-normal text-muted">{Math.round(g.units * 10) / 10} {/toxin|bio/i.test(g.product) ? "units" : "ml"}</span></span>;
        })}
      </div>
    </div>
  );
}

export function PlotSummary({ visit }: { visit: Visit }) {
  const units = visit.plot.reduce((s, p) => s + p.units, 0);
  return (
    <div className="flex items-center gap-4 p-4">
      <div className="w-24 shrink-0"><PlotCanvas patientId={visit.patientId} view="full" points={visit.plot} readOnly labels={false} /></div>
      <div className="text-[13px]">{visit.plot.length ? <><p className="font-medium">{visit.plot.length} injection points</p><p className="text-muted">{Math.round(units * 10) / 10} units or ml documented</p></> : <p className="text-muted">No injection points documented for this visit.</p>}</div>
    </div>
  );
}
