"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal, Search, SlidersHorizontal, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, EmptyState, Input, Menu, MenuContent, MenuItem, MenuTrigger, PageHeader, Pagination, Panel, Select, SkeletonRows, Td, Th } from "@/components/ui";
import { PStatus } from "@/components/app/bits";
import { PatientAvatar } from "@/components/app/photos";
import { useUI } from "@/components/app/ui-state";
import { useAction, useAppointments, useFollowUps, usePatients, useRefs, useRole, useVisits } from "@/lib/hooks";
import { api, fmtDate, fmtTime, TODAY, addDays } from "@/lib/db";
import { money, patientFinancials } from "@/lib/clinical";

const PAGE = 8;
export default function PatientsPage() { return <Suspense><Patients /></Suspense>; }

function Patients() {
  const { data: patients, isLoading, isError, refetch } = usePatients();
  const { data: appts } = useAppointments();
  const { data: visits } = useVisits();
  const { data: fus } = useFollowUps();
  const { data: refs } = useRefs();
  const { can } = useRole();
  const ui = useUI(); const router = useRouter(); const params = useSearchParams();
  const start = useAction(api.startVisit);
  const [q, setQ] = useState("");
  const [f, setF] = useState({ status: "", provider: "", location: "", last: "", next: "", fu: "", tag: "" });
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const extra = [f.location, f.last, f.next, f.fu, f.tag].filter(Boolean).length;
  useEffect(() => { if (params.get("new")) { ui.newPatient(); router.replace("/patients"); } }, [params, ui, router]);

  const tags = [...new Set((patients ?? []).flatMap((p) => p.tags ?? []))].sort();
  const rows = useMemo(() => (patients ?? []).map((p) => {
    const last = (visits ?? []).filter((v) => v.patientId === p.id && v.status === "Completed").sort((a, b) => b.date.localeCompare(a.date))[0];
    const next = (appts ?? []).filter((a) => a.patientId === p.id && a.date >= TODAY && !["completed", "cancelled", "no_show"].includes(a.status)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
    const fuDue = (fus ?? []).some((x) => x.patientId === p.id && x.status === "Open" && x.due <= TODAY);
    const loc = (appts ?? []).find((a) => a.patientId === p.id)?.locationId;
    return { p, last: last?.date, next, fuDue, loc, bal: patientFinancials(p.id).outstanding };
  }).filter(({ p, last, next, fuDue, loc }) => {
    const s = q.toLowerCase();
    if (s && ![`${p.first} ${p.last}`, p.id, p.phone, p.email].some((x) => x.toLowerCase().includes(s))) return false;
    if (f.status && p.status !== f.status) return false;
    if (f.provider && p.providerId !== f.provider) return false;
    if (f.location && loc !== f.location) return false;
    if (f.tag && !(p.tags ?? []).includes(f.tag)) return false;
    if (f.fu === "due" && !fuDue) return false;
    if (f.last === "30" && !(last && last >= addDays(TODAY, -30))) return false;
    if (f.last === "old" && last && last >= addDays(TODAY, -30)) return false;
    if (f.next === "yes" && !next) return false;
    if (f.next === "no" && next) return false;
    return true;
  }), [patients, appts, visits, fus, q, f]);
  const pages = Math.ceil(rows.length / PAGE); const slice = rows.slice((page - 1) * PAGE, page * PAGE);
  useEffect(() => setPage(1), [q, f]);
  const active = (pid: string) => (appts ?? []).find((a) => a.patientId === pid && a.date === TODAY && ["scheduled", "confirmed", "arrived", "waiting", "in_progress"].includes(a.status));
  const begin = async (pid: string, prov?: string) => { const a = active(pid); if (!a) return ui.newVisit({ patientId: pid }); const v = await start.run(a.id); toast.success("Visit started"); router.push(`/visits/${v.id}`); };
  const actions = (p: (typeof rows)[number]["p"]) => (
    <Menu><MenuTrigger asChild><button aria-label={`Actions for ${p.first} ${p.last}`} className="rounded-md p-1.5 text-muted hover:bg-cloud" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="size-4" /></button></MenuTrigger>
      <MenuContent><MenuItem onSelect={() => router.push(`/patients/${p.id}`)}>Open patient</MenuItem><MenuItem onSelect={() => ui.newAppt({ patientId: p.id })}>Book appointment</MenuItem><MenuItem onSelect={() => begin(p.id, p.providerId)}>Start visit</MenuItem>
        <MenuItem onSelect={() => router.push(`/patients/${p.id}?tab=visits`)}>Add note (in a visit)</MenuItem>{can("photos") && <MenuItem onSelect={() => router.push(`/patients/${p.id}?tab=photos`)}>Upload photo</MenuItem>}</MenuContent></Menu>
  );

  return (
    <>
      <PageHeader title="Patients" subtitle={patients ? `${patients.length} patients` : undefined} actions={<Button onClick={ui.newPatient}><UserPlus className="size-4" />New patient</Button>} />
      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-56 flex-1 sm:max-w-xs"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden /><Input aria-label="Search patients" className="h-9 pl-9" placeholder="Search by name, ID, phone or email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select sm className="w-32" aria-label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">All statuses</option><option>Active</option><option>New</option><option>Inactive</option></Select>
          <Select sm className="w-36" aria-label="Provider" value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}><option value="">All providers</option>{refs?.providers.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}</Select>
          <Button size="sm" variant={more || extra ? "soft" : "secondary"} aria-expanded={more} onClick={() => setMore((m) => !m)}><SlidersHorizontal className="size-4" />Filters{extra ? ` (${extra})` : ""}</Button>
          {extra > 0 && <Button size="sm" variant="ghost" onClick={() => setF({ ...f, location: "", last: "", next: "", fu: "", tag: "" })}>Clear</Button>}
        </div>
        {more && <div className="anim-fade flex flex-wrap gap-2 border-b border-line bg-cloud/40 px-3 py-2.5">
          <Select sm className="w-40" aria-label="Location" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })}><option value="">All locations</option>{refs?.locations.map((l) => <option key={l.id} value={l.id}>{l.name.replace("Brightwell ", "")}</option>)}</Select>
          <Select sm className="w-36" aria-label="Last visit" value={f.last} onChange={(e) => setF({ ...f, last: e.target.value })}><option value="">Any last visit</option><option value="30">Within 30 days</option><option value="old">Over 30 days ago</option></Select>
          <Select sm className="w-40" aria-label="Upcoming appointment" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })}><option value="">Any upcoming</option><option value="yes">Has upcoming</option><option value="no">No upcoming</option></Select>
          <Select sm className="w-36" aria-label="Follow-up" value={f.fu} onChange={(e) => setF({ ...f, fu: e.target.value })}><option value="">Any follow-up</option><option value="due">Follow-up due</option></Select>
          <Select sm className="w-32" aria-label="Tag" value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })}><option value="">All tags</option>{tags.map((t) => <option key={t}>{t}</option>)}</Select>
        </div>}
        {isLoading ? <SkeletonRows rows={8} /> : isError ? <EmptyState title="Couldn't load patients" text="Check your connection and try again." action={<Button variant="secondary" onClick={() => refetch()}>Try again</Button>} />
          : rows.length === 0 ? <EmptyState title="No patients found" text="Try another search or add a new patient." action={<Button onClick={ui.newPatient}>New patient</Button>} /> : (
          <>
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[960px]">
              <thead className="border-b border-line bg-cloud/50"><tr><Th>Patient</Th><Th>Contact</Th><Th>Preferred provider</Th><Th>Last visit</Th><Th>Next appointment</Th>{can("financials") && <Th>Balance</Th>}<Th>Status</Th><Th /></tr></thead>
              <tbody className="divide-y divide-line">{slice.map(({ p, last, next, bal }) => (
                <tr key={p.id} tabIndex={0} onClick={() => router.push(`/patients/${p.id}`)} onKeyDown={(e) => e.key === "Enter" && router.push(`/patients/${p.id}`)} className="cursor-pointer hover:bg-cloud/50 focus-visible:bg-cloud/50">
                  <Td><div className="flex items-center gap-3"><PatientAvatar id={p.id} name={`${p.first} ${p.last}`} size={38} /><div><p className="font-medium">{p.first} {p.last}</p><p className="text-xs text-muted">{p.id}</p>{(p.tags ?? []).length > 0 && <div className="mt-0.5 flex flex-wrap gap-1">{p.tags!.slice(0, 2).map((t) => <Badge key={t} tone={t === "VIP" ? "peach" : "lavender"} className="py-0 text-[11px]">{t}</Badge>)}</div>}</div></div></Td>
                  <Td><p>{p.phone}</p><p className="text-xs text-muted">{p.email}</p></Td><Td>{refs?.providers.find((x) => x.id === p.providerId)?.short ?? "—"}</Td>
                  <Td>{last ? fmtDate(last) : <span className="text-muted">—</span>}</Td><Td>{next ? `${next.date === TODAY ? "Today" : fmtDate(next.date)} · ${fmtTime(next.time)}` : <span className="text-muted">None</span>}</Td>
                  {can("financials") && <Td className={bal > 0 ? "font-medium text-[#9A6200]" : "text-muted"}>{bal > 0 ? money(bal) : "—"}</Td>}
                  <Td><PStatus s={p.status} /></Td><Td className="text-right">{actions(p)}</Td></tr>))}</tbody></table></div>
            <ul className="divide-y divide-line md:hidden">{slice.map(({ p, last, next }) => (
              <li key={p.id} className="flex items-center gap-1 pr-2"><button onClick={() => router.push(`/patients/${p.id}`)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"><PatientAvatar id={p.id} name={`${p.first} ${p.last}`} size={40} />
                <div className="min-w-0 flex-1"><p className="font-medium">{p.first} {p.last} <span className="text-xs font-normal text-muted">{p.id}</span></p><p className="text-xs text-muted">Last {last ? fmtDate(last) : "—"} · Next {next ? fmtDate(next.date) : "none"}</p></div><PStatus s={p.status} /></button>{actions(p)}</li>))}</ul>
            <Pagination page={page} pages={pages} onPage={setPage} total={rows.length} />
          </>)}
      </Panel>
    </>
  );
}
