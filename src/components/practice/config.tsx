"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Alert, Badge, Button, Checkbox, EmptyState, Field, Input, Panel, PanelHeader, Select, Sheet, SkeletonRows, Td, Textarea, Th } from "@/components/ui";
import { CAPABILITIES, CLINIC_CONFIG, ROLE_PERMS, SERVICE_CAPS, SERVICE_PRICE, money, type Role } from "@/lib/clinical";
import { api } from "@/lib/db";
import { useAction, useRefs, useRole } from "@/lib/hooks";
import { useSettings } from "@/lib/settings";
import type { Location, Provider, Room, Service } from "@/lib/types";

export function MultiCheck({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset><legend className="mb-1.5 text-[13px] font-medium">{label}</legend>
      <div className="grid gap-1.5 sm:grid-cols-2">{options.map((o) => <Checkbox key={o.value} checked={value.includes(o.value)} onChange={(c) => onChange(c ? [...value, o.value] : value.filter((x) => x !== o.value))} label={o.label} />)}</div></fieldset>
  );
}
const tone = (s: string) => (s === "Active" || s === "Open" ? "mint" : s === "Invited" || s === "On leave" ? "peach" : "neutral") as "mint" | "peach" | "neutral";

function Shell({ title, action, loading, empty, children, note }: { title: string; action?: React.ReactNode; loading?: boolean; empty?: boolean; children: React.ReactNode; note?: React.ReactNode }) {
  return <><Panel><PanelHeader title={title} action={action} />{loading ? <SkeletonRows rows={4} /> : empty ? <EmptyState title="Nothing configured yet" /> : <div className="overflow-x-auto">{children}</div>}</Panel>{note && <p className="mt-3 text-xs text-muted">{note}</p>}</>;
}
const useDeny = () => { const { can } = useRole(); return !can("settings"); };

/* ---------- Providers ---------- */
export function ProvidersSection() {
  const { data, isLoading } = useRefs(); const deny = useDeny();
  const [edit, setEdit] = useState<Partial<Provider> | null>(null);
  return (<>
    <Shell title="Providers" loading={isLoading} action={!deny && <Button size="sm" onClick={() => setEdit({ status: "Active", locationIds: [], serviceIds: [], hours: "Mon–Fri · 9:00 AM–5:00 PM" })}><Plus className="size-4" />New provider</Button>}>
      <table className="w-full min-w-[820px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>Provider</Th><Th>Specialty</Th><Th>Availability</Th><Th>Services</Th><Th>Locations</Th><Th>Status</Th></tr></thead>
        <tbody className="divide-y divide-line">{data?.providers.map((p) => <tr key={p.id} tabIndex={0} className={deny ? "" : "cursor-pointer hover:bg-cloud/40"} onClick={() => !deny && setEdit(p)} onKeyDown={(e) => e.key === "Enter" && !deny && setEdit(p)}><Td><span className="font-medium">{p.name}</span><span className="block text-xs text-muted">{p.title ?? "Provider"}</span></Td><Td>{p.specialty}</Td><Td>{p.hours}</Td><Td>{p.serviceIds.length} services</Td><Td>{p.locationIds.map((l) => data.locations.find((x) => x.id === l)?.name.replace("Brightwell ", "")).join(", ")}</Td><Td><Badge tone={tone(p.status)}>{p.status}</Badge></Td></tr>)}</tbody></table>
    </Shell>
    {edit && data && <ProviderSheet p={edit} onClose={() => setEdit(null)} />}
  </>);
}
function ProviderSheet({ p, onClose }: { p: Partial<Provider>; onClose: () => void }) {
  const { data } = useRefs(); const save = useAction(api.saveConfig, "Provider saved");
  const [v, setV] = useState<Partial<Provider>>(p); const [err, setErr] = useState<Record<string, string>>({});
  const submit = async () => {
    const e: Record<string, string> = {}; if (!v.name?.trim()) e.name = "Name is required"; if (!v.specialty?.trim()) e.specialty = "Specialty is required"; if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) e.email = "Enter a valid email address"; if (!(v.locationIds ?? []).length) e.loc = "Select at least one location";
    setErr(e); if (Object.keys(e).length) return; await save.run("providers", { ...v, short: v.name!.replace(/^Dr\.\s*\w+\s/, "Dr. ") }); onClose();
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={p.id ? "Edit provider" : "New provider"} width={480} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.pending} onClick={submit}>Save provider</Button></>}>
      <div className="space-y-4">
        <Field label="Name" required error={err.name}><Input value={v.name ?? ""} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Dr. First Last" /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Title / role"><Input value={v.title ?? ""} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field><Field label="Specialty" required error={err.specialty}><Input value={v.specialty ?? ""} onChange={(e) => setV({ ...v, specialty: e.target.value })} /></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Email" error={err.email}><Input value={v.email ?? ""} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field><Field label="Phone (optional)"><Input value={v.phone ?? ""} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field></div>
        <Field label="Working hours"><Input value={v.hours ?? ""} onChange={(e) => setV({ ...v, hours: e.target.value })} /></Field>
        <Field label="Time off"><Input value={v.timeOff ?? ""} onChange={(e) => setV({ ...v, timeOff: e.target.value })} placeholder="e.g. Oct 20 to Oct 24" /></Field>
        <Field label="Status"><Select value={v.status ?? "Active"} onChange={(e) => setV({ ...v, status: e.target.value as Provider["status"] })}><option>Active</option><option>On leave</option><option>Inactive</option></Select></Field>
        <div>{err.loc && <p role="alert" className="mb-1 text-xs text-danger">{err.loc}</p>}<MultiCheck label="Locations" options={(data?.locations ?? []).map((l) => ({ value: l.id, label: l.name }))} value={v.locationIds ?? []} onChange={(x) => setV({ ...v, locationIds: x })} /></div>
        <MultiCheck label="Permitted services" options={(data?.services ?? []).map((s) => ({ value: s.id, label: s.name }))} value={v.serviceIds ?? []} onChange={(x) => setV({ ...v, serviceIds: x })} />
      </div>
    </Sheet>
  );
}

/* ---------- Services & treatments ---------- */
export function ServicesSection() {
  const { data, isLoading } = useRefs(); const deny = useDeny(); const st = useSettings();
  const [edit, setEdit] = useState<Partial<Service> | null>(null);
  return (<>
    <Shell title="Services & treatments" loading={isLoading} action={!deny && <Button size="sm" onClick={() => setEdit({ status: "Active", duration: 30, providerIds: [], locationIds: [] })}><Plus className="size-4" />New service</Button>}
      note={`Clinic type: ${st.clinicType}. ${CLINIC_CONFIG[st.clinicType].capabilityHint}`}>
      <table className="w-full min-w-[860px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>Service</Th><Th>Category</Th><Th>Duration</Th><Th>Price</Th><Th>Providers</Th><Th>Capabilities</Th><Th>Status</Th></tr></thead>
        <tbody className="divide-y divide-line">{data?.services.map((s) => { const caps = SERVICE_CAPS[s.id]; return <tr key={s.id} tabIndex={0} className={deny ? "" : "cursor-pointer hover:bg-cloud/40"} onClick={() => !deny && setEdit(s)} onKeyDown={(e) => e.key === "Enter" && !deny && setEdit(s)}><Td className="font-medium">{s.name}</Td><Td>{s.category}</Td><Td>{s.duration} min</Td><Td>{money(SERVICE_PRICE[s.id] ?? 0)}</Td><Td>{s.providerIds.map((p) => data.providers.find((x) => x.id === p)?.short).join(", ") || "Unassigned"}</Td><Td>{caps ? <span className="text-xs text-muted">{CAPABILITIES.filter(([k]) => caps[k]).length} enabled</span> : <span className="text-xs text-muted">None</span>}</Td><Td><Badge tone={tone(s.status)}>{s.status}</Badge></Td></tr>; })}</tbody></table>
    </Shell>
    {edit && data && <ServiceSheet s={edit} onClose={() => setEdit(null)} />}
  </>);
}
function ServiceSheet({ s, onClose }: { s: Partial<Service>; onClose: () => void }) {
  const { data } = useRefs(); const save = useAction(api.saveConfig, "Service saved");
  const [v, setV] = useState<Partial<Service>>(s); const [price, setPrice] = useState(String(SERVICE_PRICE[s.id ?? ""] ?? "")); const [caps, setCaps] = useState(SERVICE_CAPS[s.id ?? ""] ?? Object.fromEntries(CAPABILITIES.map(([k]) => [k, false])) as Record<(typeof CAPABILITIES)[number][0], boolean>);
  const [err, setErr] = useState<Record<string, string>>({});
  const submit = async () => {
    const e: Record<string, string> = {}; if (!v.name?.trim()) e.name = "Name is required"; if (!(Number(v.duration) >= 5)) e.duration = "Duration must be at least 5 minutes"; if (price && !(Number(price) >= 0)) e.price = "Enter a valid price";
    setErr(e); if (Object.keys(e).length) return;
    const saved = await save.run("services", { ...v, duration: Number(v.duration), category: v.category || "Consultation" }) as { id: string };
    SERVICE_CAPS[saved.id] = caps; if (price) SERVICE_PRICE[saved.id] = Number(price); toast.success("Capabilities updated"); onClose();
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={s.id ? "Edit service" : "New service"} width={500} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.pending} onClick={submit}>Save service</Button></>}>
      <div className="space-y-4">
        <Field label="Name" required error={err.name}><Input value={v.name ?? ""} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Category"><Select value={v.category ?? "Consultation"} onChange={(e) => setV({ ...v, category: e.target.value })}>{["Consultation", "Aesthetics", "Dermatology", "Physiotherapy", "Dental", "Review", "Wellness"].map((c) => <option key={c}>{c}</option>)}</Select></Field><Field label="Specialty"><Input value={v.specialty ?? ""} onChange={(e) => setV({ ...v, specialty: e.target.value })} /></Field></div>
        <div className="grid grid-cols-3 gap-3"><Field label="Duration (min)" required error={err.duration}><Input type="number" value={v.duration ?? 30} onChange={(e) => setV({ ...v, duration: Number(e.target.value) })} /></Field><Field label="Price" error={err.price}><Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} /></Field><Field label="Status"><Select value={v.status ?? "Active"} onChange={(e) => setV({ ...v, status: e.target.value as Service["status"] })}><option>Active</option><option>Inactive</option></Select></Field></div>
        <Field label="Description"><Textarea value={v.description ?? ""} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
        <MultiCheck label="Eligible providers" options={(data?.providers ?? []).map((p) => ({ value: p.id, label: p.short }))} value={v.providerIds ?? []} onChange={(x) => setV({ ...v, providerIds: x })} />
        <MultiCheck label="Locations" options={(data?.locations ?? []).map((l) => ({ value: l.id, label: l.name }))} value={v.locationIds ?? []} onChange={(x) => setV({ ...v, locationIds: x })} />
        <div className="rounded-lg border border-line p-3"><p className="mb-2 text-[13px] font-medium">Capabilities for this service</p><p className="mb-2 text-xs text-muted">Only capabilities supported by your clinic type take effect. Required items block visit completion.</p>
          <div className="grid gap-1.5 sm:grid-cols-2">{CAPABILITIES.map(([k, l]) => <Checkbox key={k} checked={!!caps[k]} onChange={(c) => setCaps({ ...caps, [k]: c })} label={l} />)}</div></div>
      </div>
    </Sheet>
  );
}

/* ---------- Locations & rooms ---------- */
export function LocationsSection() {
  const { data, isLoading } = useRefs(); const deny = useDeny(); const [edit, setEdit] = useState<Partial<Location> | null>(null);
  return (<>
    <Shell title="Locations" loading={isLoading} action={!deny && <Button size="sm" onClick={() => setEdit({ status: "Open", timezone: "America/Los_Angeles" })}><Plus className="size-4" />New location</Button>}>
      <table className="w-full min-w-[720px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>Location</Th><Th>Address</Th><Th>Phone</Th><Th>Hours</Th><Th>Status</Th></tr></thead>
        <tbody className="divide-y divide-line">{data?.locations.map((l) => <tr key={l.id} tabIndex={0} className={deny ? "" : "cursor-pointer hover:bg-cloud/40"} onClick={() => !deny && setEdit(l)} onKeyDown={(e) => e.key === "Enter" && !deny && setEdit(l)}><Td className="font-medium">{l.name}</Td><Td>{l.address}</Td><Td>{l.phone}</Td><Td>{l.hours ?? "Mon–Fri · 8:30 AM–5:30 PM"}</Td><Td><Badge tone={tone(l.status)}>{l.status}</Badge></Td></tr>)}</tbody></table>
    </Shell>
    {edit && <EntitySheet title={edit.id ? "Edit location" : "New location"} kind="locations" value={edit} onClose={() => setEdit(null)} label="Location" required={["name", "address"]} fields={[["name", "Name"], ["address", "Address"], ["phone", "Phone"], ["timezone", "Time zone"], ["hours", "Opening hours"]]} statusOptions={["Open", "Closed"]} />}
  </>);
}
export function RoomsSection() {
  const { data, isLoading } = useRefs(); const deny = useDeny(); const [edit, setEdit] = useState<Partial<Room> | null>(null);
  return (<>
    <Shell title="Rooms & resources" loading={isLoading} action={!deny && <Button size="sm" onClick={() => setEdit({ locationId: "dt", type: "Consultation room", status: "Active" })}><Plus className="size-4" />New room</Button>}>
      <table className="w-full min-w-[720px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>Room</Th><Th>Location</Th><Th>Resource type</Th><Th>Capacity</Th><Th>Availability</Th><Th>Status</Th></tr></thead>
        <tbody className="divide-y divide-line">{data?.rooms.map((r) => <tr key={r.id} tabIndex={0} className={deny ? "" : "cursor-pointer hover:bg-cloud/40"} onClick={() => !deny && setEdit(r)} onKeyDown={(e) => e.key === "Enter" && !deny && setEdit(r)}><Td className="font-medium">{r.name}</Td><Td>{data.locations.find((l) => l.id === r.locationId)?.name}</Td><Td>{r.type}</Td><Td>{r.capacity ?? 1}</Td><Td>{r.availability}</Td><Td><Badge tone={tone(r.status ?? "Active")}>{r.status ?? "Active"}</Badge></Td></tr>)}</tbody></table>
    </Shell>
    {edit && <EntitySheet title={edit.id ? "Edit room" : "New room"} kind="rooms" value={edit} onClose={() => setEdit(null)} label="Room" required={["name"]} fields={[["name", "Name"], ["type", "Resource type"], ["capacity", "Capacity", "number"], ["availability", "Availability"]]} statusOptions={["Active", "Inactive"]} extra={(v, set) => <Field label="Location"><Select value={String(v.locationId ?? "dt")} onChange={(e) => set({ locationId: e.target.value })}>{data?.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>} />}
  </>);
}

function EntitySheet({ title, kind, value, onClose, label, required, fields, statusOptions, extra }: { title: string; kind: "locations" | "rooms" | "users"; value: Record<string, unknown>; onClose: () => void; label: string; required: string[]; fields: [string, string, string?][]; statusOptions: string[]; extra?: (v: Record<string, unknown>, set: (p: Record<string, unknown>) => void) => React.ReactNode }) {
  const save = useAction(api.saveConfig, `${label} saved`); const [v, setV] = useState<Record<string, unknown>>(value); const [err, setErr] = useState<Record<string, string>>({});
  const submit = async () => { const e: Record<string, string> = {}; required.forEach((k) => { if (!String(v[k] ?? "").trim()) e[k] = "Required"; }); if (kind === "users" && v.email && !/^\S+@\S+\.\S+$/.test(String(v.email))) e.email = "Enter a valid email address"; setErr(e); if (Object.keys(e).length) return; await save.run(kind, v as { id?: string }); onClose(); };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={title} width={440} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.pending} onClick={submit}>Save {label.toLowerCase()}</Button></>}>
      <div className="space-y-4">
        {fields.map(([k, l, t]) => <Field key={k} label={l} required={required.includes(k)} error={err[k]}><Input type={t ?? "text"} value={String(v[k] ?? "")} onChange={(e) => setV({ ...v, [k]: t === "number" ? Number(e.target.value) : e.target.value })} /></Field>)}
        {extra?.(v, (p) => setV({ ...v, ...p }))}
        <Field label="Status"><Select value={String(v.status ?? statusOptions[0])} onChange={(e) => setV({ ...v, status: e.target.value })}>{statusOptions.map((o) => <option key={o}>{o}</option>)}</Select></Field>
      </div>
    </Sheet>
  );
}

/* ---------- Users & permissions ---------- */
export function UsersSection() {
  const { data, isLoading } = useRefs(); const deny = useDeny(); const [edit, setEdit] = useState<Record<string, unknown> | null>(null);
  return (<>
    <Shell title="Users & permissions" loading={isLoading} action={!deny && <Button size="sm" onClick={() => setEdit({ role: "Staff", status: "Invited", locationIds: ["dt"] })}><Plus className="size-4" />Invite user</Button>} note="Roles control access to patient data, notes, photos, financials, refunds, inventory, reports, exports, settings and AI actions. Edit the matrix under Settings, Roles and permissions.">
      <table className="w-full min-w-[640px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>User</Th><Th>Role</Th><Th>Access</Th><Th>Status</Th></tr></thead>
        <tbody className="divide-y divide-line">{data?.users.map((u) => <tr key={u.id} tabIndex={0} className={deny ? "" : "cursor-pointer hover:bg-cloud/40"} onClick={() => !deny && setEdit(u as unknown as Record<string, unknown>)} onKeyDown={(e) => e.key === "Enter" && !deny && setEdit(u as unknown as Record<string, unknown>)}><Td><span className="font-medium">{u.name}</span><span className="block text-xs text-muted">{u.email}</span></Td><Td>{u.role}</Td><Td className="text-xs text-muted">{ROLE_PERMS[u.role as Role]?.length ?? 0} permissions</Td><Td><Badge tone={tone(u.status)}>{u.status}</Badge></Td></tr>)}</tbody></table>
    </Shell>
    {edit && <EntitySheet title={edit.id ? "Edit user" : "Invite user"} kind="users" value={edit} onClose={() => setEdit(null)} label="User" required={["name", "email"]} fields={[["name", "Full name"], ["email", "Email"]]} statusOptions={["Active", "Invited", "Inactive"]} extra={(v, set) => <Field label="Role"><Select value={String(v.role ?? "Staff")} onChange={(e) => set({ role: e.target.value })}>{Object.keys(ROLE_PERMS).map((r) => <option key={r}>{r}</option>)}</Select></Field>} />}
  </>);
}

export function Integrations() {
  const [apps, setApps] = useState(() => { try { return JSON.parse(localStorage.getItem("pms.integrations") ?? "null") ?? { Campaigns: false, Billing: false, Messaging: false }; } catch { return { Campaigns: false, Billing: false, Messaging: false }; } });
  useEffect(() => { try { localStorage.setItem("pms.integrations", JSON.stringify(apps)); } catch {} }, [apps]);
  const info: Record<string, string> = { Campaigns: "Outreach and recall messaging. Recall and Follow-up agents hand patient lists to Campaigns.", Billing: "Organisation-wide invoicing and reconciliation. When connected, it becomes the financial source of truth.", Messaging: "Two-way patient messaging and reminders." };
  return (
    <div className="space-y-4">
      <Alert tone="info" title="Connections are not live in this demo">The buttons below show how connection state would look. No data is sent to other EVOQ products until they are implemented and authorised.</Alert>
      <div className="grid gap-4 sm:grid-cols-2">{Object.keys(info).map((n) => (
        <Panel key={n} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">EVOQ {n}</p><p className="text-[13px] text-muted">{info[n]}</p><div className="mt-2 flex gap-2"><Badge tone={apps[n] ? "peach" : "neutral"}>{apps[n] ? "Marked connected (demo)" : "Not connected"}</Badge></div><p className="mt-1 text-xs text-muted">Last sync: never · Errors: none</p></div>
          <Button size="sm" variant="secondary" onClick={() => { setApps({ ...apps, [n]: !apps[n] }); toast(apps[n] ? `${n} disconnected` : `${n} marked connected (demo only)`); }}>{apps[n] ? "Disconnect" : "Connect"}</Button></div></Panel>))}</div>
    </div>
  );
}
