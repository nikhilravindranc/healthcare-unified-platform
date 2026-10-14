import type { Appointment, FollowUp, Visit } from "./types";

export interface VisitFlag { id: "forms" | "followup" | "no-booking"; label: string; attention: boolean }
export interface VisitRow { visit: Visit; appt?: Appointment; flags: VisitFlag[]; attention: boolean }

/**
 * What a visit row can say from recorded facts only.
 *  - A booking is shown only when the visit and an appointment point at each other. A missing link is stated, never guessed.
 *  - "Forms awaiting signature" counts forms on the visit that are not signed.
 *  - A recommended follow-up with no follow-up created from this visit is flagged on completed visits only.
 *  - A missing booking is information, not an outstanding task, because walk-in and unscheduled visits are valid.
 */
export function visitRows(visits: Visit[], appts: Appointment[], fus: FollowUp[]): VisitRow[] {
  return visits.map((visit) => {
    const appt = appts.find((a) => a.id === visit.apptId && a.visitId === visit.id) ?? appts.find((a) => a.visitId === visit.id && (!visit.apptId || a.id === visit.apptId));
    const flags: VisitFlag[] = [];
    const unsigned = visit.forms.filter((f) => !f.signed).length;
    if (unsigned) flags.push({ id: "forms", label: `${unsigned} form${unsigned === 1 ? "" : "s"} awaiting signature`, attention: true });
    if (visit.status === "Completed" && visit.followUpRecommended?.trim() && !fus.some((f) => f.visitId === visit.id)) flags.push({ id: "followup", label: "Follow-up recommended, none created", attention: true });
    if (!appt) flags.push({ id: "no-booking", label: "No booking linked", attention: false });
    return { visit, appt, flags, attention: flags.some((f) => f.attention) };
  });
}

/** In-progress visits first, then the most recent. */
export const sortVisitRows = (rows: VisitRow[]) => [...rows].sort((a, b) => (a.visit.status === "In progress" ? 0 : 1) - (b.visit.status === "In progress" ? 0 : 1) || b.visit.date.localeCompare(a.visit.date));
