import { addDays } from "@/lib/db";
import type { Enquiry } from "../enquiries/types";
import type { Message } from "../comms/types";
import type { Activity, ActivityRow } from "./types";

export interface RowInput { activities: Activity[]; enquiries: Enquiry[]; messages: Message[]; userName: (id?: string) => string | undefined; personName: (patientId?: string) => string | undefined }

/**
 * The one list. Each underlying record appears once:
 *  - activities kept in this module,
 *  - enquiry tasks (planned, or done),
 *  - calls from the communication log (always completed: they record something that happened).
 * Emails and texts are not activities: they stay in each person's message history.
 */
export function buildActivityRows(i: RowInput): ActivityRow[] {
  const rows: ActivityRow[] = [];
  i.activities.forEach((a) => rows.push({
    key: `a:${a.id}`, source: "activity", type: a.type, subject: a.subject, patientId: a.patientId, enquiryId: a.enquiryId, followUpId: a.followUpId,
    link: a.patientId ? { label: i.personName(a.patientId) ?? a.patientId, href: `/patients/${a.patientId}` } : a.enquiryId ? { label: a.enquiryId, href: `/enquiries/${a.enquiryId}` } : undefined,
    owner: a.owner, date: a.date, time: a.time, due: a.due, status: a.status, priority: a.priority, outcome: a.outcome, notes: a.notes, ref: { activityId: a.id } }));
  i.enquiries.forEach((e) => e.tasks.forEach((t) => rows.push({
    key: `t:${e.id}:${t.id}`, source: "enquiry-task", type: "task", subject: t.note, enquiryId: e.id, link: { label: `${e.name} (${e.id})`, href: `/enquiries/${e.id}` },
    owner: i.userName(t.assigneeId), date: t.due, due: t.due, status: t.done ? "Completed" : "Planned", ref: { enquiryId: e.id, taskId: t.id } })));
  const enq = new Map(i.enquiries.map((e) => [e.id, e]));
  i.messages.filter((m) => m.channel === "call").forEach((m) => rows.push({
    key: `m:${m.id}`, source: "call-log", type: "call", subject: m.subject || (m.direction === "incoming" ? "Incoming call" : "Outgoing call"), direction: m.direction,
    enquiryId: m.enquiryId, patientId: m.patientId,
    link: m.patientId ? { label: i.personName(m.patientId) ?? m.patientId, href: `/patients/${m.patientId}` } : m.enquiryId ? { label: enq.get(m.enquiryId)?.name ?? m.enquiryId, href: `/enquiries/${m.enquiryId}` } : undefined,
    owner: m.by, date: m.at, status: "Completed", notes: m.body, outcome: m.subject, ref: { messageId: m.id } }));
  return rows;
}

export type ActivityView = "all" | "mine" | "upcoming" | "overdue" | "completed";
/** Overdue: still planned and due before today. Due soon: planned and due within three days, today included. */
export const isOverdue = (r: Pick<ActivityRow, "status" | "due">, today: string) => r.status === "Planned" && !!r.due && r.due < today;
export const isDueSoon = (r: Pick<ActivityRow, "status" | "due">, today: string) => r.status === "Planned" && !!r.due && r.due >= today && r.due <= addDays(today, 3);
export function inView(r: ActivityRow, v: ActivityView, today: string, me?: string): boolean {
  if (v === "all") return true;
  if (v === "mine") return !!me && r.owner === me;
  if (v === "overdue") return isOverdue(r, today);
  if (v === "completed") return r.status === "Completed";
  return r.status === "Planned" && !isOverdue(r, today);
}
export const sortRows = (rows: ActivityRow[], today: string) => [...rows].sort((a, b) => {
  const rank = (r: ActivityRow) => (isOverdue(r, today) ? 0 : r.status === "Planned" ? 1 : 2);
  return rank(a) - rank(b) || (rank(a) === 2 ? b.date.localeCompare(a.date) : (a.due ?? a.date).localeCompare(b.due ?? b.date));
});
