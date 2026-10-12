"use client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Field, Input, Select, Sheet, Textarea } from "@/components/ui";
import { TODAY } from "@/lib/db";
import { useAction, useRefs } from "@/lib/hooks";
import { useSession } from "@/lib/auth";
import { enquiriesApi } from "./api";
import { enquirySchema, type EnquiryInput } from "./schemas";
import { ENQUIRY_SOURCES, type Enquiry } from "./types";

const EMPTY: EnquiryInput = { name: "", phone: "", email: "", serviceId: "", source: "Phone call", assigneeId: "", notes: "", nextFollowUp: "" };

/** Create (no `enquiry`) or edit an enquiry. Only contact basics and the reason for enquiring are collected, no clinical details. */
export function EnquiryFormSheet({ open, enquiry, onClose, onSaved }: { open: boolean; enquiry?: Enquiry; onClose: () => void; onSaved?: (e: Enquiry) => void }) {
  const { data: refs } = useRefs();
  const session = useSession();
  const by = session?.name ?? "Staff";
  const create = useAction(enquiriesApi.create, (e) => `Enquiry ${e.id} created`);
  const update = useAction(enquiriesApi.update, "Enquiry updated");
  const f = useForm<EnquiryInput>({ resolver: zodResolver(enquirySchema) as never, defaultValues: EMPTY });
  const { errors } = f.formState;
  const editing = !!enquiry;
  useEffect(() => {
    if (!open) return;
    f.reset(enquiry ? { name: enquiry.name, phone: enquiry.phone ?? "", email: enquiry.email ?? "", serviceId: enquiry.serviceId ?? "", source: enquiry.source, assigneeId: enquiry.assigneeId ?? "", notes: enquiry.notes, nextFollowUp: "" } : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, enquiry?.id]);
  const staff = refs?.users.filter((u) => u.status === "Active") ?? [];
  const submit = f.handleSubmit(async (d) => {
    const saved = editing ? await update.run(enquiry.id, d, by) : await create.run(d, by);
    onSaved?.(saved); onClose();
  });
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={editing ? "Edit enquiry" : "New enquiry"} description={editing ? enquiry.id : "Record who got in touch and what they asked about. Required fields are marked with an asterisk."}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={create.pending || update.pending} onClick={submit}>{editing ? "Save changes" : "Create enquiry"}</Button></>}>
      <form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Name" required error={errors.name?.message}><Input autoComplete="off" {...f.register("name")} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Phone" error={errors.phone?.message} hint="Phone or email is required"><Input type="tel" autoComplete="off" {...f.register("phone")} /></Field>
          <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="off" {...f.register("email")} /></Field>
        </div>
        <Field label="Requested service"><Select {...f.register("serviceId")}><option value="">Not sure / general enquiry</option>{refs?.services.filter((s) => s.status === "Active").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Source" required error={errors.source?.message}><Select {...f.register("source")}>{ENQUIRY_SOURCES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Assigned to"><Select {...f.register("assigneeId")}><option value="">Unassigned</option>{staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
        </div>
        {!editing && <Field label="Next follow-up date" hint="Optional. Creates a first-contact task."><Input type="date" min={TODAY} {...f.register("nextFollowUp")} /></Field>}
        <Field label="Notes" error={errors.notes?.message} hint="Keep to what the person asked. Do not record medical or sensitive details here."><Textarea {...f.register("notes")} /></Field>
      </form>
    </Sheet>
  );
}
