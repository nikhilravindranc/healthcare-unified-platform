"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ChevronDown, PhoneCall, X } from "lucide-react";
import { Avatar, Badge, EmptyState, Panel, PanelHeader, Select } from "@/components/ui";
import { addDays, fmtDate, TODAY } from "@/lib/db";
import { cn } from "@/lib/utils";
import { ActionMenu, StageButton, useEnquiryActions, type OpenFn } from "./enquiry-actions";
import { buildFlow, ribbonPath, type Dimension, type FlowLink, type FlowNode } from "./flow-layout";
import { isOpen } from "./status";
import { ENQUIRY_SOURCES, ENQUIRY_STATUSES, type Enquiry, type EnquiryStatus } from "./types";

/** Left to right: where the enquiry came from, then where it is now. A third column (e.g. service) is one more Dimension. */
const DIMS: Dimension[] = [
  { id: "source", label: "Source", key: (e) => e.source, order: [...ENQUIRY_SOURCES] },
  { id: "stage", label: "Stage", key: (e) => e.status, order: [...ENQUIRY_STATUSES] },
];
const COLOR: Record<EnquiryStatus, string> = { New: "#9A9CD6", Contacted: "#2867B2", "Appointment booked": "#2A8577", Closed: "#94A3B8", "Not converted": "#D9A441" };
const GROUPS = [["all", "All"], ["open", "Open"], ["booked", "Booked"], ["lost", "Closed or not converted"]] as const;
type Group = (typeof GROUPS)[number][0];
const inGroup = (e: Enquiry, g: Group) => g === "all" || (g === "open" ? isOpen(e.status) : g === "booked" ? e.status === "Appointment booked" : e.status === "Closed" || e.status === "Not converted");
type Sel = { kind: "node"; node: FlowNode } | { kind: "link"; link: FlowLink } | null;
const nextTask = (e: Enquiry) => e.tasks.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due))[0];
const SHOW = 6;
/** Wide screens get a roomy diagram. Narrow ones get a taller, tighter one that fits the screen instead of scrolling sideways. */
const WIDE = { W: 760, H: 380, NODE_W: 12, pad: 140, gap: 18, font: 12.5, chars: 22 };
const COMPACT = { W: 360, H: 480, NODE_W: 10, pad: 104, gap: 16, font: 11.5, chars: 13 };
const wrap = (t: string, max: number) => t.split(" ").reduce<string[]>((l, w) => (l.length && (l[l.length - 1] + " " + w).length <= max ? [...l.slice(0, -1), l[l.length - 1] + " " + w] : [...l, w]), []);

export function EnquiryFlow({ enquiries, onOpen, onEdit }: { enquiries: Enquiry[]; onOpen: OpenFn; onEdit: (e: Enquiry) => void }) {
  const act = useEnquiryActions(onOpen);
  const [group, setGroup] = useState<Group>("all");
  const [period, setPeriod] = useState("90");
  const [sel, setSel] = useState<Sel>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => { const el = wrapRef.current; if (!el) return; const ro = new ResizeObserver(() => setCompact(el.clientWidth < 600)); ro.observe(el); setCompact(el.clientWidth < 600); return () => ro.disconnect(); }, []);
  const G = compact ? COMPACT : WIDE; const { W, NODE_W } = G;

  const scoped = useMemo(() => enquiries.filter((e) => (period === "all" || e.received >= addDays(TODAY, -(Number(period) - 1))) && inGroup(e, group)), [enquiries, period, group]);
  const layout = useMemo(() => buildFlow(scoped, DIMS, { width: G.W, height: G.H, nodeW: G.NODE_W, gap: G.gap, pad: G.pad, minLink: 3 }), [scoped, G]);
  const byId = useMemo(() => new Map(scoped.map((e) => [e.id, e])), [scoped]);

  const ids = sel ? new Set(sel.kind === "link" ? sel.link.ids : layout.links.filter((l) => (sel.node.col === 0 ? l.from === sel.node : l.to === sel.node)).flatMap((l) => l.ids)) : null;
  const picked = sel ? [...ids!].map((i) => byId.get(i)!).filter(Boolean) : scoped;
  const sorted = [...picked].sort((a, b) => Number(isOpen(b.status)) - Number(isOpen(a.status)) || (nextTask(a)?.due ?? "9").localeCompare(nextTask(b)?.due ?? "9"));
  const shown = all ? sorted : sorted.slice(0, SHOW);
  const booked = scoped.filter((e) => e.status === "Appointment booked").length;
  const title = !sel ? "All enquiries in view" : sel.kind === "node" ? `${sel.node.key}` : `${sel.link.from.key} to ${sel.link.to.key}`;
  const nodeKey = (n: FlowNode) => `${n.col}:${n.key}`;
  const linkKey = (l: FlowLink) => `${nodeKey(l.from)}>${nodeKey(l.to)}`;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "0%");
  const dim = (l: FlowLink) => { const k = linkKey(l); if (hover) return hover === k ? 0.7 : 0.1; if (!sel) return 0.34; if (sel.kind === "link") return linkKey(sel.link) === k ? 0.75 : 0.1; return (sel.node.col === 0 ? l.from === sel.node : l.to === sel.node) ? 0.7 : 0.1; };
  const pickNode = (n: FlowNode) => { setAll(false); setSel(sel?.kind === "node" && sel.node === n ? null : { kind: "node", node: n }); };
  const pickLink = (l: FlowLink) => { setAll(false); setSel(sel?.kind === "link" && linkKey(sel.link) === linkKey(l) ? null : { kind: "link", link: l }); };
  const clear = () => { setSel(null); setAll(false); };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Show" className="inline-flex flex-wrap rounded-lg bg-cloud p-0.5">{GROUPS.map(([v, l]) => <button key={v} role="radio" aria-checked={group === v} onClick={() => { setGroup(v); clear(); }} className={cn("h-8 rounded-md px-3 text-[13px] font-medium", group === v ? "bg-white text-primary shadow-sm" : "text-muted hover:text-ink")}>{l}</button>)}</div>
        <Select sm className="w-36" aria-label="Period" value={period} onChange={(e) => { setPeriod(e.target.value); clear(); }}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option></Select>
        <span className="ml-auto text-xs text-muted">{scoped.length} enquiries · {pct(booked, scoped.length)} booked</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel className="min-w-0">
          <PanelHeader title="Where enquiries come from and where they end up" sub="Band width is the number of enquiries. Select a band or a label to see who is in it." />
          {scoped.length === 0 ? <EmptyState title="No enquiries in this view" text="Try a longer period or clear a filter." /> : (
            <div ref={wrapRef} className="scroll-thin overflow-x-auto p-3">
              <svg viewBox={`0 0 ${W} ${layout.height + 20}`} className="h-auto w-full" role="group" aria-label={`Enquiry flow. ${scoped.length} enquiries, ${booked} became appointments.`}>
                {layout.links.map((l) => (
                  <path key={linkKey(l)} d={ribbonPath(l, NODE_W)} fill={COLOR[l.to.key as EnquiryStatus]} fillOpacity={dim(l)} tabIndex={0} role="button"
                    aria-label={`${l.from.key} to ${l.to.key}: ${l.count} enquiries`} aria-pressed={sel?.kind === "link" && linkKey(sel.link) === linkKey(l)} className="cursor-pointer outline-none transition-[fill-opacity] focus-visible:stroke-primary focus-visible:stroke-2"
                    onMouseEnter={() => setHover(linkKey(l))} onMouseLeave={() => setHover(null)} onFocus={() => setHover(linkKey(l))} onBlur={() => setHover(null)} onClick={() => pickLink(l)} onKeyDown={(k) => (k.key === "Enter" || k.key === " ") && (k.preventDefault(), pickLink(l))}>
                    <title>{`${l.from.key} to ${l.to.key}: ${l.count}`}</title></path>))}
                {layout.nodes.map((n) => {
                  const left = n.col === 0; const on = sel?.kind === "node" && sel.node === n;
                  const done = left ? scoped.filter((e) => e.source === n.key && e.status === "Appointment booked").length : 0;
                  return (
                    <g key={nodeKey(n)} className="group cursor-pointer outline-none" role="button" tabIndex={0} aria-pressed={on} aria-label={`${n.key}: ${n.count} enquiries`} onClick={() => pickNode(n)} onKeyDown={(k) => (k.key === "Enter" || k.key === " ") && (k.preventDefault(), pickNode(n))}>
                      <rect x={n.x} y={n.y} width={NODE_W} height={n.h} rx="3" fill={left ? "#2867B2" : COLOR[n.key as EnquiryStatus]} stroke={on ? "#26384B" : "none"} strokeWidth="2" className="group-focus-visible:stroke-[#26384B]" />
                      {(() => { const lines = wrap(n.key, G.chars); const lh = G.font + 3; const top = n.y + n.h / 2 - ((lines.length * lh + 14) / 2) + G.font; const x = left ? n.x - 10 : n.x + NODE_W + 10; const anchor = left ? "end" : "start";
                        return <>{lines.map((ln, i) => <text key={i} x={x} y={top + i * lh} textAnchor={anchor} fontSize={G.font} fontWeight="600" fill="#26384B">{ln}</text>)}
                          <text x={x} y={top + lines.length * lh} textAnchor={anchor} fontSize={G.font - 1.5} fill="#64748B">{left ? `${n.count} · ${pct(done, n.count)} booked` : `${n.count} · ${pct(n.count, scoped.length)}`}</text></>; })()}
                    </g>);
                })}
              </svg>
            </div>)}
        </Panel>

        <Panel className="min-w-0 self-start">
          <PanelHeader title={title} sub={`${picked.length} enquir${picked.length === 1 ? "y" : "ies"}${sel ? "" : " · select a band to narrow down"}`} action={sel ? <button onClick={clear} aria-label="Clear selection" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-active"><X className="size-3.5" />Clear</button> : undefined} />
          {shown.length === 0 ? <EmptyState title="Nothing here" /> : (
            <ul className="divide-y divide-line">{shown.map((e) => {
              const t = nextTask(e); const late = !!t && isOpen(e.status) && t.due < TODAY;
              return (
                <li key={e.id} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <button onClick={() => onOpen(e)} className="min-w-0 flex-1 text-left"><p className="truncate text-[13.5px] font-semibold hover:text-primary">{e.name}</p>
                      <p className="truncate text-xs text-muted">{act.svc(e.serviceId)} · {e.source} · {fmtDate(e.received)}</p></button>
                    <Badge tone={e.status === "Appointment booked" ? "mint" : e.status === "Contacted" ? "blue" : e.status === "New" ? "lavender" : e.status === "Closed" ? "neutral" : "peach"}>{e.status}</Badge>
                    <ActionMenu e={e} a={act} onOpen={onOpen} onEdit={onEdit} />
                  </div>
                  {t && isOpen(e.status) && <p className={cn("mt-1.5 flex items-center gap-1.5 text-xs", late ? "font-medium text-[#8F2D2D]" : "text-slate-600")}>{late ? <AlertCircle className="size-3.5" aria-hidden /> : <PhoneCall className="size-3.5" aria-hidden />}<span className="truncate">{t.note} · {t.due === TODAY ? "today" : fmtDate(t.due)}{late && " (overdue)"}</span></p>}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">{act.who(e.assigneeId) ? <><Avatar name={act.who(e.assigneeId)!} size={22} /><span className="truncate">{act.who(e.assigneeId)}</span></> : "Unassigned"}</span>
                    <StageButton e={e} a={act} onOpen={onOpen} />
                  </div>
                </li>);
            })}</ul>)}
          {sorted.length > SHOW && <button onClick={() => setAll((v) => !v)} aria-expanded={all} className="flex w-full items-center justify-center gap-1 border-t border-line px-3 py-2.5 text-[13px] font-medium text-primary hover:bg-active/50">{all ? "Show fewer" : `Show all ${sorted.length}`}<ChevronDown className={cn("size-3.5 transition-transform", all && "rotate-180")} /></button>}
        </Panel>
      </div>
    </div>
  );
}
