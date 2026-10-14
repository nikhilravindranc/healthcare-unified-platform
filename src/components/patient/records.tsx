"use client";
import { useState } from "react";
import { isOpenStatus } from "@/lib/appointment-rules";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, ChevronDown, FileText, Plus, Upload } from "lucide-react";
import { Alert, Badge, Button, ConfirmDialog, EmptyState, Field, Input, Modal, Panel, PanelHeader, Select, StatusBadge, Td, Textarea, Th } from "@/components/ui";
import { useUI } from "@/components/app/ui-state";
import { apiC, SERVICE_CAPS } from "@/lib/clinical";
import { consentOnFile, medicalHistory, nextAppointment, unsignedForms } from "@/lib/patient-overview";
import { api, fmtDate, fmtTime, TODAY } from "@/lib/db";
import { useAction, useAppointments, useExtras, useFollowUps, useRefs, useRole, useTemplates, useVisits } from "@/lib/hooks";
import type { FormField, Patient, PlanStep } from "@/lib/types";

export function VisitsTab({ p }: { p: Patient }) {
  const { data: visits } = useVisits(); const { data: appts } = useAppointments(); const { data: refs } = useRefs(); const { can } = useRole();
  const router = useRouter(); const ui = useUI();
  const v = (visits ?? []).filter((x) => x.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const up = (appts ?? []).filter((a) => a.patientId === p.id && a.date >= TODAY && !a.visitId && isOpenStatus(a.status)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return (
    <Panel>
      {up.length === 0 && v.length === 0 ? <EmptyState title="No visits yet" text="Book an appointment or start a visit." /> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[680px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>Date</Th><Th>Visit</Th><Th>Provider</Th><Th>Notes</Th><Th>Status</Th><Th /></tr></thead>
          <tbody className="divide-y divide-line">
            {up.map((a) => <tr key={a.id} className="bg-active/30"><Td>{a.date === TODAY ? "Today" : fmtDate(a.date, true)} · {fmtTime(a.time)}</Td><Td>{refs?.services.find((s) => s.id === a.serviceId)?.name}</Td><Td>{refs?.providers.find((x) => x.id === a.providerId)?.short}</Td><Td className="text-muted">—</Td><Td><StatusBadge status={a.status} /></Td><Td className="text-right"><Button size="sm" variant="secondary" onClick={() => ui.openAppt(a.id)}>Open appointment</Button></Td></tr>)}
            {v.map((x) => <tr key={x.id}><Td>{x.date === TODAY ? "Today" : fmtDate(x.date, true)}</Td><Td>{x.type}<span className="block text-xs text-muted">{x.reason}</span></Td><Td>{refs?.providers.find((y) => y.id === x.providerId)?.short}</Td>
              <Td>{can("notes") ? (x.notes.subjective || x.notes.plan ? <Badge tone="mint">Notes saved</Badge> : <Badge>No notes</Badge>) : <span className="text-xs text-muted">Restricted</span>}</Td><Td><Badge tone={x.status === "Completed" ? "mint" : "blue"}>{x.status}</Badge></Td>
              <Td className="text-right"><Button size="sm" variant="secondary" onClick={() => router.push(`/visits/${x.id}`)}>Open visit</Button></Td></tr>)}
          </tbody></table></div>)}
    </Panel>
  );
}

export function PlansPanel({ p }: { p: Patient }) {
  const { data: refs } = useRefs(); const { data: extras } = useExtras(); const { can } = useRole();
  const setStep = useAction(apiC.setPlanStep); const addStep = useAction(apiC.addPlanStep, "Step added"); const addPlan = useAction(apiC.addPlan, "Plan created");
  const [planDlg, setPlanDlg] = useState(false); const [stepDlg, setStepDlg] = useState<string | null>(null);
  const [pf, setPf] = useState({ name: "", goal: "" }); const [sf, setSf] = useState({ title: "", date: "" }); const [err, setErr] = useState("");
  if (!can("notes")) return null;
  const plans = (extras?.plans ?? []).filter((x) => x.patientId === p.id);
  const active = plans.filter((x) => x.status === "Active"); const other = plans.filter((x) => x.status !== "Active");
  const planView = (pl: (typeof plans)[number]) => (
          <details key={pl.id} className="group border-b border-line p-4 last:border-0" open={plans.length === 1}>
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2"><span><span className="text-[14px] font-semibold">{pl.name}</span><span className="block text-xs text-muted">{pl.steps.filter((x) => x.status === "Completed").length} of {pl.steps.length} steps recorded as completed · {refs?.providers.find((x) => x.id === pl.providerId)?.short} · review {fmtDate(pl.review)}</span></span><Badge tone={pl.status === "Active" ? "blue" : "neutral"}>{pl.status}</Badge></summary>
            <p className="mt-2 text-[13px] text-muted">{pl.goal}</p>
            <ol className="mt-3 space-y-1.5">{pl.steps.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-[13px]"><span className="grid size-5 place-items-center rounded-full bg-cloud text-[11px] font-medium">{i + 1}</span><span className="flex-1"><span className="font-medium">{s.title}</span>{s.date && <span className="text-muted"> · {fmtDate(s.date)}</span>}{s.note && <span className="block text-xs text-muted">{s.note}</span>}</span>
                <Select sm aria-label={`Status of ${s.title}`} className="w-32" value={s.status} onChange={(e) => setStep.run(pl.id, s.id, e.target.value as PlanStep["status"])}>{["Planned", "Scheduled", "Completed", "Deferred", "Cancelled"].map((x) => <option key={x}>{x}</option>)}</Select></li>))}</ol>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => { setSf({ title: "", date: "" }); setErr(""); setStepDlg(pl.id); }}><Plus className="size-4" />Add step</Button>
          </details>);
  return (
    <>
      <Panel><PanelHeader title="Active treatment plan" sub="Written and approved by the provider. Progress counts only steps recorded as completed." action={<Button size="sm" variant="secondary" onClick={() => { setPf({ name: "", goal: "" }); setErr(""); setPlanDlg(true); }}><Plus className="size-4" />New plan</Button>} />
        {active.length === 0 ? <EmptyState title="No active treatment plan" text="Create a plan to track planned, scheduled and completed steps." /> : active.map(planView)}
      </Panel>
      {other.length > 0 && (
        <details className="group rounded-xl border border-line bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[13px] font-medium text-primary hover:bg-cloud/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">Completed and paused plans ({other.length})<ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden /></summary>
          <div className="border-t border-line">{other.map(planView)}</div>
        </details>)}
      <Modal open={planDlg} onOpenChange={setPlanDlg} title="New treatment plan" footer={<><Button variant="secondary" onClick={() => setPlanDlg(false)}>Cancel</Button><Button loading={addPlan.pending} onClick={async () => { if (!pf.name.trim()) return setErr("Name the plan"); await addPlan.run({ patientId: p.id, name: pf.name, goal: pf.goal, providerId: p.providerId || "pat", review: "2026-11-07" }); setPlanDlg(false); }}>Create plan</Button></>}>
        <div className="space-y-4"><Field label="Plan name" required error={err}><Input value={pf.name} onChange={(e) => { setPf({ ...pf, name: e.target.value }); setErr(""); }} /></Field><Field label="Goal or description"><Textarea value={pf.goal} onChange={(e) => setPf({ ...pf, goal: e.target.value })} /></Field></div></Modal>
      <Modal open={!!stepDlg} onOpenChange={(o) => !o && setStepDlg(null)} title="Add plan step" footer={<><Button variant="secondary" onClick={() => setStepDlg(null)}>Cancel</Button><Button onClick={async () => { if (!sf.title.trim()) return setErr("Describe the step"); await addStep.run(stepDlg!, sf.title, sf.date || undefined); setStepDlg(null); }}>Add step</Button></>}>
        <div className="space-y-4"><Field label="Step" required error={err}><Input value={sf.title} onChange={(e) => { setSf({ ...sf, title: e.target.value }); setErr(""); }} /></Field><Field label="Date (optional)"><Input type="date" value={sf.date} onChange={(e) => setSf({ ...sf, date: e.target.value })} /></Field></div></Modal>
    </>
  );
}

export function DocumentsTab({ p }: { p: Patient }) {
  const { data: extras } = useExtras();
  const add = useAction(apiC.addDocument, "Document uploaded"); const del = useAction(apiC.deleteDocument, "Document deleted");
  const [d, setD] = useState<{ id: string; name: string } | null>(null); const [err, setErr] = useState("");
  const docs = (extras?.documents ?? []).filter((x) => x.patientId === p.id);
  const onFile = async (f?: File) => {
    setErr(""); if (!f) return;
    if (f.size > 10 * 1024 * 1024) return setErr("This file is larger than 10 MB.");
    if (!/\.(pdf|png|jpe?g|docx?)$/i.test(f.name)) return setErr("Unsupported type. Use PDF, image or Word documents.");
    await add.run({ patientId: p.id, name: f.name, kind: "Attachment", date: TODAY, by: "Dr. Patel", status: "Filed" });
  };
  return (
    <Panel>
      <PanelHeader title="Uploaded documents" sub="Referral letters, outside records and attachments" action={<label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-[13px] font-medium hover:bg-cloud focus-within:ring-2 focus-within:ring-primary"><Upload className="size-4" />Upload<input type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} /></label>} />
      {err && <div className="p-3"><Alert tone="error" title="Couldn't upload">{err}</Alert></div>}
      {docs.length === 0 ? <EmptyState title="No documents" text="Referral letters, outside records and attachments appear here." /> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[560px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>Document</Th><Th>Type</Th><Th>Date</Th><Th>Status</Th><Th /></tr></thead>
          <tbody className="divide-y divide-line">
            {docs.map((x) => <tr key={x.id}><Td><span className="flex items-center gap-2"><FileText className="size-4 text-muted" />{x.name}</span></Td><Td>{x.kind}</Td><Td>{fmtDate(x.date)}</Td><Td><Badge tone={x.status === "Filed" ? "mint" : "peach"}>{x.status === "Filed" ? "Filed" : "Needs review"}</Badge></Td><Td className="text-right"><Button size="sm" variant="ghost" onClick={() => setD({ id: x.id, name: x.name })}>Delete</Button></Td></tr>)}
          </tbody></table></div>)}
      <p className="border-t border-line px-4 py-2 text-xs text-muted">Demo: only the record of an upload is kept. The file itself is not stored.</p>
      <ConfirmDialog open={!!d} onOpenChange={(o) => !o && setD(null)} danger title="Delete document?" description={<>“{d?.name}” will be removed from this patient&apos;s record and the deletion will be written to the audit log.</>} cancelLabel="Keep document" confirmLabel="Delete document" loading={del.pending} onConfirm={async () => { await del.run(d!.id); setD(null); }} />
    </Panel>
  );
}

function Fields({ fields, v, set, err }: { fields: FormField[]; v: Record<string, string>; set: (id: string, val: string) => void; err: Record<string, string> }) {
  return (
    <div className="space-y-4">{fields.map((f) => {
      if (f.type === "instructions") return <p key={f.id} className="rounded-lg bg-cloud p-3 text-[13px] text-slate-600">{f.label}</p>;
      const label = f.label;
      if (f.type === "checkbox") return <div key={f.id}><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={v[f.id] === "true"} onChange={(e) => set(f.id, String(e.target.checked))} />{label}{f.required && <span className="text-danger"> *</span>}</label>{err[f.id] && <p role="alert" className="text-xs text-danger">{err[f.id]}</p>}</div>;
      return (
        <Field key={f.id} label={label} required={f.required} error={err[f.id]} hint={f.helper}>
          {f.type === "long" ? <Textarea value={v[f.id] ?? ""} onChange={(e) => set(f.id, e.target.value)} /> : f.type === "select" || f.type === "yesno" ? <Select value={v[f.id] ?? ""} onChange={(e) => set(f.id, e.target.value)}><option value="">Select</option>{(f.type === "yesno" ? ["Yes", "No"] : f.options ?? []).map((o) => <option key={o}>{o}</option>)}</Select>
            : f.type === "multi" ? <Input readOnly value={v[f.id] ?? ""} placeholder="Choose below" /> : f.type === "file" ? <Input type="file" /> : <Input type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} value={v[f.id] ?? ""} onChange={(e) => set(f.id, e.target.value)} />}
        </Field>
      );
    })}</div>
  );
}
export { Fields as FormFields };

export function FormsTab({ p }: { p: Patient }) {
  const { data: tpls } = useTemplates(); const { data: extras } = useExtras(); const { data: visits } = useVisits(); const { data: appts } = useAppointments();
  const submit = useAction(apiC.submitForm, "Form submitted");
  const [tid, setTid] = useState<string | null>(null); const [visitId, setVisitId] = useState(""); const [v, setV] = useState<Record<string, string>>({}); const [err, setErr] = useState<Record<string, string>>({});
  const published = (tpls ?? []).filter((t) => t.status === "Published");
  const tpl = published.find((t) => t.id === tid);
  const resp = (extras?.responses ?? []).filter((r) => r.patientId === p.id);
  const mine = (visits ?? []).filter((x) => x.patientId === p.id);
  const next = nextAppointment(appts ?? [], p.id, TODAY);
  const consentNeeded = !!next && !!SERVICE_CAPS[next.serviceId]?.consent;
  const consent = consentOnFile(visits ?? [], extras?.documents ?? [], p.id);
  const history = medicalHistory(extras?.responses ?? [], tpls ?? [], p.id);
  const needed = [
    ...(consentNeeded && !consent ? [{ k: "c", t: "Signed consent", d: "None on file for the next appointment" }] : []),
    ...(!history ? [{ k: "m", t: "Medical history form", d: "No form on file" }] : []),
    ...unsignedForms(visits ?? [], p.id).map((f) => ({ k: f.id, t: f.name, d: "Awaiting signature" })),
    ...(extras?.responses ?? []).filter((r) => r.patientId === p.id && r.status === "Submitted").map((r) => ({ k: r.id, t: r.templateName, d: "Submitted, awaiting practitioner review" })),
  ];
  const rows = [
    ...resp.map((r) => ({ id: r.id, name: r.templateName, type: tpls?.find((t) => t.id === r.templateId)?.type ?? "Form", ver: `v${r.version}`, date: r.submitted, visit: r.visitId, status: r.status === "Reviewed" ? "Reviewed" : "Submitted, awaiting review", tone: r.status === "Reviewed" ? "mint" : "blue", src: `Completed in the app, ${r.by}` })),
    ...mine.flatMap((x) => x.forms.map((f) => ({ id: f.id + x.id, name: f.name, type: f.kind, ver: "", date: x.date, visit: x.id, status: f.signed ? "Signed (typed name)" : "Awaiting signature", tone: f.signed ? "mint" : "peach", src: "Recorded in the visit" }))),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const send = async () => {
    const e: Record<string, string> = {};
    tpl!.fields.forEach((f) => { if (f.required && f.type !== "instructions" && !(v[f.id] ?? "").trim()) e[f.id] = "This field is required"; if (f.required && f.type === "checkbox" && v[f.id] !== "true") e[f.id] = "Please confirm to continue"; });
    setErr(e); if (Object.keys(e).length) return;
    await submit.run({ patientId: p.id, visitId: visitId || undefined, templateId: tpl!.id, templateName: tpl!.name, version: tpl!.version, submitted: TODAY, by: `${p.first} ${p.last}`, status: "Submitted", answers: v }); setTid(null);
  };
  return (
    <div className="space-y-5">
      {next && (
        <Panel aria-label="Needed for the next appointment"><PanelHeader title="Needed for the next appointment" sub={`${fmtDate(next.date, true)}, ${fmtTime(next.time)}`} />
          {needed.length === 0 ? <p className="flex items-center gap-2 p-4 text-[13px]"><Check className="size-4 text-[#2A8577]" aria-hidden />Everything required is on file.</p> : (
            <ul className="divide-y divide-line">{needed.map((n) => <li key={n.k} className="flex items-center gap-2.5 px-4 py-2.5 text-[13px]"><AlertCircle className="size-4 shrink-0 text-[#9A6200]" aria-hidden /><span className="flex-1"><span className="font-medium">{n.t}</span><span className="text-muted"> · {n.d}</span></span></li>)}</ul>)}
        </Panel>)}
      <Panel><PanelHeader title="Forms and consent" sub="Structured records, kept separate from uploaded files" action={<Select sm className="w-52" aria-label="Complete a form" value="" onChange={(e) => { setTid(e.target.value); setV({}); setErr({}); setVisitId(""); }}><option value="">Complete a form…</option>{published.map((t) => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}</Select>} />
        {rows.length === 0 ? <EmptyState title="No forms completed" text="Start one from the menu above." /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[720px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>Record</Th><Th>Type</Th><Th>Date</Th><Th>Visit</Th><Th>Status</Th><Th>Source</Th></tr></thead>
            <tbody className="divide-y divide-line">{rows.map((r) => <tr key={r.id}><Td className="font-medium">{r.name}{r.ver && <span className="ml-1.5 text-xs font-normal text-muted">{r.ver}</span>}</Td><Td>{r.type}</Td><Td>{fmtDate(r.date, true)}</Td><Td>{r.visit ? <Link className="text-primary hover:underline" href={`/visits/${r.visit}`}>Open visit</Link> : "—"}</Td><Td><Badge tone={r.tone as "mint" | "blue" | "peach"}>{r.status}</Badge></Td><Td className="text-xs text-muted">{r.src}</Td></tr>)}</tbody></table></div>)}
      </Panel>
      <p className="text-xs text-muted">Submitted responses keep the template version they were completed with. A signature here is a typed name recorded in the app. It is not a legally binding e-signature, and no expiry is tracked.</p>
      <Modal open={!!tpl} onOpenChange={(o) => !o && setTid(null)} width={560} title={tpl?.name ?? ""} description={tpl?.description}
        footer={<><Button variant="secondary" onClick={() => setTid(null)}>Cancel</Button><Button loading={submit.pending} onClick={send}>Submit form</Button></>}>
        {tpl && <div className="space-y-4"><Field label="Link to visit (optional)"><Select value={visitId} onChange={(e) => setVisitId(e.target.value)}><option value="">Not linked</option>{mine.map((x) => <option key={x.id} value={x.id}>{fmtDate(x.date)} · {x.type}</option>)}</Select></Field><Fields fields={tpl.fields} v={v} set={(id, val) => setV({ ...v, [id]: val })} err={err} /></div>}
      </Modal>
    </div>
  );
}

export function FollowUpsTab({ p }: { p: Patient }) {
  const { data: fus } = useFollowUps(); const ui = useUI();
  const complete = useAction(api.completeFollowUp, "Follow-up completed");
  const rows = (fus ?? []).filter((f) => f.patientId === p.id).sort((a, b) => a.due.localeCompare(b.due));
  return (
    <Panel><PanelHeader title="Follow-ups" action={<Button size="sm" variant="secondary" onClick={() => ui.newFollowUp({ patientId: p.id })}><Plus className="size-4" />Add follow-up</Button>} />
      {rows.length === 0 ? <EmptyState title="No follow-ups" text="Add a follow-up to track this patient's next steps." /> : (
        <ul className="divide-y divide-line">{rows.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-4 px-4 py-3 text-[13px]"><span className="min-w-0 flex-1"><span className="font-medium">{f.type}</span><br /><span className="text-muted">Due {fmtDate(f.due, true)} · {f.assignee}{f.visitId ? " · linked to visit" : ""}</span></span>
            <Badge tone={f.status === "Completed" ? "mint" : f.due < TODAY ? "red" : "neutral"}>{f.status === "Open" && f.due < TODAY ? "Overdue" : f.status}</Badge>
            {f.status === "Open" && <><Button size="sm" variant="secondary" onClick={() => ui.newAppt({ patientId: p.id })}>Book next appointment</Button><Button size="sm" variant="soft" onClick={() => complete.run(f.id)}>Complete</Button></>}</li>))}</ul>)}
    </Panel>
  );
}

export const COMM_LOG = [
    { d: "2026-10-05", t: "Appointment reminder sent", s: "Automated reminder for Oct 7, 10:00 AM", ch: "System" },
    { d: "2026-09-25", t: "Invoice INV-1046 issued", s: "Receipt email queued", ch: "System" },
    { d: "2026-09-18", t: "Post-treatment instructions given", s: "Verbal instructions documented in visit", ch: "In person" },
];

export function CommunicationTab({ p }: { p: Patient }) {
  const log = COMM_LOG;
  return (
    <div className="space-y-5">
      <Panel><PanelHeader title="Communication history" />
        <ul className="divide-y divide-line">{log.map((x) => <li key={x.d + x.t} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]"><span><span className="font-medium">{x.t}</span><br /><span className="text-muted">{x.s}</span></span><span className="text-right text-xs text-muted">{fmtDate(x.d)}<br />{x.ch}</span></li>)}</ul></Panel>
      <Alert tone="info" title="Messaging is not connected" action={<Link href="/practice/integrations"><Button size="sm" variant="secondary">Integrations</Button></Link>}>Sending SMS, email or campaign messages to {p.first} requires an approved integration (EVOQ Campaigns or Messaging). The history above is demo data.</Alert>
    </div>
  );
}
