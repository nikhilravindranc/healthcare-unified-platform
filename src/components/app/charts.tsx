import { fmtDate } from "@/lib/db";

/** Small dependency-free charts, styled like the Reports page. */
export function LineChart({ labels, series, label }: { labels: string[]; series: { name: string; color: string; v: number[] }[]; label: string }) {
  const W = 560, H = 210, L = 30, B = 24, T = 8, R = 8;
  const max = Math.max(4, ...series.flatMap((s) => s.v));
  const top = Math.ceil(max / 4) * 4;
  const x = (i: number) => L + (i / Math.max(1, labels.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}. ${series.map((s) => `${s.name}: total ${s.v.reduce((a, b) => a + b, 0)}`).join(", ")}`} className="w-full">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(top * t)} y2={y(top * t)} stroke="#E2E7EB" strokeWidth="1" strokeDasharray={t === 0 ? undefined : "3 4"} /><text x={L - 6} y={y(top * t) + 3} fontSize="10" fill="#64748B" textAnchor="end">{Math.round(top * t)}</text></g>)}
        {[0, Math.floor((labels.length - 1) / 2), labels.length - 1].map((i) => <text key={i} x={x(i)} y={H - 6} fontSize="10" fill="#64748B" textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"}>{fmtDate(labels[i])}</text>)}
        {series.map((s, k) => { const pts = s.v.map((v, i) => `${x(i)},${y(v)}`); return (
          <g key={s.name}>
            <defs><linearGradient id={`area-${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity="0.16" /><stop offset="100%" stopColor={s.color} stopOpacity="0" /></linearGradient></defs>
            {k === 0 && s.v.length > 1 && <polygon fill={`url(#area-${k})`} points={`${x(0)},${y(0)} ${pts.join(" ")} ${x(s.v.length - 1)},${y(0)}`} />}
            <polyline fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pts.join(" ")} />
          </g>); })}
      </svg>
      <figcaption className="mt-1 flex gap-4 text-xs text-muted">{series.map((s) => <span key={s.name} className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: s.color }} />{s.name}</span>)}</figcaption>
    </figure>
  );
}

/** Horizontal bars with the value printed beside each bar (no color-only meaning). */
export function BarList({ rows, color = "#2867B2" }: { rows: { label: string; value: number; sub?: string }[]; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">{rows.map((r) => (
      <li key={r.label}>
        <div className="mb-1 flex justify-between gap-3 text-[13px]"><span className="font-medium">{r.label}</span><span>{r.value}{r.sub && <span className="ml-2 text-xs text-muted">{r.sub}</span>}</span></div>
        <div className="h-2.5 rounded-full bg-cloud"><div className="h-2.5 rounded-full transition-all" style={{ width: `${(r.value / max) * 100}%`, background: color }} /></div>
      </li>))}
    </ul>
  );
}
