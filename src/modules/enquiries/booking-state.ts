import type { Enquiry, EnquiryActivity, LinkedAppointment } from "./types";

export type ApptLookup = (id: string) => LinkedAppointment | undefined;
const LOST = ["cancelled", "no_show"];
export const isLostAppointment = (a?: LinkedAppointment) => !!a && LOST.includes(a.status);
const verb = (a: LinkedAppointment) => (a.status === "cancelled" ? "cancelled" : "marked as a no-show");

/**
 * Joins an enquiry with the live state of its PMS appointment.
 * - A booked enquiry only counts as "Appointment booked" while its appointment exists and is not cancelled or a no-show.
 * - Otherwise it shows as "Contacted" again, with `bookingLost` set so the UI can offer to rebook.
 * - Stored history is never removed. Cancellations are added as derived entries.
 */
export function resolveBooking(e: Enquiry, lookup: ApptLookup): Enquiry {
  const out: Enquiry = { ...e, history: [...e.history] };
  const derived: EnquiryActivity[] = [];
  const current = e.appointmentId ? lookup(e.appointmentId) : undefined;
  if (current) out.appointment = current;
  for (const id of [...(e.previousAppointmentIds ?? []), ...(e.appointmentId ? [e.appointmentId] : [])]) {
    const a = lookup(id);
    if (isLostAppointment(a)) derived.push({ id: `d-${a!.id}`, at: a!.date, text: `Appointment ${a!.id} (${a!.date}) was ${verb(a!)}`, derived: true });
  }
  if (e.status === "Appointment booked" && (!current || isLostAppointment(current))) { out.status = "Contacted"; out.bookingLost = true; }
  out.history = [...out.history, ...derived];
  return out;
}

/** True when the enquiry currently has a live (not cancelled or missed) appointment. */
export const hasLiveAppointment = (e: Enquiry) => !!e.appointment && !isLostAppointment(e.appointment);
