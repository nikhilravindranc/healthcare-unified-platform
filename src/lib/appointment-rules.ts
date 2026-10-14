import type { ApptStatus } from "./types";

/**
 * One place for what an appointment status means, so every screen, count and report agrees.
 *  - lost:  cancelled or no-show. Never a successful booking, never "upcoming", never a seen patient.
 *  - open:  not finished yet (everything except completed, cancelled and no-show).
 *  - final: completed, cancelled or no-show.
 */
export const LOST_STATUSES: readonly ApptStatus[] = ["cancelled", "no_show"];
export const FINAL_STATUSES: readonly ApptStatus[] = ["completed", "cancelled", "no_show"];
export const isLostStatus = (s: ApptStatus) => LOST_STATUSES.includes(s);
export const isLiveStatus = (s: ApptStatus) => !isLostStatus(s);
export const isOpenStatus = (s: ApptStatus) => !FINAL_STATUSES.includes(s);
/** An appointment on or after `today` that is still open: what "upcoming" means everywhere. */
export const isUpcoming = (a: { status: ApptStatus; date: string }, today: string) => a.date >= today && isOpenStatus(a.status);
/** Statuses from which an appointment may be moved to another time. Cancelled and no-show ones can be revived with a logged event. */
export const canReschedule = (s: ApptStatus) => s === "scheduled" || s === "confirmed" || s === "arrived" || s === "waiting" || isLostStatus(s);

/**
 * Where an appointment is in its life, in words a person can scan.
 *  - booked:    a plan only (scheduled, confirmed). Nobody has arrived.
 *  - attending: the patient is here (arrived, waiting, in visit).
 *  - completed: marked completed.
 *  - lost:      cancelled or no-show. It did not take place.
 */
export type ApptStage = "booked" | "attending" | "completed" | "lost";
export const apptStage = (s: ApptStatus): ApptStage => (s === "scheduled" || s === "confirmed" ? "booked" : s === "arrived" || s === "waiting" || s === "in_progress" ? "attending" : s === "completed" ? "completed" : "lost");
export const STAGE_LABEL: Record<ApptStage, string> = { booked: "Booked", attending: "Attending", completed: "Completed", lost: "Did not take place" };
