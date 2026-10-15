"use client";
import * as React from "react";
import { useEffect, useState } from "react";
import { Quote, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { quoteForDay } from "@/lib/quotes";

/** Every screen family gets its own colour arrangement and its own drawing, so the banners never read as copies of each other. All colours come from the active theme. */
export type BannerVariant = "today" | "appointments" | "visits" | "followups" | "patients" | "enquiries" | "contacts" | "booking" | "patient" | "visit" | "enquiry" | "contact";

const BG: Record<BannerVariant, string> = {
  today: "linear-gradient(115deg, var(--t1) 0%, var(--t2) 38%, var(--t3) 72%, var(--t4) 100%)",
  appointments: "linear-gradient(100deg, var(--t2) 0%, var(--t3) 52%, var(--t1) 100%)",
  visits: "linear-gradient(160deg, var(--t3) 0%, var(--t2) 55%, var(--t1) 100%)",
  followups: "linear-gradient(120deg, var(--t4) 0%, var(--t1) 50%, var(--t2) 100%)",
  patients: "linear-gradient(105deg, var(--t1) 0%, var(--t3) 60%, var(--t2) 100%)",
  enquiries: "linear-gradient(130deg, var(--t3) 0%, var(--t4) 48%, var(--t1) 100%)",
  contacts: "linear-gradient(110deg, var(--t2) 0%, var(--t1) 55%, var(--t4) 100%)",
  booking: "linear-gradient(135deg, var(--t1) 0%, var(--t2) 45%, var(--t3) 100%)",
  patient: "linear-gradient(110deg, var(--t1) 0%, var(--t2) 60%, var(--t3) 100%)",
  visit: "linear-gradient(120deg, var(--t3) 0%, var(--t2) 55%, var(--t1) 100%)",
  enquiry: "linear-gradient(115deg, var(--t4) 0%, var(--t3) 55%, var(--t2) 100%)",
  contact: "linear-gradient(115deg, var(--t2) 0%, var(--t1) 55%, var(--t4) 100%)",
};

const P = "var(--primary)";
const C = "var(--cyan)";
const M = "var(--mint)";
const L = "var(--lavender)";
const K = "var(--peach)";

/** The drawing on the right of a banner. Decorative only, so it is hidden from assistive technology and never takes clicks. */
function Motif({ variant, className }: { variant: BannerVariant; className?: string }) {
  const base = className ?? "pointer-events-none absolute bottom-0 right-0 hidden h-[52%] w-[22%] min-w-[150px] opacity-30 sm:block";
  const box = { viewBox: "0 0 400 160", preserveAspectRatio: "xMidYMid meet", "aria-hidden": true, className: base } as const;
  switch (variant) {
    case "today":
      return <svg {...box}><circle cx="318" cy="38" r="54" fill={K} opacity=".55" /><circle cx="318" cy="38" r="34" fill="#fff" opacity=".7" />{[78, 102, 128].map((r, i) => <circle key={r} cx="318" cy="38" r={r} fill="none" stroke={P} strokeOpacity={0.14 - i * 0.03} strokeWidth="1.5" />)}<path d="M40 150 C 120 90, 200 150, 290 110 S 400 90, 400 110 V160 H40Z" fill="#fff" opacity=".45" /><g stroke={P} strokeOpacity=".28" strokeWidth="2.5" strokeLinecap="round"><path d="M70 30v14M63 37h14" /><path d="M200 18v10M195 23h10" /><path d="M370 120v12M364 126h12" /></g></svg>;
    case "appointments":
      return <svg {...box}>{Array.from({ length: 5 }).flatMap((_, r) => Array.from({ length: 7 }).map((__, c) => { const on = (r * 7 + c) % 6 === 2; return <rect key={`${r}-${c}`} x={150 + c * 34} y={14 + r * 28} width="24" height="20" rx="6" fill={on ? P : "#fff"} opacity={on ? 0.35 : 0.55} />; }))}<circle cx="96" cy="84" r="46" fill="#fff" opacity=".75" /><circle cx="96" cy="84" r="46" fill="none" stroke={P} strokeOpacity=".35" strokeWidth="3" /><path d="M96 56v30l20 12" fill="none" stroke={P} strokeOpacity=".55" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "visits":
      return <svg {...box}><path d="M0 100 H110 L130 70 L152 128 L176 40 L200 112 L218 100 H400" fill="none" stroke={P} strokeOpacity=".4" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M0 100 H110 L130 70 L152 128 L176 40 L200 112 L218 100 H400" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" style={{ mixBlendMode: "overlay" }} /><circle cx="330" cy="50" r="30" fill={C} opacity=".28" /><circle cx="360" cy="34" r="14" fill={M} opacity=".6" /><rect x="260" y="118" width="90" height="12" rx="6" fill="#fff" opacity=".6" /><rect x="260" y="136" width="56" height="8" rx="4" fill="#fff" opacity=".45" /></svg>;
    case "followups":
      return <svg {...box}>{[0, 1, 2].map((i) => <g key={i} transform={`translate(${250 + i * 54} ${80 - (i % 2) * 22})`}><circle r={28 - i * 4} fill="#fff" opacity=".6" /><path d={`M-${11 - i} -6 A ${12 - i} ${12 - i} 0 0 1 ${10 - i} -8 M${10 - i} -8 l1 -6 m-1 6 l-6 -1 M${11 - i} 6 A ${12 - i} ${12 - i} 0 0 1 -${10 - i} 8 M-${10 - i} 8 l-1 6 m1 -6 l6 1`} fill="none" stroke={P} strokeOpacity=".5" strokeWidth="2.5" strokeLinecap="round" /></g>)}<path d="M200 138 C 260 118, 300 150, 360 126" fill="none" stroke={K} strokeWidth="5" strokeLinecap="round" strokeDasharray="2 10" opacity=".9" /></svg>;
    case "patients":
      return <svg {...box}>{[[300, 66, 36, 0.55], [230, 84, 28, 0.45], [364, 92, 24, 0.4], [170, 98, 20, 0.35]].map(([x, y, r, o], i) => <g key={i} opacity={o as number}><circle cx={x} cy={(y as number) - (r as number) * 0.55} r={(r as number) * 0.55} fill={i % 2 ? C : P} /><path d={`M${(x as number) - (r as number)} ${(y as number) + (r as number) * 0.9} a${r} ${(r as number) * 0.85} 0 0 1 ${(r as number) * 2} 0 v${(r as number) * 0.5} h-${(r as number) * 2}z`} fill={i % 2 ? C : P} /></g>)}<circle cx="300" cy="66" r="62" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="2" /></svg>;
    case "enquiries":
      return <svg {...box}><g><rect x="190" y="26" width="130" height="52" rx="18" fill="#fff" opacity=".75" /><path d="M214 78 l-6 18 l22 -18z" fill="#fff" opacity=".75" /><rect x="210" y="42" width="70" height="7" rx="3.5" fill={P} opacity=".3" /><rect x="210" y="56" width="44" height="7" rx="3.5" fill={P} opacity=".2" /></g><g><rect x="270" y="88" width="120" height="48" rx="18" fill={P} opacity=".3" /><path d="M370 136 l8 16 l-24 -16z" fill={P} opacity=".3" /><rect x="290" y="104" width="64" height="7" rx="3.5" fill="#fff" opacity=".8" /></g><circle cx="150" cy="120" r="10" fill={K} opacity=".8" /><circle cx="128" cy="44" r="6" fill={M} opacity=".8" /></svg>;
    case "contacts":
      return <svg {...box}><g stroke={P} strokeOpacity=".25" strokeWidth="2">{[[250, 40, 320, 90], [320, 90, 380, 40], [320, 90, 290, 138], [250, 40, 190, 92], [190, 92, 290, 138]].map(([a, b, c, d], i) => <line key={i} x1={a} y1={b} x2={c} y2={d} />)}</g>{[[250, 40, 16, P], [320, 90, 22, C], [380, 40, 12, M], [290, 138, 14, K], [190, 92, 12, L]].map(([x, y, r, f], i) => <g key={i}><circle cx={x as number} cy={y as number} r={(r as number) + 6} fill="#fff" opacity=".6" /><circle cx={x as number} cy={y as number} r={r as number} fill={f as string} opacity=".7" /></g>)}</svg>;
    case "booking":
      return <svg {...box}><rect x="210" y="22" width="150" height="116" rx="18" fill="#fff" opacity=".75" /><rect x="210" y="22" width="150" height="30" rx="18" fill={P} opacity=".3" />{[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={226 + (i % 3) * 44} y={66 + Math.floor(i / 3) * 32} width="32" height="20" rx="6" fill={i === 4 ? P : M} opacity={i === 4 ? 0.55 : 0.4} />)}<circle cx="178" cy="46" r="14" fill={K} opacity=".7" /><path d="M170 46l5 5 9-10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "patient":
      return <svg {...box}><circle cx="330" cy="60" r="70" fill="#fff" opacity=".45" /><path d="M250 150 C 280 100, 340 100, 390 150Z" fill={P} opacity=".16" /><circle cx="330" cy="62" r="24" fill={P} opacity=".18" /><path d="M20 112 H130 L146 90 L164 134 L184 70 L202 112 H300" fill="none" stroke={P} strokeOpacity=".22" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "visit":
      return <svg {...box}><rect x="250" y="20" width="100" height="120" rx="14" fill="#fff" opacity=".6" /><g fill={P} opacity=".25">{[0, 1, 2, 3].map((i) => <rect key={i} x="266" y={42 + i * 24} width={i === 3 ? 40 : 68} height="8" rx="4" />)}</g><circle cx="350" cy="36" r="16" fill={M} opacity=".7" /><path d="M343 36l5 5 9-10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><path d="M0 130 H100 L116 112 L132 146 L150 98 L166 130 H230" fill="none" stroke={P} strokeOpacity=".25" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "enquiry":
      return <svg {...box}><rect x="230" y="30" width="120" height="70" rx="20" fill="#fff" opacity=".7" /><path d="M262 100 l-8 22 l28 -22z" fill="#fff" opacity=".7" /><circle cx="262" cy="65" r="6" fill={P} opacity=".4" /><circle cx="290" cy="65" r="6" fill={P} opacity=".4" /><circle cx="318" cy="65" r="6" fill={P} opacity=".4" /><circle cx="370" cy="120" r="12" fill={K} opacity=".8" /></svg>;
    case "contact":
      return <svg {...box}><circle cx="320" cy="76" r="26" fill={P} opacity=".2" /><circle cx="250" cy="42" r="14" fill={C} opacity=".35" /><circle cx="384" cy="120" r="16" fill={M} opacity=".5" /><circle cx="236" cy="124" r="10" fill={K} opacity=".7" /><g stroke={P} strokeOpacity=".2" strokeWidth="2"><line x1="250" y1="42" x2="320" y2="76" /><line x1="320" y1="76" x2="384" y2="120" /><line x1="320" y1="76" x2="236" y2="124" /></g></svg>;
  }
}

const SURFACE = "relative overflow-hidden rounded-3xl border border-white/70 shadow-card ring-1 ring-black/[0.03]";

/** The coloured, illustrated surface used behind a screen's heading. Content goes inside it. */
export function BannerSurface({ variant, as: Tag = "section", className, motif = true, children, ...rest }: { variant: BannerVariant; as?: "section" | "header" | "div"; className?: string; /** Draw the picture behind the content. Turn off where the content already makes room for it. */ motif?: boolean; children: React.ReactNode } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag {...(rest as object)} className={cn(SURFACE, className)} style={{ background: BG[variant] }}>
      <span aria-hidden className="pointer-events-none absolute -left-16 -top-24 size-56 rounded-full bg-white/45 blur-3xl" />
      {motif && <Motif variant={variant} />}
      <div className="relative">{children}</div>
    </Tag>
  );
}

const CHIP = {
  blue: "bg-white/85 text-primary", mint: "bg-white/85 text-[#1E6B61]", peach: "bg-white/85 text-[#7A4B00]", lavender: "bg-white/85 text-[#40428A]",
  cyan: "bg-white/85 text-[#0E6577]", red: "bg-white/85 text-[#8F2D2D]", slate: "bg-white/85 text-slate-600",
} as const;
export type BannerTone = keyof typeof CHIP;

/** A small figure that sits inside a banner. With `onClick` it works as a filter button. */
export function BannerStat({ label, value, icon: Icon, tone = "blue", active, onClick, title }: { label: string; value: React.ReactNode; icon: LucideIcon; tone?: BannerTone; active?: boolean; onClick?: () => void; title?: string }) {
  const body = (
    <>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg shadow-sm", CHIP[tone])}><Icon className="size-4" aria-hidden /></span>
      <span><span className="block text-lg font-semibold leading-none tabular-nums text-ink">{value}</span><span className="mt-0.5 block text-[11.5px] font-medium text-slate-600">{label}</span></span>
    </>
  );
  const cls = cn("flex items-center gap-2.5 rounded-xl border bg-white/70 px-3 py-2 text-left shadow-card backdrop-blur-sm", active ? "border-primary ring-1 ring-primary/30 bg-white/95" : "border-white/80");
  return onClick
    ? <button type="button" aria-pressed={active} title={title} onClick={onClick} className={cn(cls, "transition-all hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40")}>{body}</button>
    : <div title={title} className={cls}>{body}</div>;
}

/** The banner at the top of a list screen: the title on the left, small figures in the centre and the main actions on the right. Kept short so the list is not pushed down. */
export function Banner({ variant, title, subtitle, actions, stats, statsLabel = "Key figures", aside, className }: { variant: BannerVariant; title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; stats?: React.ReactNode; statsLabel?: string; aside?: React.ReactNode; className?: string }) {
  return (
    <BannerSurface variant={variant} motif={false} className={cn("mb-5 px-5 py-4 sm:px-6", className)}>
      <div className={cn("grid items-center gap-x-6 gap-y-3", stats ? "lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)_auto]")}>
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight sm:text-[26px]">{title}</h1>
          {subtitle && <p className="mt-0.5 max-w-xl text-[13.5px] text-slate-700">{subtitle}</p>}
        </div>
        {stats && <div role="group" aria-label={statsLabel} className="flex flex-wrap gap-2 lg:justify-center">{stats}</div>}
        <div className="flex items-center gap-3 lg:justify-end">
          <Motif variant={variant} className="pointer-events-none hidden h-14 w-24 shrink-0 opacity-70 2xl:block" />
          {(actions || aside) && <div className="relative z-10 flex flex-wrap items-center gap-2 lg:flex-nowrap lg:justify-end">{actions}{aside}</div>}
        </div>
      </div>
    </BannerSurface>
  );
}

/** One line for the day, chosen by the calendar date. It is picked after the page loads so it always matches the person's own date. */
export function DailyQuote({ className }: { className?: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => setText(quoteForDay()), []);
  return (
    <figure aria-label="Thought for the day" className={cn("relative rounded-2xl border border-white/80 bg-white/70 p-4 shadow-card backdrop-blur-sm", className)}>
      <span aria-hidden className="absolute -top-3 left-4 grid size-7 place-items-center rounded-full bg-primary text-white shadow-md"><Quote className="size-3.5" /></span>
      <figcaption className="text-[11px] font-semibold uppercase tracking-wider text-primary">Thought for the day</figcaption>
      <blockquote className="mt-1.5 min-h-[3.5rem] text-[15px] font-medium leading-snug text-ink">{text ? `“${text}”` : " "}</blockquote>
    </figure>
  );
}
