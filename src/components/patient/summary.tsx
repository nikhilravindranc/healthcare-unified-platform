"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Pencil, Plus } from "lucide-react";
import { Badge, Button, EmptyState, Field, Input, Modal, Panel, PanelHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { PhotoThumb, PortraitField } from "@/components/app/photos";
import { CompareDialog } from "@/components/app/capture";
import { useUI } from "@/components/app/ui-state";
import { useAction, useAppointments, useBilling, useExtras, usePhotos, useRefs, useRole, useVisits } from "@/lib/hooks";
import { COMM_LOG, FollowUpsTab } from "./records";
import { api, fmtDate, fmtTime, TODAY } from "@/lib/db";
import { money, patientFinancials } from "@/lib/clinical";
import type { Patient, PhotoAsset } from "@/lib/types";
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
        <div className="sm:col-span-2"><Field label="Marketing consent (separate from treatment consent)" hint="Leave as Not recorded unless the patient has made a decision."><Select value={v.marketingConsent === undefined ? "" : v.marketingConsent ? "yes" : "no"} onChange={(e) => setV({ ...v, marketingConsent: e.target.value === "" ? undefined : e.target.value === "yes" })}><option value="">Not recorded</option><option value="yes">Granted</option><option value="no">Not granted</option></Select></Field></div>
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

export function SummaryTab({ p, goto }: { p: Patient; goto: (t: string) => void }) {
  const { data: visits } = useVisits();
  const { data: appts } = useAppointments();
  const { data: photos } = usePhotos();
  const { data: billing } = useBilling();
  const { data: extras } = useExtras();
  const { data: refs } = useRefs();
  const { can } = useRole();
  const ui = useUI();
  const router = useRouter();
  const tag = useAction(api.updatePatient);
  const [edit, setEdit] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [newTag, setNewTag] = useState<string | null>(null);
  const [cmp, setCmp] = useState<[PhotoAsset, PhotoAsset] | null>(null);

  const myVisits = (visits ?? []).filter((v) => v.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const done = myVisits.filter((v) => v.status === "Completed");
  const upcoming = (appts ?? []).filter((a) => a.patientId === p.id && a.date >= TODAY && !["completed", "cancelled", "no_show"].includes(a.status)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const next = upcoming.find((a) => a.date > TODAY) ?? upcoming[0];
  const fin = patientFinancials(p.id);
  void billing;
  const myPhotos = (photos ?? []).filter((x) => x.patientId === p.id);
  const pairs = ["Front", "Close-up (eyes)", "Close-up (lips)"].map((view) => ({ view, b: myPhotos.filter((x) => x.view === view && x.stage === "Before").sort((a, c) => c.date.localeCompare(a.date))[0], a: myPhotos.filter((x) => x.view === view && x.stage === "After").sort((x, c) => c.date.localeCompare(x.date))[0] }));
  const treatments = done.filter((v) => v.treatments.length || v.plot.length).length;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        <dl className="grid grid-cols-2 divide-x divide-y divide-line overflow-hidden rounded-xl border border-line bg-white sm:grid-cols-5 sm:divide-y-0">
          {[["Total visits", String(done.length)], ["Treatments", String(treatments)], ...(can("financials") ? [["Total paid", money(fin.paid)], ["Outstanding", money(fin.outstanding)]] : []), ["Next appointment", next ? `${next.date === TODAY ? "Today" : fmtDate(next.date)}, ${fmtTime(next.time)}` : "None"]].map(([l, n]) => (
            <div key={l} className="px-4 py-3"><dd className="text-[17px] font-semibold">{n}</dd><dt className="text-xs text-muted">{l}</dt></div>))}
        </dl>
        <Panel>
          <PanelHeader title="Recent visits" action={<button onClick={() => goto("visits")} className="text-[13px] font-medium text-primary hover:underline">View all</button>} />
          {myVisits.length === 0 ? <EmptyState title="No visits yet" /> : (
            <table className="w-full text-[13px]"><thead className="border-b border-line bg-cloud/50 text-left text-xs text-muted"><tr><th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">Treatment</th><th className="px-4 py-2 font-medium">Provider</th><th className="px-4 py-2 font-medium">Status</th></tr></thead>
              <tbody className="divide-y divide-line">{myVisits.slice(0, 5).map((v) => (
                <tr key={v.id} tabIndex={0} className="cursor-pointer hover:bg-cloud/40" onClick={() => router.push(`/visits/${v.id}`)} onKeyDown={(e) => e.key === "Enter" && router.push(`/visits/${v.id}`)}>
                  <td className="px-4 py-2.5">{v.date === TODAY ? "Today" : fmtDate(v.date, true)}</td><td className="px-4 py-2.5">{v.type}{v.plot.length > 0 && can("notes") && <button onClick={(e) => { e.stopPropagation(); router.push(`/visits/${v.id}?tab=plotting`); }} className="ml-2 rounded-md bg-active px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-[#dcebf8]">Injection plot · {v.plot.length}</button>}</td><td className="px-4 py-2.5 text-muted">{refs?.providers.find((x) => x.id === v.providerId)?.short}</td>
                  <td className="px-4 py-2.5"><Badge tone={v.status === "Completed" ? "mint" : "blue"}>{v.status}</Badge></td></tr>))}</tbody></table>)}
        </Panel>
        {can("photos") && (
          <Panel>
            <PanelHeader title="Before & after" sub="Illustrative demo set" action={<button onClick={() => goto("photos")} className="text-[13px] font-medium text-primary hover:underline">View all</button>} />
            {pairs.every((x) => !x.b && !x.a) ? <EmptyState title="No photos yet" text="Capture a before photo during the next visit." action={<Button size="sm" onClick={() => goto("photos")}>Open photos</Button>} /> : (
              <div className="grid grid-cols-3 gap-3 p-4">
                {pairs.map(({ view, a, b }) => (
                  <figure key={view}>
                    <button disabled={!a || !b} onClick={() => a && b && setCmp([b, a])} className="grid w-full grid-cols-2 gap-px overflow-hidden rounded-lg border border-line text-left enabled:hover:ring-2 enabled:hover:ring-primary/40" aria-label={`Compare ${view}`}>
                      {b ? <PhotoThumb photo={b} ar={4 / 5} /> : <span className="grid aspect-[4/5] place-items-center bg-cloud text-[11px] text-muted">No before</span>}
                      {a ? <PhotoThumb photo={a} ar={4 / 5} /> : <span className="grid aspect-[4/5] place-items-center bg-cloud text-[11px] text-muted">No after</span>}
                    </button>
                    <figcaption className="mt-1 text-xs text-muted">{view}</figcaption>
                  </figure>))}
              </div>)}
          </Panel>
        )}
        {can("notes") && (extras?.plans ?? []).filter((x) => x.patientId === p.id && x.status === "Active").map((pl) => {
          const done = pl.steps.filter((x) => x.status === "Completed").length; const nextStep = pl.steps.find((x) => ["Scheduled", "Planned"].includes(x.status));
          return (
            <Panel key={pl.id}>
              <PanelHeader title="Treatment plan" action={<button onClick={() => goto("history")} className="text-[13px] font-medium text-primary hover:underline">Manage</button>} />
              <div className="space-y-2 p-4 text-[13px]"><p className="font-medium">{pl.name}</p><div className="h-1.5 rounded-full bg-cloud" role="progressbar" aria-valuenow={done} aria-valuemax={pl.steps.length} aria-label="Plan progress"><div className="h-full rounded-full bg-primary" style={{ width: `${(done / Math.max(1, pl.steps.length)) * 100}%` }} /></div>
                <p className="text-muted">{done} of {pl.steps.length} steps completed{nextStep ? ` · Next: ${nextStep.title}${nextStep.date ? `, ${fmtDate(nextStep.date)}` : ""}` : ""}</p></div>
            </Panel>);
        })}
        <Panel>
          <PanelHeader title="Next appointment" action={next && <button onClick={() => goto("visits")} className="text-[13px] font-medium text-primary hover:underline">View all</button>} />
          {!next ? <EmptyState title="No upcoming appointment" action={<Button size="sm" onClick={() => ui.newAppt({ patientId: p.id })}>Book appointment</Button>} /> : (
            <div className="flex flex-wrap items-center gap-4 p-4 text-[13px]">
              <div className="rounded-lg border border-line px-3 py-2 text-center"><p className="text-[11px] uppercase text-muted">{new Date(next.date + "T12:00").toLocaleDateString("en-US", { month: "short" })}</p><p className="text-xl font-semibold leading-none">{Number(next.date.slice(8))}</p></div>
              <div className="min-w-0 flex-1"><p className="font-medium">{refs?.services.find((s) => s.id === next.serviceId)?.name}</p><p className="text-muted">{fmtTime(next.time)} · {refs?.providers.find((x) => x.id === next.providerId)?.short} · {refs?.rooms.find((r) => r.id === next.roomId)?.name}</p></div>
              <StatusBadge status={next.status} /><Button size="sm" variant="secondary" onClick={() => ui.openAppt(next.id)}>Open</Button>
            </div>)}
        </Panel>
        <FollowUpsTab p={p} />
      </div>

      <div className="space-y-5">
        <Panel>
          <PanelHeader title="Patient information" action={<button onClick={() => setEdit(true)} className="flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"><Pencil className="size-3.5" />Edit</button>} />
          <dl className="grid grid-cols-[110px_1fr] gap-y-2 p-4 text-[13px]">
            <dt className="text-muted">Date of birth</dt><dd>{fmtDate(p.dob, true)} ({ageOf(p.dob)} years)</dd>
            <dt className="text-muted">Gender</dt><dd>{p.gender || "Not specified"}</dd>
            <dt className="text-muted">Phone</dt><dd>{p.phone}</dd>
            <dt className="text-muted">Email</dt><dd className="break-all text-primary">{p.email}</dd>
            <dt className="text-muted">Address</dt><dd>{p.address || "—"}</dd>
            <dt className="text-muted">Emergency</dt><dd>{p.emergency || "—"}</dd>
            <dt className="text-muted">Preferred provider</dt><dd>{refs?.providers.find((x) => x.id === p.providerId)?.name ?? "—"}</dd>
            <dt className="text-muted">Marketing consent</dt><dd><Badge tone={p.marketingConsent ? "mint" : "neutral"}>{p.marketingConsent === undefined ? "Not recorded" : p.marketingConsent ? "Yes" : "No"}</Badge></dd>
            <dt className="text-muted">Referral source</dt><dd>{p.referral || "—"}</dd>
          </dl>
        </Panel>
        <Panel>
          <PanelHeader title="Important information" action={<button onClick={() => setAlertOpen(true)} className="flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"><Plus className="size-3.5" />Add</button>} />
          {(p.alerts ?? []).length === 0 ? <p className="p-4 text-[13px] text-muted">No alerts recorded. This does not mean the patient has none; confirm at intake.</p> : (
            <ul className="divide-y divide-line">{p.alerts!.map((a) => (
              <li key={a.id} className="flex gap-2.5 px-4 py-3 text-[13px]"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#9A6200]" aria-hidden />
                <div><p className="font-medium">{a.type}: {a.description}</p><p className="text-xs text-muted">{a.severity ? `${a.severity} · ` : ""}{a.source} · {a.author} · {fmtDate(a.date)}</p></div></li>))}</ul>)}
        </Panel>
        <Panel>
          <PanelHeader title="Tags" />
          <div className="flex flex-wrap items-center gap-1.5 p-4">
            {(p.tags ?? []).length === 0 && <span className="text-[13px] text-muted">No tags</span>}
            {(p.tags ?? []).map((t) => <Badge key={t} tone={t === "VIP" ? "peach" : "lavender"}>{t}<button aria-label={`Remove ${t}`} className="ml-0.5 opacity-60 hover:opacity-100" onClick={() => tag.run(p.id, { tags: p.tags!.filter((x) => x !== t) })}>×</button></Badge>)}
            {newTag === null ? <button onClick={() => setNewTag("")} className="rounded-md border border-dashed border-line px-2 py-0.5 text-xs text-muted hover:text-primary">+ Add tag</button>
              : <form onSubmit={(e) => { e.preventDefault(); if (newTag.trim() && !(p.tags ?? []).includes(newTag.trim())) tag.run(p.id, { tags: [...(p.tags ?? []), newTag.trim()] }); setNewTag(null); }}><Input autoFocus aria-label="New tag" className="h-7 w-28 text-xs" value={newTag} onChange={(e) => setNewTag(e.target.value)} onBlur={() => setNewTag(null)} /></form>}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Communication" action={<Link href="/practice/settings?s=integrations" className="text-[13px] font-medium text-primary hover:underline">Connect</Link>} />
          <ul className="divide-y divide-line">{COMM_LOG.slice(0, 2).map((x) => <li key={x.d + x.t} className="px-4 py-2.5 text-[13px]"><span className="font-medium">{x.t}</span><span className="block text-xs text-muted">{fmtDate(x.d)} · {x.ch}</span></li>)}</ul>
          <p className="border-t border-line px-4 py-2 text-xs text-muted">Messaging is not connected. History is demo data.</p>
        </Panel>
      </div>


      <EditPatientDialog key={p.id + edit} p={p} open={edit} onClose={() => setEdit(false)} />
      <AlertDialog p={p} open={alertOpen} onClose={() => setAlertOpen(false)} />
      <CompareDialog open={!!cmp} onClose={() => setCmp(null)} a={cmp?.[0]} b={cmp?.[1]} />
    </div>
  );
}
