"use client";
import { useSyncExternalStore } from "react";
import { CLINIC_TYPES, type ClinicType } from "./clinical";
import type { CustomTheme } from "./themes";

export interface Settings {
  clinicName: string; clinicType: ClinicType; currency: string; timezone: string; country: string; phone: string;
  openTime: string; closeTime: string; defaultDuration: number; bufferMin: number; noShowPolicy: string; cancelHours: number; reminders: boolean; confirmRequests: boolean;
  idPrefix: string; dobRequired: boolean; phoneRequired: boolean; emailRequired: boolean; referralSources: string; tagList: string; alertTypes: string;
  maxPhotoMB: number; photoConsentRequired: boolean; photoRetentionYears: number;
  taxRate: number; invoicePrefix: string; dueDays: number; paymentMethods: string; billingOwner: string;
  notifyWaitMin: number; notifyEmail: boolean; notifySms: boolean; notifyAssignments: boolean;
  /** Practice break and closed dates (empty = none). Applied to every appointment, internal and online. */
  breakStart: string; breakEnd: string; closedDates: string;
  /** Online booking: whether the public page is on, which services it offers (null = every active service), the notice needed, and how far ahead people can book (0 = no limit). */
  booking: { enabled: boolean; serviceIds: string[] | null; leadHours: number; windowDays: number }; modules: Record<string, boolean>; agents: Record<string, boolean>; theme: string; custom: CustomTheme | null; sessionMinutes: number; mfa: boolean; setupPending: string[];
}
export const DEFAULTS: Settings = {
  clinicName: "Brightwell Clinic", clinicType: "Medical aesthetics", currency: "USD", timezone: "America/Los_Angeles", country: "United States", phone: "(415) 555-0142",
  openTime: "08:30", closeTime: "17:30", defaultDuration: 30, bufferMin: 0, noShowPolicy: "Record the no-show and offer to rebook", cancelHours: 24, reminders: true, confirmRequests: true,
  idPrefix: "P-", dobRequired: false, phoneRequired: true, emailRequired: true, referralSources: "Website enquiry, Patient referral, Provider referral, Social media, Walk-in", tagList: "VIP, Regular, Injectables, Skin treatments", alertTypes: "Allergy, Medical, Skin, Other",
  maxPhotoMB: 5, photoConsentRequired: true, photoRetentionYears: 10,
  taxRate: 0, invoicePrefix: "INV-", dueDays: 14, paymentMethods: "Card (recorded manually), Cash, Bank transfer, Cheque", billingOwner: "Practice module (until EVOQ Billing is connected)",
  notifyWaitMin: 15, notifyEmail: true, notifySms: false, notifyAssignments: true,
  breakStart: "", breakEnd: "", closedDates: "",
  booking: { enabled: true, serviceIds: null, leadHours: 2, windowDays: 60 },
  modules: { crm: true, booking: true, campaigns: true },
  agents: { prep: true, followup: true, appointment: true, recall: true, noshow: true, insights: true, engagement: false, scribe: false, receptionist: false }, theme: "evoq", custom: null, sessionMinutes: 30, mfa: true, setupPending: [],
};
const KEY = "pms.settings";
let cache: { raw: string | null; val: Settings } = { raw: "__", val: DEFAULTS };
export function getSettings(): Settings {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch {}
  if (raw !== cache.raw) {
    let v = DEFAULTS;
    try { if (raw) { const p = JSON.parse(raw); v = { ...DEFAULTS, ...p, agents: { ...DEFAULTS.agents, ...(p.agents ?? {}) }, modules: { ...DEFAULTS.modules, ...(p.modules ?? {}) }, booking: { ...DEFAULTS.booking, ...(p.booking ?? {}) } }; } } catch {}
    try { const ct = localStorage.getItem("pms.clinicType") as ClinicType; if (ct && CLINIC_TYPES.includes(ct)) v = { ...v, clinicType: ct }; } catch {}
    cache = { raw, val: v };
  }
  return cache.val;
}
export function saveSettings(patch: Partial<Settings>) {
  const next = { ...getSettings(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); if (patch.clinicType) localStorage.setItem("pms.clinicType", patch.clinicType); window.dispatchEvent(new Event("pms-clinic")); window.dispatchEvent(new Event("pms-settings")); } catch {}
}
const sub = (cb: () => void) => { window.addEventListener("pms-settings", cb); window.addEventListener("pms-clinic", cb); return () => { window.removeEventListener("pms-settings", cb); window.removeEventListener("pms-clinic", cb); }; };
export function useSettings(): Settings { return useSyncExternalStore(sub, getSettings, () => DEFAULTS); }
