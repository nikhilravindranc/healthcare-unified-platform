"use client";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Alert, Badge, Button, Checkbox, Field, Input, Select, Sheet, Textarea } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { fmtDate, TODAY } from "@/lib/db";
import { useAction } from "@/lib/hooks";
import { SMS_LIMIT } from "../comms/eligibility";
import { CONTACT_STAGES, SOURCE_FILTER_OPTIONS, type CrmContact } from "../crm/contacts";
import { campaignsApi } from "./api";
import { previewAudience, recipientRefs } from "./audience";
import { AudiencePreviewCard } from "./audience-preview";
import { campaignSchema, type CampaignInput } from "./schemas";
import type { Campaign } from "./types";

const EMPTY: CampaignInput = { name: "", channel: "email", subject: "", body: "", stages: [], sources: [], scheduledFor: "" };
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/**
 * One panel to create, edit and review a campaign. A campaign that has been run in demo mode, or a viewer without the
 * campaigns permission, gets the read-only view. Nothing here sends anything.
 */
export function CampaignSheet({ campaign, creating, canManage, contacts, onClose, onOpen }: { campaign?: Campaign; creating: boolean; canManage: boolean; contacts: CrmContact[]; onClose: () => void; onOpen: (id: string) => void }) {
  const open = creating || !!campaign;
  const session = useSession();
  const by = session?.name ?? "Staff";
  const editable = canManage && (creating || (!!campaign && campaign.status !== "Simulated"));
  const f = useForm<CampaignInput>({ resolver: zodResolver(campaignSchema) as never, defaultValues: EMPTY });
  const v = f.watch(); const { errors } = f.formState;
  const create = useAction(campaignsApi.create);
  const update = useAction(campaignsApi.update, "Campaign saved");
  const schedule = useAction(campaignsApi.schedule);
  const unschedule = useAction(campaignsApi.unschedule, "Moved back to draft");
  const simulate = useAction(campaignsApi.simulate);
  const duplicate = useAction(campaignsApi.duplicate, "Copied as a new draft");
  const remove = useAction(campaignsApi.remove, "Draft deleted");

  useEffect(() => {
    if (!open) return;
    f.reset(campaign ? { name: campaign.name, channel: campaign.channel, subject: campaign.subject, body: campaign.body, stages: campaign.audience.stages, sources: campaign.audience.sources, scheduledFor: campaign.scheduledFor ?? "" } : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campaign?.id]);

  const shownCriteria = editable ? { stages: v.stages ?? [], sources: v.sources ?? [] } : campaign?.audience ?? { stages: [], sources: [] };
  const shownChannel = editable ? v.channel : campaign?.channel ?? "email";
  const preview = useMemo(() => previewAudience(contacts, shownCriteria, shownChannel), [contacts, shownCriteria.stages.join("|"), shownCriteria.sources.join("|"), shownChannel]); // eslint-disable-line react-hooks/exhaustive-deps
  const eligible = preview.eligible.length;
  const channelLabel = shownChannel === "email" ? "email" : "SMS";

  const saveDraft = f.handleSubmit(async (d) => {
    if (creating) { const c = await create.run(d, by); toast.success("Draft created. Nothing has been sent."); onOpen(c.id); }
    else if (campaign) { await update.run(campaign.id, d, by); }
  });
  const doSchedule = f.handleSubmit(async (d) => {
    if (!campaign) return;
    await update.run(campaign.id, d, by);
    try { await schedule.run(campaign.id, d.scheduledFor, eligible); toast.success(`Scheduled for ${fmtDate(d.scheduledFor, true)}. Demo only: nothing will be sent.`); } catch { toast.error("Choose a date, and make sure at least one person is eligible."); }
  });
  const doSimulate = f.handleSubmit(async (d) => {
    if (!campaign) return;
    await update.run(campaign.id, d, by);
    const r = await simulate.run(campaign.id, recipientRefs(preview.eligible), by);
    toast.success(`Demo only: ${r.simulatedRecipients} simulated messages were recorded. Nothing was sent.`);
  });

  const busy = create.pending || update.pending || schedule.pending || simulate.pending;
  const title = creating ? "New campaign" : campaign?.name ?? "Campaign";
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} width={560} title={title} description={creating ? "Configure a campaign and check who it would reach. Nothing is sent." : campaign ? `${campaign.id} · created ${fmtDate(campaign.createdAt, true)} by ${campaign.createdBy}` : undefined}
      footer={editable ? (
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {campaign?.status === "Draft" && <Button variant="ghost" onClick={async () => { await remove.run(campaign.id); onClose(); }} className="mr-auto">Delete draft</Button>}
          {campaign?.status === "Scheduled" && <Button variant="ghost" onClick={() => unschedule.run(campaign.id)} className="mr-auto">Move to draft</Button>}
          <Button variant="secondary" loading={create.pending || update.pending} onClick={saveDraft}>{creating ? "Create draft" : "Save changes"}</Button>
          {!creating && <Button variant="secondary" disabled={busy || eligible < 1 || !v.scheduledFor} onClick={doSchedule} title={eligible < 1 ? "No eligible recipients" : !v.scheduledFor ? "Choose a date first" : undefined}>Schedule (demo)</Button>}
          {!creating && <Button disabled={busy || eligible < 1} loading={simulate.pending} onClick={doSimulate} title={eligible < 1 ? "No eligible recipients" : undefined}>Simulate send</Button>}
        </div>
      ) : campaign && canManage ? <Button variant="secondary" loading={duplicate.pending} onClick={async () => { const c = await duplicate.run(campaign.id, by); onOpen(c.id); }}>Duplicate as new draft</Button> : undefined}>
      <div className="space-y-5">
        <Alert tone="info" title="Demo mode">No email or SMS provider is connected. Scheduling and &ldquo;Simulate send&rdquo; only record what would happen. Nothing is delivered and no real results exist.</Alert>

        {editable ? (
          <form noValidate className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <Field label="Campaign name" required error={errors.name?.message}><Input {...f.register("name")} /></Field>
            <Field label="Channel"><Select {...f.register("channel")}><option value="email">Email</option><option value="sms">SMS</option></Select></Field>

            <fieldset className="space-y-2"><legend className="text-[13px] font-medium">Audience: relationship stage <span className="font-normal text-muted">(none selected = anyone)</span></legend>
              <div className="grid gap-1.5 sm:grid-cols-2">{CONTACT_STAGES.map((s) => <Checkbox key={s} checked={v.stages?.includes(s) ?? false} onChange={() => f.setValue("stages", toggle(v.stages ?? [], s))} label={s} />)}</div></fieldset>
            <fieldset className="space-y-2"><legend className="text-[13px] font-medium">Audience: first-touch source <span className="font-normal text-muted">(none selected = any)</span></legend>
              <div className="grid gap-1.5 sm:grid-cols-2">{SOURCE_FILTER_OPTIONS.map((s) => <Checkbox key={s} checked={v.sources?.includes(s) ?? false} onChange={() => f.setValue("sources", toggle(v.sources ?? [], s))} label={s} />)}</div></fieldset>

            <AudiencePreviewCard preview={preview} channelLabel={channelLabel} />

            {v.channel === "email" && <Field label="Subject" required error={errors.subject?.message}><Input {...f.register("subject")} /></Field>}
            <Field label="Message" required error={errors.body?.message} hint={v.channel === "sms" ? `${v.body.length}/${SMS_LIMIT} characters. Marketing only: appointment confirmations and reminders are not sent from Campaigns.` : "Marketing only: appointment confirmations and reminders are not sent from Campaigns."}><Textarea {...f.register("body")} /></Field>
            {!creating && <Field label="Schedule for" hint="Optional. Demo only: nothing will be sent on this date."><Input type="date" min={TODAY} {...f.register("scheduledFor")} /></Field>}
          </form>
        ) : campaign && (
          <>
            <div className="flex flex-wrap items-center gap-2"><Badge tone={campaign.status === "Simulated" ? "peach" : campaign.status === "Scheduled" ? "blue" : "neutral"}>{campaign.status === "Simulated" ? "Run in demo mode" : campaign.status}</Badge><Badge tone="neutral">{campaign.channel === "email" ? "Email" : "SMS"}</Badge>
              {campaign.scheduledFor && <span className="text-xs text-muted">For {fmtDate(campaign.scheduledFor, true)}</span>}</div>
            <section><h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">Audience</h3>
              <p className="mb-2 text-[13px]">{campaign.audience.stages.length ? campaign.audience.stages.join(", ") : "Any stage"} · {campaign.audience.sources.length ? campaign.audience.sources.join(", ") : "any source"}</p>
              <AudiencePreviewCard preview={preview} channelLabel={channelLabel} />
              {campaign.status === "Simulated" && <p className="mt-1.5 text-xs text-muted">This shows who is eligible now. {campaign.simulatedRecipients !== undefined ? `The demo run on ${fmtDate(campaign.simulatedAt!, true)} recorded ${campaign.simulatedRecipients} simulated messages.` : `Marked as run in demo mode on ${fmtDate(campaign.simulatedAt!, true)}.`}</p>}</section>
            <section><h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">Message</h3>
              {campaign.subject && <p className="text-[13px] font-medium">{campaign.subject}</p>}<p className="whitespace-pre-wrap text-[13px] text-slate-600">{campaign.body}</p></section>
            {campaign.sample && (
              <section><h3 className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted">Performance <Badge tone="peach">Sample data</Badge></h3>
                <dl className="grid grid-cols-4 gap-2 text-center">{(["delivered", "opened", "clicked", "replied"] as const).map((k) => <div key={k} className="rounded-md border border-line px-2 py-2"><dd className="text-lg font-semibold">{campaign.sample![k]}</dd><dt className="text-xs capitalize text-muted">{k}</dt></div>)}</dl>
                <p className="mt-1.5 text-xs text-muted">Made-up figures to show the layout. They are not results, because nothing was ever sent.</p></section>)}
            <section><h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">History</h3>
              <ol className="space-y-1 border-l border-line pl-3.5 text-[13px]">{[...campaign.events].reverse().map((e, i) => <li key={i}>{e.text}<span className="block text-xs text-muted">{fmtDate(e.at, true)}</span></li>)}</ol></section>
          </>
        )}
        {editable && campaign && (
          <section><h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">History</h3>
            <ol className="space-y-1 border-l border-line pl-3.5 text-[13px]">{[...campaign.events].reverse().map((e, i) => <li key={i}>{e.text}<span className="block text-xs text-muted">{fmtDate(e.at, true)}</span></li>)}</ol></section>)}
      </div>
    </Sheet>
  );
}
