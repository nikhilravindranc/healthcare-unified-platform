"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, Badge, Button, Panel, PanelHeader, Segmented } from "@/components/ui";
import { Denied } from "@/components/patient/shared";
import { useRole } from "@/lib/hooks";
import { readableOnWhite, readLogo } from "@/lib/palette";
import { saveSettings, useSettings } from "@/lib/settings";
import { applyTheme, customColors, DEFAULT_CUSTOM, THEMES, type CustomTheme, type Theme } from "@/lib/themes";
import { cn } from "@/lib/utils";

/** A small picture of the app in a set of colours. It is only a preview. */
function Preview({ vars }: { vars: Record<string, string> }) {
  const v = (k: string, d: string) => vars[k] ?? d;
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

const FONTS: { value: CustomTheme["font"]; label: string }[] = [{ value: "inter", label: "Inter" }, { value: "system", label: "System" }, { value: "humanist", label: "Humanist" }, { value: "serif", label: "Serif headings" }];
const SIZES: { value: CustomTheme["size"]; label: string }[] = [{ value: "compact", label: "Compact" }, { value: "default", label: "Standard" }, { value: "comfortable", label: "Comfortable" }];
const CORNERS: { value: CustomTheme["corners"]; label: string }[] = [{ value: "sharp", label: "Sharp" }, { value: "soft", label: "Soft" }, { value: "round", label: "Round" }];
const BUTTONS: { value: CustomTheme["buttons"]; label: string }[] = [{ value: "square", label: "Square" }, { value: "rounded", label: "Rounded" }, { value: "pill", label: "Pill" }];
const ICONS: { value: CustomTheme["icons"]; label: string }[] = [{ value: "light", label: "Light" }, { value: "regular", label: "Regular" }, { value: "bold", label: "Bold" }];

function Option({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={cn("min-w-0", wide && "sm:col-span-2")}><div className="max-w-full overflow-x-auto scroll-thin"><p className="mb-1.5 text-[13px] font-medium">{label}</p>{children}</div></div>;
}

/** Upload or drop a logo, take its colours as a starting palette, then adjust colours, type, corners, buttons and icons. */
function BrandEditor() {
  const s = useSettings();
  const [draft, setDraft] = useState<CustomTheme>(s.custom ?? DEFAULT_CUSTOM);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const saved = useRef({ theme: s.theme, custom: s.custom });
  saved.current = { theme: s.theme, custom: s.custom };
  // Leaving the page without saving puts the saved look back.
  useEffect(() => () => applyTheme(saved.current.theme, saved.current.custom), []);

  const change = (p: Partial<CustomTheme>) => { const n = { ...draft, ...p }; setDraft(n); setDirty(true); applyTheme("custom", n); };
  const take = async (file?: File | null) => {
    if (!file) return;
    setError(""); setNote(""); setBusy(true);
    try {
      const { dataUrl, colors } = await readLogo(file);
      const [a, b, c] = [colors[0], colors[1] ?? colors[0], colors[2] ?? colors[1] ?? colors[0]];
      if (!a) { change({ logo: dataUrl }); setNote("No clear brand colour was found in this logo, so the colours were left as they are. You can pick them yourself."); }
      else { const p = readableOnWhite(a); change({ logo: dataUrl, primary: p, accent: b, secondary: c }); setNote(p !== a ? "Colours were taken from your logo. The main colour was made slightly darker so white text on buttons stays easy to read." : "Colours were taken from your logo. Adjust any of them below."); }
    } catch (e) { setError(e instanceof Error ? e.message : "That file could not be used."); }
    finally { setBusy(false); }
  };
  const save = () => { saveSettings({ theme: "custom", custom: draft }); setDirty(false); toast.success("Your theme is applied"); };
  const reset = () => { saveSettings({ theme: "evoq", custom: null }); setDraft(DEFAULT_CUSTOM); setDirty(false); setNote(""); applyTheme("evoq", null); toast.success("Back to the default theme"); };
  const active = s.theme === "custom";
  const colorInput = (k: "primary" | "accent" | "secondary", label: string, hint: string) => (
    <label className="flex items-center gap-3 rounded-xl border border-line bg-white p-2.5">
      <input type="color" value={draft[k]} onChange={(e) => change({ [k]: e.target.value })} aria-label={`${label} colour`} className="size-10 shrink-0 cursor-pointer rounded-lg border border-line bg-white p-0.5" />
      <span className="min-w-0"><span className="block text-[13px] font-medium">{label}</span><span className="block text-xs text-muted">{hint} · <span className="font-mono">{draft[k].toUpperCase()}</span></span></span>
    </label>
  );

  return (
    <Panel className="mb-5">
      <PanelHeader title="Your brand" sub="Add your logo to build a theme from its colours, then adjust it to suit your practice." action={active && !dirty ? <Badge tone="mint"><Check className="size-3" aria-hidden />In use</Badge> : undefined} />
      <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="space-y-3">
          <label onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); }}
            className={cn("group flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 text-center transition-colors focus-within:ring-2 focus-within:ring-primary/40", over ? "border-primary bg-active" : "border-line bg-cloud/50 hover:border-primary/50 hover:bg-active/50")}>
            <input type="file" accept="image/*" className="sr-only" aria-label="Upload a logo" onChange={(e) => { take(e.target.files?.[0]); e.target.value = ""; }} />
            {draft.logo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={draft.logo} alt="Your logo" className="max-h-20 max-w-full object-contain" />
              : <span className="grid size-12 place-items-center rounded-xl bg-white text-primary shadow-sm"><ImagePlus className="size-5" aria-hidden /></span>}
            <span className="text-[13px] font-medium">{busy ? "Reading your logo…" : draft.logo ? "Drop a different logo or click to replace" : "Drop your logo here or click to choose"}</span>
            <span className="text-xs text-muted">PNG, JPG, SVG or WebP, up to 3 MB. The image stays in this browser.</span>
          </label>
          {draft.logo && <Button size="sm" variant="ghost" onClick={() => change({ logo: undefined })}><Trash2 className="size-4" aria-hidden />Remove logo</Button>}
          {error && <Alert tone="error">{error}</Alert>}
          {note && <Alert tone="info">{note}</Alert>}
          <p className="text-xs text-muted">Pulling colours from a website address needs a server to read the page, so it is not available yet. For now, use your logo or pick colours by hand.</p>
        </div>

        <div className="space-y-5">
          <div className="grid gap-2.5 sm:grid-cols-3">
            {colorInput("primary", "Main colour", "Buttons and links")}
            {colorInput("accent", "Accent", "Highlights")}
            {colorInput("secondary", "Support", "Soft backgrounds")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Option label="Font" wide><Segmented label="Font" value={draft.font} onChange={(v) => change({ font: v })} options={FONTS} /></Option>
            <Option label="Text size" wide><Segmented label="Text size" value={draft.size} onChange={(v) => change({ size: v })} options={SIZES} /></Option>
            <Option label="Corners"><Segmented label="Corners" value={draft.corners} onChange={(v) => change({ corners: v })} options={CORNERS} /></Option>
            <Option label="Buttons"><Segmented label="Buttons" value={draft.buttons} onChange={(v) => change({ buttons: v })} options={BUTTONS} /></Option>
            <Option label="Icon weight"><Segmented label="Icon weight" value={draft.icons} onChange={(v) => change({ icons: v })} options={ICONS} /></Option>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium">Preview</p>
            <Preview vars={customColors(draft)} />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <Button onClick={save} disabled={!dirty && active}>Use this theme</Button>
            <Button variant="ghost" onClick={reset} disabled={!s.custom && !dirty}><RotateCcw className="size-4" aria-hidden />Reset to default</Button>
            {dirty && <span className="text-xs text-muted">Previewing. Nothing is saved until you choose Use this theme.</span>}
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function ThemesSection() {
  const { can } = useRole();
  const { theme } = useSettings();
  if (!can("settings")) return <Denied what="themes" />;
  const choose = (t: Theme) => { saveSettings({ theme: t.id }); applyTheme(t.id, null); toast.success(`${t.name} theme applied`); };
  return (
    <>
      <BrandEditor />
      <Panel>
        <PanelHeader title="Ready-made themes" sub="Choose a look that suits your practice. These change colours only." />
        <ul className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {THEMES.map((t) => {
            const on = t.id === theme || (!theme && t.id === "evoq");
            return (
              <li key={t.id} className={cn("rounded-2xl border bg-white p-3 shadow-card", on ? "border-primary ring-2 ring-primary/20" : "border-line")}>
                <Preview vars={t.vars} />
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
    </>
  );
}
