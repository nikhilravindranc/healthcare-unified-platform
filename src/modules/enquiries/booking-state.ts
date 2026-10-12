import { isLostStatus, isUpcoming } from "@/lib/appointment-rules";
import type { Appointment } from "@/lib/types";
import type { Enquiry, EnquiryActivity, LinkedAppointment } from "./types";

export type ApptLookup = (id: string) => LinkedAppointment | undefined;
export const isLostAppointment = (a?: LinkedAppointment) => !!a && isLostStatus(a.status);
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
    if (!a) continue;
    (a.events ?? []).forEach((ev, i) => derived.push({ id: `d-${a.id}-${i}`, at: ev.at, text: `Appointment ${a.id}: ${ev.text}`, derived: true }));
    if (isLostAppointment(a) && !(a.events ?? []).length) derived.push({ id: `d-${a.id}`, at: a.date, text: `Appointment ${a.id} (${a.date}) was ${verb(a)}`, derived: true });
  }
  if (e.status === "Appointment booked" && (!current || isLostAppointment(current))) { out.status = "Contacted"; out.bookingLost = true; }
  out.history = [...out.history, ...derived];
  return out;
}

/** True when the enquiry currently has a live (not cancelled or missed) appointment. */
export const hasLiveAppointment = (e: Enquiry) => !!e.appointment && !isLostAppointment(e.appointment);

/** Upcoming appointments of the enquiry's patient that could be the booking, so we do not book the same visit twice. */
export function existingBookingCandidates(e: Pick<Enquiry, "patientId" | "serviceId" | "id">, appointments: Appointment[], enquiries: Pick<Enquiry, "id" | "appointmentId">[], today: string): Appointment[] {
  if (!e.patientId) return [];
  const taken = new Set(enquiries.filter((x) => x.id !== e.id && x.appointmentId).map((x) => x.appointmentId));
  return appointments.filter((a) => a.patientId === e.patientId && isUpcoming(a, today) && !taken.has(a.id) && (!e.serviceId || a.serviceId === e.serviceId));
}

