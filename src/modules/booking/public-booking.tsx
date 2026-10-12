"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Alert, Badge, Button, Checkbox, EmptyState, Field, Input, Panel, Select, Skeleton, Textarea } from "@/components/ui";
import { fmtDate, fmtTime, TODAY } from "@/lib/db";
import { useRefs } from "@/lib/hooks";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { bookingApi, SlotTakenError } from "./api";
import { bookableServices, dayNote, locationFor, providersForService, slotsFor, upcomingDates, type Slot } from "./availability";
import { PublicShell, useBookingAvailable } from "./public-shell";
import { bookingDetailsSchema, type BookingDetails } from "./schemas";

const STEPS = ["Service", "Provider", "Time", "Your details", "Review"] as const;
const EMPTY: BookingDetails = { returning: false, first: "", last: "", email: "", phone: "", notes: "", marketingOptIn: false };

function Choice({ selected, onClick, title, sub }: { selected: boolean; onClick: () => void; title: string; sub?: string }) {
  return <button type="button" role="radio" aria-checked={selected} onClick={onClick} className={cn("w-full rounded-xl border bg-white px-4 py-3 text-left transition-colors hover:border-primary/50", selected ? "border-primary ring-2 ring-primary/20" : "border-line")}><span className="block text-sm font-medium">{title}</span>{sub && <span className="block text-xs text-muted">{sub}</span>}</button>;
}

export function PublicBooking() {
  const { data: refs } = useRefs();
  const st = useSettings();
  const available = useBookingAvailable();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState("");
  const [providerChoice, setProviderChoice] = useState("");           // "any" or a provider id
  const [locationPref, setLocationPref] = useState("");
  const [date, setDate] = useState(TODAY);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [details, setDetails] = useState<BookingDetails>(EMPTY);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ reference: string; isNew: boolean } | null>(null);
  const f = useForm<BookingDetails>({ resolver: zodResolver(bookingDetailsSchema), defaultValues: EMPTY });
  const { errors } = f.formState;

  const services = useMemo(() => (refs ? bookableServices(refs.services, st.booking) : []), [refs, st.booking]);
  const service = services.find((s) => s.id === serviceId);
  const providers = useMemo(() => (refs && service ? providersForService(refs.providers, service) : []), [refs, service]);
  const providerIds = providerChoice === "any" ? providers.map((p) => p.id) : providerChoice ? [providerChoice] : [];
  const slots = useMemo(() => (service && providerIds.length ? slotsFor(providerIds, service.duration, date, st.booking) : []), [service, providerIds.join("|"), date, st.booking, st.breakStart, st.breakEnd, st.closedDates, st.bufferMin]); // eslint-disable-line react-hooks/exhaustive-deps
  const provider = refs?.providers.find((p) => p.id === slot?.providerId);
  const chosenProvider = refs?.providers.find((p) => p.id === providerChoice);
  const locations = refs && chosenProvider ? refs.locations.filter((l) => chosenProvider.locationIds.includes(l.id) && l.status === "Open") : [];
  const location = refs && provider ? locationFor(provider, refs.locations, locationPref) : undefined;

  const reset = () => { setStep(0); setServiceId(""); setProviderChoice(""); setLocationPref(""); setDate(TODAY); setSlot(null); setDetails(EMPTY); f.reset(EMPTY); setNotFound(false); setError(""); setDone(null); };

  const submitDetails = f.handleSubmit(async (d) => {
    setError(""); setBusy(true);
    try {
      if (d.returning && !notFound) {
        const hit = await bookingApi.findReturning(d.email, d.last);
        if (!hit) { setNotFound(true); setDetails(d); return; }
      }
      setDetails(d); setStep(4);
    } finally { setBusy(false); }
  });
  const continueAsNew = () => { const d = { ...f.getValues(), returning: false }; f.setValue("returning", false); setDetails(d); setNotFound(false); setStep(4); };

  const confirm = async () => {
    if (!slot || !service || !location) return;
    setBusy(true); setError("");
    try {
      const r = await bookingApi.book({ serviceId: service.id, providerId: slot.providerId, locationId: location.id, date, time: slot.time, details });
      await qc.invalidateQueries(); setDone({ reference: r.reference, isNew: r.isNew });
    } catch (e) {
      if (e instanceof SlotTakenError) { setError(e.message); setSlot(null); setStep(2); } else setError("Something went wrong. Please try again.");
    } finally { setBusy(false); }
  };

  if (!refs) return <PublicShell><Skeleton className="h-64 w-full" /></PublicShell>;
  if (!available || services.length === 0) return <PublicShell><Panel><EmptyState title="Online booking is not available right now" text="Please contact the practice directly to book an appointment." /></Panel></PublicShell>;

  if (done) return (
    <PublicShell>
      <Panel className="space-y-4 p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-[#2A8577]" aria-hidden />
        <h1 className="text-xl font-semibold">Your booking is confirmed (demo)</h1>
        <p className="text-sm text-muted">Reference <span className="font-semibold text-ink">{done.reference}</span>. Keep it, and the email you used, to change or cancel your booking.</p>
        <dl className="mx-auto max-w-sm divide-y divide-line rounded-lg border border-line text-left text-[13px]">
          {[["Service", service?.name], ["With", provider?.name], ["Where", location?.name], ["When", slot ? `${fmtDate(date, true)} at ${fmtTime(slot.time)}` : ""]].map(([l, v]) => <div key={l} className="flex justify-between gap-4 px-3 py-2"><dt className="text-muted">{l}</dt><dd className="text-right font-medium">{v}</dd></div>)}
        </dl>
        <Alert tone="warn" title="Demo only">No confirmation email or text message was sent.</Alert>
        <div className="flex flex-wrap justify-center gap-2"><Link href={`/book/manage?ref=${done.reference}`}><Button variant="secondary">Manage this booking</Button></Link><Button onClick={reset}>Book another</Button></div>
      </Panel>
    </PublicShell>
  );

  return (
    <PublicShell>
      <h1 className="text-2xl font-semibold tracking-tight">Book an appointment</h1>
      <ol className="mb-5 mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Progress">{STEPS.map((s, i) => <li key={s} aria-current={i === step ? "step" : undefined} className={cn("font-medium", i === step ? "text-primary" : i < step ? "text-slate-600" : "text-muted")}>{i + 1}. {s}</li>)}</ol>
      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}

      {step === 0 && (
        <section className="space-y-2" role="radiogroup" aria-label="Choose a service">
          {services.map((s) => <Choice key={s.id} selected={serviceId === s.id} onClick={() => { setServiceId(s.id); setProviderChoice(""); setSlot(null); setStep(1); }} title={s.name} sub={`${s.duration} minutes${s.category ? ` · ${s.category}` : ""}`} />)}
        </section>)}

      {step === 1 && service && (
        <section className="space-y-3">
          <p className="text-sm text-muted">{service.name}, {service.duration} minutes</p>
          <div className="space-y-2" role="radiogroup" aria-label="Choose a provider">
            <Choice selected={providerChoice === "any"} onClick={() => { setProviderChoice("any"); setSlot(null); setStep(2); }} title="Any available provider" sub="We will pick whoever is free at your time" />
            {providers.map((p) => <Choice key={p.id} selected={providerChoice === p.id} onClick={() => { setProviderChoice(p.id); setLocationPref(p.locationIds[0]); setSlot(null); setStep(2); }} title={p.name} sub={p.specialty} />)}
          </div>
          {providers.length === 0 && <Alert tone="warn">No provider is offering this service online right now.</Alert>}
          <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
        </section>)}

      {step === 2 && service && (
        <section className="space-y-4">
          {locations.length > 1 && <Field label="Location"><Select value={locationPref} onChange={(e) => setLocationPref(e.target.value)}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>}
          <Field label="Date"><Input type="date" min={TODAY} max={upcomingDates(st.booking.windowDays > 0 ? st.booking.windowDays + 1 : 366).at(-1)} value={date} onChange={(e) => { setDate(e.target.value || TODAY); setSlot(null); }} /></Field>
          <div role="radiogroup" aria-label="Available times" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.length === 0 ? <p className="col-span-full text-sm text-muted">{dayNote(providerIds.map((id) => refs.providers.find((p) => p.id === id)).filter((p) => !!p), date, st.booking) ?? "No times are available on this date."} Try another date.</p>
              : slots.map((s) => <button key={s.time} type="button" role="radio" aria-checked={slot?.time === s.time} onClick={() => setSlot(s)} className={cn("rounded-lg border px-2 py-2 text-sm font-medium", slot?.time === s.time ? "border-primary bg-active text-primary" : "border-line bg-white hover:border-primary/50")}>{fmtTime(s.time)}</button>)}
          </div>
          <p className="text-xs text-muted">Sample availability for the demo. It is not updated in real time.</p>
          <div className="flex justify-between gap-2"><Button variant="ghost" onClick={() => setStep(1)}>Back</Button><Button disabled={!slot} onClick={() => setStep(3)}>Continue</Button></div>
        </section>)}

      {step === 3 && (
        <form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); submitDetails(); }}>
          <div className="flex gap-2" role="radiogroup" aria-label="Have you visited before?">
            {[[false, "I am new here"], [true, "I have been here before"]].map(([v, l]) => <button key={String(v)} type="button" role="radio" aria-checked={f.watch("returning") === v} onClick={() => { f.setValue("returning", v as boolean); setNotFound(false); }} className={cn("flex-1 rounded-lg border px-3 py-2 text-sm font-medium", f.watch("returning") === v ? "border-primary bg-active text-primary" : "border-line bg-white")}>{l as string}</button>)}
          </div>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="First name" required error={errors.first?.message}><Input autoComplete="given-name" {...f.register("first")} /></Field><Field label="Last name" required error={errors.last?.message}><Input autoComplete="family-name" {...f.register("last")} /></Field></div>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Email" required error={errors.email?.message}><Input type="email" autoComplete="email" {...f.register("email")} /></Field><Field label="Phone" required error={errors.phone?.message}><Input type="tel" autoComplete="tel" {...f.register("phone")} /></Field></div>
          <Field label="Anything we should know?" error={errors.notes?.message} hint="Optional. Please do not include medical details."><Textarea {...f.register("notes")} /></Field>
          {!f.watch("returning") && <Checkbox checked={f.watch("marketingOptIn")} onChange={(c) => f.setValue("marketingOptIn", c)} label="I agree to receive marketing emails from the practice (optional)" />}
          {notFound && <Alert tone="warn" title="We could not find a matching record" action={<Button size="sm" variant="secondary" onClick={continueAsNew}>Continue as a new patient</Button>}>Check the email and last name you used before. You can also continue as a new patient.</Alert>}
          <div className="flex justify-between gap-2"><Button type="button" variant="ghost" onClick={() => setStep(2)}>Back</Button><Button type="submit" loading={busy}>Review booking</Button></div>
        </form>)}

      {step === 4 && service && slot && (
        <section className="space-y-4">
          <dl className="divide-y divide-line rounded-xl border border-line bg-white text-sm">
            {[["Service", `${service.name} (${service.duration} min)`], ["With", provider?.name], ["Where", location?.name], ["When", `${fmtDate(date, true)} at ${fmtTime(slot.time)}`], ["Name", `${details.first} ${details.last}`], ["Contact", `${details.email} · ${details.phone}`], ["Patient", details.returning ? "Returning patient" : "New patient"]].map(([l, v]) => <div key={l} className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-muted">{l}</dt><dd className="text-right font-medium">{v}</dd></div>)}
          </dl>
          <p className="text-xs text-muted">{details.marketingOptIn ? <><Badge tone="neutral">Marketing emails: yes</Badge> You can change this later.</> : "You will not receive marketing emails unless you opt in."}</p>
          <div className="flex justify-between gap-2"><Button variant="ghost" onClick={() => setStep(3)}>Back</Button><Button loading={busy} onClick={confirm}>Confirm booking</Button></div>
        </section>)}
    </PublicShell>
  );
}
