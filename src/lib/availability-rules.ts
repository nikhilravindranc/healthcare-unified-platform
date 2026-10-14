/**
 * Pure availability rules, shared by the internal appointment form and online booking so both offer the same times.
 * Provider weekdays, time off and the buffer come from data the practice already configures; breaks, closed dates,
 * lead time and booking window are the practice's own settings. Nothing here is a hidden default: an empty setting means no rule.
 */
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export const weekdayOf = (date: string) => new Date(date + "T12:00:00").getDay();
export const daysBetween = (from: string, to: string) => Math.round((new Date(to + "T12:00:00").getTime() - new Date(from + "T12:00:00").getTime()) / 86400000);

const to24 = (h: string, m: string, ap: string) => ((Number(h) % 12) + (ap.toUpperCase() === "PM" ? 12 : 0)) * 60 + Number(m);

/** Reads "Mon–Fri · 8:30 AM–5:00 PM" or "Mon, Wed, Fri · 9:00 AM–1:00 PM". A part that cannot be read means no rule for that part. */
export function parseProviderHours(text: string): { days: number[] | null; start: number | null; end: number | null } {
  const t = /(\d+):(\d+)\s*([AP]M)\s*[–-]\s*(\d+):(\d+)\s*([AP]M)/i.exec(text);
  const dayPart = (text.split("·")[0] ?? "").trim();
  const idx = (s: string) => DAY_NAMES.findIndex((d) => d.toLowerCase() === s.trim().slice(0, 3).toLowerCase());
  let days: number[] | null = null;
  const range = /^([A-Za-z]{3})[a-z]*\s*[–-]\s*([A-Za-z]{3})[a-z]*$/.exec(dayPart);
  if (range && idx(range[1]) >= 0 && idx(range[2]) >= 0) {
    days = []; for (let d = idx(range[1]); ; d = (d + 1) % 7) { days.push(d); if (d === idx(range[2])) break; }
  } else {
    const list = dayPart.split(/[,&]|\band\b/i).map((s) => s.trim()).filter(Boolean);
    if (list.length && list.every((s) => idx(s) >= 0 && /^[A-Za-z]+$/.test(s))) days = [...new Set(list.map(idx))];
  }
  return { days, start: t ? to24(t[1], t[2], t[3]) : null, end: t ? to24(t[4], t[5], t[6]) : null };
}

export interface DateRange { from: string; to: string }
const iso = /^(\d{4})-(\d{2})-(\d{2})$/;
function oneDate(s: string, year: number): string | null {
  const t = s.trim();
  if (iso.test(t)) return Number.isNaN(Date.parse(t + "T12:00:00")) ? null : t;
  const m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?$/.exec(t);
  const mi = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  if (!m || mi < 0) return null;
  const d = `${m[3] ?? year}-${String(mi + 1).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
  return Number.isNaN(Date.parse(d + "T12:00:00")) ? null : d;
}
/** Reads dates such as "2026-12-25", "2026-12-24 to 2026-12-26" or "Oct 20 to Oct 24", separated by commas, semicolons or new lines. Unreadable entries are returned, never guessed. */
export function parseDateRanges(text: string | undefined, year: number): { ranges: DateRange[]; invalid: string[] } {
  const ranges: DateRange[] = [], invalid: string[] = [];
  for (const part of (text ?? "").split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)) {
    const [a, b] = part.split(/\s+to\s+|\s+until\s+/i);
    const from = oneDate(a, year); let to = b === undefined ? from : oneDate(b, year);
    if (from && to && !iso.test(b ?? "") && to < from) to = oneDate(b, year + 1);   // "Dec 28 to Jan 2" crosses the year
    if (from && to && to >= from) ranges.push({ from, to }); else invalid.push(part);
  }
  return { ranges, invalid };
}
/** Whether `date` falls in a range written as text. Dates without a year are read in the year of `date`, and a range may run into it from the year before. */
export function dateInText(date: string, text: string | undefined): boolean {
  const year = Number(date.slice(0, 4));
  return [year, year - 1].some((y) => parseDateRanges(text, y).ranges.some((r) => date >= r.from && date <= r.to));
}

export interface ClinicRules { openTime: string; closeTime: string; bufferMin: number; breakStart: string; breakEnd: string; closedDates: string }
export interface ProviderRules { short: string; hours: string; timeOff?: string }
export interface RuleIssue { kind: "hours"; text: string }

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fmt = (m: number) => { const h = Math.floor(m / 60); return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };

/** Day, closed-date, time-off, weekday and break rules for a visit on `date` from `start` for `duration` minutes. Hours of the day are checked by the caller. */
export function availabilityIssues(v: { date: string; start: number; duration: number; provider?: ProviderRules; clinic: Pick<ClinicRules, "breakStart" | "breakEnd" | "closedDates"> }): RuleIssue[] {
  const out: RuleIssue[] = []; const end = v.start + v.duration;
  if (dateInText(v.date, v.clinic.closedDates)) out.push({ kind: "hours", text: "The practice is closed on this date." });
  if (v.clinic.breakStart && v.clinic.breakEnd && v.clinic.breakStart < v.clinic.breakEnd) {
    const bs = toMin(v.clinic.breakStart), be = toMin(v.clinic.breakEnd);
    if (v.start < be && bs < end) out.push({ kind: "hours", text: `This overlaps the practice break (${fmt(bs)} to ${fmt(be)}).` });
  }
  if (v.provider) {
    const p = v.provider; const wh = parseProviderHours(p.hours);
    if (wh.days && !wh.days.includes(weekdayOf(v.date))) out.push({ kind: "hours", text: `${p.short} does not work on ${FULL_DAYS[weekdayOf(v.date)]}s.` });
    if (dateInText(v.date, p.timeOff)) out.push({ kind: "hours", text: `${p.short} is on time off on this date.` });
  }
  return out;
}

/** Whether a time is far enough ahead and not too far away, for online booking. `nowDate`/`nowMinutes` are the clock to measure from. */
export function onlineWindowIssue(v: { date: string; time: string; nowDate: string; nowMinutes: number; leadHours: number; windowDays: number }): string | null {
  const ahead = daysBetween(v.nowDate, v.date);
  if (v.windowDays > 0 && ahead > v.windowDays) return `Online booking opens up to ${v.windowDays} days ahead.`;
  if (v.leadHours > 0 && ahead * 1440 + toMin(v.time) - v.nowMinutes < v.leadHours * 60) return `Online bookings need at least ${v.leadHours} hour${v.leadHours === 1 ? "" : "s"} notice.`;
  return null;
}
/**
 * What the booking rules will actually read from a provider's availability text, so the screen shows what is enforced.
 * Text that cannot be read gives no rule for that part, and is reported rather than guessed.
 */
export function describeAvailability(p: { hours?: string; timeOff?: string }, year = 2026): { days: string | null; hours: string | null; timeOff: string | null; unreadableTimeOff: string[]; enforced: boolean } {
  const r = parseProviderHours(p.hours ?? "");
  const days = r.days ? r.days.map((d) => DAY_NAMES[d]).join(", ") : null;
  const hours = r.start != null && r.end != null ? `${fmt(r.start)} to ${fmt(r.end)}` : null;
  const off = p.timeOff?.trim() ? parseDateRanges(p.timeOff, year) : { ranges: [], invalid: [] as string[] };
  return { days, hours, timeOff: p.timeOff?.trim() || null, unreadableTimeOff: off.invalid, enforced: !!(days || hours) };
}
