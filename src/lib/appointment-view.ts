import type { Appointment, ApptStatus } from "./types";
import { canReschedule, isLostStatus, isOpenStatus } from "./appointment-rules";

/**
 * Booking status and attendance status, read from the one stored `status`.
 * The model has a single status, so each of the two is stated only as far as that status supports:
 *  - Booking: Awaiting confirmation (scheduled), Confirmed, Cancelled. Once someone has arrived, whether the booking was ever
 *    confirmed is not recorded, so it is shown as "Booked" and not as confirmed.
 *  - Attendance: Not yet arrived, Arrived, Waiting, In visit, Completed, No-show. A cancelled booking has no attendance.
 * A past booking that is still open has no attendance recorded, and says so. Completed only means the appointment was marked
 * completed. It does not show that care was documented: that is the visit.
 */
export interface ApptStates { booking: string; attendance: string }
export function apptStates(a: Pick<Appointment, "status" | "date">, today: string): ApptStates {
  const s: ApptStatus = a.status;
  const booking = s === "cancelled" ? "Cancelled" : s === "scheduled" ? "Awaiting confirmation" : s === "confirmed" ? "Confirmed" : "Booked";
  const attendance = s === "cancelled" ? "Did not take place" : s === "no_show" ? "No-show" : s === "arrived" ? "Arrived" : s === "waiting" ? "Waiting" : s === "in_progress" ? "In visit" : s === "completed" ? "Completed"
    : a.date < today ? "No attendance recorded" : "Not yet arrived";
  return { booking, attendance };
}

export type ApptAction = "confirm" | "check-in" | "reschedule" | "cancel" | "no-show" | "start-visit" | "open-visit" | "patient";
/**
 * Which actions make sense for an appointment in its current state. Contradictory ones never appear together:
 * a finished or lost appointment is not checked in or confirmed, and only an appointment with a visit can open it.
 */
export function apptActions(a: Pick<Appointment, "status" | "date" | "visitId">, today: string): ApptAction[] {
  const s = a.status; const out: ApptAction[] = [];
  if (s === "scheduled") out.push("confirm");
  if ((s === "scheduled" || s === "confirmed") && a.date <= today) out.push("check-in");
  if (isOpenStatus(s) && a.visitId && s !== "scheduled" && s !== "confirmed") out.push("open-visit");
  else if (isOpenStatus(s) && !a.visitId && a.date === today) out.push("start-visit");
  if ((s === "completed" || s === "in_progress") && a.visitId && !out.includes("open-visit")) out.push("open-visit");
  if (canReschedule(s) && s !== "in_progress" && s !== "completed") out.push("reschedule");
  if (isOpenStatus(s) && s !== "in_progress") out.push("cancel");
  if ((s === "scheduled" || s === "confirmed") && a.date <= today) out.push("no-show");
  out.push("patient");
  return out;
}

export type QuickView = "all" | "upcoming" | "today" | "past" | "lost";
export function inQuickView(a: Pick<Appointment, "status" | "date">, v: QuickView, today: string): boolean {
  if (v === "all") return true;
  if (v === "lost") return isLostStatus(a.status);
  if (v === "today") return a.date === today;
  if (v === "upcoming") return a.date >= today && isOpenStatus(a.status);
  return a.date < today && !isLostStatus(a.status);
}

/** "Needs attention": an open booking whose date has passed with no attendance recorded, or someone waiting 10 minutes or more. */
export function needsAttention(a: Pick<Appointment, "status" | "date" | "arrivedAt">, today: string, nowMin: number): boolean {
  if (isOpenStatus(a.status) && a.date < today) return true;
  return a.date === today && a.status === "waiting" && a.arrivedAt != null && nowMin - a.arrivedAt >= 10;
}
