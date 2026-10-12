"use client";
import { useEffect, useMemo, useState } from "react";
import { Footprints, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button, EmptyState, Field, Input, Modal, Pagination, Panel, Select, SkeletonRows, StatusBadge, StatusDot, STATUS, Td, Th } from "@/components/ui";
import { ApptActions, PatientLink } from "./bits";
import { PatientAvatar } from "./photos";
import { useUI } from "./ui-state";
import { waitLabel } from "./panels";
import { useAction, useAppointments, useNow, usePatients, useRefs } from "@/lib/hooks";
import { api, fmtTime, getPatient, pname, TODAY } from "@/lib/db";
import type { ApptStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE = 8;
const STRIP: { label: string; statuses: ApptStatus[]; key: string }[] = [
  { key: "scheduled", label: "Scheduled", statuses: ["scheduled", "confirmed"] },
  { key: "arrived", label: "Arrived", statuses: ["arrived"] },
  { key: "waiting", label: "Waiting", statuses: ["waiting"] },
  { key: "in_progress", label: "In visit", statuses: ["in_progress"] },
  { key: "completed", label: "Completed", statuses: ["completed"] },
];

export function FlowBoard() {
  const { data: appts, isLoading, isError, refetch } = useAppointments();
  const { data: refs } = useRefs();
  const { data: patients } = usePatients();
  const ui = useUI();
  const now = useNow();
  const [filter, setFilter] = useState<string>("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [walk, setWalk] = useState(false);
  const [w, setW] = useState({ patientId: "", providerId: "pat", serviceId: "consult" });
  const [werr, setWerr] = useState("");
  const walkIn = useAction(api.walkIn);

  const today = useMemo(() => (appts ?? []).filter((a) => a.date === TODAY).sort((a, b) => a.time.localeCompare(b.time)), [appts]);
  const rows = today.filter((a) => {
    if (a.status === "cancelled" || a.status === "no_show") return false;
    const strip = STRIP.find((s) => s.key === filter);
    if (strip && !strip.statuses.includes(a.status)) return false;
    return !q || pname(a.patientId).toLowerCase().includes(q.toLowerCase()) || a.patientId.toLowerCase().includes(q.toLowerCase());
  });
  useEffect(() => setPage(1), [filter, q]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const slice = rows.slice((Math.min(page, pages) - 1) * PAGE, Math.min(page, pages) * PAGE);
  const services = refs?.services.filter((s) => s.providerIds.includes(w.providerId)) ?? [];
  const hidden = today.filter((a) => a.status === "cancelled" || a.status === "no_show").length;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Patient flow for today. Actions change with each status.</p>
        <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => { setW({ patientId: "", providerId: "pat", serviceId: "consult" }); setWerr(""); setWalk(true); }}><Footprints className="size-4" />Walk-in patient</Button>
          <Button size="sm" onClick={ui.newPatient}><UserPlus className="size-4" />New patient</Button></div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-5" role="group" aria-label="Filter by status">
        {STRIP.map((s) => {
          const n = today.filter((a) => s.statuses.includes(a.status)).length;
          const on = filter === s.key;
          return (
            <button key={s.key} aria-pressed={on} onClick={() => setFilter(on ? "" : s.key)} className={cn("bg-white px-4 py-3 text-left hover:bg-cloud/60", on && "bg-active hover:bg-active")}>
              <span className="flex items-center gap-1.5 text-xs text-muted"><StatusDot status={s.statuses[0]} />{s.label}</span><span className="text-2xl font-semibold leading-tight">{isLoading ? "–" : n}</span>
            </button>
          );
        })}
      </div>

      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-56 flex-1 sm:max-w-xs"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden /><Input aria-label="Search patient" className="h-9 pl-9" placeholder="Search patient" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {filter && <Button size="sm" variant="ghost" onClick={() => setFilter("")}>Show all</Button>}
          {hidden > 0 && <span className="ml-auto text-xs text-muted">{hidden} cancelled or no-show hidden</span>}
        </div>
        {isLoading ? <SkeletonRows rows={8} /> : isError ? <EmptyState title="Couldn't load today's patients" action={<Button variant="secondary" onClick={() => refetch()}>Try again</Button>} />
          : rows.length === 0 ? <EmptyState title="No patients in this view" text={filter ? "Try another status." : "Your schedule is clear."} />
          : (
            <>
              <table className="hidden w-full md:table">
                <thead className="border-b border-line bg-cloud/50"><tr><Th>Time</Th><Th>Patient</Th><Th>Provider</Th><Th>Appointment</Th><Th>Wait time</Th><Th>Status</Th><Th className="text-right">Action</Th></tr></thead>
                <tbody className="divide-y divide-line">
                  {slice.map((a) => (
                    <tr key={a.id} className="hover:bg-cloud/40">
                      <Td className="tabular-nums font-medium">{fmtTime(a.time)}</Td>
                      <Td><button className="text-left" onClick={() => ui.openAppt(a.id)}><span className="flex items-center gap-2.5"><PatientAvatar id={a.patientId} size={32} /><span><span className="block font-medium hover:text-primary">{pname(a.patientId)}</span><span className="text-xs text-muted">{getPatient(a.patientId)?.id}{a.notes === "Walk-in" ? " · Walk-in" : ""}</span></span></span></button></Td>
                      <Td>{refs?.providers.find((p) => p.id === a.providerId)?.short}</Td>
                      <Td>{refs?.services.find((s) => s.id === a.serviceId)?.name}<span className="block text-xs text-muted">{refs?.rooms.find((r) => r.id === a.roomId)?.name}</span></Td>
                      <Td className={a.status === "waiting" && now - (a.arrivedAt ?? now) >= 10 ? "font-medium text-[#7A4B00]" : ""}>{["arrived", "waiting"].includes(a.status) ? waitLabel(now, a.arrivedAt) : <span className="text-muted">—</span>}</Td>
                      <Td><StatusBadge status={a.status} /></Td>
                      <Td className="text-right"><div className="flex justify-end"><ApptActions a={a} /></div></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="divide-y divide-line md:hidden">
                {slice.map((a) => (
                  <li key={a.id} className="space-y-2 px-4 py-3">
                    <div className="flex items-start justify-between gap-2"><div><PatientLink id={a.patientId} /><p className="text-xs text-muted">{fmtTime(a.time)} · {refs?.services.find((s) => s.id === a.serviceId)?.name} · {refs?.providers.find((p) => p.id === a.providerId)?.short}</p></div><StatusBadge status={a.status} /></div>
                    <div className="flex items-center justify-between"><span className="text-xs text-muted">{["arrived", "waiting"].includes(a.status) ? `Waiting ${waitLabel(now, a.arrivedAt)}` : STATUS[a.status].label}</span><ApptActions a={a} /></div>
                  </li>
                ))}
              </ul>
              {rows.length > PAGE && <Pagination page={Math.min(page, pages)} pages={pages} onPage={setPage} total={rows.length} />}
            </>
          )}
      </Panel>

      <Modal open={walk} onOpenChange={setWalk} title="Walk-in patient" description="Register an arrival without a scheduled appointment."
        footer={<><Button variant="secondary" onClick={() => setWalk(false)}>Cancel</Button>
          <Button loading={walkIn.pending} onClick={async () => { if (!w.patientId) return setWerr("Select a patient or add a new one"); await walkIn.run(w.patientId, w.providerId, w.serviceId); toast.success(`${pname(w.patientId)} checked in as a walk-in`); setWalk(false); }}>Check in</Button></>}>
        <div className="space-y-4">
          <Field label="Patient" required error={werr}><Select value={w.patientId} onChange={(e) => { setW({ ...w, patientId: e.target.value }); setWerr(""); }}><option value="">Select patient</option>{patients?.map((p) => <option key={p.id} value={p.id}>{p.first} {p.last} · {p.id}</option>)}</Select></Field>
          <button type="button" className="text-[13px] font-medium text-primary hover:underline" onClick={() => { setWalk(false); ui.newPatient(); }}>Patient not found? Add a new patient</button>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Provider"><Select value={w.providerId} onChange={(e) => { const sv = refs!.services.find((s) => s.providerIds.includes(e.target.value))!; setW({ ...w, providerId: e.target.value, serviceId: sv.id }); }}>{refs?.providers.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}</Select></Field>
            <Field label="Service"><Select value={w.serviceId} onChange={(e) => setW({ ...w, serviceId: e.target.value })}>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          </div>
        </div>
      </Modal>
    </>
  );
}
