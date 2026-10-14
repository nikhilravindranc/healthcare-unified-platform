import { TODAY } from "@/lib/db";
import type { Activity } from "./types";

const lag = <T,>(v: T, ms = 200) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), ms));
/** In memory, empty at start. Nothing is invented. */
export const activities: Activity[] = [];
let seq = 0;

export type ActivityInput = Omit<Activity, "id" | "status"> & { status?: Activity["status"] };
export const activitiesApi = {
  list: () => lag(activities),
  async create(i: ActivityInput) {
    if (!i.subject.trim()) throw new Error("A subject is required");
    const a: Activity = { ...i, id: `ACT-${++seq}`, status: i.status ?? "Planned" };
    activities.unshift(a); return lag(a);
  },
  async update(id: string, patch: Partial<Omit<Activity, "id">>) {
    const a = activities.find((x) => x.id === id); if (!a) throw new Error("Activity not found");
    Object.assign(a, patch); return lag(a);
  },
  /** Completes this activity only. A linked follow-up is never completed by it. */
  async complete(id: string, outcome?: string) {
    const a = activities.find((x) => x.id === id); if (!a) throw new Error("Activity not found");
    a.status = "Completed"; if (outcome?.trim()) a.outcome = outcome.trim(); if (!a.date) a.date = TODAY;
    return lag(a);
  },
};
