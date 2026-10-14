"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, EmptyState, Panel, Select, Skeleton, Td, Th } from "@/components/ui";
import { BarList, LineChart } from "@/components/app/charts";
import { docTotal, invoiceBalance, money } from "@/lib/clinical";
import { fmtDate, pname, TODAY } from "@/lib/db";
import { appointmentInsight, apptsIn, capacityInsight, clinicInsight, continuityInsight, financialInsight, patientInsight, rangeFor, serviceInsight } from "@/lib/insights";
import { useAppointments, useBilling, useFollowUps, useExtras, usePatients, useRefs, useRole, useVisits } from "@/lib/hooks";
import { useSettings } from "@/lib/settings";
import { computeInsights } from "@/modules/enquiries/insights";
import { useEnquiries } from "@/modules/enquiries/hooks";
import { useMessages } from "@/modules/comms/hooks";
import { Metric, MetricRow, Note, pctText, Section, type useInsightFilters } from "./shell";

type F = ReturnType<typeof useInsightFilters>;
/** A link to the records behind a figure: the same dates and filters, in Reports. */
const report = (f: F, slug: string, extra: Record<string, string> = {}, withDims = false) => { const p = new URLSearchParams({ from: f.filters.from, to: f.filters.to, ...extra }); if (withDims) { if (f.location) p.set("location", f.location); if (f.provider) p.set("provider", f.provider); if (f.service) p.set("service", f.service); } return `/reports/${slug}?${p}`; };
const qs = (f: F, extra: Record<string, string> = {}) => report(f, "appointments", extra, true);
const useData = () => ({ appts: useAppointments(), visits: useVisits(), fus: useFollowUps(), patients: usePatients(), refs: useRefs() });
const Loading = () => <div className="grid gap-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
const Table = ({ head, children, min = 420 }: { head: string[]; children: React.ReactNode; min?: number }) => (
  <Panel className="overflow-x-auto"><table className="w-full" style={{ minWidth: min }}><thead className="border-b border-line bg-cloud/50"><tr>{head.map((h) => <Th key={h}>{h}</Th>)}</tr></thead><tbody className="divide-y divide-line">{children}</tbody></table></Panel>
);

/* ---------- Clinic overview ---------- */
export function ClinicView({ f, compact }: { f: F; compact?: boolean }) {
  const { appts, visits, fus } = useData();
  if (!appts.data || !visits.data || !fus.data) return <Loading />;
  const c = clinicInsight(appts.data, visits.data, fus.data, f.filters, TODAY); const a = c.appointments;
  return (
    <>
      <MetricRow>
        <Metric label="Appointments" value={a.total} def="Appointment records dated in the range, all statuses." href={compact ? undefined : qs(f)} />
        <Metric label="Attended" value={a.attended} def="Arrived, waiting, in visit or completed, up to today." />
        <Metric label="Cancelled or no-show" value={a.cancelled + a.noShow} def="Cancelled plus no-show in the range." href={compact ? undefined : qs(f, { status: "Cancelled or no-show" })} />
        <Metric label="Visits completed" value={c.visitsCompleted} def={`Of ${c.visitsStarted} visits dated in the range. A visit is care delivered; an appointment is a booking.`} href={compact ? undefined : report(f, "visits", { status: "Completed" })} />
      </MetricRow>
      {!compact && (
        <>
          <Section title="Follow-ups" sub="A snapshot as of today. Follow-ups have no completion date."><MetricRow>
            <Metric label="Open" value={c.followUps.open} def="Follow-ups not yet completed." href="/reports/follow-ups?status=Open" />
            <Metric label="Overdue" value={c.followUps.overdue} def="Open and due before today." href="/reports/follow-ups?status=Overdue" tone={c.followUps.overdue ? "attention" : undefined} />
            <Metric label="Completed" value={c.followUps.completed} def="All completed follow-ups on record." />
          </MetricRow></Section>
          <Section title="Operational exceptions" sub="Things that may need someone's attention">
            <ul className="divide-y divide-line rounded-xl border border-line bg-white text-[13px]">
              <li className="flex items-center justify-between gap-3 px-4 py-2.5"><span>Past appointments still open (no attendance recorded)</span><Link className="font-medium text-primary hover:underline" href="/appointments?filter=attention">{c.exceptions.pastOpenAppointments}</Link></li>
              <li className="flex items-center justify-between gap-3 px-4 py-2.5"><span>Visits with a form awaiting signature</span><Link className="font-medium text-primary hover:underline" href="/visits">{c.exceptions.visitsWithUnsignedForms}</Link></li>
              <li className="flex items-center justify-between gap-3 px-4 py-2.5"><span>Overdue follow-ups</span><Link className="font-medium text-primary hover:underline" href="/follow-ups">{c.exceptions.overdueFollowUps}</Link></li>
            </ul>
          </Section>
        </>)}
    </>
  );
}

/* ---------- Appointments ---------- */
export function AppointmentsView({ f }: { f: F }) {
  const { appts, refs } = useData(); const { can } = useRole();
  if (!appts.data) return <Loading />;
  const a = appointmentInsight(appts.data, f.filters, TODAY);
  const nm = (id: string, k: "providers" | "locations") => (k === "providers" ? refs.data?.providers.find((p) => p.id === id)?.short : refs.data?.locations.find((l) => l.id === id)?.name.replace("Brightwell ", "")) ?? id;
  const exportCsv = () => {
    const rows = ["date,appointments", ...a.byDay.map((d) => `${d.date},${d.n}`)].join("\n");
    const url = URL.createObjectURL(new Blob([rows], { type: "text/csv" })); const el = document.createElement("a"); el.href = url; el.download = `appointments-by-day-${f.filters.from}-to-${f.filters.to}.csv`; el.click(); URL.revokeObjectURL(url);
    toast.success("Exported appointment counts by day. No patient details are included.");
  };
  return (
    <>
      <MetricRow>
        <Metric label="Booked" value={a.total} def="Appointment records dated in the range, any status." href={qs(f)} />
        <Metric label="Confirmation" value={pctText(a.confirmationRate)} def={`${a.confirmed} confirmed of ${a.confirmed + a.awaiting} open bookings (confirmed plus awaiting confirmation).`} />
        <Metric label="Attendance" value={pctText(a.attendanceRate)} def={`${a.attended} attended of ${a.attended + a.noShow} that were attended or missed. Cancelled and future bookings are excluded.`} />
        <Metric label="No-show rate" value={pctText(a.noShowRate)} def={`${a.noShow} no-shows, same denominator as attendance.`} href={qs(f, { status: "No-show" })} />
        <Metric label="Cancellation rate" value={pctText(a.cancellationRate)} def={`${a.cancelled} cancelled of ${a.total} booked.`} href={qs(f, { status: "Cancelled" })} />
        <Metric label="Rescheduled" value={a.rescheduled} def="Appointments with a logged reschedule. Only reschedules made after logging started are counted." />
        <Metric label="Online bookings" value={a.online} def="Booked through the online booking page (demo)." />
        <Metric label="Open but past" value={a.pastOpen} def="Dated before today with no attendance recorded." href="/appointments?filter=attention" tone={a.pastOpen ? "attention" : undefined} />
      </MetricRow>
      {a.total === 0 ? <EmptyState title="No appointments in this range" text="Choose a different range or clear the filters." /> : (
        <>
          <Section title="Bookings by day" sub="Appointment records by their date, all statuses" action={can("reports") && <Button size="sm" variant="secondary" onClick={exportCsv}><Download className="size-3.5" aria-hidden />Export counts</Button>}>
            <Panel className="p-4"><LineChart label="Appointments by day" labels={a.byDay.map((d) => d.date)} series={[{ name: "Appointments", color: "#2867B2", v: a.byDay.map((d) => d.n) }]} /></Panel>
          </Section>
          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Demand by weekday" sub="Live appointments (not cancelled or missed)"><Panel className="p-4"><BarList rows={a.byWeekday.map((x) => ({ label: x.label, value: x.n }))} /></Panel></Section>
            <Section title="Demand by hour" sub="By start time"><Panel className="p-4"><BarList color="#26B9CF" rows={a.byHour.map((x) => ({ label: x.label, value: x.n }))} /></Panel></Section>
            <Section title="By provider"><Panel className="p-4"><BarList rows={a.byProvider.map((x) => ({ label: nm(x.id, "providers"), value: x.n }))} /></Panel></Section>
            <Section title="By location"><Panel className="p-4"><BarList color="#7ACFC5" rows={a.byLocation.map((x) => ({ label: nm(x.id, "locations"), value: x.n }))} /></Panel></Section>
          </div>
        </>)}
    </>
  );
}

/* ---------- Patients ---------- */
export function PatientsView({ f }: { f: F }) {
  const { appts, visits, patients } = useData(); const [days, setDays] = useState(90);
  if (!appts.data || !visits.data || !patients.data) return <Loading />;
  const r = patientInsight(patients.data, appts.data, visits.data, f.filters, TODAY, days);
  return (
    <>
      <MetricRow>
        <Metric label="Patients seen" value={r.seen} def="Patients with a completed visit dated in the range." />
        <Metric label="Returning" value={r.returning} def="Seen in the range and with a completed visit before it." />
        <Metric label="First visit on record" value={r.firstInRecords} def="Seen in the range with no earlier completed visit in these records. It cannot tell whether they were patients elsewhere." />
        <Metric label="Rebooked" value={pctText(r.rebookingRate)} def={`${r.rebooked} of ${r.seen} patients seen have an open future appointment.`} />
      </MetricRow>
      <p className="-mt-3 mb-5 text-[13px]"><Link className="font-medium text-primary hover:underline" href="/reports/patients">See the patient records</Link></p>
      <Section title="Visit frequency" sub="Completed visits per patient in the range">
        <Panel className="p-4"><BarList rows={[{ label: "1 visit", value: r.frequency.once }, { label: "2 visits", value: r.frequency.twice }, { label: "3 or more", value: r.frequency.threePlus }]} /></Panel>
      </Section>
      <Section title="Inactive patients" sub="No completed visit within the threshold and nothing booked ahead" action={<Select sm className="w-44" aria-label="Inactive threshold" value={String(days)} onChange={(e) => setDays(Number(e.target.value))}><option value="60">No visit in 60 days</option><option value="90">No visit in 90 days</option><option value="180">No visit in 180 days</option></Select>}>
        {r.inactive.length === 0 ? <Note>No patient meets this threshold. Patients with no completed visit on record are not counted.</Note> : (
          <Panel className="overflow-x-auto"><table className="w-full min-w-[420px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>Patient</Th><Th>Last completed visit</Th></tr></thead><tbody className="divide-y divide-line">{r.inactive.map((p) => <tr key={p.id}><Td><Link className="font-medium text-primary hover:underline" href={`/patients/${p.id}`}>{p.name}</Link><span className="block text-xs text-muted">{p.id}</span></Td><Td>{fmtDate(p.last, true)}</Td></tr>)}</tbody></table></Panel>)}
      </Section>
    </>
  );
}

/* ---------- Marketing ---------- */
export function MarketingView({ f }: { f: F }) {
  const { data, isLoading } = useEnquiries(); const { data: refs } = useRefs(); const { data: msgs } = useMessages();
  const days = f.key.startsWith("n") ? 30 : Number(f.key);
  const d = useMemo(() => computeInsights(data ?? [], days, TODAY), [data, days]);
  if (isLoading) return <Loading />;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "Not enough data");
  const list = (data ?? []).filter((e) => e.received >= f.filters.from && e.received <= f.filters.to);
  const bySvc = [...new Set(list.map((e) => e.serviceId ?? ""))].map((id) => { const l = list.filter((e) => (e.serviceId ?? "") === id); const booked = l.filter((e) => e.appointment && !["cancelled", "no_show"].includes(e.appointment.status)).length; return { name: id ? refs?.services.find((s) => s.id === id)?.name ?? id : "General enquiry", n: l.length, booked }; }).sort((a, b) => b.n - a.n);
  const sims = (msgs ?? []).filter((m) => m.campaignId && m.status === "simulated").length;
  return (
    <>
      {f.key.startsWith("n") && <div className="mb-4"><Note>Enquiries are looked back on. This view uses the last 30 days.</Note></div>}
      <MetricRow>
        <Metric label="Enquiries" value={d.total} def="Enquiries received in the range." href={report(f, "enquiries")} />
        <Metric label="Became appointments" value={d.booked} def="Enquiries linked to an appointment that is not cancelled or missed." />
        <Metric label="Enquiry to appointment" value={d.total ? `${d.rate}%` : "Not enough data"} def="Became appointments divided by enquiries received." />
        <Metric label="Still open" value={d.open} def="New or contacted. Includes enquiries whose appointment was cancelled or missed." />
      </MetricRow>
      {d.total === 0 ? <EmptyState title="No enquiries in this range" text="Choose a longer range." /> : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Enquiry sources"><Panel className="p-4"><BarList rows={d.bySource.map((x) => ({ label: x.source, value: x.n, sub: `${x.booked} booked` }))} /></Panel></Section>
          <Section title="Conversion by source" sub="Share of enquiries that reached a booked appointment"><Table head={["Source", "Enquiries", "Booked", "Rate"]}>{d.bySource.map((x) => <tr key={x.source}><Td className="font-medium">{x.source}</Td><Td>{x.n}</Td><Td>{x.booked}</Td><Td>{pct(x.booked, x.n)}</Td></tr>)}</Table></Section>
          <Section title="Conversion by service" sub="By the service requested on the enquiry"><Table head={["Requested", "Enquiries", "Booked", "Rate"]}>{bySvc.map((x) => <tr key={x.name}><Td className="font-medium">{x.name}</Td><Td>{x.n}</Td><Td>{x.booked}</Td><Td>{pct(x.booked, x.n)}</Td></tr>)}</Table></Section>
          <Section title="Campaigns" sub="Enquiries tagged with a campaign in the demo data">{d.campaigns.length === 0 ? <Note>No campaign enquiries in this range.</Note> : <Table head={["Campaign", "Enquiries", "Booked", "Rate"]}>{d.campaigns.map((x) => <tr key={x.campaign}><Td className="font-medium">{x.campaign}</Td><Td>{x.n}</Td><Td>{x.booked}</Td><Td>{pct(x.booked, x.n)}</Td></tr>)}</Table>}</Section>
        </div>)}
      <Note>Demo data. Campaign messages are simulated ({sims} so far), so delivery and response are not tracked. Time to contact and time to booking are not shown: only dates are recorded, not times. No cost or revenue is attributed to a source, so there is no return on spend.</Note>
    </>
  );
}

/* ---------- Services ---------- */
export function ServicesView({ f }: { f: F }) {
  const { appts, visits, refs } = useData(); const { data: bill } = useBilling(); const { can } = useRole();
  if (!appts.data || !visits.data) return <Loading />;
  const rows = serviceInsight(appts.data, visits.data, bill?.invoices ?? [], f.filters, TODAY, docTotal, can("financials"));
  if (rows.length === 0) return <EmptyState title="No appointments in this range" text="Choose a different range." />;
  const nm = (id: string) => refs.data?.services.find((s) => s.id === id)?.name ?? id;
  return (
    <>
      <p className="mb-4 text-[13px]"><Link className="font-medium text-primary hover:underline" href={report(f, "services")}>See the service records</Link> · <Link className="font-medium text-primary hover:underline" href={report(f, "appointments", {}, true)}>See the appointments</Link></p>
      <Section title="Demand by service" sub="Appointment records by service in the range"><Panel className="p-4"><BarList rows={rows.map((r) => ({ label: nm(r.id), value: r.appointments, sub: `${r.completedVisits} completed visits` }))} /></Panel></Section>
      <Section title="By service" sub="Completed visits are visits marked completed that came from the appointment"><Table min={560} head={["Service", "Booked", "Completed visits", "Cancelled", "Cancellation rate", "Repeat patients", ...(can("financials") ? ["Invoiced"] : [])]}>
        {rows.map((r) => <tr key={r.id}><Td className="font-medium">{nm(r.id)}</Td><Td>{r.appointments}</Td><Td>{r.completedVisits}</Td><Td>{r.cancelled}</Td><Td>{pctText(r.cancellationRate)}</Td><Td>{r.repeatPatients}</Td>{can("financials") && <Td>{money(r.revenue ?? 0)}</Td>}</tr>)}</Table></Section>
      <Note>Repeat patients: patients with more than one live appointment for the service in the range. Invoiced counts invoices issued in the range that are tied to a visit that came from an appointment for the service. Invoices not tied to a visit are not assigned to a service.</Note>
    </>
  );
}

/* ---------- Capacity ---------- */
export function CapacityView({ f }: { f: F }) {
  const { appts, refs } = useData(); const st = useSettings();
  if (!appts.data || !refs.data) return <Loading />;
  const rows = capacityInsight(refs.data.providers, appts.data, f.filters, st);
  const nm = (id: string) => refs.data!.providers.find((p) => p.id === id)?.short ?? id;
  const hrs = (m: number) => `${Math.round((m / 60) * 10) / 10} h`;
  return (
    <>
      <Section title="Booked against available time" sub="Available = working days in the range x working hours, less the practice break, closed dates and the provider's time off. Cancelled and missed bookings are not counted as booked.">
        <Table min={520} head={["Provider", "Booked", "Available", "Utilisation"]}>{rows.map((r) => <tr key={r.id}><Td className="font-medium">{nm(r.id)}</Td><Td>{hrs(r.booked)}</Td><Td>{r.available == null ? <span className="text-muted">Not known</span> : hrs(r.available)}</Td><Td>{r.utilization == null ? <span className="text-xs text-muted">{r.reason}</span> : `${r.utilization}%`}</Td></tr>)}</Table>
      </Section>
      <Note>Utilisation is shown only where working days and hours can be read. Hours that cannot be read are never guessed. Choose a forward range to see how full the coming days are. Past ranges only include appointments still on record.</Note>
    </>
  );
}

/* ---------- Financial ---------- */
export function FinancialView({ f }: { f: F }) {
  const { data: bill, isLoading } = useBilling(); const { patients } = useData();
  if (isLoading || !bill) return <Loading />;
  const r = financialInsight(bill.invoices, bill.payments, f.filters, docTotal, invoiceBalance);
  const owing = bill.invoices.filter((i) => i.status !== "Void" && i.status !== "Draft" && i.issued >= f.filters.from && i.issued <= f.filters.to && invoiceBalance(i) > 0);
  return (
    <>
      <MetricRow>
        <Metric label="Invoiced" value={money(r.invoiced)} def={`${r.invoices} invoices issued in the range, excluding void and draft.`} />
        <Metric label="Collected" value={money(r.collected)} def="Posted payments and deposits dated in the range. A payment can relate to an earlier invoice." />
        <Metric label="Refunds" value={money(r.refunds)} def="Posted refunds dated in the range." />
        <Metric label="Outstanding" value={money(r.outstanding)} def={`Balance still unpaid on invoices issued in the range (${r.outstandingInvoices} invoices).`} />
      </MetricRow>
      {r.invoices > 0 && <p className="mb-4 text-[13px]"><Link className="font-medium text-primary hover:underline" href={report(f, "invoices")}>See the invoices</Link> · <Link className="font-medium text-primary hover:underline" href={report(f, "payments")}>See the payments</Link></p>}
      <Section title="Invoices with a balance" sub="Open the patient's financials to act on them. Billing owns the records.">
        {owing.length === 0 ? <Note>No invoice issued in this range has a balance.</Note> : (
          <Table head={["Invoice", "Patient", "Issued", "Balance"]}>{owing.map((i) => <tr key={i.id}><Td className="font-medium">{i.id}</Td><Td><Link className="text-primary hover:underline" href={`/patients/${i.patientId}?tab=financials`}>{patients.data?.find((p) => p.id === i.patientId) ? pname(i.patientId) : i.patientId}</Link></Td><Td>{fmtDate(i.issued, true)}</Td><Td>{money(invoiceBalance(i))}</Td></tr>)}</Table>)}
      </Section>
      <Note>Invoiced, collected and outstanding are different things and are not added together. Dates: invoices by issued date, payments by payment date. These are demo records and not a substitute for accounting reports.</Note>
    </>
  );
}

/* ---------- Continuity ---------- */
export function ContinuityView({ f }: { f: F }) {
  const { appts, visits, fus } = useData(); const { data: x } = useExtras();
  if (!appts.data || !visits.data || !fus.data) return <Loading />;
  const c = continuityInsight(fus.data, visits.data, appts.data, x?.plans ?? [], f.filters, TODAY);
  return (
    <>
      <MetricRow>
        <Metric label="Overdue follow-ups" value={c.overdue.length} def="Open and due before today, whatever the range." href="/reports/follow-ups?status=Overdue" tone={c.overdue.length ? "attention" : undefined} />
        <Metric label="Follow-up completion" value={pctText(c.completionRate)} def={`${c.completedInRange} of ${c.dueInRange} follow-ups that fell due in the range are completed.`} />
        <Metric label="Rebooked after a visit" value={pctText(c.rebookingRate)} def={`${c.rebookedAfterVisit} of ${c.visitsCompleted} completed visits have a later appointment that was not cancelled or missed.`} />
        <Metric label="Open plan steps" value={c.outstandingPlanSteps.length} def="Planned or scheduled steps in active treatment plans." />
      </MetricRow>
      <Section title="Overdue follow-ups">{c.overdue.length === 0 ? <Note>None.</Note> : <Table head={["Patient", "Follow-up", "Due"]}>{c.overdue.map((x2) => <tr key={x2.id}><Td><Link className="font-medium text-primary hover:underline" href={`/patients/${x2.patientId}`}>{pname(x2.patientId)}</Link></Td><Td>{x2.type}{x2.note ? <span className="block text-xs text-muted">{x2.note}</span> : null}</Td><Td>{fmtDate(x2.due, true)}</Td></tr>)}</Table>}</Section>
      <Section title="Outstanding care-plan steps" sub="Steps not yet recorded as completed. A booking does not complete a step.">{c.outstandingPlanSteps.length === 0 ? <Note>None.</Note> : <Table head={["Patient", "Plan", "Step", "Status"]}>{c.outstandingPlanSteps.map((s, i) => <tr key={i}><Td><Link className="font-medium text-primary hover:underline" href={`/patients/${s.patientId}?tab=history`}>{pname(s.patientId)}</Link></Td><Td>{s.plan}</Td><Td>{s.title}</Td><Td><Badge tone={s.status === "Scheduled" ? "blue" : "neutral"}>{s.status}</Badge></Td></tr>)}</Table>}</Section>
    </>
  );
}

/** Used by the landing page: counts by provider for the filters (kept here so the landing and detail agree). */
export const overviewAppts = (all: Parameters<typeof apptsIn>[0], f: F) => apptsIn(all, f.filters);
export { rangeFor };
