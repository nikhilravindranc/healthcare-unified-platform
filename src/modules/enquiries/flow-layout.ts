import type { Enquiry } from "./types";

/**
 * Layout for the Flow (ribbon) view. It is generic over the columns, so a third column
 * (for example Source > Service > Stage) only needs another `Dimension` in the list.
 */
export interface Dimension { id: string; label: string; key: (e: Enquiry) => string; order: string[] }
export interface FlowNode { col: number; key: string; count: number; x: number; y: number; h: number }
export interface FlowLink { from: FlowNode; to: FlowNode; count: number; y0: number; y1: number; t: number; ids: string[] }
export interface FlowLayout { nodes: FlowNode[]; links: FlowLink[]; width: number; height: number; nodeW: number; total: number }

export function buildFlow(enquiries: Enquiry[], dims: Dimension[], opts: { width: number; height: number; nodeW?: number; gap?: number; pad?: number; minLink?: number }): FlowLayout {
  const nodeW = opts.nodeW ?? 14, gap = opts.gap ?? 14, pad = opts.pad ?? 140, minLink = opts.minLink ?? 3;
  const total = enquiries.length;
  const colX = dims.map((_, i) => pad + (dims.length === 1 ? 0 : (i * (opts.width - 2 * pad - nodeW)) / (dims.length - 1)));

  const nodes: FlowNode[][] = dims.map((d, ci) => {
    const counts = new Map<string, number>();
    enquiries.forEach((e) => counts.set(d.key(e), (counts.get(d.key(e)) ?? 0) + 1));
    const keys = [...counts.keys()].sort((a, b) => (ci === 0 ? counts.get(b)! - counts.get(a)! : d.order.indexOf(a) - d.order.indexOf(b)));
    return keys.map((key) => ({ col: ci, key, count: counts.get(key)!, x: colX[ci], y: 0, h: 0 }));
  });
  // One shared vertical scale so ribbons keep their thickness from column to column.
  const tallest = Math.max(1, ...nodes.map((c) => c.length));
  const usable = Math.max(40, opts.height - (tallest - 1) * gap);
  const scale = total ? usable / total : 0;
  nodes.forEach((col) => { let y = 0; col.forEach((n) => { n.h = Math.max(8, n.count * scale); n.y = y; y += n.h + gap; }); });

  const links: FlowLink[] = [];
  for (let ci = 0; ci < dims.length - 1; ci++) {
    const A = nodes[ci], B = nodes[ci + 1];
    const out = new Map<FlowNode, number>(), inn = new Map<FlowNode, number>();
    const pairs = new Map<string, string[]>();
    enquiries.forEach((e) => { const k = dims[ci].key(e) + "\u0000" + dims[ci + 1].key(e); (pairs.get(k) ?? pairs.set(k, []).get(k)!).push(e.id); });
    // Stack outgoing in target order, incoming in source order.
    for (const a of A) {
      for (const b of B) {
        const ids = pairs.get(a.key + "\u0000" + b.key); if (!ids) continue;
        const ta = (ids.length / a.count) * a.h, tb = (ids.length / b.count) * b.h, t = Math.max(Math.min(ta, tb), minLink); // thin ribbons stay visible
        const y0 = a.y + (out.get(a) ?? 0) + ta / 2 - t / 2, y1 = b.y + (inn.get(b) ?? 0) + tb / 2 - t / 2;
        out.set(a, (out.get(a) ?? 0) + ta); inn.set(b, (inn.get(b) ?? 0) + tb);
        links.push({ from: a, to: b, count: ids.length, y0, y1, t, ids });
      }
    }
  }
  return { nodes: nodes.flat(), links, width: opts.width, height: Math.max(...nodes.map((c) => (c.length ? c[c.length - 1].y + c[c.length - 1].h : 0)), 0), nodeW, total };
}

/** Closed band between two nodes, as an SVG path (top edge out, bottom edge back). */
export function ribbonPath(l: FlowLink, nodeW: number) {
  const x0 = l.from.x + nodeW, x1 = l.to.x, mx = (x0 + x1) / 2;
  const a0 = l.y0, a1 = l.y0 + l.t, b0 = l.y1, b1 = l.y1 + l.t;
  return `M${x0},${a0} C${mx},${a0} ${mx},${b0} ${x1},${b0} L${x1},${b1} C${mx},${b1} ${mx},${a1} ${x0},${a1} Z`;
}
