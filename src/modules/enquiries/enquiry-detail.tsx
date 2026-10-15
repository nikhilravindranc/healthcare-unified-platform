"use client";
import { Avatar } from "@/components/ui";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, Check, ChevronDown, Link2, Pencil, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { BannerSurface } from "@/components/ui/banner";
import { Alert, Badge, Button, ConfirmDialog, Field, Input, Menu, MenuContent, MenuItem, MenuTrigger, Select, Sheet, Skeleton, StatusBadge } from "@/components/ui";
import { useUI } from "@/components/app/ui-state";
import { useSession } from "@/lib/auth";
import { fmtDate, fmtTime, TODAY } from "@/lib/db";
import { useAction, usePatients, useRefs, useRole } from "@/lib/hooks";
import { enquiriesApi } from "./api";
import { taskSchema, type TaskInput } from "./schemas";
import { ENQUIRY_STATUSES, type Enquiry, type EnquiryStatus } from "./types";
import { useBookEnquiry } from "./use-book";
import { useEnquiryAccess } from "./enquiry-actions";
import { CommunicationPanel } from "../comms/communication-panel";
import { consentFromFlag } from "../comms/eligibility";

const digits = (s?: string) => (s ?? "").replace(/\D/g, "");
const Row = ({ l, children }: { l: string; children: React.ReactNode }) => <div className="flex justify-between gap-4 py-1.5 text-[13px]"><dt className="text-muted">{l}</dt><dd className="text-right font-medium">{children}</dd></div>;
const H = ({ children }: { children: React.ReactNode }) => <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">{children}</h3>;

export function EnquiryDetailSheet({ enquiry, needPatient: askPatient, onClose, onEdit, page }: { /** Render as a full page instead of a side panel. */ page?: boolean; enquiry?: Enquiry; /** Open with the "link or create a patient" prompt showing. */ needPatient?: boolean; onClose: () => void; onEdit: (e: Enquiry) => void }) {
  const { data: refs } = useRefs();
  const ui = useUI();
  const { readOnly } = useEnquiryAccess();
  const { data: patients } = usePatients();
  const { can } = useRole();
  const session = useSession();
  const by = session?.name ?? "Staff";
  const setStatus = useAction(enquiriesApi.setStatus, (e) => `Status set to ${e.status.toLowerCase()}`);
  const assign = useAction(enquiriesApi.assign, "Assigned staff updated");
  const addTask = useAction(enquiriesApi.addTask, "Follow-up added");
  const doneTask = useAction(enquiriesApi.completeTask, "Follow-up marked done");
  const link = useAction(enquiriesApi.linkPatient, "Enquiry linked to patient");
  const mkPatient = useAction(enquiriesApi.createPatientFrom, (p) => `Patient ${p.id} created (demo data)`);
  const [pick, setPick] = useState("");
  const [confirm, setConfirm] = useState<"create" | null>(null);
  const [needPatient, setNeedPatient] = useState(false);
  useEffect(() => { setNeedPatient(!!askPatient); setPick(""); }, [enquiry?.id, askPatient]);
  const tf = useForm<TaskInput>({ resolver: zodResolver(taskSchema), defaultValues: { due: "", note: "", assigneeId: "" } });

  const e = enquiry;
  const staff = refs?.users.filter((u) => u.status === "Active") ?? [];
  const svc = refs?.services.find((s) => s.id === e?.serviceId);
  const patient = patients?.find((p) => p.id === e?.patientId);
  const closed = e?.status === "Closed" || e?.status === "Not converted";
  /** Suggestions only: a person confirms the link. Shared phones and emails mean a match is never automatic. */
  const matches = useMemo(() => !e || e.patientId ? [] : (patients ?? []).filter((p) => (e.phone && digits(p.phone) === digits(e.phone)) || (e.email && p.email.toLowerCase() === e.email.toLowerCase())), [e, patients]);
  const dupWarn = matches.length > 0;

  const bookEnquiry = useBookEnquiry();
  const book = () => { if (e && !bookEnquiry(e, onClose)) setNeedPatient(true); };
  const createPatient = async () => {
    if (!e) return;
    const [first, ...rest] = e.name.split(" ");
    await mkPatient.run(e.id, { first, last: rest.join(" ") || "-", dob: "", phone: e.phone ?? "", email: e.email ?? "", providerId: "", notes: `Created from enquiry ${e.id} (demo)` }, by);
    setConfirm(null);
  };
  const canCreate = !!(e?.phone && e?.email);

  const footer = e && !readOnly && <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" onClick={() => onEdit(e)}><Pencil className="size-4" />Edit</Button>
        <div className="flex flex-wrap items-center gap-2">
          {!closed && (
            <Menu>
              <MenuTrigger asChild><Button variant="secondary">Mark as<ChevronDown className="size-4" aria-hidden /></Button></MenuTrigger>
              <MenuContent side="top" align="end">
                <MenuItem onSelect={() => setStatus.run(e.id, "Closed", by)}>Closed</MenuItem>
                <MenuItem onSelect={() => setStatus.run(e.id, "Not converted", by)}>Not converted</MenuItem>
              </MenuContent>
            </Menu>)}
          {can("patients") && e.status !== "Appointment booked" && <Button onClick={book}><CalendarPlus className="size-4" />Book appointment</Button>}
        </div>
      </div>;
  const content = (
    <>
      {!e ? <Skeleton className="h-40" /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status"><Select disabled={readOnly} value={e.status} onChange={(x) => (x.target.value === "Appointment booked" ? book() : setStatus.run(e.id, x.target.value as EnquiryStatus, by))}>{ENQUIRY_STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="Assigned to"><Select disabled={readOnly} value={e.assigneeId ?? ""} onChange={(x) => assign.run(e.id, x.target.value, by)}><option value="">Unassigned</option>{staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
          </div>

          <section><H>Contact</H><dl className="divide-y divide-line">
            <Row l="Phone">{readOnly ? <span className="font-normal text-muted">Hidden (view-only)</span> : e.phone ?? <span className="font-normal text-muted">Not given</span>}</Row>
            <Row l="Email">{readOnly ? <span className="font-normal text-muted">Hidden (view-only)</span> : e.email ?? <span className="font-normal text-muted">Not given</span>}</Row>
            <Row l="Requested service">{svc?.name ?? <span className="font-normal text-muted">General enquiry</span>}</Row>
            <Row l="Source">{e.source}{e.campaign && <span className="block text-xs font-normal text-muted">{e.campaign} (demo)</span>}</Row>
            <Row l="Received">{fmtDate(e.received, true)}</Row>
          </dl></section>

          {!readOnly && <section><H>Patient record</H>
            {e.patientId ? (
              <p className="text-[13px]">Linked to <Link className="font-medium text-primary hover:underline" href={`/patients/${e.patientId}`}>{patient ? `${patient.first} ${patient.last}` : e.patientId}</Link> <span className="text-muted">({e.patientId})</span></p>
            ) : (
              <div className="space-y-2.5">
                {needPatient && <Alert tone="warn" title="Link or create a patient first">An appointment is booked for a patient. Link this enquiry to an existing patient or create one below.</Alert>}
                {dupWarn && <Alert tone="info" title="Possible existing patient">Phone or email matches {matches.map((m) => `${m.first} ${m.last}`).join(", ")}. Check it is the same person before linking, as family members can share details.</Alert>}
                <div className="flex gap-2">
                  <Select aria-label="Existing patient" value={pick} onChange={(x) => setPick(x.target.value)}><option value="">Choose an existing patient</option>{[...matches, ...(patients ?? []).filter((p) => !matches.includes(p))].map((p) => <option key={p.id} value={p.id}>{p.first} {p.last} · {p.id}</option>)}</Select>
                  <Button variant="secondary" disabled={!pick} loading={link.pending} onClick={() => link.run(e.id, pick, by)}><Link2 className="size-4" />Link</Button>
                </div>
                <Button size="sm" variant="ghost" disabled={!can("patients")} onClick={() => canCreate ? setConfirm("create") : toast.info("Add both a phone number and an email to the enquiry first")}><UserPlus className="size-4" />Create new patient (demo)</Button>
              </div>)}
          </section>}

          {e.appointment && (
            <section><H>Appointment</H>
              <div className="rounded-lg border border-line px-3 py-2.5 text-[13px]">
                <div className="flex items-start justify-between gap-2"><div>{readOnly ? <><p className="font-medium">Appointment · {fmtDate(e.appointment.date, true)}</p><p className="text-xs text-muted">Details not shown for your role</p></> : <><p className="font-medium">{refs?.services.find((x) => x.id === e.appointment!.serviceId)?.name ?? "Appointment"} · {fmtDate(e.appointment.date, true)} at {fmtTime(e.appointment.time)}</p><p className="text-xs text-muted">{refs?.providers.find((x) => x.id === e.appointment!.providerId)?.short} · {e.appointment.id}</p></>}</div><StatusBadge status={e.appointment.status} /></div>
                {!readOnly && <Button size="sm" variant="secondary" className="mt-2" onClick={() => { onClose(); ui.openAppt(e.appointment!.id); }}>View appointment</Button>}
              </div>
              {e.bookingLost && <div className="mt-2"><Alert tone="warn" title="This appointment was not kept">It was {e.appointment.status === "cancelled" ? "cancelled" : "missed"}, so the enquiry is open again. Book a new appointment to continue. The history below is kept.</Alert></div>}
            </section>)}

          <section><H>Messages</H><CommunicationPanel subject={{ name: e.name, enquiryId: e.id, patientId: e.patientId, appointmentId: e.appointmentId, reach: { email: !!e.email, phone: !!e.phone }, consent: consentFromFlag(patient?.marketingConsent) }} canCompose={!readOnly} canReadText={!readOnly} /></section>

          {e.notes && <section><H>Notes</H><p className="whitespace-pre-wrap text-[13px]">{e.notes}</p></section>}

          <section><H>Next actions</H>
            <ul className="space-y-1.5">
              {e.tasks.length === 0 && <li className="text-[13px] text-muted">No follow-ups planned.</li>}
              {[...e.tasks].sort((a, b) => Number(a.done) - Number(b.done) || a.due.localeCompare(b.due)).map((t) => (
                <li key={t.id} className="flex items-start gap-2.5 rounded-lg border border-line px-3 py-2">
                  <button aria-label={t.done ? "Done" : `Mark done: ${t.note}`} disabled={t.done || readOnly} onClick={() => doneTask.run(e.id, t.id)} className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded border ${t.done ? "border-primary bg-primary text-white" : "border-slate-300 hover:border-primary"}`}>{t.done && <Check className="size-3" strokeWidth={3} />}</button>
                  <div className="min-w-0 flex-1 text-[13px]"><p className={t.done ? "text-muted line-through" : "font-medium"}>{t.note}</p><p className="text-xs text-muted">{!t.done && t.due < TODAY ? <Badge tone="red">Overdue</Badge> : null} Due {fmtDate(t.due, true)}{t.assigneeId ? ` · ${refs?.users.find((u) => u.id === t.assigneeId)?.name ?? ""}` : ""}</p></div>
                </li>))}
            </ul>
            {!closed && !readOnly && (
              <form noValidate className="mt-2.5 grid gap-2 sm:grid-cols-[1fr_140px_auto]" onSubmit={tf.handleSubmit(async (d) => { await addTask.run(e.id, d); tf.reset(); })}>
                <Field label="New follow-up" error={tf.formState.errors.note?.message}><Input placeholder="e.g. Call to offer a consultation" {...tf.register("note")} /></Field>
                <Field label="Due" error={tf.formState.errors.due?.message}><Input type="date" min={TODAY} {...tf.register("due")} /></Field>
                <div className="flex items-end"><Button type="submit" variant="secondary" loading={addTask.pending}>Add</Button></div>
              </form>)}
          </section>

          <section><H>History</H>
            <ol className="space-y-1.5 border-l border-line pl-3.5">{[...e.history].reverse().map((h) => <li key={h.id} className="text-[13px]">{readOnly ? h.text.replace(/[PA]-E?[0-9]+/g, "a record") : h.text}<span className="block text-xs text-muted">{fmtDate(h.at, true)}</span></li>)}</ol>
          </section>
        </div>)}
      <ConfirmDialog open={confirm === "create"} onOpenChange={(o) => !o && setConfirm(null)} title="Create a patient record?" loading={mkPatient.pending}
        description={`This adds ${e?.name} to the demo patient list using the enquiry's phone and email. It is mock data and resets on reload.${dupWarn ? " A possible match was found, so check first." : ""}`}
        cancelLabel="Cancel" confirmLabel="Create patient" onConfirm={createPatient} />
    </>
  );
  if (page) {
    return (
      <div className="mx-auto max-w-4xl">
        <Link href="/enquiries" className="text-[13px] text-primary hover:underline">← All enquiries</Link>
        <BannerSurface variant="enquiry" className="mb-4 mt-2 px-5 py-5 sm:px-6"><div className="flex flex-wrap items-center gap-4"><Avatar name={e?.name ?? "Enquiry"} size={56} tint="rgba(255,255,255,0.85)" /><div className="min-w-0"><h1 className="text-[24px] font-semibold leading-tight tracking-tight">{e?.name ?? "Enquiry"}</h1>{e && <p className="mt-0.5 text-[13px] text-slate-700">{e.id} · received {fmtDate(e.received, true)}</p>}</div>{e && <Badge tone="lavender" className="ml-auto bg-white/80">{e.status}</Badge>}</div></BannerSurface>
        <div className="rounded-xl border border-line bg-white p-5">{content}</div>
        {footer && <div className="mt-4 rounded-xl border border-line bg-white p-3">{footer}</div>}
      </div>
    );
  }
  return (
    <Sheet open={!!e} onOpenChange={(o) => !o && onClose()} width={500} title={e?.name ?? "Enquiry"} description={e ? `${e.id} · received ${fmtDate(e.received, true)}` : undefined} footer={footer}>
      {e && <Link href={`/enquiries/${e.id}`} className="mb-3 inline-block text-[13px] font-medium text-primary hover:underline">Open full page</Link>}
      {content}
    </Sheet>
  );
}
