import { hasLiveAppointment } from "./booking-state";
import { ENQUIRY_SOURCES, type Enquiry } from "./types";

export interface InsightsResult {
  total: number;
  /** Enquiries whose linked appointment exists and is not cancelled or a no-show. */
  booked: number;
  /** Enquiries whose appointment was cancelled or missed. They are not counted as booked. */
  lost: number;
  open: number;
  rate: number;
  bySource: { source: string; n: number; booked: number }[];
  campaigns: { campaign: string; n: number; booked: number }[];
  series: { labels: string[]; enquiries: number[]; booked: number[]; step: number };
}

const addDays = (d: string, n: number) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

/** Marketing Insights numbers. "Booked" comes from the appointment relationship, not from the status text. */
export function computeInsights(enquiries: Enquiry[], days: number, today: string): InsightsResult {
  const from = addDays(today, -(days - 1));
  const list = enquiries.filter((e) => e.received >= from && e.received <= today);
  const isBooked = (e: Enquiry) => hasLiveAppointment(e);
  const booked = list.filter(isBooked);
  const step = days > 31 ? 7 : 1;
  const labels: string[] = [], enq: number[] = [], bk: number[] = [];
  for (let i = 0; i < days; i += step) {
    const a = addDays(from, i), b = addDays(from, Math.min(days - 1, i + step - 1));
    const w = list.filter((e) => e.received >= a && e.received <= b);
    labels.push(a); enq.push(w.length); bk.push(w.filter(isBooked).length);
  }
  const campaignNames = [...new Set(list.map((e) => e.campaign).filter(Boolean) as string[])];
  return {
    total: list.length, booked: booked.length, lost: list.filter((e) => e.bookingLost).length,
    open: list.filter((e) => e.status === "New" || e.status === "Contacted").length,
    rate: list.length ? Math.round((booked.length / list.length) * 100) : 0,
    bySource: ENQUIRY_SOURCES.map((s) => { const l = list.filter((e) => e.source === s); return { source: s, n: l.length, booked: l.filter(isBooked).length }; }).sort((a, b) => b.n - a.n),
    campaigns: campaignNames.map((c) => { const l = list.filter((e) => e.campaign === c); return { campaign: c, n: l.length, booked: l.filter(isBooked).length }; }).sort((a, b) => b.n - a.n),
    series: { labels, enquiries: enq, booked: bk, step },
  };
}
