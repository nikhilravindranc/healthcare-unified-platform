"use client";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Panel, PanelHeader } from "@/components/ui";
import { Denied } from "@/components/patient/shared";
import { useRole } from "@/lib/hooks";
import { saveSettings, useSettings } from "@/lib/settings";
import { applyTheme, THEMES, type Theme } from "@/lib/themes";
import { cn } from "@/lib/utils";

/** A small picture of the app in the theme's colours. It is only a preview. */
function Preview({ t }: { t: Theme }) {
  const v = (k: string, d: string) => t.vars[k] ?? d;
  const primary = v("--primary", "#2867b2"), active = v("--active", "#eaf3fb");
  const t1 = v("--t1", "#F1EEFB"), t2 = v("--t2", "#E6F1FB"), t3 = v("--t3", "#DFF4F0"), t4 = v("--t4", "#FFF3DC");
  const c1 = v("--canvas-1", "#F5F7FB"), c2 = v("--canvas-2", "#EEF3F9");
  return (
    <div aria-hidden className="flex h-28 overflow-hidden rounded-xl border border-line" style={{ background: `linear-gradient(160deg, ${c1}, ${c2})` }}>
      <div className="flex w-9 flex-col gap-1.5 border-r border-line bg-white p-1.5"><span className="h-1.5 rounded" style={{ background: primary }} /><span className="h-1.5 rounded bg-slate-200" /><span className="h-1.5 rounded bg-slate-200" /><span className="h-1.5 rounded bg-slate-200" /></div>
      <div className="flex-1 space-y-1.5 p-2">
        <div className="h-9 rounded-lg" style={{ background: `linear-gradient(115deg, ${t1}, ${t2} 40%, ${t3} 72%, ${t4})` }} />
        <div className="flex gap-1.5"><span className="h-5 flex-1 rounded-md bg-white shadow-sm" /><span className="h-5 flex-1 rounded-md" style={{ background: active }} /><span className="h-5 w-10 rounded-md" style={{ background: primary }} /></div>
        <div className="h-8 rounded-md bg-white shadow-sm" />
      </div>
    </div>
  );
}

export function ThemesSection() {
  const { can } = useRole();
  const { theme } = useSettings();
  if (!can("settings")) return <Denied what="themes" />;
  const choose = (t: Theme) => { saveSettings({ theme: t.id }); applyTheme(t.id); toast.success(`${t.name} theme applied`); };
  return (
    <Panel>
      <PanelHeader title="Themes" sub="Choose the look that suits your practice. A theme changes colours only. Nothing else in the app changes." />
      <ul className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {THEMES.map((t) => {
          const on = t.id === theme || (!theme && t.id === "evoq");
          return (
            <li key={t.id} className={cn("rounded-2xl border bg-white p-3 shadow-card", on ? "border-primary ring-2 ring-primary/20" : "border-line")}>
              <Preview t={t} />
              <div className="mt-3 flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="text-sm font-semibold">{t.name}</p><Badge tone="lavender" className="mt-1">{t.audience}</Badge></div>
                {on ? <span className="inline-flex items-center gap-1 rounded-full bg-active px-2.5 py-1 text-xs font-medium text-primary"><Check className="size-3.5" aria-hidden />Current</span>
                  : <Button size="sm" variant="secondary" aria-label={`Use the ${t.name} theme`} onClick={() => choose(t)}>Use theme</Button>}
              </div>
              <p className="mt-2 text-[13px] text-slate-600">{t.description}</p>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
