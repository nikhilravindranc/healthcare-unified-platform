"use client";
import { Suspense, use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, ConfirmDialog, EmptyState, Field, Input, PageTitle, Panel, Select, Skeleton, StatusBadge } from "@/components/ui";
import { Denied } from "@/components/patient/shared";
import { apptActions, apptStates } from "@/lib/appointment-view";
import { docTotal, invoiceBalance, invoiceStatus, money } from "@/lib/clinical";
import { api, fmtDate, fmtTime, freeSlots, fromMin, nowMin, pname, TODAY, toMin } from "@/lib/db";
import { useAction, useAppointments, useBilling, usePatients, useRefs, useRole, useVisits } from "@/lib/hooks";
import { useEnquiries } from "@/modules/enquiries/hooks";

export default function AppointmentPage({ params }: { params: Promise<{ id: string }> }) { return <Suspense><Detail id={use(params).id} /></Suspense>; }

const Row = ({ l, children }: { l: string; children: React.ReactNode }) => <div className="flex justify-between gap-4 py-2 text-[13px]"><dt className="text-muted">{l}</dt><dd className="text-right font-medium">{children}</dd></div>;
const H = ({ children }: { children: React.ReactNode }) => <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">{children}</h2>;

function Detail({ id }: { id: string }) {
  const { data: appts, isLoading } = useAppointments();
  const { data: patients } = usePatients(); const { data: refs } = useRefs(); const { data: visits } = useVisits(); const { data: bill } = useBilling(); const { data: enquiries } = useEnquiries();
  const { can } = useRole(); const router = useRouter();
  const setStatus = useAction(api.setStatus); const reschedule = useAction(api.reschedule, "Appointment rescheduled"); const start = useAction(api.startVisit);
  const [confirm, setConfirm] = useState<null | "cancel" | "no-show">(null);
  const [resched, setResched] = useState(false); const [rdate, setRdate] = useState(TODAY); const [rtime, setRtime] = useState("");
  const a = appts?.find((x) => x.id === id);
  const slots = useMemo(() => (a ? freeSlots(a.providerId, rdate, a.duration) : []), [a, rdate]);
  if (!can("patients")) return <Denied what="appointments" />;
  if (isLoading) return <div className="space-y-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-72 w-full" /></div>;
  if (!a) return <EmptyState title="Appointment not found" text="It may have been removed." action={<Link href="/appointments"><Button variant="secondary">Back to appointments</Button></Link>} />;

  const p = patients?.find((x) => x.id === a.patientId);
  const name = pname(a.patientId);
  const prov = refs?.providers.find((x) => x.id === a.providerId); const svc = refs?.services.find((x) => x.id === a.serviceId);
  const loc = refs?.locations.find((x) => x.id === a.locationId); const room = refs?.rooms.find((x) => x.id === a.roomId);
  const visit = a.visitId ? visits?.find((v) => v.id === a.visitId) : undefined;
  const st = apptStates(a, TODAY); const acts = apptActions(a, TODAY);
  const fromEnquiry = (can("enquiries") || can("enquiries_view")) ? enquiries?.find((e) => e.appointmentId === a.id || e.previousAppointmentIds?.includes(a.id)) : undefined;
  const source = a.origin === "online" ? "Online booking (demo)" : fromEnquiry ? `Enquiry ${fromEnquiry.id}` : "Not recorded";
  const alerts = p?.alerts ?? [];
  const invoices = can("financials") && visit ? (bill?.invoices ?? []).filter((i) => i.visitId === visit.id && i.status !== "Void") : [];
  const end = fromMin(toMin(a.time) + a.duration);
  const startVisit = async () => { const v = await start.run(a.id); toast.success(a.visitId ? "Visit resumed" : "Visit started"); router.push(`/visits/${v.id}`); };

  return (
    <>
      <PageTitle crumbs={[{ label: "Appointments", href: "/appointments" }, { label: a.id }]} title={name}
        description={<>{p?.id} · {svc?.name} · {a.date === TODAY ? "Today" : fmtDate(a.date, true)}, {fmtTime(a.time)} to {fmtTime(end)} ({a.duration} min)</>}
        actions={<>
          {acts.includes("confirm") && <Button variant="secondary" loading={setStatus.pending} onClick={async () => { await setStatus.run(a.id, "confirmed"); toast.success("Booking confirmed"); }}>Confirm booking</Button>}
          {acts.includes("check-in") && <Button variant="secondary" loading={setStatus.pending} onClick={async () => { await setStatus.run(a.id, "arrived"); toast.success(`${name} checked in`); }}>Check in</Button>}
          {acts.includes("reschedule") && <Button variant="secondary" aria-expanded={resched} onClick={() => setResched((r) => !r)}>Reschedule</Button>}
          {acts.includes("cancel") && <Button variant="secondary" onClick={() => setConfirm("cancel")}>Cancel</Button>}
          {acts.includes("open-visit") && <Button onClick={() => router.push(`/visits/${a.visitId}`)}>{visit?.status === "In progress" ? "Resume visit" : "Open visit"}</Button>}
          {acts.includes("start-visit") && <Button onClick={startVisit} loading={start.pending}>Start visit</Button>}
        </>} />

      <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="Status">
        <StatusBadge status={a.status} />
        <span className="text-[13px] text-slate-600"><span className="text-muted">Booking</span> {st.booking}<span className="mx-2 text-line" aria-hidden>|</span><span className="text-muted">Attendance</span> {st.attendance}</span>
      </div>

      {resched && (
        <Panel className="mb-5 p-4"><p className="mb-3 text-sm font-medium">Reschedule appointment</p>
          <div className="grid max-w-md gap-3 sm:grid-cols-2">
            <Field label="Date"><Input type="date" min={TODAY} value={rdate} onChange={(e) => { setRdate(e.target.value); setRtime(""); }} /></Field>
            <Field label="Time" hint={slots.length === 0 ? "No free times on this date within the provider's hours." : undefined}><Select value={rtime} onChange={(e) => setRtime(e.target.value)}><option value="">Select time</option>{slots.filter((s) => rdate !== TODAY || s > fromMin(nowMin())).map((s) => <option key={s} value={s}>{fmtTime(s)}</option>)}</Select></Field>
          </div>
          <div className="mt-3 flex gap-2"><Button size="sm" disabled={!rtime} loading={reschedule.pending} onClick={async () => { await reschedule.run(a.id, rdate, rtime); setResched(false); setRtime(""); }}>Confirm new time</Button><Button size="sm" variant="secondary" onClick={() => setResched(false)}>Close</Button></div>
          <p className="mt-2 text-xs text-muted">Times shown follow the provider&apos;s hours, time off, the practice break and closed dates.</p>
        </Panel>)}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Panel className="p-5"><H>Appointment</H>
            <dl className="divide-y divide-line">
              <Row l="Provider">{prov?.name ?? <span className="font-normal text-muted">Not recorded</span>}</Row>
              <Row l="Service">{svc?.name ?? <span className="font-normal text-muted">Not recorded</span>}</Row>
              <Row l="Location">{loc?.name ?? <span className="font-normal text-muted">Not recorded</span>}</Row>
              <Row l="Room">{room?.name ?? <span className="font-normal text-muted">Not recorded</span>}</Row>
              <Row l="Booking source">{source}{fromEnquiry && <> <Link className="text-primary hover:underline" href={`/enquiries/${fromEnquiry.id}`}>Open</Link></>}</Row>
              <Row l="Notes">{a.notes ? a.notes : <span className="font-normal text-muted">None</span>}</Row>
            </dl>
          </Panel>

          <Panel className="p-5"><H>Visit</H>
            {visit ? (
              <div className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
                <div><p className="font-medium">{visit.type} <Badge tone={visit.status === "Completed" ? "mint" : "blue"}>{visit.status}</Badge></p><p className="text-muted">{visit.id} · {fmtDate(visit.date, true)}. Care and documentation live in the visit, not in this booking.</p></div>
                <Link href={`/visits/${visit.id}`}><Button variant="secondary">{visit.status === "In progress" ? "Resume visit" : "Open visit"}</Button></Link>
              </div>
            ) : <p className="text-[13px] text-muted">No visit has been started for this appointment. Opening this page does not create one.</p>}
          </Panel>

          <Panel className="p-5"><H>History</H>
            {a.events && a.events.length > 0 ? <ol className="space-y-1.5 border-l border-line pl-3.5 text-[13px]">{[...a.events].reverse().map((e, i) => <li key={i}>{e.text}<span className="block text-xs text-muted">{fmtDate(e.at, true)}</span></li>)}</ol>
              : <p className="text-[13px] text-muted">No changes have been recorded for this appointment. Only cancellations, no-shows, rescheduling and online booking are logged.</p>}
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          <Panel className="p-5"><H>Patient</H>
            <p className="text-[14px] font-medium">{name}</p><p className="text-xs text-muted">{a.patientId}</p>
            {alerts.length > 0 ? <ul className="mt-3 space-y-1.5">{alerts.slice(0, 3).map((al) => <li key={al.id} className="flex items-start gap-1.5 rounded-md bg-[#FFF3DF] px-2 py-1 text-xs text-[#7A4B00]"><ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /><span><span className="font-medium">{al.type}:</span> {al.description}</span></li>)}</ul> : <p className="mt-3 text-xs text-muted">No alerts recorded.</p>}
            <Link href={`/patients/${a.patientId}`}><Button size="sm" variant="secondary" className="mt-3">Open patient profile</Button></Link>
          </Panel>
          {can("financials") && (
            <Panel className="p-5"><H>Payment</H>
              {invoices.length === 0 ? <p className="text-[13px] text-muted">{visit ? "No invoice is linked to this visit." : "No invoice or deposit is recorded for this appointment."}</p>
                : <ul className="space-y-2 text-[13px]">{invoices.map((i) => <li key={i.id} className="flex items-center justify-between gap-2"><span><span className="font-medium">{i.id}</span><span className="block text-xs text-muted">{money(docTotal(i))}{invoiceBalance(i) > 0 ? `, ${money(invoiceBalance(i))} outstanding` : ""}</span></span><span className="flex items-center gap-2"><Badge tone={invoiceStatus(i) === "Paid" ? "mint" : "peach"}>{invoiceStatus(i)}</Badge><Link className="text-primary hover:underline" href={`/patients/${a.patientId}?tab=financials`}>Open</Link></span></li>)}</ul>}
            </Panel>)}
        </div>
      </div>

      <ConfirmDialog open={confirm === "cancel"} onOpenChange={(o) => !o && setConfirm(null)} title="Cancel appointment?" description={`${name}, ${fmtDate(a.date)} at ${fmtTime(a.time)}. The record is kept and shown as cancelled.`} cancelLabel="Keep appointment" confirmLabel="Cancel appointment" danger loading={setStatus.pending}
        onConfirm={async () => { await setStatus.run(a.id, "cancelled"); setConfirm(null); toast.success("Appointment cancelled"); }} />
    </>
  );
}
