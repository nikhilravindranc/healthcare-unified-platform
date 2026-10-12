/**
 * Online booking data access (frontend demo). It reuses the existing PMS patient and appointment APIs, so a booking made here is
 * an ordinary appointment that every internal screen shows. A real implementation would be a public, authenticated service.
 */
import { api, appointments, checkConflicts, getProvider, getService, patients, TODAY } from "@/lib/db";
import { canReschedule } from "@/lib/appointment-rules";
import { rooms } from "@/lib/db";
import type { Appointment } from "@/lib/types";
import { enquiriesApi } from "../enquiries/api";
import { onlineIssue, pickRoom } from "./availability";
import type { BookingDetails } from "./schemas";

export interface BookingRequest { serviceId: string; providerId: string; locationId: string; date: string; time: string; details: BookingDetails }
export interface PublicBooking { reference: string; status: Appointment["status"]; serviceId: string; providerId: string; locationId: string; date: string; time: string; first: string; canChange: boolean }

const norm = (s: string) => s.trim().toLowerCase();
const publicView = (a: Appointment): PublicBooking => ({ reference: a.id, status: a.status, serviceId: a.serviceId, providerId: a.providerId, locationId: a.locationId, date: a.date, time: a.time, first: patients.find((p) => p.id === a.patientId)?.first ?? "", canChange: canReschedule(a.status) && a.status !== "cancelled" && a.status !== "no_show" && a.date >= TODAY });
const lag = <T,>(v: T, ms = 300) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), ms));

/** The chosen time cannot be booked: taken, outside the practice's rules, or too soon or too far ahead. */
export class SlotTakenError extends Error { constructor(why?: string) { super(why ? `${why} Please choose another time.` : "That time has just been taken. Please choose another."); } }

export const bookingApi = {
  /**
   * A returning patient is only recognised when the email AND last name both match one existing patient, exactly. Nothing is merged
   * on partial matches. A real service must verify identity properly (for example a link sent to the address).
   */
  async findReturning(email: string, last: string) {
    const hits = patients.filter((p) => norm(p.email) === norm(email) && norm(p.last) === norm(last));
    return lag(hits.length === 1 ? { id: hits[0].id, first: hits[0].first } : null, 350);
  },

  async book(req: BookingRequest) {
    const svc = getService(req.serviceId), prov = getProvider(req.providerId);
    if (!svc || !prov) throw new Error("This service or provider is not available");
    const notice = onlineIssue(req.date, req.time);
    if (notice) throw new SlotTakenError(notice);
    const roomId = pickRoom(rooms, req.locationId, req.providerId, req.date, req.time, svc.duration);
    const why = checkConflicts({ providerId: req.providerId, roomId: roomId ?? "", date: req.date, time: req.time, duration: svc.duration });
    if (!roomId || why.length) throw new SlotTakenError(why.find((c) => c.kind === "hours")?.text);

    const d = req.details;
    let patientId: string | undefined; let isNew = false;
    if (d.returning) patientId = (await bookingApi.findReturning(d.email, d.last))?.id;
    if (!patientId) {
      const p = await api.createPatient({ first: d.first, last: d.last, dob: "", phone: d.phone, email: d.email, providerId: req.providerId, notes: d.notes ? `Online booking note: ${d.notes}` : "" });
      patientId = p.id; isNew = true;
      if (d.marketingOptIn) await api.updatePatient(patientId, { marketingConsent: true });      // an explicit opt-in only; nothing is recorded otherwise
    }
    const appt = await api.createAppointment({ patientId, providerId: req.providerId, serviceId: req.serviceId, date: req.date, time: req.time, duration: svc.duration, locationId: req.locationId, roomId, notes: "Booked online (demo)" }, { origin: "online" });
    if (isNew) await enquiriesApi.createFromOnlineBooking({ name: `${d.first} ${d.last}`, phone: d.phone, email: d.email, serviceId: req.serviceId, patientId, appointmentId: appt.id });
    return { reference: appt.id, isNew, patientId };
  },

  /** Finds an online booking from its reference and the email it was made with. Only online bookings can be managed this way. */
  async find(reference: string, email: string) {
    const a = appointments.find((x) => norm(x.id) === norm(reference) && x.origin === "online");
    const p = a && patients.find((x) => x.id === a.patientId);
    return lag(a && p && norm(p.email) === norm(email) ? publicView(a) : null, 350);
  },
  async cancel(reference: string, email: string) {
    const b = await bookingApi.find(reference, email); if (!b || !b.canChange) throw new Error("This booking cannot be changed");
    await api.setStatus(reference, "cancelled"); return publicView(appointments.find((x) => x.id === reference)!);
  },
  async reschedule(reference: string, email: string, date: string, time: string) {
    const b = await bookingApi.find(reference, email); if (!b || !b.canChange) throw new Error("This booking cannot be changed");
    const a = appointments.find((x) => x.id === reference)!;
    const notice = onlineIssue(date, time);
    if (notice) throw new SlotTakenError(notice);
    const why = checkConflicts({ providerId: a.providerId, roomId: a.roomId, date, time, duration: a.duration, ignoreId: a.id });
    if (why.length) throw new SlotTakenError(why.find((c) => c.kind === "hours")?.text);
    await api.reschedule(reference, date, time); return publicView(appointments.find((x) => x.id === reference)!);
  },
};
