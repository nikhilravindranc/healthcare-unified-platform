"use client";
import { CONSENT_LABEL, consentFromFlag } from "@/modules/comms/eligibility";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, ChevronDown, Minus, Pencil, Plus, ShieldAlert } from "lucide-react";
import { Badge, Button, EmptyState, Field, Input, Modal, Panel, PanelHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { PhotoThumb, PortraitField } from "@/components/app/photos";
import { CompareDialog } from "@/components/app/capture";
import { useUI } from "@/components/app/ui-state";
import { useAction, useAppointments, useBilling, useExtras, useFollowUps, usePhotos, useRefs, useRole, useTemplates, useVisits } from "@/lib/hooks";
import { COMM_LOG } from "./records";
import { PatientNotesPanel } from "./notes-tab";
import { api, fmtDate, fmtTime, TODAY } from "@/lib/db";
import { cn } from "@/lib/utils";
import { patientFinancials, SERVICE_CAPS } from "@/lib/clinical";
import { activePlan, consentOnFile, lastCompletedVisit, medicalHistory, nextAppointment, outstandingActions, planProgress, unsignedForms } from "@/lib/patient-overview";
import type { Patient, PatientAlert, PhotoAsset } from "@/lib/types";
import { ageOf } from "./shared";

export function EditPatientDialog({ p, open, onClose }: { p: Patient; open: boolean; onClose: () => void }) {
  const save = useAction(api.updatePatient, "Patient updated");
  const [v, setV] = useState({ first: p.first, last: p.last, phone: p.phone, email: p.email, address: p.address ?? "", gender: p.gender ?? "", referral: p.referral ?? "", marketingConsent: p.marketingConsent as boolean | undefined, portrait: p.portrait as string | undefined });
  const [err, setErr] = useState<Record<string, string>>({});
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!v.first.trim()) e.first = "First name is required"; if (!v.last.trim()) e.last = "Last name is required";
    if (!/^\S+@\S+\.\S+$/.test(v.email)) e.email = "Enter a valid email address"; if (v.phone.replace(/\D/g, "").length < 7) e.phone = "Enter a valid phone number";
    setErr(e); if (Object.keys(e).length) return;
    await save.run(p.id, { ...v, first: v.first.trim(), last: v.last.trim() }); onClose();
  };
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Edit patient" width={520}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.pending} onClick={submit}>Save changes</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><PortraitField value={v.portrait} onChange={(x) => setV({ ...v, portrait: x })} name={`${p.first} ${p.last}`} /></div>
        <Field label="First name" required error={err.first}><Input value={v.first} onChange={(e) => setV({ ...v, first: e.target.value })} /></Field>
        <Field label="Last name" required error={err.last}><Input value={v.last} onChange={(e) => setV({ ...v, last: e.target.value })} /></Field>
        <Field label="Phone" required error={err.phone}><Input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
        <Field label="Email" required error={err.email}><Input value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
        <Field label="Gender"><Select value={v.gender} onChange={(e) => setV({ ...v, gender: e.target.value })}><option value="">Not specified</option><option>Female</option><option>Male</option><option>Non-binary</option></Select></Field>
        <Field label="Referral source"><Select value={v.referral} onChange={(e) => setV({ ...v, referral: e.target.value })}>{["Website enquiry", "Patient referral", "Provider referral", "Social media", "Walk-in", "Other"].map((r) => <option key={r}>{r}</option>)}{v.referral && !["Website enquiry", "Patient referral", "Provider referral", "Social media", "Walk-in", "Other"].includes(v.referral) && <option>{v.referral}</option>}</Select></Field>
        <Field label="Address" className="sm:col-span-2"><Input value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Field label="Marketing consent (separate from treatment consent)" hint="Leave as Not recorded unless the patient has made a decision."><Select value={v.marketingConsent === undefined ? "" : v.marketingConsent ? "yes" : "no"} onChange={(e) => setV({ ...v, marketingConsent: e.target.value === "" ? undefined : e.target.value === "yes" })}><option value="">Not recorded</option><option value="yes">Granted</option><option value="no">Not granted (details unknown)</option></Select></Field></div>
      </div>
    </Modal>
  );
}

function AlertDialog({ p, open, onClose }: { p: Patient; open: boolean; onClose: () => void }) {
  const add = useAction(api.addAlert, "Alert added");
  const [v, setV] = useState({ type: "Allergy" as "Allergy" | "Medical" | "Skin" | "Other", description: "", severity: "Low" as "Low" | "Moderate" | "High" });
  const [err, setErr] = useState("");
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Add alert" description="Record only documented information. The author and date are saved with the alert."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={add.pending} onClick={async () => { if (!v.description.trim()) return setErr("Describe the alert"); await add.run(p.id, v); setV({ ...v, description: "" }); setErr(""); onClose(); }}>Add alert</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type"><Select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as typeof v.type })}><option>Allergy</option><option>Medical</option><option>Skin</option><option>Other</option></Select></Field>
          <Field label="Severity"><Select value={v.severity} onChange={(e) => setV({ ...v, severity: e.target.value as typeof v.severity })}><option>Low</option><option>Moderate</option><option>High</option></Select></Field>
        </div>
        <Field label="Description" required error={err}><Textarea value={v.description} onChange={(e) => { setV({ ...v, description: e.target.value }); setErr(""); }} /></Field>
      </div>
    </Modal>
  );
}

const SEV: Record<string, number> = { High: 0, Moderate: 1, Low: 2 };
/** The most relevant safety indicator first: highest severity, then newest. */
export const sortAlerts = (alerts: PatientAlert[]) => [...alerts].sort((a, b) => (SEV[a.severity ?? "Low"] ?? 3) - (SEV[b.severity ?? "Low"] ?? 3) || b.date.localeCompare(a.date));

function Status({ state, children }: { state: "ok" | "missing" | "note"; children: React.ReactNode }) {
  const Icon = state === "ok" ? Check : state === "missing" ? AlertCircle : Minus;
  return <span className="flex items-start gap-2"><Icon className={cn("mt-0.5 size-4 shrink-0", state === "ok" ? "text-[#2A8577]" : state === "missing" ? "text-[#9A6200]" : "text-slate-400")} aria-hidden /><span>{children}</span></span>;
}

export function OverviewTab({ p, goto }: { p: Patient; goto: (t: string) => void }) {
  const { data: visits } = useVisits();
  const { data: appts } = useAppointments();
  const { data: photos } = usePhotos();
  const { data: extras } = useExtras();
  const { data: tpls } = useTemplates();
  const { data: fus } = useFollowUps();
  const { data: refs } = useRefs();
  const { can } = useRole();
  useBilling();
  const ui = useUI();
  const router = useRouter();
  const tag = useAction(api.updatePatient);
  const finish = useAction(api.completeFollowUp, "Follow-up completed");
  const [edit, setEdit] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [newTag, setNewTag] = useState<string | null>(null);
  const [cmp, setCmp] = useState<[PhotoAsset, PhotoAsset] | null>(null);

  const myVisits = (visits ?? []).filter((v) => v.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const last = lastCompletedVisit(visits ?? [], p.id, TODAY);
  const next = nextAppointment(appts ?? [], p.id, TODAY);
  const nextService = refs?.services.find((s) => s.id === next?.serviceId)?.name;
  const nextProvider = refs?.providers.find((x) => x.id === next?.providerId)?.short;
  const nextRoom = refs?.rooms.find((r) => r.id === next?.roomId)?.name;
  const consentRequired = !!next && !!SERVICE_CAPS[next.serviceId]?.consent;
  const consent = consentOnFile(visits ?? [], extras?.documents ?? [], p.id);
  const history = medicalHistory(extras?.responses ?? [], tpls ?? [], p.id);
  const openForms = unsignedForms(visits ?? [], p.id);
  const alerts = sortAlerts(p.alerts ?? []);
  const plan = can("notes") ? activePlan(extras?.plans ?? [], p.id) : undefined;
  const prog = plan ? planProgress(plan) : null;
  const fin = patientFinancials(p.id);
  const actions = outstandingActions({ patientId: p.id, today: TODAY, followUps: fus ?? [], visits: visits ?? [], docs: extras?.documents ?? [], responses: extras?.responses ?? [], templates: tpls ?? [], nextAppt: next, consentRequired, balance: fin.outstanding, canSeeFinancials: can("financials") });
  const myPhotos = can("photos") ? (photos ?? []).filter((x) => x.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date)) : [];
  const front = myPhotos.filter((x) => x.view === "Front");
  const pair: [PhotoAsset, PhotoAsset] | null = (() => { const b = front.find((x) => x.stage === "Before"), a = front.find((x) => x.stage === "After"); return a && b ? [b, a] : null; })();
  const go = (a: (typeof actions)[number]) => ("tab" in a.go ? goto(a.go.tab) : router.push(a.go.href));
  const toneCls = { red: "bg-[#FBE9E9] text-[#8F2D2D]", peach: "bg-[#FFF3DF] text-[#7A4B00]", blue: "bg-[#E5F8FB] text-primary", neutral: "bg-cloud text-slate-600" } as const;

  return (
    <div className="@container space-y-5">
      {/* 1. Safety and missing information come first and stay at the top. */}
      <Panel className={alerts.length > 0 ? "border-[#F4DDAA]" : undefined} aria-label="Safety and medical information">
        <PanelHeader title="Safety and medical information" action={<button onClick={() => setAlertOpen(true)} className="flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"><Plus className="size-3.5" aria-hidden />Add alert</button>} />
        <div className="grid gap-4 p-4 @min-[760px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Alerts</p>
            {alerts.length === 0 ? <p className="text-[13px] text-muted">No alerts recorded. This does not mean the patient has none; confirm at intake.</p> : (
              <ul className="space-y-2">{alerts.map((a) => (
                <li key={a.id} className="flex gap-2.5 rounded-lg bg-[#FFF3DF] px-3 py-2 text-[13px]"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-[#9A6200]" aria-hidden />
                  <div><p className="font-medium">{a.type}: {a.description}{a.severity && <span className="ml-1.5 text-xs font-normal text-[#7A4B00]">({a.severity} severity)</span>}</p><p className="text-xs text-slate-600">{a.source} · {a.author} · {fmtDate(a.date)}</p></div></li>))}</ul>)}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Medical information on file</p>
            <ul className="space-y-2 text-[13px]">
              <li><Status state={history ? "ok" : "missing"}>{history ? <>Medical history: <span className="font-medium">{history.name}</span>, {fmtDate(history.date, true)}. {history.reviewed ? "Reviewed." : "Awaiting review."}</> : <>Medical history: <span className="font-medium">no form on file</span>. Ask the patient to complete one.</>}</Status></li>
              <li><Status state={consent ? "ok" : "missing"}>{consent ? <>Signed consent on file, {fmtDate(consent.date, true)}.</> : <>Signed consent: <span className="font-medium">none on file</span>.</>}</Status></li>
              <li><Status state={openForms.length ? "missing" : "note"}>{openForms.length ? <>{openForms.length} form{openForms.length === 1 ? "" : "s"} awaiting signature.</> : <>No forms awaiting signature.</>}</Status></li>
            </ul>
          </div>
        </div>
      </Panel>

      <div className="grid items-start gap-5 @min-[860px]:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column: next appointment, plan, recent care */}
        <div className="min-w-0 space-y-5">
          <Panel aria-label="Next appointment">
            <PanelHeader title="Next appointment" action={next ? <Button size="sm" variant="secondary" onClick={() => ui.openAppt(next.id)}>Open</Button> : <Button size="sm" variant="secondary" onClick={() => ui.newAppt({ patientId: p.id })}>Book appointment</Button>} />
            {!next ? <EmptyState title="No upcoming appointment" text="Nothing is booked. A booking is not attendance: it is only a planned time." /> : (
              <>
                <div className="flex flex-wrap items-center gap-4 p-4 text-[13px]">
                  <div className="rounded-lg bg-[#E5F8FB] px-3 py-2 text-center text-primary"><p className="text-[11px] uppercase">{new Date(next.date + "T12:00").toLocaleDateString("en-US", { month: "short" })}</p><p className="text-xl font-semibold leading-none">{Number(next.date.slice(8))}</p></div>
                  <div className="min-w-0 flex-1"><p className="text-[14px] font-semibold">{nextService}</p><p className="text-muted">{next.date === TODAY ? "Today" : fmtDate(next.date, true)}, {fmtTime(next.time)} · {nextProvider}{nextRoom ? ` · ${nextRoom}` : ""}</p></div>
                  <StatusBadge status={next.status} />
                </div>
                <div className="border-t border-line px-4 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Before this appointment</p>
                  <ul className="grid gap-x-6 gap-y-1.5 text-[13px] @min-[560px]:grid-cols-2">
                    <li><Status state={alerts.length ? "missing" : "note"}>{alerts.length ? <>Review {alerts.length} recorded alert{alerts.length === 1 ? "" : "s"}</> : <>No alerts recorded: confirm at intake</>}</Status></li>
                    {consentRequired && <li><Status state={consent ? "ok" : "missing"}>{consent ? <>Consent on file ({fmtDate(consent.date)})</> : <>Signed consent needed for this service</>}</Status></li>}
                    <li><Status state={history ? "ok" : "missing"}>{history ? <>Medical history on file ({fmtDate(history.date)})</> : <>Medical history form missing</>}</Status></li>
                    <li><Status state={last ? "ok" : "note"}>{last ? <>Last visit {fmtDate(last.date)}: {last.type}</> : <>No previous completed visit</>}</Status></li>
                  </ul>
                </div>
              </>)}
          </Panel>

          {plan && prog && (
            <Panel aria-label="Active treatment plan">
              <PanelHeader title="Active treatment plan" action={<button onClick={() => goto("history")} className="text-[13px] font-medium text-primary hover:underline">Manage plan</button>} />
              <div className="space-y-2 p-4 text-[13px]">
                <p className="text-[14px] font-semibold">{plan.name}</p>
                <div className="h-1.5 rounded-full bg-cloud" role="progressbar" aria-valuenow={prog.done} aria-valuemax={prog.total} aria-label={`${prog.done} of ${prog.total} plan steps completed`}><div className="h-full rounded-full bg-primary" style={{ width: `${(prog.done / Math.max(1, prog.total)) * 100}%` }} /></div>
                <p className="text-muted">{prog.done} of {prog.total} steps recorded as completed{prog.next ? <> · Next: {prog.next.title}{prog.next.date ? `, ${fmtDate(prog.next.date)}` : ""} ({prog.next.status.toLowerCase()})</> : ""}</p>
              </div>
            </Panel>)}

          <Panel aria-label="Last visit and recent care">
            <PanelHeader title="Last visit and recent care" action={<button onClick={() => goto("history")} className="text-[13px] font-medium text-primary hover:underline">Open care history</button>} />
            {myVisits.length === 0 ? <EmptyState title="No visits yet" text="Completed visits appear here." /> : (
              <ul className="divide-y divide-line">{myVisits.slice(0, 3).map((v, i) => (
                <li key={v.id}><button onClick={() => router.push(`/visits/${v.id}`)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] hover:bg-cloud/60">
                  <span className="w-24 shrink-0 text-muted">{v.date === TODAY ? "Today" : fmtDate(v.date, true)}</span>
                  <span className="min-w-0 flex-1"><span className="font-medium">{v.type}</span>{i === 0 && v.status === "Completed" && <span className="ml-2 text-xs text-muted">Last visit</span>}<span className="block truncate text-xs text-muted">{refs?.providers.find((x) => x.id === v.providerId)?.short}{v.reason ? ` · ${v.reason}` : ""}</span></span>
                  <Badge tone={v.status === "Completed" ? "mint" : "blue"}>{v.status}</Badge></button></li>))}</ul>)}
            {myPhotos.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
                <div className="flex gap-1.5">{myPhotos.slice(0, 4).map((ph) => <button key={ph.id} onClick={() => goto("photos")} aria-label={`${ph.stage} ${ph.view}, ${fmtDate(ph.date)}. Open photos`} className="relative"><PhotoThumb photo={ph} ar={1} className="size-12 rounded-md" /><span className="absolute inset-x-0 bottom-0 rounded-b-md bg-black/55 text-center text-[9px] font-medium text-white">{ph.stage}</span></button>)}</div>
                <div className="ml-auto flex items-center gap-3 text-[13px]">{pair && <button onClick={() => setCmp(pair)} className="font-medium text-primary hover:underline">Compare before and after</button>}<button onClick={() => goto("photos")} className="font-medium text-primary hover:underline">All photos ({myPhotos.length})</button></div>
              </div>)}
          </Panel>

          {can("notes") && <PatientNotesPanel p={p} />}
        </div>

        {/* Side column: what needs doing, and the patient's details */}
        <div className="space-y-5">
          <Panel aria-label="Needs action">
            <PanelHeader title="Needs action" sub={actions.length ? `${actions.length} item${actions.length === 1 ? "" : "s"}` : undefined} action={<button onClick={() => ui.newFollowUp({ patientId: p.id })} className="flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"><Plus className="size-3.5" aria-hidden />Follow-up</button>} />
            {actions.length === 0 ? <p className="p-4 text-[13px] text-muted">Nothing outstanding right now.</p> : (
              <ul className="divide-y divide-line">{actions.map((a) => (
                <li key={a.id + a.reason} className="px-4 py-2.5 text-[13px]">
                  <div className="flex items-start gap-2"><span className="min-w-0 flex-1"><span className="font-medium">{a.label}</span><span className={cn("ml-2 rounded px-1.5 py-0.5 text-[11px] font-medium", toneCls[a.tone])}>{a.reason}</span>
                    <span className="mt-0.5 block text-xs text-muted">{a.due ? `Due ${fmtDate(a.due, true)}` : ""}{a.due && a.owner ? " · " : ""}{a.owner ?? ""}</span></span>
                    <button onClick={() => go(a)} className="shrink-0 text-xs font-medium text-primary hover:underline">Open</button></div>
                  {a.id.startsWith("F-") || (fus ?? []).some((f) => f.id === a.id) ? <div className="mt-1.5 flex gap-1.5"><Button size="sm" variant="secondary" onClick={() => ui.newAppt({ patientId: p.id })}>Book next appointment</Button><Button size="sm" variant="soft" loading={finish.pending} onClick={() => finish.run(a.id)}>Complete</Button></div> : null}
                </li>))}</ul>)}
          </Panel>

          <Panel aria-label="Patient details">
            <PanelHeader title="Patient details" action={<button onClick={() => setEdit(true)} className="flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"><Pencil className="size-3.5" aria-hidden />Edit</button>} />
            <dl className="grid grid-cols-[104px_1fr] gap-y-2 p-4 text-[13px]">
              <dt className="text-muted">Phone</dt><dd>{p.phone}</dd>
              <dt className="text-muted">Email</dt><dd className="break-all">{p.email}</dd>
              <dt className="text-muted">Emergency</dt><dd>{p.emergency || "—"}</dd>
              <dt className="text-muted">Date of birth</dt><dd>{fmtDate(p.dob, true)} ({ageOf(p.dob)} years)</dd>
              <dt className="text-muted">Preferred provider</dt><dd>{refs?.providers.find((x) => x.id === p.providerId)?.name ?? "—"}</dd>
            </dl>
            <details className="group border-t border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-[13px] font-medium text-primary hover:bg-cloud/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">All details, tags and messages<ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden /></summary>
              <div className="space-y-4 px-4 pb-4 text-[13px]">
                <dl className="grid grid-cols-[104px_1fr] gap-y-2">
                  <dt className="text-muted">Gender</dt><dd>{p.gender || "Not specified"}</dd>
                  <dt className="text-muted">Address</dt><dd>{p.address || "—"}</dd>
                  <dt className="text-muted">Referral source</dt><dd>{p.referral || "—"}</dd>
                  <dt className="text-muted">Marketing consent</dt><dd><Badge tone={p.marketingConsent ? "mint" : "neutral"}>{CONSENT_LABEL[consentFromFlag(p.marketingConsent).status]}</Badge><span className="mt-0.5 block text-xs text-muted">Separate from treatment consent.</span></dd>
                </dl>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Tags</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(p.tags ?? []).length === 0 && <span className="text-muted">No tags</span>}
                    {(p.tags ?? []).map((t) => <Badge key={t} tone="lavender">{t}<button aria-label={`Remove tag ${t}`} className="ml-0.5 opacity-60 hover:opacity-100" onClick={() => tag.run(p.id, { tags: p.tags!.filter((x) => x !== t) })}>×</button></Badge>)}
                    {newTag === null ? <button onClick={() => setNewTag("")} className="rounded-md border border-dashed border-line px-2 py-0.5 text-xs text-muted hover:text-primary">+ Add tag</button>
                      : <form onSubmit={(e) => { e.preventDefault(); if (newTag.trim() && !(p.tags ?? []).includes(newTag.trim())) tag.run(p.id, { tags: [...(p.tags ?? []), newTag.trim()] }); setNewTag(null); }}><Input autoFocus aria-label="New tag" className="h-7 w-28 text-xs" value={newTag} onChange={(e) => setNewTag(e.target.value)} onBlur={() => setNewTag(null)} /></form>}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Messages (demo history)</p>
                  <ul className="space-y-1">{COMM_LOG.map((x) => <li key={x.d + x.t}><span className="font-medium">{x.t}</span><span className="block text-xs text-muted">{fmtDate(x.d)} · {x.ch}</span></li>)}</ul>
                  <p className="mt-1.5 text-xs text-muted">Messaging is not connected. This history is demo data.</p>
                </div>
              </div>
            </details>
          </Panel>
        </div>
      </div>

      <EditPatientDialog key={p.id + edit} p={p} open={edit} onClose={() => setEdit(false)} />
      <AlertDialog p={p} open={alertOpen} onClose={() => setAlertOpen(false)} />
      <CompareDialog open={!!cmp} onClose={() => setCmp(null)} a={cmp?.[0]} b={cmp?.[1]} />
    </div>
  );
}
