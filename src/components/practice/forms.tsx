"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, Badge, Button, Checkbox, EmptyState, Field, Input, Modal, Panel, PanelHeader, Select, SkeletonRows, Td, Textarea, Th } from "@/components/ui";
import { FormFields } from "@/components/patient/records";
import { apiC } from "@/lib/clinical";
import { useAction, useRole, useTemplates } from "@/lib/hooks";
import type { FormField, FormTemplate } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPES: { v: FormField["type"]; l: string }[] = [{ v: "short", l: "Short text" }, { v: "long", l: "Long text" }, { v: "number", l: "Number" }, { v: "date", l: "Date" }, { v: "select", l: "Single select" }, { v: "multi", l: "Multi-select" }, { v: "checkbox", l: "Checkbox" }, { v: "yesno", l: "Yes / no" }, { v: "instructions", l: "Instructions" }, { v: "file", l: "File upload" }];
const blank = (): FormTemplate => ({ id: `ft${Date.now()}`, name: "", type: "Clinical form", specialty: "All", description: "", version: 1, status: "Draft", owner: "Meera Iyer", fields: [] });
const tone = (s: string) => (s === "Published" ? "mint" : s === "Draft" ? "peach" : "neutral") as "mint" | "peach" | "neutral";

export function FormsSection() {
  const { data, isLoading } = useTemplates(); const { can } = useRole(); const save = useAction(apiC.saveTemplate);
  const [edit, setEdit] = useState<FormTemplate | null>(null); const [f, setF] = useState({ type: "", status: "" });
  const rows = (data ?? []).filter((t) => (!f.type || t.type === f.type) && (!f.status || t.status === f.status));
  if (edit) return <Builder t={edit} onClose={() => setEdit(null)} />;
  return (
    <Panel>
      <PanelHeader title="Forms and consent" action={can("settings") && <Button size="sm" onClick={() => setEdit(blank())}><Plus className="size-4" />New form</Button>} />
      <div className="flex flex-wrap gap-2 border-b border-line p-3">
        <Select sm aria-label="Type" className="w-40" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="">All types</option><option>Consent</option><option>Clinical form</option><option>Intake</option></Select>
        <Select sm aria-label="Status" className="w-36" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">All status</option><option>Published</option><option>Draft</option><option>Archived</option></Select>
      </div>
      {isLoading ? <SkeletonRows rows={4} /> : rows.length === 0 ? <EmptyState title="No forms" text="Create a form template to collect consent or clinical information." /> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[760px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>Form</Th><Th>Type</Th><Th>Specialty</Th><Th>Version</Th><Th>Fields</Th><Th>Status</Th><Th /></tr></thead>
          <tbody className="divide-y divide-line">{rows.map((t) => (
            <tr key={t.id} className="hover:bg-cloud/40"><Td className="font-medium">{t.name}<span className="block text-xs font-normal text-muted">{t.description}</span></Td><Td>{t.type}</Td><Td>{t.specialty}</Td><Td>v{t.version}</Td><Td>{t.fields.length}</Td><Td><Badge tone={tone(t.status)}>{t.status}</Badge></Td>
              <Td className="text-right"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => setEdit(structuredClone(t))} disabled={!can("settings")}>Edit</Button>
                <Button size="sm" variant="ghost" aria-label={`Duplicate ${t.name}`} disabled={!can("settings")} onClick={async () => { await save.run({ ...structuredClone(t), id: `ft${Date.now()}`, name: `${t.name} (copy)`, version: 1, status: "Draft" }); toast.success("Duplicated as a draft"); }}><Copy className="size-4" /></Button>
                {t.status !== "Archived" && <Button size="sm" variant="ghost" disabled={!can("settings")} onClick={async () => { await save.run({ ...t, status: "Archived" }); toast.success("Form archived. Past responses are unchanged."); }}>Archive</Button>}</div></Td></tr>))}</tbody></table></div>)}
    </Panel>
  );
}

function Builder({ t: init, onClose }: { t: FormTemplate; onClose: () => void }) {
  const save = useAction(apiC.saveTemplate);
  const [t, setT] = useState(init); const [sel, setSel] = useState<string | null>(init.fields[0]?.id ?? null); const [prev, setPrev] = useState(false); const [pv, setPv] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string[]>([]);
  const field = t.fields.find((x) => x.id === sel);
  const upd = (id: string, p: Partial<FormField>) => setT({ ...t, fields: t.fields.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const add = (type: FormField["type"]) => { const f: FormField = { id: `f${Date.now()}`, type, label: TYPES.find((x) => x.v === type)!.l, required: false, options: type === "select" || type === "multi" ? ["Option 1", "Option 2"] : undefined }; setT({ ...t, fields: [...t.fields, f] }); setSel(f.id); };
  const move = (i: number, d: number) => { const a = [...t.fields]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setT({ ...t, fields: a }); };
  const validate = () => { const e: string[] = []; if (!t.name.trim()) e.push("Give the form a name."); if (!t.fields.length) e.push("Add at least one field."); t.fields.forEach((f) => { if (!f.label.trim()) e.push("Every field needs a label."); if ((f.type === "select" || f.type === "multi") && (f.options ?? []).filter(Boolean).length < 2) e.push(`"${f.label}" needs at least two options.`); }); setErr([...new Set(e)]); return e.length === 0; };
  const persist = async (status: FormTemplate["status"]) => {
    if (!validate()) return;
    const publishing = status === "Published";
    await save.run({ ...t, status, version: publishing && init.status === "Published" ? init.version + 1 : t.version });
    toast.success(publishing ? `Published v${init.status === "Published" ? init.version + 1 : t.version}. Earlier submissions keep their original version.` : "Draft saved"); onClose();
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><button onClick={onClose} className="text-[13px] text-primary hover:underline">← Back to forms</button><h2 className="text-[20px] font-semibold">{init.name || "New form"} <Badge tone={tone(t.status)}>{t.status}</Badge></h2></div>
        <div className="flex gap-2"><Button variant="secondary" onClick={() => setPrev(true)}><Eye className="size-4" />Preview</Button><Button variant="secondary" loading={save.pending} onClick={() => persist("Draft")}>Save draft</Button><Button loading={save.pending} onClick={() => persist("Published")}>Publish{init.status === "Published" ? ` v${init.version + 1}` : ""}</Button></div></div>
      {err.length > 0 && <Alert tone="error" title="Fix these before saving"><ul className="list-disc pl-4">{err.map((e) => <li key={e}>{e}</li>)}</ul></Alert>}
      <Panel className="grid gap-4 p-4 sm:grid-cols-4"><Field label="Name" required className="sm:col-span-2"><Input value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} /></Field><Field label="Type"><Select value={t.type} onChange={(e) => setT({ ...t, type: e.target.value as FormTemplate["type"] })}><option>Consent</option><option>Clinical form</option><option>Intake</option></Select></Field><Field label="Specialty / service"><Input value={t.specialty} onChange={(e) => setT({ ...t, specialty: e.target.value })} /></Field><Field label="Description" className="sm:col-span-4"><Input value={t.description} onChange={(e) => setT({ ...t, description: e.target.value })} /></Field></Panel>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel><PanelHeader title="Fields" action={<Select sm aria-label="Add field" className="w-40" value="" onChange={(e) => e.target.value && add(e.target.value as FormField["type"])}><option value="">Add field…</option>{TYPES.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}</Select>} />
          {t.fields.length === 0 ? <EmptyState title="No fields yet" text="Add a field from the menu above." /> : <ol className="divide-y divide-line">{t.fields.map((f, i) => (
            <li key={f.id}><div className={cn("flex items-center gap-2 px-4 py-2.5 hover:bg-cloud/40", sel === f.id && "bg-active/60")}><button className="flex-1 text-left text-[13px]" onClick={() => setSel(f.id)}><span className="font-medium">{f.label || "Untitled"}</span>{f.required && <span className="text-danger"> *</span>}<span className="block text-xs text-muted">{TYPES.find((x) => x.v === f.type)?.l}</span></button>
              <button aria-label="Move up" className="rounded p-1 text-muted hover:bg-cloud" onClick={() => move(i, -1)}><ArrowUp className="size-4" /></button><button aria-label="Move down" className="rounded p-1 text-muted hover:bg-cloud" onClick={() => move(i, 1)}><ArrowDown className="size-4" /></button>
              <button aria-label="Delete field" className="rounded p-1 text-muted hover:text-danger" onClick={() => { setT({ ...t, fields: t.fields.filter((x) => x.id !== f.id) }); if (sel === f.id) setSel(null); }}><Trash2 className="size-4" /></button></div></li>))}</ol>}
        </Panel>
        <Panel><PanelHeader title="Field settings" />
          {field ? <div className="space-y-3 p-4"><Field label="Label" required><Textarea className="min-h-16" value={field.label} onChange={(e) => upd(field.id, { label: e.target.value })} /></Field>
            {field.type !== "instructions" && <><Field label="Helper text"><Input value={field.helper ?? ""} onChange={(e) => upd(field.id, { helper: e.target.value })} /></Field><Checkbox checked={field.required} onChange={(c) => upd(field.id, { required: c })} label="Required" /></>}
            {(field.type === "select" || field.type === "multi") && <Field label="Options (one per line)"><Textarea value={(field.options ?? []).join("\n")} onChange={(e) => upd(field.id, { options: e.target.value.split("\n") })} /></Field>}
            {field.type === "file" && <p className="text-xs text-muted">Uploads are stored with the response. Signature capture is not available; use a typed name field.</p>}</div> : <EmptyState title="Select a field" />}</Panel>
      </div>
      <p className="text-xs text-muted">Publishing creates a new version. Submitted responses keep the version they were completed with.</p>
      <Modal open={prev} onOpenChange={setPrev} title={t.name || "Form preview"} description={t.description} width={560} footer={<Button variant="secondary" onClick={() => setPrev(false)}>Close preview</Button>}><FormFields fields={t.fields} v={pv} set={(id, val) => setPv({ ...pv, [id]: val })} err={{}} /></Modal>
    </div>
  );
}
