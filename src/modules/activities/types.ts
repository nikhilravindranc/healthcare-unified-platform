/**
 * Activities (frontend demo model): a worklist of interactions and planned work.
 *  - Calls are logged through the existing communication log (`commsApi`), so a call is stored once.
 *  - A task linked to an enquiry is an enquiry task (`enquiriesApi.addTask`), so it is stored once.
 *  - Other tasks, meetings and logged interactions are kept here. They are in memory and reset on reload.
 * A follow-up is a different record that stays in Follow-ups. An activity may point at one, and completing the activity never completes it.
 */
export const ACTIVITY_TYPES = ["call", "task", "meeting", "other"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const TYPE_LABEL: Record<ActivityType, string> = { call: "Call", task: "Task", meeting: "Meeting", other: "Other" };
export type ActivityStatus = "Planned" | "Completed" | "Cancelled";
export type Priority = "Low" | "Normal" | "High";

/** An activity kept in this module (a task, meeting or other interaction). */
export interface Activity {
  id: string; type: Exclude<ActivityType, "call">; subject: string;
  patientId?: string; enquiryId?: string; followUpId?: string;
  owner: string; /** YYYY-MM-DD: when it happens or happened. */ date: string; time?: string; due?: string;
  status: ActivityStatus; priority?: Priority; outcome?: string; notes?: string;
}

export type RowSource = "activity" | "enquiry-task" | "call-log";
/** One line in the Activities list, whatever record it comes from. */
export interface ActivityRow {
  key: string; source: RowSource; type: ActivityType; subject: string;
  patientId?: string; enquiryId?: string; followUpId?: string; link?: { label: string; href: string };
  owner?: string; date: string; time?: string; due?: string; status: ActivityStatus; priority?: Priority;
  outcome?: string; notes?: string; direction?: "incoming" | "outgoing";
  /** The ids to use with the owning API. */
  ref: { activityId?: string; enquiryId?: string; taskId?: string; messageId?: string };
}
