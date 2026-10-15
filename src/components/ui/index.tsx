"use client";
import * as React from "react";
import Link from "next/link";
import { Dialog as RDialog, DropdownMenu as RMenu, Tabs as RTabs } from "radix-ui";
import { Check, Loader2, Sparkles, X, AlertCircle, CheckCircle2, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApptStatus } from "@/lib/types";

/* ---------------- Logo (official asset, cropped by CSS only) ---------------- */
export function Logo({ variant = "full", height = 28, className }: { variant?: "full" | "icon"; height?: number; className?: string }) {
  const r = variant === "full" ? { x: 120, y: 200, w: 1330, h: 300 } : { x: 126, y: 203, w: 296, h: 292 };
  const s = height / r.h;
  return (
    <span className={cn("block shrink-0 overflow-hidden", className)} style={{ width: r.w * s, height }} role="img" aria-label="Healthcare Platform">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.webp" alt="" draggable={false} style={{ width: 2000 * s, maxWidth: "none", marginLeft: -r.x * s, marginTop: -r.y * s }} />
    </span>
  );
}

/* ---------------- Button ---------------- */
const btn = {
  primary: "bg-primary text-white shadow-[var(--shadow-btn)] hover:bg-primary-hover",
  secondary: "bg-white text-primary border border-[#C9DAEE] shadow-[0_1px_2px_rgba(38,56,75,0.04)] hover:bg-active",
  ghost: "text-ink hover:bg-cloud",
  danger: "bg-danger text-white hover:bg-[#9a3433]",
  soft: "bg-active text-primary hover:bg-[#dcebf8]",
};
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof btn; size?: "sm" | "md"; loading?: boolean };
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...p }, ref) {
  return (
    <button ref={ref} disabled={disabled || loading} {...p}
      className={cn("inline-flex items-center justify-center gap-1.5 rounded-xl font-medium whitespace-nowrap transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm", btn[variant], className)}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

/* ---------------- Form controls ---------------- */
const control = "w-full rounded-xl border bg-white px-3.5 text-sm text-ink placeholder:text-slate-400 transition-all hover:border-slate-300 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:bg-cloud";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...p }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn(control, "h-10", invalid ? "border-danger" : "border-line", className)} {...p} />;
});
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ className, invalid, ...p }, ref) {
  return <textarea ref={ref} aria-invalid={invalid || undefined} className={cn(control, "py-2 min-h-20", invalid ? "border-danger" : "border-line", className)} {...p} />;
});
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; sm?: boolean }>(function Select({ className, invalid, sm, children, ...p }, ref) {
  return (
    <select ref={ref} aria-invalid={invalid || undefined} className={cn(control, sm ? "h-8 text-[13px] pr-7" : "h-10", invalid ? "border-danger" : "border-line", className)} {...p}>
      {children}
    </select>
  );
});
export function Field({ label, error, hint, children, className, required }: { label: string; error?: string; hint?: string; children: React.ReactElement<{ id?: string; invalid?: boolean }>; className?: string; required?: boolean }) {
  const id = React.useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-[13px] font-medium text-ink">{label}{required && <span className="text-danger"> *</span>}</label>
      {React.cloneElement(children, { id, invalid: !!error })}
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
export function Checkbox({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; id?: string }) {
  return (
    <label className="flex items-start gap-2.5 text-sm cursor-pointer select-none">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded border border-slate-300 bg-white peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 text-white">
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span>{label}</span>
    </label>
  );
}

/* ---------------- Badges & status ---------------- */
export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "blue" | "cyan" | "mint" | "peach" | "lavender" | "red"; className?: string }) {
  const t = { neutral: "bg-cloud text-slate-600", blue: "bg-[#E6F0FA] text-[#1E4F8C]", cyan: "bg-[#DDF4F8] text-[#0E6577]", mint: "bg-[#DDF3EF] text-[#1E6B61]", peach: "bg-[#FFF1D6] text-[#7A4B00]", lavender: "bg-[#ECECF9] text-[#40428A]", red: "bg-[#FBE9E9] text-[#8F2D2D]" }[tone];
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", t, className)}>{children}</span>;
}
export const STATUS: Record<ApptStatus, { label: string; tone: Parameters<typeof Badge>[0]["tone"]; dot: string; shape: "ring" | "dot" | "half" | "check" | "x" | "dash" }> = {
  scheduled: { label: "Scheduled", tone: "neutral", dot: "#94A3B8", shape: "ring" },
  confirmed: { label: "Confirmed", tone: "blue", dot: "#2867B2", shape: "ring" },
  arrived: { label: "Arrived", tone: "cyan", dot: "#26B9CF", shape: "dot" },
  waiting: { label: "Waiting", tone: "peach", dot: "#E0A23A", shape: "half" },
  in_progress: { label: "In visit", tone: "blue", dot: "#2867B2", shape: "dot" },
  completed: { label: "Completed", tone: "mint", dot: "#3FA797", shape: "check" },
  cancelled: { label: "Cancelled", tone: "red", dot: "#B4403F", shape: "x" },
  no_show: { label: "No-show", tone: "red", dot: "#B4403F", shape: "dash" },
};
export function StatusDot({ status, className }: { status: ApptStatus; className?: string }) {
  const s = STATUS[status];
  const base = "inline-block size-2.5 rounded-full shrink-0";
  const style: React.CSSProperties =
    s.shape === "ring" ? { border: `2px solid ${s.dot}` }
    : s.shape === "half" ? { background: `linear-gradient(90deg, ${s.dot} 50%, transparent 50%)`, border: `1.5px solid ${s.dot}` }
    : s.shape === "check" ? { background: s.dot, boxShadow: `inset 0 0 0 2px #fff, 0 0 0 1.5px ${s.dot}` }
    : s.shape === "dash" ? { background: `repeating-linear-gradient(45deg, ${s.dot} 0 2px, #fff 2px 4px)`, border: `1.5px solid ${s.dot}` }
    : { background: s.dot };
  return <span aria-hidden className={cn(base, className)} style={style} />;
}
export function StatusBadge({ status }: { status: ApptStatus }) {
  const s = STATUS[status];
  return <Badge tone={s.tone}><StatusDot status={status} />{s.label}</Badge>;
}

/* ---------------- Skeleton / empty / alert ---------------- */
export const Skeleton = ({ className }: { className?: string }) => <div className={cn("skeleton h-4", className)} aria-hidden />;
export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4"><Skeleton className="w-14" /><Skeleton className="w-40" /><Skeleton className="flex-1" /><Skeleton className="w-20" /></div>
      ))}
    </div>
  );
}
export function EmptyState({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <span aria-hidden className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,#ECECF9,#DDF4F8)] text-primary"><Sparkles className="size-5" /></span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {text && <p className="mt-1 text-sm text-muted">{text}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
export function Alert({ tone = "info", title, children, action }: { tone?: "info" | "warn" | "error" | "success"; title?: string; children?: React.ReactNode; action?: React.ReactNode }) {
  const m = { info: ["bg-active border-[#cfe3f5]", Info, "text-primary"], warn: ["bg-[#FFF8E8] border-[#F4DDAA]", TriangleAlert, "text-[#9A6200]"], error: ["bg-[#FDF0F0] border-[#F0CFCF]", AlertCircle, "text-danger"], success: ["bg-[#EAF7F4] border-[#C5E8E1]", CheckCircle2, "text-[#2A8577]"] }[tone] as [string, typeof Info, string];
  const Icon = m[1];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-2.5 rounded-lg border px-3 py-2.5 text-[13px]", m[0])}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", m[2])} aria-hidden />
      <div className="flex-1">{title && <p className="font-medium text-ink">{title}</p>}{children && <div className="text-slate-600">{children}</div>}</div>
      {action}
    </div>
  );
}
export function Avatar({ name, size = 32, tint }: { name: string; size?: number; tint?: string }) {
  const ini = name.replace(/^Dr\.\s*/, "").split(" ").map((x) => x[0]).slice(0, 2).join("");
  return <span className="grid shrink-0 place-items-center rounded-full bg-lavender/70 font-medium text-[#40428A]" style={{ width: size, height: size, fontSize: size * 0.38, background: tint }} aria-hidden>{ini}</span>;
}

/* ---------------- Tabs ---------------- */
export const Tabs = RTabs.Root;
export const TabsList = ({ className, ...p }: React.ComponentProps<typeof RTabs.List>) => (
  <RTabs.List className={cn("flex gap-1 overflow-x-auto border-b border-line scroll-thin", className)} {...p} />
);
export const TabsTrigger = ({ className, ...p }: React.ComponentProps<typeof RTabs.Trigger>) => (
  <RTabs.Trigger className={cn("relative whitespace-nowrap px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:text-ink data-[state=active]:text-primary after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded after:bg-transparent data-[state=active]:after:bg-primary", className)} {...p} />
);
export const TabsContent = ({ className, ...p }: React.ComponentProps<typeof RTabs.Content>) => <RTabs.Content className={cn("pt-5 focus-visible:outline-none", className)} {...p} />;

/* ---------------- Dialog / Sheet ---------------- */
/** Dialogs and panels opened from code have no trigger element, so Radix cannot return focus. Remember what had focus and put it back on close. */
function useReturnFocus() {
  const opener = React.useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: () => { const a = document.activeElement; opener.current = a instanceof HTMLElement && a !== document.body ? a : null; },
    onCloseAutoFocus: (e: Event) => { const el = opener.current; if (el?.isConnected) { e.preventDefault(); el.focus(); } },
  };
}
export function Modal({ open, onOpenChange, title, description, children, footer, width = 480 }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode; width?: number }) {
  const rf = useReturnFocus();
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="anim-fade fixed inset-0 z-50 bg-[#26384B]/40 backdrop-blur-[2px]" />
        <RDialog.Content {...rf} style={{ maxWidth: width }} className="anim-pop fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-lift focus:outline-none">
          <div className="p-5">
            <RDialog.Title className="text-base font-semibold">{title}</RDialog.Title>
            <RDialog.Description asChild><div className="mt-1.5 text-sm text-muted">{description}</div></RDialog.Description>
            {children && <div className="mt-4">{children}</div>}
          </div>
          {footer && <div className="flex justify-end gap-2 rounded-b-xl border-t border-line bg-cloud/50 px-5 py-3">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
export function ConfirmDialog({ open, onOpenChange, title, description, cancelLabel, confirmLabel, onConfirm, danger, loading }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description: React.ReactNode; cancelLabel: string; confirmLabel: string; onConfirm: () => void; danger?: boolean; loading?: boolean }) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={description} width={420}
      footer={<><Button variant="secondary" onClick={() => onOpenChange(false)}>{cancelLabel}</Button><Button variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>} />
  );
}
export function Sheet({ open, onOpenChange, title, description, children, footer, width = 440, modal = true }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode; width?: number; modal?: boolean }) {
  const rf = useReturnFocus();
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      <RDialog.Portal>
        {modal && <RDialog.Overlay className="anim-fade fixed inset-0 z-40 bg-[#26384B]/25 backdrop-blur-[2px]" />}
        <RDialog.Content {...rf} style={{ width }} onInteractOutside={(e) => { if (!modal) e.preventDefault(); }}
          className="anim-panel fixed right-0 top-0 z-50 flex h-full max-w-full flex-col border-l border-line bg-white shadow-xl focus:outline-none">
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <RDialog.Title className="text-base font-semibold">{title}</RDialog.Title>
              <RDialog.Description className={description ? "mt-0.5 text-[13px] text-muted" : "sr-only"}>{description ?? title}</RDialog.Description>
            </div>
            <RDialog.Close className="rounded-md p-1.5 text-muted hover:bg-cloud" aria-label="Close panel"><X className="size-4" /></RDialog.Close>
          </div>
          <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/* ---------------- Dropdown menu ---------------- */
export const Menu = RMenu.Root;
export const MenuTrigger = RMenu.Trigger;
export function MenuContent({ className, align = "end", ...p }: React.ComponentProps<typeof RMenu.Content>) {
  return (
    <RMenu.Portal>
      <RMenu.Content align={align} sideOffset={6} className={cn("anim-pop z-[60] min-w-48 rounded-xl border border-line bg-white p-1.5 shadow-lift", className)} {...p} />
    </RMenu.Portal>
  );
}
export const MenuItem = ({ className, ...p }: React.ComponentProps<typeof RMenu.Item>) => (
  <RMenu.Item className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-cloud", className)} {...p} />
);
export const MenuLabel = ({ className, ...p }: React.ComponentProps<typeof RMenu.Label>) => <RMenu.Label className={cn("px-2.5 py-1.5 text-xs font-medium text-muted", className)} {...p} />;
export const MenuSep = () => <RMenu.Separator className="my-1 h-px bg-line" />;

/* ---------------- Layout helpers ---------------- */
/** The top of every screen: a soft palette gradient with the title, a short line and the main actions. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="relative mb-5 overflow-hidden rounded-2xl border border-[#E3E6F5] bg-[linear-gradient(115deg,#F1EEFB_0%,#E6F1FB_38%,#DFF4F0_72%,#FFF3DC_100%)] px-5 py-5 sm:px-7">
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-white/50 blur-2xl" />
      <span aria-hidden className="pointer-events-none absolute -bottom-24 right-48 size-52 rounded-full bg-[#DCDDF5]/60 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><h1 className="text-[26px] font-semibold leading-tight tracking-tight">{title}</h1>{subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-600">{subtitle}</p>}</div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </section>
  );
}

/* ---------------- Stat tiles ---------------- */
const TILE_TONE = {
  blue: ["bg-primary", "bg-active text-primary"],
  mint: ["bg-mint", "bg-[#DDF3EF] text-[#1E6B61]"],
  peach: ["bg-peach", "bg-[#FFF1D6] text-[#7A4B00]"],
  lavender: ["bg-lavender", "bg-[#ECECF9] text-[#40428A]"],
  cyan: ["bg-cyan", "bg-[#DDF4F8] text-[#0E6577]"],
  red: ["bg-[#E7A9A8]", "bg-[#FBE9E9] text-[#8F2D2D]"],
  slate: ["bg-line", "bg-cloud text-slate-500"],
} as const;
export type TileTone = keyof typeof TILE_TONE;
/** A headline number with a colour bar, an icon and one helpful line. With `onClick` it acts as a filter button. */
export function StatTile({ label, value, hint, icon: Icon, tone = "blue", active, onClick }: { label: string; value: React.ReactNode; hint?: string; icon: LucideIcon; tone?: TileTone; active?: boolean; onClick?: () => void }) {
  const [bar, chip] = TILE_TONE[tone];
  const body = (
    <>
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1", bar)} />
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0"><span className="block text-[13px] font-medium text-muted">{label}</span><span className="mt-1 block truncate text-[28px] font-semibold leading-none tracking-tight tabular-nums">{value}</span></span>
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", chip)}><Icon className="size-5" aria-hidden /></span>
      </span>
      {hint && <span className="mt-2 block text-xs text-muted">{hint}</span>}
    </>
  );
  const cls = cn("relative block overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-card", active ? "border-primary ring-2 ring-primary/15" : "border-line");
  return onClick
    ? <button type="button" aria-pressed={active} onClick={onClick} className={cn(cls, "transition-all hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40")}>{body}</button>
    : <div className={cls}>{body}</div>;
}
export function StatGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 3 | 4 | 5 }) {
  return <div role="group" aria-label="Key figures" className={cn("mb-5 grid grid-cols-2 gap-3", cols === 5 ? "lg:grid-cols-5" : cols === 3 ? "sm:grid-cols-3" : "lg:grid-cols-4")}>{children}</div>;
}
export const Panel = ({ className, children, ...p }: React.HTMLAttributes<HTMLElement>) => (
  <section className={cn("rounded-2xl border border-line bg-white shadow-card", className)} {...p}>{children}</section>
);
export function PanelHeader({ title, action, sub }: { title: string; action?: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
      <div><h2 className="text-[15px] font-semibold">{title}</h2>{sub && <p className="text-xs text-muted">{sub}</p>}</div>{action}
    </div>
  );
}
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-cloud p-0.5">
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn("h-8 rounded-md px-3 text-[13px] font-medium transition-colors", value === o.value ? "bg-white text-primary shadow-sm" : "text-muted hover:text-ink")}>{o.label}</button>
      ))}
    </div>
  );
}
export function Pagination({ page, pages, onPage, total }: { page: number; pages: number; onPage: (p: number) => void; total: number }) {
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[13px] text-muted">
      <span>{total} results</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <span>Page {page} of {Math.max(pages, 1)}</span>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
export const Th = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => <th className={cn("px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted", className)} {...p} />;
export const Td = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn("px-4 py-3 align-middle text-[13px]", className)} {...p} />;

/** A quiet page title for working screens: no gradient, a short description, optional breadcrumb and actions. */
export function PageTitle({ title, description, actions, crumbs }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; crumbs?: { label: string; href?: string }[] }) {
  return (
    <header className="mb-5">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-1.5"><ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
          {crumbs.map((c, i) => <li key={c.label} className="flex items-center gap-1.5">{i > 0 && <span aria-hidden>/</span>}{c.href ? <Link href={c.href} className="hover:text-primary hover:underline">{c.label}</Link> : <span aria-current="page" className="text-ink">{c.label}</span>}</li>)}
        </ol></nav>)}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0"><h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">{title}</h1>{description && <p className="mt-1 max-w-3xl text-[14px] text-slate-600">{description}</p>}</div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
