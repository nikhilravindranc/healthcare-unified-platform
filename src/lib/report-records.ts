import type { Appointment, FollowUp } from "./types";

export interface RecordFilters { from: string; to: string; provider?: string; service?: string; location?: string }
export interface RecordCounts { total: number; completed: number; cancelled: number; noShow: number; openOrAttending: number; days: { date: string; total: number; completed: number; cancelled: number; noShow: number }[] }

/** Counts of the appointment records themselves, so a report figure can be traced to rows the user can open. */
export function appointmentCounts(appts: Appointment[], f: RecordFilters): RecordCounts {
  const inRange = appts.filter((a) => a.date >= f.from && a.date <= f.to && (!f.provider || a.providerId === f.provider) && (!f.service || a.serviceId === f.service) && (!f.location || a.locationId === f.location));
  const by = new Map<string, Appointment[]>();
  inRange.forEach((a) => by.set(a.date, [...(by.get(a.date) ?? []), a]));
  const n = (l: Appointment[], s: Appointment["status"]) => l.filter((a) => a.status === s).length;
  const days = [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, l]) => ({ date, total: l.length, completed: n(l, "completed"), cancelled: n(l, "cancelled"), noShow: n(l, "no_show") }));
  return { total: inRange.length, completed: n(inRange, "completed"), cancelled: n(inRange, "cancelled"), noShow: n(inRange, "no_show"), openOrAttending: inRange.length - n(inRange, "completed") - n(inRange, "cancelled") - n(inRange, "no_show"), days };
}

/** Follow-up state right now. Follow-ups carry no completion date, so this is never a rate over a period. */
export function followUpState(fus: FollowUp[], today: string) {
  const open = fus.filter((f) => f.status === "Open");
  return { open: open.length, overdue: open.filter((f) => f.due < today).length, dueToday: open.filter((f) => f.due === today).length, completed: fus.length - open.length };
}
