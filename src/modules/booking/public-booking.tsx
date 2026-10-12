"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowLeft, Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Clock, MapPin, Smile, Sparkles, Stethoscope, UserRound, Users, ScanFace, Mail, Phone, CalendarDays, type LucideIcon } from "lucide-react";
import { Alert, Avatar, Badge, Button, Checkbox, EmptyState, Field, Input, Panel, Select, Skeleton, Textarea } from "@/components/ui";
import { addDays, fmtDate, fmtLong, fmtTime, TODAY, toMin } from "@/lib/db";
import { daysBetween } from "@/lib/availability-rules";
import { useRefs } from "@/lib/hooks";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { bookingApi, SlotTakenError } from "./api";
import { bookableServices, dayNote, locationFor, providersForService, slotsFor, upcomingDates, type Slot } from "./availability";
import { PublicShell, useBookingAvailable } from "./public-shell";
import { bookingDetailsSchema, type BookingDetails } from "./schemas";

const STEPS = ["Service", "Provider", "Date & time", "Your details", "Review"] as const;
const EMPTY: BookingDetails = { returning: false, first: "", last: "", email: "", phone: "", notes: "", marketingOptIn: false };
const ICONS: Record<string, LucideIcon> = { Consultation: Stethoscope, Review: ClipboardCheck, Dermatology: ScanFace, Aesthetics: Sparkles, Physiotherapy: Activity, Dental: Smile };
const weekday = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
const monthDay = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** A selectable card: used for services and providers. */
function Choice({ selected, onClick, icon, title, sub, meta }: { selected: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub?: string; meta?: React.ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onClick}
      className={cn("group flex w-full items-center gap-3.5 rounded-xl border bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-px hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40", selected ? "border-primary ring-2 ring-primary/20" : "border-line")}>
      {icon}
      <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold text-ink">{title}</span>{sub && <span className="mt-0.5 block text-[13px] text-muted">{sub}</span>}{meta && <span className="mt-2 flex flex-wrap gap-1.5">{meta}</span>}</span>
      <ChevronRight className="size-4 shrink-0 text-slate-300 transition-colors group-hover:text-primary" aria-hidden />
    </button>
  );
}
const IconTile = ({ icon: Icon, tone = "bg-active text-primary" }: { icon: LucideIcon; tone?: string }) => <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", tone)}><Icon className="size-5" aria-hidden /></span>;

function Stepper({ step, onGo }: { step: number; onGo: (i: number) => void }) {
  return (
    <ol aria-label="Progress" className="flex items-center">
      {STEPS.map((s, i) => {
        const done = i < step, now = i === step;
        return (
          <li key={s} aria-current={now ? "step" : undefined} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
            <button type="button" disabled={!done} onClick={() => onGo(i)} className="flex items-center gap-2 disabled:cursor-default" aria-label={`${i + 1}. ${s}${done ? ", completed" : now ? ", current" : ""}`}>
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-full border text-[13px] font-semibold transition-colors", done ? "border-primary bg-primary text-white" : now ? "border-primary bg-active text-primary" : "border-line bg-white text-muted")}>{done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : i + 1}</span>
              <span className={cn("hidden whitespace-nowrap text-[13px] font-medium md:block", now ? "text-ink" : done ? "text-slate-600" : "text-muted")}>{s}</span>
            </button>
            {i < STEPS.length - 1 && <span className={cn("mx-2 h-0.5 flex-1 rounded sm:mx-3", done ? "bg-primary" : "bg-line")} aria-hidden />}
          </li>);
      })}
    </ol>
  );
}

function SummaryRow({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value?: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg", value ? "bg-active text-primary" : "bg-cloud text-slate-400")}><Icon className="size-4" aria-hidden /></span>
      <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>{value ? <><p className="text-sm font-medium text-ink">{value}</p>{sub && <p className="text-xs text-muted">{sub}</p>}</> : <p className="text-sm text-slate-400">Not chosen yet</p>}</div>
    </div>
  );
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
  const [offset, setOffset] = useState(0);                            // days from today at the start of the visible week
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
  const ruleKey = [st.booking.leadHours, st.booking.windowDays, st.breakStart, st.breakEnd, st.closedDates, st.bufferMin].join("|");
  const slots = useMemo(() => (service && providerIds.length ? slotsFor(providerIds, service.duration, date, st.booking) : []), [service, providerIds.join("|"), date, ruleKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(TODAY, offset + i)), [offset]);
  const weekCounts = useMemo(() => week.map((d) => (service && providerIds.length ? slotsFor(providerIds, service.duration, d, st.booking).length : 0)), [week, service, providerIds.join("|"), ruleKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const provider = refs?.providers.find((p) => p.id === slot?.providerId);
  const chosenProvider = refs?.providers.find((p) => p.id === providerChoice);
  const locations = refs && chosenProvider ? refs.locations.filter((l) => chosenProvider.locationIds.includes(l.id) && l.status === "Open") : [];
  const location = refs && provider ? locationFor(provider, refs.locations, locationPref) : undefined;
  const note = slots.length === 0 && refs ? dayNote(providerIds.map((id) => refs.providers.find((p) => p.id === id)).filter((p) => !!p), date, st.booking) : null;
  const groups = [["Morning", slots.filter((s) => toMin(s.time) < 720)], ["Afternoon", slots.filter((s) => toMin(s.time) >= 720 && toMin(s.time) < 1020)], ["Evening", slots.filter((s) => toMin(s.time) >= 1020)]] as const;
  const lastOffset = st.booking.windowDays > 0 ? st.booking.windowDays : 365;

  const reset = () => { setStep(0); setServiceId(""); setProviderChoice(""); setLocationPref(""); setDate(TODAY); setOffset(0); setSlot(null); setDetails(EMPTY); f.reset(EMPTY); setNotFound(false); setError(""); setDone(null); };
  const goDate = (d: string) => { setDate(d); setOffset(Math.max(0, Math.floor(daysBetween(TODAY, d) / 7) * 7)); setSlot(null); };
  /** Opens on the first date that has a time, so people do not land on an empty day. */
  const openOn = (ids: string[], duration: number) => { for (let i = 0; i <= Math.min(lastOffset, 60); i++) { const d = addDays(TODAY, i); if (slotsFor(ids, duration, d, st.booking).length) return goDate(d); } goDate(TODAY); };

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

  if (!refs) return <PublicShell title="Book an appointment"><Skeleton className="h-72 w-full" /></PublicShell>;
  if (!available || services.length === 0) return <PublicShell title="Book an appointment"><Panel><EmptyState title="Online booking is not available right now" text="Please contact the practice directly to book an appointment." /></Panel></PublicShell>;

  if (done) return (
    <PublicShell narrow title="You're booked in" subtitle="Keep your reference. You will need it, with your email, to change or cancel.">
      <Panel className="overflow-hidden">
        <div className="flex flex-col items-center gap-3 border-b border-dashed border-line bg-[#EAF7F4] px-6 py-8 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-white shadow-sm ring-4 ring-[#C5E8E1]"><CheckCircle2 className="size-8 text-[#2A8577]" aria-hidden /></span>
          <div><p className="text-xs font-semibold uppercase tracking-wide text-[#1E6B61]">Booking reference</p><p className="text-3xl font-semibold tracking-wide text-ink">{done.reference}</p></div>
          <Badge tone="mint">Confirmed (demo)</Badge>
        </div>
        <dl className="divide-y divide-line px-6 text-[14px]">
          {[["Service", service?.name], ["With", provider?.name], ["Where", location?.name], ["When", slot ? `${fmtLong(date)} at ${fmtTime(slot.time)}` : ""]].map(([l, v]) => <div key={l} className="flex justify-between gap-4 py-3"><dt className="text-muted">{l}</dt><dd className="text-right font-medium">{v}</dd></div>)}
        </dl>
        <div className="space-y-4 border-t border-line bg-cloud/40 p-6">
          <Alert tone="warn" title="Demo only">No confirmation email or text message was sent.</Alert>
          <div className="flex flex-wrap gap-2"><Link href={`/book/manage?ref=${done.reference}`} className="flex-1"><Button variant="secondary" className="w-full">Manage this booking</Button></Link><Button className="flex-1" onClick={reset}>Book another</Button></div>
        </div>
      </Panel>
    </PublicShell>
  );

  const showProvider = providerChoice === "any" ? (provider ? provider.name : "Any available provider") : chosenProvider?.name;
  return (
    <PublicShell title="Book an appointment" subtitle={`Choose a service and a time that suits you at ${st.clinicName}. It takes about a minute.`}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Panel className="px-4 py-4 sm:px-6"><Stepper step={step} onGo={(i) => { setError(""); setStep(i); }} /></Panel>
          {error && <Alert tone="error">{error}</Alert>}

          <Panel className="p-5 sm:p-6">
            {step === 0 && (
              <section aria-labelledby="s0">
                <h2 id="s0" className="text-lg font-semibold">What would you like to book?</h2>
                <p className="mb-4 mt-0.5 text-sm text-muted">Choose a service to see who offers it.</p>
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Choose a service">
                  {services.map((s) => {
                    const n = providersForService(refs.providers, s).length;
                    return <Choice key={s.id} selected={serviceId === s.id} icon={<IconTile icon={ICONS[s.category ?? ""] ?? Stethoscope} />} title={s.name} sub={s.category}
                      meta={<><Badge tone="neutral"><Clock className="size-3" aria-hidden />{s.duration} min</Badge><Badge tone="blue">{n} provider{n === 1 ? "" : "s"}</Badge></>}
                      onClick={() => { setServiceId(s.id); setProviderChoice(""); setSlot(null); setStep(1); }} />;
                  })}
                </div>
              </section>)}

            {step === 1 && service && (
              <section aria-labelledby="s1">
                <h2 id="s1" className="text-lg font-semibold">Who would you like to see?</h2>
                <p className="mb-4 mt-0.5 text-sm text-muted">{service.name}, {service.duration} minutes</p>
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Choose a provider">
                  <Choice selected={providerChoice === "any"} icon={<IconTile icon={Users} tone="bg-[#DDF3EF] text-[#1E6B61]" />} title="Any available provider" sub="We will pick whoever is free at your time" meta={<Badge tone="mint">More times to choose from</Badge>}
                    onClick={() => { setProviderChoice("any"); setSlot(null); openOn(providers.map((p) => p.id), service.duration); setStep(2); }} />
                  {providers.map((p) => {
                    const places = refs.locations.filter((l) => p.locationIds.includes(l.id) && l.status === "Open").map((l) => l.name);
                    return <Choice key={p.id} selected={providerChoice === p.id} icon={<Avatar name={p.name} size={44} tint={`${p.color}26`} />} title={p.name} sub={p.specialty} meta={places.length > 0 && <Badge tone="neutral"><MapPin className="size-3" aria-hidden />{places.join(", ")}</Badge>}
                      onClick={() => { setProviderChoice(p.id); setLocationPref(p.locationIds[0]); setSlot(null); openOn([p.id], service.duration); setStep(2); }} />;
                  })}
                </div>
                {providers.length === 0 && <div className="mt-3"><Alert tone="warn">No provider is offering this service online right now.</Alert></div>}
                <div className="mt-5"><Button variant="ghost" onClick={() => setStep(0)}><ArrowLeft className="size-4" aria-hidden />Back</Button></div>
              </section>)}

            {step === 2 && service && (
              <section aria-labelledby="s2" className="space-y-5">
                <div><h2 id="s2" className="text-lg font-semibold">Pick a date and time</h2><p className="mt-0.5 text-sm text-muted">{service.name} · {service.duration} minutes</p></div>
                {locations.length > 1 && <Field label="Location"><Select value={locationPref} onChange={(e) => setLocationPref(e.target.value)}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field>}

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium">{monthDay(week[0])} to {monthDay(week[6])}</p>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="secondary" aria-label="Previous week" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 7))}><ChevronLeft className="size-4" /></Button>
                      <Button size="sm" variant="secondary" aria-label="Next week" disabled={offset + 7 > lastOffset} onClick={() => setOffset(offset + 7)}><ChevronRight className="size-4" /></Button>
                    </div>
                  </div>
                  <div role="radiogroup" aria-label="Choose a date" className="grid grid-cols-7 gap-1.5 sm:gap-2">
                    {week.map((d, i) => {
                      const ok = weekCounts[i] > 0, on = d === date;
                      return (
                        <button key={d} type="button" role="radio" aria-checked={on} disabled={!ok} onClick={() => { setDate(d); setSlot(null); }}
                          aria-label={`${fmtLong(d)}, ${ok ? `${weekCounts[i]} times available` : "no times available"}`}
                          className={cn("flex flex-col items-center rounded-xl border px-1 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40", on ? "border-primary bg-primary text-white shadow-sm" : ok ? "border-line bg-white hover:border-primary/50" : "cursor-not-allowed border-transparent bg-cloud/60 text-slate-300")}>
                          <span className={cn("text-[11px] font-medium uppercase tracking-wide", on ? "text-white/80" : ok ? "text-muted" : "")}>{weekday(d)}</span>
                          <span className="text-lg font-semibold leading-tight">{Number(d.slice(8))}</span>
                          <span className={cn("mt-1 size-1.5 rounded-full", on ? "bg-white" : ok ? "bg-[#3FA797]" : "bg-transparent")} aria-hidden />
                        </button>);
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted"><span>Need another week?</span><Input type="date" aria-label="Jump to a date" className="h-8 w-40 text-[13px]" min={TODAY} max={st.booking.windowDays > 0 ? upcomingDates(st.booking.windowDays + 1).at(-1) : undefined} value={date} onChange={(e) => goDate(e.target.value || TODAY)} /></div>
                </div>

                <div>
                  <p className="mb-3 text-sm font-medium">{fmtLong(date)}</p>
                  {slots.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-line bg-cloud/40 px-4 py-8 text-center"><CalendarDays className="mx-auto mb-2 size-6 text-slate-400" aria-hidden /><p className="text-sm font-medium">No times on this date</p><p className="mt-0.5 text-[13px] text-muted">{note ?? "Everything is booked."} Try another date.</p></div>
                  ) : (
                    <div role="radiogroup" aria-label="Available times" className="space-y-4">
                      {groups.filter(([, g]) => g.length > 0).map(([label, g]) => (
                        <div key={label}><p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                            {g.map((s) => <button key={s.time} type="button" role="radio" aria-checked={slot?.time === s.time} onClick={() => setSlot(s)} className={cn("rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40", slot?.time === s.time ? "border-primary bg-primary text-white shadow-sm" : "border-line bg-white hover:border-primary/60 hover:bg-active")}>{fmtTime(s.time)}</button>)}
                          </div></div>))}
                    </div>)}
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-line pt-4"><Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="size-4" aria-hidden />Back</Button><Button disabled={!slot} onClick={() => setStep(3)}>Continue</Button></div>
              </section>)}

            {step === 3 && (
              <form noValidate aria-labelledby="s3" className="space-y-5" onSubmit={(e) => { e.preventDefault(); submitDetails(); }}>
                <div><h2 id="s3" className="text-lg font-semibold">Your details</h2><p className="mt-0.5 text-sm text-muted">We need these to hold your appointment.</p></div>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-cloud p-1" role="radiogroup" aria-label="Have you visited before?">
                  {[[false, "I am new here"], [true, "I have been here before"]].map(([v, l]) => <button key={String(v)} type="button" role="radio" aria-checked={f.watch("returning") === v} onClick={() => { f.setValue("returning", v as boolean); setNotFound(false); }} className={cn("rounded-lg px-3 py-2 text-sm font-medium transition-colors", f.watch("returning") === v ? "bg-white text-primary shadow-sm" : "text-slate-600 hover:text-ink")}>{l as string}</button>)}
                </div>
                <div className="grid gap-4 sm:grid-cols-2"><Field label="First name" required error={errors.first?.message}><Input autoComplete="given-name" {...f.register("first")} /></Field><Field label="Last name" required error={errors.last?.message}><Input autoComplete="family-name" {...f.register("last")} /></Field></div>
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Email" required error={errors.email?.message}><Input type="email" autoComplete="email" {...f.register("email")} /></Field><Field label="Phone" required error={errors.phone?.message}><Input type="tel" autoComplete="tel" {...f.register("phone")} /></Field></div>
                <Field label="Anything we should know?" error={errors.notes?.message} hint="Optional. Please do not include medical details."><Textarea {...f.register("notes")} /></Field>
                {!f.watch("returning") && <div className="rounded-xl border border-line bg-cloud/40 p-4"><Checkbox checked={f.watch("marketingOptIn")} onChange={(c) => f.setValue("marketingOptIn", c)} label={<><span className="font-medium">Send me news and offers by email</span><span className="block text-xs text-muted">Optional. Leave this off and you will only get messages about your booking.</span></>} /></div>}
                {notFound && <Alert tone="warn" title="We could not find a matching record" action={<Button size="sm" variant="secondary" onClick={continueAsNew}>Continue as new</Button>}>Check the email and last name you used before. You can also continue as a new patient.</Alert>}
                <div className="flex items-center justify-between gap-2 border-t border-line pt-4"><Button type="button" variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="size-4" aria-hidden />Back</Button><Button type="submit" loading={busy}>Review booking</Button></div>
              </form>)}

            {step === 4 && service && slot && (
              <section aria-labelledby="s4" className="space-y-5">
                <div><h2 id="s4" className="text-lg font-semibold">Check and confirm</h2><p className="mt-0.5 text-sm text-muted">Make sure everything looks right.</p></div>
                <dl className="divide-y divide-line overflow-hidden rounded-xl border border-line text-sm">
                  {([["Service", `${service.name} (${service.duration} min)`, 0], ["With", provider?.name, 1], ["Where", location?.name, 2], ["When", `${fmtLong(date)} at ${fmtTime(slot.time)}`, 2], ["Name", `${details.first} ${details.last}`, 3], ["Contact", `${details.email} · ${details.phone}`, 3], ["Patient", details.returning ? "Returning patient" : "New patient", 3]] as const).map(([l, v, to]) => (
                    <div key={l} className="flex items-center justify-between gap-4 px-4 py-3"><dt className="text-muted">{l}</dt><dd className="flex items-center gap-3 text-right font-medium">{v}<button type="button" onClick={() => setStep(to)} className="text-xs font-medium text-primary hover:underline">Change</button></dd></div>))}
                </dl>
                <p className="text-xs text-muted">{details.marketingOptIn ? <><Badge tone="mint">Marketing emails: yes</Badge> You can change this later.</> : "You will not receive marketing emails unless you opt in."}</p>
                <div className="flex items-center justify-between gap-2 border-t border-line pt-4"><Button variant="ghost" onClick={() => setStep(3)}><ArrowLeft className="size-4" aria-hidden />Back</Button><Button loading={busy} onClick={confirm}>Confirm booking</Button></div>
              </section>)}
          </Panel>
        </div>

        <aside aria-label="Your appointment" className="lg:sticky lg:top-24 lg:self-start">
          <Panel className="overflow-hidden">
            <div className="border-b border-line bg-gradient-to-r from-active to-white px-5 py-3.5"><h2 className="text-sm font-semibold">Your appointment</h2></div>
            <div className="divide-y divide-line px-5">
              <SummaryRow icon={ClipboardCheck} label="Service" value={service?.name} sub={service ? `${service.duration} minutes` : undefined} />
              <SummaryRow icon={UserRound} label="Provider" value={showProvider} sub={provider && providerChoice === "any" ? provider.specialty : chosenProvider?.specialty} />
              <SummaryRow icon={CalendarDays} label="Date and time" value={slot ? `${fmtDate(date, true)} at ${fmtTime(slot.time)}` : undefined} />
              <SummaryRow icon={MapPin} label="Location" value={location?.name} sub={location?.address} />
            </div>
            <div className="space-y-2 border-t border-line bg-cloud/50 px-5 py-4 text-xs text-muted">
              <p>You can change or cancel online with your reference and email.</p>
              {st.phone && <p className="flex items-center gap-1.5"><Phone className="size-3.5" aria-hidden />Questions? Call {st.phone}</p>}
              <p className="flex items-center gap-1.5"><Mail className="size-3.5" aria-hidden />Confirmation messages are not sent in this demo.</p>
            </div>
          </Panel>
        </aside>
      </div>
    </PublicShell>
  );
}
