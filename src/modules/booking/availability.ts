/**
 * Demo availability for online booking. It reuses the internal appointment rules (`freeSlots`, `checkConflicts`) so a
 * time offered online is a time the practice could also book internally: working hours, provider weekdays and time off,
 * the practice break and closed dates, and the buffer between visits. On top of that, online booking has a notice period
 * and a booking window, both set on the Online Bookings page. It is NOT real-time: a real service must read live schedules.
 */
import { addDays, checkConflicts, freeSlots, nowMin, toMin, TODAY } from "@/lib/db";
import { availabilityIssues, dateInText, onlineWindowIssue } from "@/lib/availability-rules";
import { getSettings } from "@/lib/settings";
import type { Location, Provider, Room, Service } from "@/lib/types";

export interface OnlineRules { leadHours: number; windowDays: number }
/** Why an online booking cannot be made at this date and time, or null. Used both to hide times and to refuse a booking. */
export function onlineIssue(date: string, time: string, rules: OnlineRules = getSettings().booking): string | null {
  if (date < TODAY || (date === TODAY && toMin(time) <= nowMin())) return "That time has already passed.";
  return onlineWindowIssue({ date, time, nowDate: TODAY, nowMinutes: nowMin(), leadHours: rules.leadHours, windowDays: rules.windowDays });
}

/** An explanation for a date with no times, when the reason is a rule rather than a full diary. */
export function dayNote(providers: Pick<Provider, "short" | "hours" | "timeOff">[], date: string, rules: OnlineRules = getSettings().booking): string | null {
  if (date < TODAY) return "That date has already passed.";
  const win = onlineWindowIssue({ date, time: "00:00", nowDate: TODAY, nowMinutes: 0, leadHours: 0, windowDays: rules.windowDays });
  if (win) return win;
  if (dateInText(date, getSettings().closedDates)) return "The practice is closed on this date.";
  const off = providers.map((p) => availabilityIssues({ date, start: 0, duration: 1, provider: p, clinic: { breakStart: "", breakEnd: "", closedDates: "" } }));
  if (providers.length && off.every((i) => i.length)) return providers.length === 1 ? off[0][0].text : "None of the providers are working on this date.";
  return null;
}

export const bookableServices = (services: Service[], booking: { enabled: boolean; serviceIds: string[] | null }) =>
  booking.enabled ? services.filter((s) => s.status === "Active" && (booking.serviceIds === null || booking.serviceIds.includes(s.id))) : [];

export const providersForService = (providers: Provider[], service: Pick<Service, "id">) =>
  providers.filter((p) => p.status === "Active" && p.serviceIds.includes(service.id));

export interface Slot { time: string; providerId: string }

/** Times on `date` for the chosen providers. With several providers, a time is offered once, with the first provider who is free. */
export function slotsFor(providerIds: string[], duration: number, date: string, rules: OnlineRules = getSettings().booking): Slot[] {
  const seen = new Map<string, string>();
  for (const id of providerIds) for (const t of freeSlots(id, date, duration)) if (!seen.has(t)) seen.set(t, id);
  return [...seen.entries()].filter(([t]) => !onlineIssue(date, t, rules)).sort(([a], [b]) => a.localeCompare(b)).map(([time, providerId]) => ({ time, providerId }));
}

/** The first room at the location that is free for the whole visit, or null. */
export function pickRoom(rooms: Room[], locationId: string, providerId: string, date: string, time: string, duration: number): string | null {
  for (const r of rooms.filter((x) => x.locationId === locationId && (x.status ?? "Active") === "Active")) {
    if (checkConflicts({ providerId, roomId: r.id, date, time, duration }).length === 0) return r.id;
  }
  return null;
}

export const upcomingDates = (n: number) => Array.from({ length: n }, (_, i) => addDays(TODAY, i));
export const locationFor = (provider: Provider, locations: Location[], preferred?: string) => locations.find((l) => l.id === (preferred && provider.locationIds.includes(preferred) ? preferred : provider.locationIds[0]) && l.status === "Open");
