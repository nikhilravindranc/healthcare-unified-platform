"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Alert, Badge, Button, Checkbox, Field, Input, Panel, PanelHeader, Select, Td, Textarea, Th } from "@/components/ui";
import { Denied } from "@/components/patient/shared";
import { CLINIC_CONFIG, CLINIC_TYPES, logAudit, PERMS, ROLE_PERMS, saveClinic, saveRolePerms, type ClinicType, type PermKey, type Role } from "@/lib/clinical";
import { saveSettings, useSettings, type Settings } from "@/lib/settings";
import { agents } from "@/lib/insight";
import { useAudit, useRole } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const GROUPS: [string, string[]][] = [
  ["Practice", ["profile", "locations", "people", "rooms"]], ["Clinical", ["services", "clinical", "forms", "photos", "records", "inventory"]],
  ["Operations", ["appointments", "billing", "notifications"]], ["Access and AI", ["roles", "agents", "integrations", "security"]], ["You", ["personal"]],
];
const SECTIONS: { id: string; label: string; link?: string }[] = [
  { id: "profile", label: "Practice profile" }, { id: "locations", label: "Locations", link: "/practice/locations" }, { id: "people", label: "Providers & users", link: "/practice/team?v=users" },
  { id: "roles", label: "Roles & permissions" }, { id: "services", label: "Services & treatments", link: "/practice/services" }, { id: "appointments", label: "Appointments" },
  { id: "rooms", label: "Rooms & resources", link: "/practice/locations" }, { id: "records", label: "Patient records" }, { id: "clinical", label: "Clinical templates" },
  { id: "forms", label: "Forms & consent", link: "/practice/forms" }, { id: "photos", label: "Photos & privacy" }, { id: "inventory", label: "Inventory", link: "/practice/inventory" },
  { id: "billing", label: "Billing & taxes" }, { id: "notifications", label: "Notifications" }, { id: "agents", label: "EVI & agents" }, { id: "integrations", label: "Integrations", link: "/practice/integrations" },
  { id: "security", label: "Security & audit" }, { id: "personal", label: "Personal preferences" },
];
const COUNTRIES = ["United States", "Canada", "United Kingdom", "India", "Australia", "United Arab Emirates", "Other"];
const ZONES = ["America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "America/Toronto", "Europe/London", "Asia/Kolkata", "Australia/Sydney"];

function Block({ title, desc, onSave, children, dirty }: { title: string; desc?: string; onSave: () => void; children: React.ReactNode; dirty: boolean }) {
  return (
    <Panel><PanelHeader title={title} sub={desc} action={<Button size="sm" disabled={!dirty} onClick={onSave}>Save changes</Button>} /><div className="space-y-4 p-4">{children}</div></Panel>
  );
}

export function SettingsSection() {
  const { can } = useRole();
  const params = useSearchParams(); const router = useRouter();
  const s = useSettings();
  const sec = params.get("s") ?? "profile";
  const [d, setD] = useState<Partial<Settings>>({});
  const v = { ...s, ...d } as Settings;
  const set = (p: Partial<Settings>) => setD({ ...d, ...p });
  const dirty = Object.keys(d).length > 0;
  const save = (label: string) => { saveSettings(d); if (d.clinicType) saveClinic(d.clinicType); logAudit("Meera Iyer", "Changed settings", `${label}: ${Object.keys(d).join(", ")}`); setD({}); toast.success(`${label} saved`); };
  if (!can("settings")) return <Denied what="settings" />;
  const cur = SECTIONS.find((x) => x.id === sec) ?? SECTIONS[0];
  const go = (id: string) => { setD({}); router.replace(`/practice/settings?s=${id}`, { scroll: false }); };

  return (
    <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="flex gap-3 overflow-x-auto lg:flex-col lg:gap-4 lg:overflow-visible">
        {GROUPS.map(([g, ids]) => (
          <div key={g} className="flex gap-1 lg:flex-col">
            <p className="hidden px-3 pb-0.5 text-[11px] font-medium uppercase tracking-wider text-muted lg:block">{g}</p>
            {ids.map((id) => { const x = SECTIONS.find((y) => y.id === id)!; return x.link ? <Link key={x.id} href={x.link} className="flex items-center justify-between whitespace-nowrap rounded-lg px-3 py-1.5 text-[13.5px] font-medium text-slate-600 hover:bg-cloud">{x.label}<ExternalLink className="size-3.5 text-muted" aria-hidden /></Link>
              : <button key={x.id} onClick={() => go(x.id)} aria-current={x.id === sec ? "page" : undefined} className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-[13.5px] font-medium", x.id === sec ? "bg-active text-primary" : "text-slate-600 hover:bg-cloud")}>{x.label}</button>; })}
          </div>))}
      </nav>
      <div className="min-w-0 space-y-4">
        {sec === "profile" && <Block title="Practice profile" desc="Clinic type changes defaults, terminology, templates and visit tabs. Shared core features stay available." dirty={dirty} onSave={() => save("Practice profile")}>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Practice name"><Input value={v.clinicName} onChange={(e) => set({ clinicName: e.target.value })} /></Field><Field label="Phone"><Input value={v.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
            <Field label="Clinic type"><Select value={v.clinicType} onChange={(e) => set({ clinicType: e.target.value as ClinicType })}>{CLINIC_TYPES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Country / region"><Select value={v.country} onChange={(e) => set({ country: e.target.value })}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Time zone"><Select value={v.timezone} onChange={(e) => set({ timezone: e.target.value })}>{ZONES.map((c) => <option key={c}>{c}</option>)}</Select></Field><Field label="Currency"><Select value={v.currency} onChange={(e) => set({ currency: e.target.value })}>{["USD", "CAD", "GBP", "INR", "AUD", "AED"].map((c) => <option key={c}>{c}</option>)}</Select></Field></div>
          <div className="rounded-lg bg-cloud/70 p-3 text-[13px]"><p className="font-medium">{v.clinicType}</p><p className="text-muted">{CLINIC_CONFIG[v.clinicType].emphasis}</p><p className="mt-1 text-muted">{CLINIC_CONFIG[v.clinicType].capabilityHint}</p></div>
          <Alert tone="info">Logo upload and display branding are not available in this demo. The EVOQ logo is used throughout.</Alert></Block>}

        {sec === "roles" && <Panel><PanelHeader title="Roles & permissions" sub="Least privilege. Owner always has full access." />
          <div className="overflow-x-auto"><table className="w-full min-w-[640px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>Permission</Th>{(Object.keys(ROLE_PERMS) as Role[]).map((r) => <Th key={r}>{r}</Th>)}</tr></thead>
            <tbody className="divide-y divide-line">{PERMS.map(([k, l]) => <tr key={k}><Td className="font-medium">{l}</Td>{(Object.keys(ROLE_PERMS) as Role[]).map((r) => <Td key={r}><input type="checkbox" aria-label={`${r}: ${l}`} disabled={r === "Owner"} checked={ROLE_PERMS[r].includes(k as PermKey)} onChange={(e) => { ROLE_PERMS[r] = e.target.checked ? [...ROLE_PERMS[r], k as PermKey] : ROLE_PERMS[r].filter((x) => x !== k); saveRolePerms(); logAudit("Meera Iyer", "Changed permission", `${r}: ${l} → ${e.target.checked ? "allowed" : "removed"}`); toast.success("Permission updated"); }} /></Td>)}</tr>)}</tbody></table></div>
          <p className="border-t border-line p-3 text-xs text-muted">Use the account menu, View as role, to see how each role experiences the app.</p></Panel>}

        {sec === "appointments" && <Block title="Appointments" dirty={dirty} onSave={() => save("Appointments")}>
          <div className="grid gap-4 sm:grid-cols-3"><Field label="Opens"><Input type="time" value={v.openTime} onChange={(e) => set({ openTime: e.target.value })} /></Field><Field label="Closes"><Input type="time" value={v.closeTime} onChange={(e) => set({ closeTime: e.target.value })} /></Field><Field label="Default duration (min)"><Input type="number" min={5} value={v.defaultDuration} onChange={(e) => set({ defaultDuration: Number(e.target.value) })} /></Field>
            <Field label="Buffer between visits (min)"><Input type="number" min={0} value={v.bufferMin} onChange={(e) => set({ bufferMin: Number(e.target.value) })} /></Field><Field label="Late cancellation window (hours)"><Input type="number" min={0} value={v.cancelHours} onChange={(e) => set({ cancelHours: Number(e.target.value) })} /></Field><Field label="No-show rule"><Input value={v.noShowPolicy} onChange={(e) => set({ noShowPolicy: e.target.value })} /></Field></div>
          <Checkbox checked={v.reminders} onChange={(c) => set({ reminders: c })} label="Send appointment reminders (needs a connected messaging integration)" /><Checkbox checked={v.confirmRequests} onChange={(c) => set({ confirmRequests: c })} label="Ask patients to confirm" />
          <p className="text-xs text-muted">Working hours are enforced when booking: times outside them show a warning.</p></Block>}

        {sec === "records" && <Block title="Patient records" dirty={dirty} onSave={() => save("Patient records")}>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Patient ID prefix"><Input value={v.idPrefix} onChange={(e) => set({ idPrefix: e.target.value })} /></Field></div>
          <Checkbox checked={v.dobRequired} onChange={(c) => set({ dobRequired: c })} label="Date of birth is required when creating a patient" /><Checkbox checked={v.phoneRequired} onChange={(c) => set({ phoneRequired: c })} label="Phone is required" /><Checkbox checked={v.emailRequired} onChange={(c) => set({ emailRequired: c })} label="Email is required" />
          <Field label="Referral sources" hint="Comma separated"><Textarea value={v.referralSources} onChange={(e) => set({ referralSources: e.target.value })} /></Field><Field label="Tags" hint="Comma separated"><Input value={v.tagList} onChange={(e) => set({ tagList: e.target.value })} /></Field><Field label="Alert types" hint="Comma separated"><Input value={v.alertTypes} onChange={(e) => set({ alertTypes: e.target.value })} /></Field></Block>}

        {sec === "clinical" && <Panel><PanelHeader title="Clinical templates" sub={`Defaults for ${v.clinicType}`} />
          <div className="space-y-4 p-4 text-[13px]"><div><p className="font-medium">Note templates</p><p className="text-muted">Standard visit note · Injectable treatment note · Follow-up note · Physiotherapy session</p></div>
            <div><p className="font-medium">Photo checklist</p><p className="text-muted">{CLINIC_CONFIG[v.clinicType].photoChecklist.join(", ") || "Not used for this clinic type"}</p></div>
            <div><p className="font-medium">Visit tabs</p><div className="mt-1 flex flex-wrap gap-1.5">{Object.entries(CLINIC_CONFIG[v.clinicType].tabs).map(([k, on]) => <Badge key={k} tone={on ? "mint" : "neutral"}>{k}{on ? "" : " (off)"}</Badge>)}</div></div>
            <p className="text-muted">Per-service requirements (consent, before photo, plotting) are set on each service under Services &amp; treatments. Aftercare and follow-up templates are provider-approved text inserted from the visit notes.</p></div></Panel>}

        {sec === "photos" && <Block title="Photos & privacy" dirty={dirty} onSave={() => save("Photos & privacy")}>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Maximum file size (MB)"><Input type="number" min={1} max={25} value={v.maxPhotoMB} onChange={(e) => set({ maxPhotoMB: Number(e.target.value) })} /></Field><Field label="Retention (years)" hint="Verify regional requirements before relying on this."><Input type="number" min={1} value={v.photoRetentionYears} onChange={(e) => set({ photoRetentionYears: Number(e.target.value) })} /></Field></div>
          <Checkbox checked={v.photoConsentRequired} onChange={(c) => set({ photoConsentRequired: c })} label="Record photography consent with each photo" /><p className="text-xs text-muted">Allowed types: JPG, PNG, WebP. Access follows the Photos permission in Roles &amp; permissions.</p></Block>}

        {sec === "billing" && <Block title="Billing & taxes" dirty={dirty} onSave={() => save("Billing & taxes")}>
          <div className="grid gap-4 sm:grid-cols-3"><Field label="Default tax rate (%)" hint="Must match your jurisdiction."><Input type="number" min={0} step="0.01" value={v.taxRate} onChange={(e) => set({ taxRate: Number(e.target.value) })} /></Field><Field label="Invoice prefix"><Input value={v.invoicePrefix} onChange={(e) => set({ invoicePrefix: e.target.value })} /></Field><Field label="Payment due (days)"><Input type="number" min={0} value={v.dueDays} onChange={(e) => set({ dueDays: Number(e.target.value) })} /></Field></div>
          <Field label="Payment methods"><Input value={v.paymentMethods} onChange={(e) => set({ paymentMethods: e.target.value })} /></Field><Field label="Financial source of truth"><Input value={v.billingOwner} readOnly /></Field></Block>}

        {sec === "notifications" && <Block title="Notifications" dirty={dirty} onSave={() => save("Notifications")}>
          <Field label="Alert when a patient has waited (minutes)"><Input className="max-w-40" type="number" min={1} value={v.notifyWaitMin} onChange={(e) => set({ notifyWaitMin: Number(e.target.value) })} /></Field>
          <Checkbox checked={v.notifyAssignments} onChange={(c) => set({ notifyAssignments: c })} label="In-app: follow-up assignments and operational alerts" /><Checkbox checked={v.notifyEmail} onChange={(c) => set({ notifyEmail: c })} label="Email (requires a connected provider)" /><Checkbox checked={v.notifySms} onChange={(c) => set({ notifySms: c })} label="SMS (requires a connected provider)" /></Block>}

        {sec === "agents" && <Panel><PanelHeader title="EVI & agents" sub="Agents surface items for review. They never change records without a person approving." />
          <ul className="divide-y divide-line">{[...agents.map((a) => ({ id: a.id, name: a.name, soon: false, desc: a.description })), { id: "engagement", name: "Patient Engagement Agent", soon: true, desc: "Needs a connected engagement tool." }, { id: "scribe", name: "AI Scribe", soon: true, desc: "Future capability. Drafts would require provider review." }, { id: "receptionist", name: "AI Receptionist", soon: true, desc: "Future capability. Not live." }].map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-4 px-4 py-3"><div><p className="text-[13.5px] font-medium">{a.name}{a.soon && <Badge className="ml-2">Not available yet</Badge>}</p><p className="text-xs text-muted">{a.desc}</p></div>
              <Checkbox checked={!!v.agents[a.id] && !a.soon} onChange={(c) => { if (a.soon) return; saveSettings({ agents: { ...s.agents, [a.id]: c } }); logAudit("Meera Iyer", c ? "Enabled agent" : "Disabled agent", a.name); toast.success(`${a.name} ${c ? "enabled" : "disabled"}`); }} label={<span className="sr-only">{a.name} enabled</span>} /></li>))}</ul></Panel>}

        {sec === "security" && <SecurityBlock v={v} set={set} dirty={dirty} onSave={() => save("Security")} />}
        {sec === "personal" && <Personal />}
        <p className="text-xs text-muted">{cur.label}. Changes are written to the audit log. This demo stores settings in your browser.</p>
      </div>
    </div>
  );
}

function SecurityBlock({ v, set, dirty, onSave }: { v: Settings; set: (p: Partial<Settings>) => void; dirty: boolean; onSave: () => void }) {
  const { data } = useAudit(); const { can } = useRole();
  const exportCsv = () => { const csv = ["time,who,action,target", ...(data ?? []).map((a) => `${a.at},"${a.who}","${a.action}","${a.target}"`)].join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const el = document.createElement("a"); el.href = url; el.download = "audit-log.csv"; el.click(); URL.revokeObjectURL(url); toast.success("Audit log exported"); };
  return (<>
    <Block title="Security" dirty={dirty} onSave={onSave}><Checkbox checked={v.mfa} onChange={(c) => set({ mfa: c })} label="Require two-step verification for staff (not enforced in this demo)" /><Field label="Sign out after inactivity (minutes)"><Input className="max-w-40" type="number" min={5} value={v.sessionMinutes} onChange={(e) => set({ sessionMinutes: Number(e.target.value) })} /></Field>
      <Alert tone="info">Regional privacy, retention and compliance requirements must be verified for your deployment. A setting here is not a compliance claim.</Alert></Block>
    <Panel><PanelHeader title="Audit log" sub="Sensitive changes, refunds, permissions and AI actions" action={can("exports") ? <Button size="sm" variant="secondary" onClick={exportCsv}><Download className="size-4" />Export</Button> : undefined} />
      <div className="overflow-x-auto"><table className="w-full min-w-[560px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>Time</Th><Th>Who</Th><Th>Action</Th><Th>Target</Th></tr></thead><tbody className="divide-y divide-line">{(data ?? []).slice(0, 25).map((a) => <tr key={a.id}><Td className="whitespace-nowrap">{a.at.replace("T", " ")}</Td><Td>{a.who}</Td><Td>{a.action}</Td><Td className="text-muted">{a.target}</Td></tr>)}</tbody></table></div></Panel>
  </>);
}
function Personal() {
  const [p, setP] = useState(() => { try { return JSON.parse(localStorage.getItem("pms.prefs") ?? "null") ?? { language: "English", tz: "America/Los_Angeles", emailDigest: true, inApp: true }; } catch { return { language: "English", tz: "America/Los_Angeles", emailDigest: true, inApp: true }; } });
  return (
    <Panel><PanelHeader title="Personal preferences" action={<Button size="sm" onClick={() => { try { localStorage.setItem("pms.prefs", JSON.stringify(p)); } catch {} toast.success("Preferences saved"); }}>Save changes</Button>} />
      <div className="space-y-4 p-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Language"><Select value={p.language} onChange={(e) => setP({ ...p, language: e.target.value })}><option>English</option></Select></Field><Field label="Time zone"><Select value={p.tz} onChange={(e) => setP({ ...p, tz: e.target.value })}>{ZONES.map((z) => <option key={z}>{z}</option>)}</Select></Field></div>
        <Checkbox checked={p.inApp} onChange={(c) => setP({ ...p, inApp: c })} label="In-app notifications" /><Checkbox checked={p.emailDigest} onChange={(c) => setP({ ...p, emailDigest: c })} label="Daily email summary" /><p className="text-xs text-muted">Appearance follows light mode in this version.</p></div></Panel>
  );
}
