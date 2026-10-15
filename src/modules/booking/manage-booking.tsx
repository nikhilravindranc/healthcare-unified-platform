"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, ConfirmDialog, Field, Input, Panel, Skeleton } from "@/components/ui";
import { addDays, fmtDate, fmtTime, TODAY } from "@/lib/db";
import { useRefs } from "@/lib/hooks";
import { useSettings } from "@/lib/settings";
import { bookingApi, SlotTakenError, type PublicBooking } from "./api";
import { dayNote, slotsFor } from "./availability";
import { PublicShell } from "./public-shell";
import { manageLookupSchema, type ManageLookup } from "./schemas";

/**
 * Self-service change or cancellation of an online booking. In the demo the reference and email are the only proof of identity,
 * which is not enough for a real service. Only the appointment's date, time, service, provider and place are shown.
 */
export function ManageBooking({ initialReference = "" }: { initialReference?: string }) {
  const embed = useSearchParams().get("embed") === "1";
  const { data: refs } = useRefs();
  const qc = useQueryClient();
  const f = useForm<ManageLookup>({ resolver: zodResolver(manageLookupSchema), defaultValues: { reference: initialReference, email: "" } });
  const { errors } = f.formState;
  const [email, setEmail] = useState("");
  const [booking, setBooking] = useState<PublicBooking | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [changing, setChanging] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [date, setDate] = useState(TODAY);
  const [time, setTime] = useState("");

  const service = refs?.services.find((s) => s.id === booking?.serviceId);
  const st = useSettings();
  const provider = refs?.providers.find((p) => p.id === booking?.providerId);
  const slots = useMemo(() => (booking && service ? slotsFor([booking.providerId], service.duration, date, st.booking) : []), [booking, service, date, st.booking, st.breakStart, st.breakEnd, st.closedDates, st.bufferMin]); // eslint-disable-line react-hooks/exhaustive-deps
  const look = f.handleSubmit(async (d) => { setBusy(true); setMsg(null); setMissing(false); try { const b = await bookingApi.find(d.reference, d.email); setEmail(d.email); setBooking(b); setMissing(!b); } finally { setBusy(false); } });
  const refresh = async (b: PublicBooking, text: string) => { setBooking(b); setMsg({ tone: "success", text }); setChanging(false); await qc.invalidateQueries(); };
  const cancel = async () => { setBusy(true); try { await refresh(await bookingApi.cancel(booking!.reference, email), "Your booking is cancelled. Demo only: no email or text was sent."); } catch { setMsg({ tone: "error", text: "This booking cannot be changed." }); } finally { setBusy(false); setConfirm(false); } };
  const move = async () => { setBusy(true); try { await refresh(await bookingApi.reschedule(booking!.reference, email, date, time), "Your booking has been moved. Demo only: no email or text was sent."); } catch (e) { setMsg({ tone: "error", text: e instanceof SlotTakenError ? e.message : "This booking cannot be changed." }); } finally { setBusy(false); } };

  if (!refs) return <PublicShell narrow title="Manage your booking" subtitle="Enter the reference you were given and the email you booked with."><Skeleton className="h-48 w-full" /></PublicShell>;
  return (
    <PublicShell narrow title="Manage your booking" subtitle="Enter the reference you were given and the email you booked with.">
      {!booking ? (
        <Panel className="p-5 sm:p-6"><form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); look(); }}>
          <Field label="Booking reference" required error={errors.reference?.message}><Input autoComplete="off" {...f.register("reference")} /></Field>
          <Field label="Email" required error={errors.email?.message}><Input type="email" autoComplete="email" {...f.register("email")} /></Field>
          {missing && <Alert tone="warn" title="We could not find that booking">Check the reference and email. Only bookings made on this page can be managed here.</Alert>}
          <div className="flex justify-between"><Link href={embed ? "/book?embed=1" : "/book"}><Button type="button" variant="ghost">Book an appointment</Button></Link><Button type="submit" loading={busy}>Find booking</Button></div>
        </form></Panel>
      ) : (
        <Panel className="space-y-4 p-5">
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted">Reference {booking.reference}</p><p className="text-base font-semibold">{service?.name}</p></div><Badge tone={booking.status === "cancelled" ? "red" : "mint"}>{booking.status === "cancelled" ? "Cancelled" : "Booked"}</Badge></div>
          <dl className="divide-y divide-line rounded-lg border border-line text-[13px]">
            {[["With", refs.providers.find((p) => p.id === booking.providerId)?.name], ["Where", refs.locations.find((l) => l.id === booking.locationId)?.name], ["When", `${fmtDate(booking.date, true)} at ${fmtTime(booking.time)}`]].map(([l, v]) => <div key={l} className="flex justify-between gap-4 px-3 py-2"><dt className="text-muted">{l}</dt><dd className="text-right font-medium">{v}</dd></div>)}
          </dl>
          {booking.canChange ? (
            changing ? (
              <div className="space-y-3 rounded-lg border border-line p-3">
                <Field label="New date"><Input type="date" min={TODAY} max={st.booking.windowDays > 0 ? addDays(TODAY, st.booking.windowDays) : undefined} value={date} onChange={(e) => { setDate(e.target.value || TODAY); setTime(""); }} /></Field>
                <div role="radiogroup" aria-label="Available times" className="grid grid-cols-3 gap-2 sm:grid-cols-4">{slots.length === 0 ? <p className="col-span-full text-sm text-muted">{dayNote(provider ? [provider] : [], date, st.booking) ?? "No times are available on this date."}</p> : slots.map((s) => <button key={s.time} type="button" role="radio" aria-checked={time === s.time} onClick={() => setTime(s.time)} className={`rounded-lg border px-2 py-2 text-sm font-medium ${time === s.time ? "border-primary bg-active text-primary" : "border-line bg-white"}`}>{fmtTime(s.time)}</button>)}</div>
                <p className="text-xs text-muted">Sample availability for the demo.</p>
                <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setChanging(false)}>Keep my time</Button><Button disabled={!time} loading={busy} onClick={move}>Confirm new time</Button></div>
              </div>
            ) : <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => { setChanging(true); setDate(booking.date); }}>Change time</Button><Button variant="secondary" onClick={() => setConfirm(true)}>Cancel booking</Button></div>
          ) : <p className="text-sm text-muted">This booking can no longer be changed here. Please contact the practice.</p>}
          <div className="flex justify-between"><Button variant="ghost" onClick={() => { setBooking(null); setMsg(null); setChanging(false); }}>Look up another</Button><Link href={embed ? "/book?embed=1" : "/book"}><Button variant="ghost">Book an appointment</Button></Link></div>
        </Panel>)}
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Cancel this booking?" description="Your time will be released." cancelLabel="Keep booking" confirmLabel="Cancel booking" danger loading={busy} onConfirm={cancel} />
    </PublicShell>
  );
}
