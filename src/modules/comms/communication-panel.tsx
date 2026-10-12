"use client";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDownLeft, ArrowUpRight, ExternalLink, Mail, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";
import { Alert, Badge, Button, EmptyState, Field, Input, Select, Skeleton, Textarea } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { fmtDate } from "@/lib/db";
import { useAction } from "@/lib/hooks";
import { commsApi } from "./api";
import { checkEligibility, SMS_LIMIT, type Reach } from "./eligibility";
import { useMessages } from "./hooks";
import { composerSchema, type ComposerInput } from "./schemas";
import { messagesFor } from "./select";
import { CHANNEL_LABEL, STATUS_LABEL, type Channel, type Message, type MessageStatus } from "./types";

export interface CommsSubject {
  name: string;
  enquiryId?: string; /** All enquiries of a contact (CRM). */ enquiryIds?: string[]; patientId?: string; appointmentId?: string;
  reach: Reach;
  consent: { status: "granted" | "withdrawn" | "not-recorded" };
}

const ICON: Record<Channel, typeof Mail> = { email: Mail, sms: MessageSquare, call: Phone };
const TONE: Record<MessageStatus, Parameters<typeof Badge>[0]["tone"]> = { draft: "neutral", simulated: "peach", received: "mint", logged: "blue" };
const consentText = (s: CommsSubject["consent"]["status"]) => (s === "granted" ? "Granted" : s === "withdrawn" ? "Withdrawn" : "Not recorded");

/**
 * The one place messages are shown and written. Used in the enquiry panel (with the composer) and in the CRM
 * contact panel (history only). Everything here is a demo: sending is simulated and nothing is delivered.
 */
export function CommunicationPanel({ subject, canCompose, canReadText, onOpenEnquiry }: { subject: CommsSubject; canCompose: boolean; canReadText: boolean; onOpenEnquiry?: (id: string) => void }) {
  const { data, isLoading } = useMessages();
  const list = useMemo(() => messagesFor(data ?? [], subject), [data, subject.enquiryId, subject.enquiryIds, subject.patientId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [composing, setComposing] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Badge tone="peach">Demo mode</Badge>
        <span className="text-muted">Sending is simulated. Nothing is delivered.</span>
      </div>
      <ConsentSummary subject={subject} />
      {canCompose && (composing ? <Composer subject={subject} onDone={() => setComposing(false)} /> : <Button variant="secondary" size="sm" onClick={() => setComposing(true)}>New message or call log</Button>)}
      {isLoading ? <Skeleton className="h-16" /> : list.length === 0 ? <EmptyState title="No messages yet" text="Messages and call logs for this person appear here." /> : (
        <ul className="space-y-2">{list.map((m) => <MessageItem key={m.id} m={m} canReadText={canReadText} onOpenEnquiry={m.enquiryId && m.enquiryId !== subject.enquiryId && onOpenEnquiry ? onOpenEnquiry : undefined} />)}</ul>)}
    </div>
  );
}

/** What this person may be contacted about. Marketing needs an explicit yes, and missing consent is shown as missing. */
export function ConsentSummary({ subject }: { subject: CommsSubject }) {
  const emailMkt = checkEligibility({ channel: "email", purpose: "marketing", reach: subject.reach, consent: subject.consent });
  const smsMkt = checkEligibility({ channel: "sms", purpose: "marketing", reach: subject.reach, consent: subject.consent });
  const row = (label: string, ok: boolean, text: string) => <div className="flex items-center justify-between gap-3 py-1 text-[13px]"><dt className="text-muted">{label}</dt><dd><Badge tone={ok ? "mint" : "neutral"}>{text}</Badge></dd></div>;
  return (
    <dl className="divide-y divide-line rounded-lg border border-line px-3" aria-label="Consent and eligibility">
      {row("Email marketing", emailMkt.eligible, emailMkt.eligible ? "Eligible" : consentText(subject.consent.status))}
      {row("SMS marketing", smsMkt.eligible, smsMkt.eligible ? "Eligible" : "No consent recorded")}
      {row("Service messages", subject.reach.email || subject.reach.phone, subject.reach.email || subject.reach.phone ? "Can be reached" : "No contact details")}
    </dl>
  );
}

function MessageItem({ m, canReadText, onOpenEnquiry }: { m: Message; canReadText: boolean; onOpenEnquiry?: (id: string) => void }) {
  const Icon = ICON[m.channel];
  return (
    <li className="rounded-lg border border-line px-3 py-2 text-[13px]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Icon className="size-4 text-muted" aria-hidden />
        <span className="inline-flex items-center gap-1 font-medium">{m.direction === "incoming" ? <ArrowDownLeft className="size-3.5" aria-hidden /> : <ArrowUpRight className="size-3.5" aria-hidden />}{m.direction === "incoming" ? "Incoming" : "Outgoing"} {CHANNEL_LABEL[m.channel].toLowerCase()}</span>
        <Badge tone={TONE[m.status]}>{STATUS_LABEL[m.status]}</Badge>
        {m.purpose === "marketing" && <Badge tone="lavender">Marketing{m.campaignId ? ` · ${m.campaignId}` : ""}</Badge>}
        <span className="ml-auto text-xs text-muted">{fmtDate(m.at, true)}</span>
      </div>
      {canReadText ? <div className="mt-1.5">{m.subject && <p className="font-medium">{m.subject}</p>}<p className="whitespace-pre-wrap text-slate-600">{m.body}</p></div> : <p className="mt-1.5 text-xs text-muted">Message text is not shown for your role.</p>}
      {(m.by || onOpenEnquiry) && <div className="mt-1 flex items-center justify-between text-xs text-muted"><span>{m.by ? `By ${m.by}` : ""}</span>{onOpenEnquiry && m.enquiryId && <button className="inline-flex items-center gap-1 font-medium text-primary hover:underline" onClick={() => onOpenEnquiry(m.enquiryId!)}><ExternalLink className="size-3" />Open enquiry {m.enquiryId}</button>}</div>}
    </li>
  );
}

function Composer({ subject, onDone }: { subject: CommsSubject; onDone: () => void }) {
  const session = useSession();
  const by = session?.name ?? "Staff";
  const f = useForm<ComposerInput>({ resolver: zodResolver(composerSchema) as never, defaultValues: { channel: "email", direction: "outgoing", purpose: "service", subject: "", body: "" } });
  const v = f.watch(); const { errors } = f.formState;
  const send = useAction(commsApi.send);
  const draft = useAction(commsApi.saveDraft);
  const ids = { enquiryId: subject.enquiryId, patientId: subject.patientId, appointmentId: subject.appointmentId };
  const elig = checkEligibility({ channel: v.channel, purpose: v.channel === "call" ? "service" : v.purpose, reach: subject.reach, consent: subject.consent });
  const isCall = v.channel === "call";
  const submit = f.handleSubmit(async (d) => {
    await send.run({ ...d, direction: isCall ? d.direction : "outgoing", purpose: isCall ? "service" : d.purpose, ...ids }, { reach: subject.reach, consent: subject.consent }, by);
    toast.success(isCall ? "Call logged" : "Demo only: the message was recorded as simulated. Nothing was delivered.");
    onDone();
  });
  const saveDraft = async () => { const d = f.getValues(); if (d.body.trim().length < 3) return f.setError("body", { message: "Write something to save as a draft" }); await draft.run({ ...d, direction: "outgoing", ...ids }, by); toast.success("Draft saved. It has not been sent."); onDone(); };
  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3 rounded-lg border border-line bg-cloud/40 p-3" aria-label="New message">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Channel"><Select {...f.register("channel")}>{(["email", "sms", "call"] as const).map((c) => <option key={c} value={c}>{c === "call" ? "Log a phone call" : CHANNEL_LABEL[c]}</option>)}</Select></Field>
        {isCall ? <Field label="Direction"><Select {...f.register("direction")}><option value="incoming">Incoming call</option><option value="outgoing">Outgoing call</option></Select></Field>
          : <Field label="Purpose"><Select {...f.register("purpose")}><option value="service">Service (about their enquiry or appointment)</option><option value="marketing">Marketing</option></Select></Field>}
      </div>
      {v.channel === "email" && <Field label="Subject" error={errors.subject?.message}><Input {...f.register("subject")} /></Field>}
      <Field label={isCall ? "Call notes" : "Message"} error={errors.body?.message} hint={v.channel === "sms" ? `${v.body.length}/${SMS_LIMIT} characters` : isCall ? "Do not record clinical details." : undefined}><Textarea {...f.register("body")} /></Field>
      {!isCall && (elig.eligible
        ? <Alert tone="success" title="Eligible to send in the demo">{elig.basis}</Alert>
        : <Alert tone="warn" title="Not eligible to send"><ul className="list-disc pl-4">{elig.reasons.map((r) => <li key={r}>{r}</li>)}</ul></Alert>)}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancel</Button>
        {!isCall && <Button type="button" variant="secondary" size="sm" loading={draft.pending} onClick={saveDraft}>Save draft</Button>}
        <Button type="submit" size="sm" loading={send.pending} disabled={!isCall && !elig.eligible}>{isCall ? "Log call" : "Send (demo)"}</Button>
      </div>
    </form>
  );
}
