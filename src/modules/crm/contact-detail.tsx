"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck, ExternalLink, UserRound } from "lucide-react";
import { Alert, Badge, Button, Sheet, StatusBadge } from "@/components/ui";
import { CONSENT_LABEL } from "../comms/eligibility";
import { useUI } from "@/components/app/ui-state";
import { fmtDate, fmtTime } from "@/lib/db";
import { useRefs } from "@/lib/hooks";
import { EnquiryStatusBadge } from "../enquiries/status";
import { CommunicationPanel } from "../comms/communication-panel";
import type { ContactAccess, CrmContact } from "./contacts";
import { StageBadge } from "./stage-badge";

const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">{children}</h3>;
const Row = ({ l, children }: { l: string; children: React.ReactNode }) => <div className="flex justify-between gap-4 py-1.5 text-[13px]"><dt className="text-muted">{l}</dt><dd className="text-right font-medium">{children}</dd></div>;
const Hidden = () => <span className="font-normal text-muted">Hidden for your role</span>;
const Missing = ({ children }: { children: React.ReactNode }) => <span className="font-normal text-muted">{children}</span>;

/** Read-only view of one contact. All records open in their own modules; nothing is created or changed here. */
export function ContactDetailSheet({ contact: c, access, onClose, page }: { /** Render as a full page instead of a side panel. */ page?: boolean; contact?: CrmContact; access: ContactAccess; onClose: () => void }) {
  const { data: refs } = useRefs();
  const router = useRouter();
  const ui = useUI();
  const svc = (id?: string) => refs?.services.find((s) => s.id === id)?.name ?? "General enquiry";
  const prov = (id: string) => refs?.providers.find((p) => p.id === id)?.short ?? "";
  const who = (id?: string) => refs?.users.find((u) => u.id === id)?.name;
  const go = (href: string) => { onClose(); router.push(href); };
  const consentLabel = c ? CONSENT_LABEL[c.consent.status] : "";

  const desc = c ? (c.kind === "patient" ? `Registered patient${c.patientId ? ` · ${c.patientId}` : ""}` : "Enquiry only · not a registered patient") : undefined;
  /** The page address uses the patient or enquiry record id, never the display key. A role that cannot see those ids gets no page link. */
  const pageHref = c ? (c.kind === "patient" ? (c.patientId ? `/crm/patient/${c.patientId}` : null) : c.enquiries[0] ? `/crm/enquiry/${c.enquiries[0].id}` : null) : null;
  const content = (
    <>
      {c && (
        <div className="space-y-5">
          {c.kind === "enquiry-only" && <Alert tone="info" title="Not a patient yet">This person has only made an enquiry. No patient record or appointment exists for them.</Alert>}
          <div className="flex items-center gap-2"><StageBadge s={c.stage} /><Badge tone={c.kind === "patient" ? "blue" : "lavender"}>{c.kind === "patient" ? "Patient" : "Enquiry only"}</Badge></div>

          <section><H>Contact details</H><dl className="divide-y divide-line">
            <Row l="Phone">{c.detailsHidden ? <Hidden /> : c.phone ?? <Missing>Not given</Missing>}</Row>
            <Row l="Email">{c.detailsHidden ? <Hidden /> : c.email ?? <Missing>Not given</Missing>}</Row>
            {c.kind === "patient" && <Row l="Date of birth">{c.detailsHidden ? <Hidden /> : c.dob ? fmtDate(c.dob, true) : <Missing>Not recorded</Missing>}</Row>}
          </dl></section>

          <section><H>How they found us</H><dl className="divide-y divide-line">
            <Row l="First-touch source">{c.firstTouch.source}</Row>
            <Row l="Based on">{c.firstTouch.basis === "enquiry" ? `Earliest enquiry (${c.firstTouch.enquiryId}, ${fmtDate(c.firstTouch.date!, true)})` : c.firstTouch.basis === "patient-referral" ? "Referral recorded on the patient" : <Missing>No enquiry or referral on record</Missing>}</Row>
            {c.firstTouch.raw && !c.firstTouch.mapped && <Row l="As recorded">{c.firstTouch.raw}</Row>}
          </dl></section>

          <section><H>Marketing consent</H><dl className="divide-y divide-line">
            <Row l="Email marketing">{consentLabel}</Row>
            <Row l="Date recorded">{c.consent.recordedAt ? fmtDate(c.consent.recordedAt, true) : <Missing>Date not recorded</Missing>}</Row>
            <Row l="Source">{c.consent.source ?? <Missing>Source not recorded</Missing>}</Row>
          </dl>
            {c.consent.status === "not-granted" && <p className="mt-1.5 text-xs text-muted">An earlier record says marketing was not agreed. It does not say whether the person declined, withdrew or was never asked.</p>}
            {c.consent.status === "not-recorded" && <p className="mt-1.5 text-xs text-muted">No consent has been recorded for this person. That is not the same as consent being given.</p>}
          </section>

          {c.patientId && access.patientRecords && <section><H>Patient record</H><Button variant="secondary" size="sm" onClick={() => go(`/patients/${c.patientId}`)}><UserRound className="size-4" />Open patient record</Button></section>}

          <section><H>Communication</H><CommunicationPanel subject={{ name: c.name, enquiryIds: c.enquiries.map((e) => e.id), patientId: c.patientId, reach: c.reach, consent: c.consent }} canCompose={false} canReadText={access.details} onOpenEnquiry={(id) => go(`/enquiries/${id}`)} />{c.enquiries.length > 0 && <p className="mt-1.5 text-xs text-muted">To reply, open the enquiry. Messages are written in one place only.</p>}</section>

          <section><H>Enquiries ({c.enquiries.length})</H>
            {c.enquiries.length === 0 ? <p className="text-[13px] text-muted">No enquiries linked to this patient.</p> : (
              <ul className="space-y-2">{[...c.enquiries].sort((a, b) => b.received.localeCompare(a.received)).map((e) => (
                <li key={e.id} className="rounded-lg border border-line px-3 py-2 text-[13px]">
                  <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="font-medium">{svc(e.serviceId)}</p><p className="text-xs text-muted">{e.id} · {e.source} · {fmtDate(e.received, true)}{who(e.assigneeId) ? ` · ${who(e.assigneeId)}` : ""}</p></div><EnquiryStatusBadge s={e.status} /></div>
                  {e.bookingLost && <p className="mt-1 text-xs text-[#8F2D2D]">Appointment {e.appointment?.status === "no_show" ? "missed" : "cancelled"}. The enquiry is open again.</p>}
                  <Button variant="ghost" size="sm" className="-ml-2 mt-1" onClick={() => go(`/enquiries/${e.id}`)}><ExternalLink className="size-3.5" />Open enquiry</Button>
                </li>))}</ul>)}
          </section>

          <section><H>Appointments ({c.appointments.length})</H>
            {c.kind === "enquiry-only" ? <p className="text-[13px] text-muted">None. Appointments are created for registered patients.</p>
              : c.appointments.length === 0 ? <p className="text-[13px] text-muted">No appointments on record.</p> : (
              <ul className="space-y-2">{c.appointments.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-2 rounded-lg border border-line px-3 py-2 text-[13px]">
                  <div className="min-w-0"><p className="font-medium">{access.patientRecords ? `${svc(a.serviceId)} · ${fmtDate(a.date, true)} at ${fmtTime(a.time)}` : `Appointment · ${fmtDate(a.date, true)}`}</p><p className="text-xs text-muted">{access.patientRecords ? `${prov(a.providerId)} · ${a.id}` : "Details not shown for your role"}{a.enquiryId ? ` · from ${a.enquiryId}` : ""}</p>
                    {access.patientRecords && <Button variant="ghost" size="sm" className="-ml-2 mt-1" onClick={() => { onClose(); ui.openAppt(a.id); }}><CalendarCheck className="size-3.5" />View appointment</Button>}</div>
                  <StatusBadge status={a.status} />
                </li>))}</ul>)}
          </section>
        </div>)}
    </>
  );
  if (page) {
    return (
      <div className="mx-auto max-w-3xl">
        <Link href="/crm" className="text-[13px] text-primary hover:underline">← All contacts</Link>
        <div className="mb-4 mt-1"><h1 className="text-[24px] font-semibold tracking-tight">{c?.name ?? "Contact"}</h1><p className="text-[13px] text-muted">{desc}</p></div>
        <div className="rounded-xl border border-line bg-white p-5">{content}</div>
      </div>
    );
  }
  return (
    <Sheet open={!!c} onOpenChange={(o) => !o && onClose()} width={500} title={c?.name ?? "Contact"} description={desc}>
      {pageHref && <Link href={pageHref} className="mb-3 inline-block text-[13px] font-medium text-primary hover:underline">Open full page</Link>}
      {content}
    </Sheet>
  );
}
