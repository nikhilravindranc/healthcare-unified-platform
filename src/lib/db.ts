import type {
  Appointment, ApptStatus, AppUser, FollowUp, Location, Notification, Patient,
  PlotPoint, Provider, Room, Service, Visit,
} from "./types";
import type { AppointmentInput, PatientInput } from "./schemas";

export const TODAY = "2026-10-07";
const START_MIN = 10 * 60 + 20;
const T0 = Date.now();
/** Demo clock: starts at 10:20 AM on load and advances in real time. */
export const nowMin = () => START_MIN + Math.floor((Date.now() - T0) / 60000);

export const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const fmtTime = (t: string) => {
  const m = toMin(t); const h = Math.floor(m / 60);
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
export const fmtDate = (d: string, withYear = false) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });
export const fmtLong = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
export const addDays = (d: string, n: number) => {
  const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10);
};

const lag = <T,>(v: T, ms = 280) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), ms));
let seq = 100;
const uid = (p: string) => `${p}-${++seq}`;

export const providers: Provider[] = [
  { id: "pat", name: "Dr. Aarav Patel", short: "Dr. Patel", specialty: "Medical aesthetics", status: "Active", serviceIds: ["consult", "followup", "skin", "inject", "review"], locationIds: ["dt"], hours: "Mon–Fri · 8:30 AM–5:00 PM", color: "#2867B2" },
  { id: "rao", name: "Dr. Kavya Rao", short: "Dr. Rao", specialty: "Dermatology", status: "Active", serviceIds: ["consult", "followup", "skin", "review"], locationIds: ["dt", "ws"], hours: "Mon–Fri · 9:00 AM–5:30 PM", color: "#26B9CF" },
  { id: "meh", name: "Dr. Neil Mehta", short: "Dr. Mehta", specialty: "Physiotherapy & dental", status: "Active", serviceIds: ["physio", "dental", "followup", "review"], locationIds: ["ws"], hours: "Mon–Sat · 9:00 AM–5:00 PM", color: "#7ACFC5" },
];
export const services: Service[] = [
  { id: "consult", name: "Consultation", category: "Consultation", duration: 30, providerIds: ["pat", "rao"], locationIds: ["dt"], status: "Active" },
  { id: "followup", name: "Follow-up", category: "Review", duration: 20, providerIds: ["pat", "rao", "meh"], locationIds: ["dt", "ws"], status: "Active" },
  { id: "skin", name: "Skin consultation", category: "Dermatology", duration: 30, providerIds: ["pat", "rao"], locationIds: ["dt"], status: "Active" },
  { id: "inject", name: "Injectable treatment", category: "Aesthetics", duration: 45, providerIds: ["pat"], locationIds: ["dt"], status: "Active" },
  { id: "physio", name: "Physiotherapy session", category: "Physiotherapy", duration: 45, providerIds: ["meh"], locationIds: ["ws"], status: "Active" },
  { id: "dental", name: "Dental consultation", category: "Dental", duration: 30, providerIds: ["meh"], locationIds: ["ws"], status: "Active" },
  { id: "review", name: "Treatment review", category: "Review", duration: 20, providerIds: ["pat", "rao", "meh"], locationIds: ["dt", "ws"], status: "Active" },
];
export const locations: Location[] = [
  { id: "dt", name: "Brightwell Downtown", address: "214 Harbor Street, Suite 300", phone: "(415) 555-0142", status: "Open" },
  { id: "ws", name: "Brightwell Westside", address: "88 Linden Avenue", phone: "(415) 555-0177", status: "Open" },
];
export const rooms: Room[] = [
  { id: "r1", name: "Room 1", locationId: "dt", type: "Consultation room", availability: "Mon–Fri · 8:30 AM–5:30 PM" },
  { id: "r2", name: "Room 2", locationId: "dt", type: "Consultation room", availability: "Mon–Fri · 8:30 AM–5:30 PM" },
  { id: "tsa", name: "Treatment Suite A", locationId: "dt", type: "Treatment suite", availability: "Mon–Fri · 9:00 AM–5:00 PM" },
  { id: "r3", name: "Room 3", locationId: "ws", type: "Consultation room", availability: "Mon–Sat · 9:00 AM–5:00 PM" },
  { id: "gym", name: "Physio Gym", locationId: "ws", type: "Therapy space", availability: "Mon–Sat · 9:00 AM–5:00 PM" },
  { id: "dop", name: "Dental Operatory", locationId: "ws", type: "Dental operatory", availability: "Mon–Fri · 9:00 AM–5:00 PM" },
];
export const users: AppUser[] = [
  { id: "u1", name: "Dr. Aarav Patel", email: "dr.patel@brightwellclinic.com", role: "Owner", status: "Active" },
  { id: "u2", name: "Meera Iyer", email: "meera.iyer@brightwellclinic.com", role: "Practice manager", status: "Active" },
  { id: "u3", name: "Dr. Kavya Rao", email: "kavya.rao@brightwellclinic.com", role: "Provider", status: "Active" },
  { id: "u4", name: "Dr. Neil Mehta", email: "neil.mehta@brightwellclinic.com", role: "Provider", status: "Active" },
  { id: "u5", name: "Tom Reyes", email: "tom.reyes@brightwellclinic.com", role: "Front desk", status: "Active" },
  { id: "u6", name: "Lena Park", email: "lena.park@brightwellclinic.com", role: "Staff", status: "Invited" },
];

const P = (id: number, first: string, last: string, dob: string, phone: string, providerId: string, status: Patient["status"] = "Active", gender = "Female"): Patient => ({
  id: `P-${id}`, first, last, dob, phone, email: `${first}.${last}`.toLowerCase() + "@example.com", providerId, status, gender,
  address: "Address on file", emergency: "On file", tags: [], marketingConsent: true, referral: "Website enquiry", alerts: [],
});
const TAGS: Record<number, string[]> = { 10248: ["VIP", "Regular", "Injectables", "Skin treatments"], 10270: ["Injectables", "Regular"], 10281: ["Injectables"], 10299: ["Injectables", "Skin treatments"], 10251: ["Skin treatments"], 10260: ["Physio programme"], 10256: ["Physio programme"] };
export const patients: Patient[] = [
  P(10248, "Sarah", "Johnson", "1988-04-12", "(415) 555-0101", "pat"),
  P(10251, "Michael", "Thomas", "1975-09-30", "(415) 555-0118", "rao", "Active", "Male"),
  P(10256, "Anita", "Shah", "1991-01-22", "(415) 555-0133", "meh"),
  P(10260, "David", "Wilson", "1969-11-05", "(415) 555-0149", "meh", "Active", "Male"),
  P(10263, "Emily", "Carter", "1994-06-18", "(415) 555-0150", "pat"),
  P(10270, "Priya", "Menon", "1985-03-09", "(415) 555-0164", "pat"),
  P(10274, "Daniel", "Cooper", "1980-12-14", "(415) 555-0172", "pat", "Active", "Male"),
  P(10281, "Olivia", "Bennett", "1997-08-02", "(415) 555-0186", "pat"),
  P(10285, "Rahul", "Verma", "1983-05-27", "(415) 555-0191", "rao", "Active", "Male"),
  P(10290, "Grace", "Nguyen", "1990-10-16", "(415) 555-0205", "rao"),
  P(10294, "Marcus", "Lee", "1972-02-03", "(415) 555-0217", "pat", "New", "Male"),
  P(10299, "Hannah", "Brooks", "1987-07-21", "(415) 555-0226", "pat"),
];
patients.forEach((p) => { p.tags = TAGS[Number(p.id.slice(2))] ?? []; });
patients[0].alerts = [{ id: "al1", type: "Skin", description: "Sensitive skin", severity: "Low", source: "Intake form", date: "2026-08-21", author: "Dr. Patel" }];
patients[0].marketingConsent = true;
patients[0].referral = "Dr. Emily Carter (referral)";
patients[4].marketingConsent = false;
patients[6].alerts = [{ id: "al2", type: "Allergy", description: "Reported latex sensitivity", severity: "Moderate", source: "Patient report", date: "2026-09-15", author: "Dr. Patel" }];

const A = (n: number, pid: string, prov: string, svc: string, time: string, status: ApptStatus, room: string, arrivedAt?: number, date = TODAY): Appointment => {
  const s = services.find((x) => x.id === svc)!;
  return { id: `A-${n}`, patientId: pid, providerId: prov, serviceId: svc, date, time, duration: s.duration, locationId: rooms.find((r) => r.id === room)!.locationId, roomId: room, status, arrivedAt };
};
export const appointments: Appointment[] = [
  A(1, "P-10263", "pat", "consult", "08:30", "completed", "r1"),
  A(2, "P-10274", "pat", "followup", "09:15", "completed", "r1"),
  A(3, "P-10248", "pat", "inject", "10:00", "waiting", "tsa", 608),
  A(4, "P-10270", "pat", "review", "10:45", "arrived", "r1", 619),
  A(5, "P-10281", "pat", "inject", "11:30", "confirmed", "tsa"),
  A(6, "P-10294", "pat", "consult", "13:00", "scheduled", "r2"),
  A(7, "P-10299", "pat", "skin", "14:00", "confirmed", "r1"),
  A(8, "P-10260", "pat", "followup", "15:30", "scheduled", "r2"),
  A(9, "P-10290", "rao", "skin", "09:00", "completed", "r2"),
  A(10, "P-10285", "rao", "skin", "09:45", "no_show", "r2"),
  A(11, "P-10251", "rao", "followup", "10:15", "waiting", "r2", 615),
  A(12, "P-10294", "rao", "skin", "11:00", "scheduled", "r2"),
  A(13, "P-10270", "rao", "skin", "13:30", "scheduled", "r2"),
  A(14, "P-10281", "rao", "followup", "15:00", "cancelled", "r2"),
  A(15, "P-10285", "rao", "skin", "16:00", "scheduled", "r2"),
  A(16, "P-10260", "meh", "physio", "10:00", "in_progress", "gym", 598),
  A(17, "P-10256", "meh", "physio", "10:30", "waiting", "gym", 616),
  A(18, "P-10274", "meh", "physio", "11:30", "confirmed", "gym"),
  A(19, "P-10290", "meh", "dental", "14:00", "confirmed", "dop"),
  A(20, "P-10263", "meh", "physio", "15:00", "scheduled", "gym"),
  A(21, "P-10248", "pat", "review", "10:00", "confirmed", "r1", undefined, "2026-10-15"),
  A(22, "P-10299", "pat", "followup", "09:30", "scheduled", "r1", undefined, "2026-10-08"),
  A(23, "P-10251", "rao", "review", "11:00", "confirmed", "r2", undefined, "2026-10-09"),
];

const pt = (id: string, x: number, y: number, product: string, units: number, note = "", area = ""): PlotPoint => ({ id, x, y, product, units, note, area, view: "front" });
const V = (id: string, patientId: string, providerId: string, type: string, date: string, reason: string, extra: Partial<Visit> = {}): Visit => ({
  id, patientId, providerId, type, date, status: "Completed", reason,
  notes: { subjective: "Patient reports no concerns since last visit.", objective: "Documented by provider at visit.", assessment: "Documented by provider.", plan: "Continue as planned." },
  treatments: [], plot: [], forms: [{ id: id + "f", name: "Treatment consent", kind: "Consent", signed: true }], followUpInstructions: "", followUpRecommended: "", ...extra,
});
export const visits: Visit[] = [
  V("V-5001", "P-10248", "pat", "Injectable treatment", "2026-09-18", "Forehead and glabellar lines", {
    notes: { subjective: "Requested softening of forehead lines ahead of an event. No prior reactions reported.", objective: "Static lines noted at rest on forehead; symmetrical brow position.", assessment: "Treatment completed as planned.", plan: "Review at 2 weeks. Advised to avoid strenuous exercise for 24 hours." },
    treatments: [{ id: "t1", service: "Injectable treatment", area: "Forehead, glabella, lateral canthal", product: "Botulinum toxin A", units: 32, notes: "Tolerated well." }],
    technique: "Standard protocol",
    areas: "Forehead, glabella, lateral canthal",
    plot: [pt("p1", 42, 19, "Botulinum toxin A", 4, "", "Forehead"), pt("p2", 50, 16, "Botulinum toxin A", 4, "", "Forehead"), pt("p3", 58, 19, "Botulinum toxin A", 4, "", "Forehead"), pt("p4", 45, 30, "Botulinum toxin A", 5, "", "Glabella"), pt("p5", 55, 30, "Botulinum toxin A", 5, "", "Glabella"), pt("p6", 28, 38, "Botulinum toxin A", 5, "", "Crow's feet (L)"), pt("p7", 72, 38, "Botulinum toxin A", 5, "", "Crow's feet (R)")],
    followUpInstructions: "Avoid strenuous exercise for 24 hours. Contact the practice if swelling persists.", followUpRecommended: "Post-treatment review in 2 weeks",
  }),
  V("V-5002", "P-10248", "pat", "Consultation", "2026-09-04", "Initial consultation", { followUpRecommended: "Book treatment session" }),
  V("V-5003", "P-10248", "pat", "Follow-up", "2026-08-21", "Skin review"),
  V("V-5004", "P-10251", "rao", "Follow-up", "2026-09-22", "Eczema review", { followUpRecommended: "Routine review in 2 weeks" }),
  V("V-5005", "P-10256", "meh", "Physiotherapy session", "2026-09-25", "Lower back stiffness"),
  V("V-5006", "P-10260", "meh", "Physiotherapy session", "2026-09-30", "Knee rehabilitation, session 4"),
  V("V-5007", "P-10270", "pat", "Injectable treatment", "2026-09-10", "Lip treatment", { plot: [pt("p1", 45, 57, "Hyaluronic acid filler", 0.4, "", "Lips"), pt("p2", 55, 57, "Hyaluronic acid filler", 0.4, "", "Lips"), pt("p3", 50, 61, "Hyaluronic acid filler", 0.3, "", "Lips")], followUpRecommended: "Treatment review in 4 weeks" }),
  V("V-5008", "P-10274", "pat", "Consultation", "2026-09-15", "Skin concerns"),
  V("V-5009", "P-10281", "pat", "Injectable treatment", "2026-09-02", "Masseter treatment", { plot: [pt("p1", 34, 66, "Botulinum toxin A", 15, "", "Masseter (L)"), pt("p2", 66, 66, "Botulinum toxin A", 15, "", "Masseter (R)")], followUpRecommended: "Treatment continuation in 3 months" }),
  V("V-5010", "P-10285", "rao", "Skin consultation", "2026-09-01", "Acne scarring", { followUpRecommended: "Recall" }),
  V("V-5011", "P-10290", "rao", "Skin consultation", "2026-09-29", "Pigmentation review"),
  V("V-5012", "P-10299", "pat", "Injectable treatment", "2026-09-23", "Lateral canthal lines", { plot: [pt("p1", 28, 38, "Botulinum toxin A", 6, "", "Crow's feet (L)"), pt("p2", 72, 38, "Botulinum toxin A", 6, "", "Crow's feet (R)")], followUpRecommended: "Post-treatment review" }),
  V("V-5013", "P-10263", "pat", "Consultation", TODAY, "Initial consultation", { apptId: "A-1" }),
  V("V-5014", "P-10274", "pat", "Follow-up", TODAY, "Post-consultation follow-up", { apptId: "A-2" }),
  V("V-5015", "P-10290", "rao", "Skin consultation", TODAY, "Pigmentation recheck", { apptId: "A-9" }),
  V("V-9001", "P-10260", "meh", "Physiotherapy session", TODAY, "Knee rehabilitation, session 5", { apptId: "A-16", status: "In progress" }),
];
const link = (aid: string, vid: string) => { appointments.find((a) => a.id === aid)!.visitId = vid; };
link("A-1", "V-5013"); link("A-2", "V-5014"); link("A-9", "V-5015"); link("A-16", "V-9001");

const F = (n: number, pid: string, type: FollowUp["type"], due: string, assignee: string, status: FollowUp["status"] = "Open", visitId?: string): FollowUp => ({ id: `F-${n}`, patientId: pid, type, due, assignee, status, visitId });
export const followUps: FollowUp[] = [
  F(1, "P-10251", "Routine review", TODAY, "Dr. Rao", "Open", "V-5004"),
  F(2, "P-10274", "Treatment continuation", TODAY, "Tom Reyes", "Open", "V-5008"),
  F(3, "P-10263", "Post-treatment", TODAY, "Dr. Patel", "Open", "V-5013"),
  F(4, "P-10285", "Recall", "2026-10-02", "Meera Iyer", "Open", "V-5010"),
  F(5, "P-10299", "Post-treatment", "2026-10-05", "Tom Reyes", "Open", "V-5012"),
  F(6, "P-10290", "Post-treatment", "2026-10-09", "Dr. Rao", "Open", "V-5011"),
  F(7, "P-10270", "Treatment continuation", "2026-10-12", "Tom Reyes", "Open", "V-5007"),
  F(8, "P-10248", "Post-treatment", "2026-10-14", "Dr. Patel", "Open", "V-5001"),
  F(9, "P-10281", "Treatment continuation", "2026-12-02", "Tom Reyes", "Open", "V-5009"),
  F(10, "P-10256", "Routine review", "2026-10-08", "Dr. Mehta", "Open", "V-5005"),
  F(11, "P-10260", "Other", "2026-09-30", "Dr. Mehta", "Completed", "V-5006"),
];
export const notifications: Notification[] = [
  { id: "n1", text: "3 patients are waiting", time: "2 min ago", read: false, href: "/overview?view=flow" },
  { id: "n2", text: "Rahul Verma was recorded as a no-show (9:45 AM)", time: "35 min ago", read: false, href: "/calendar" },
  { id: "n3", text: "Follow-up overdue: Hannah Brooks", time: "1 hr ago", read: false, href: "/follow-ups" },
  { id: "n4", text: "Appointment cancelled: Olivia Bennett, 3:00 PM", time: "2 hr ago", read: true, href: "/calendar" },
  { id: "n5", text: "Dr. Mehta's schedule changed for Saturday", time: "Yesterday", read: true, href: "/calendar" },
  { id: "n6", text: "Follow-up Agent completed a review of overdue follow-ups", time: "Yesterday", read: true, href: "/agents" },
];

export const getPatient = (id: string) => patients.find((p) => p.id === id);
export const getProvider = (id: string) => providers.find((p) => p.id === id);
export const getService = (id: string) => services.find((p) => p.id === id);
export const getRoom = (id: string) => rooms.find((p) => p.id === id);
export const getLocation = (id: string) => locations.find((p) => p.id === id);
export const pname = (id: string) => { const p = getPatient(id); return p ? `${p.first} ${p.last}` : "Unknown patient"; };

function workingHours() {
  try { const s = JSON.parse(localStorage.getItem("pms.settings") ?? "{}"); return { open: s.openTime ?? "08:30", close: s.closeTime ?? "17:30" }; } catch { return { open: "08:30", close: "17:30" }; }
}
export function checkConflicts(v: { providerId: string; roomId: string; date: string; time: string; duration: number; ignoreId?: string }) {
  const out: { kind: "provider" | "room" | "hours"; text: string }[] = [];
  if (!v.time) return out;
  const s = toMin(v.time), e = s + v.duration;
  const wh = workingHours();
  if (s < toMin(wh.open) || e > toMin(wh.close)) out.push({ kind: "hours", text: `This time is outside working hours (${fmtTime(wh.open)} to ${fmtTime(wh.close)}).` });
  const ph = getProvider(v.providerId)?.hours.match(/(\d+):(\d+) ([AP]M)\s*[–-]\s*(\d+):(\d+) ([AP]M)/);
  if (ph) { const c = (h: string, m: string, ap: string) => ((Number(h) % 12) + (ap === "PM" ? 12 : 0)) * 60 + Number(m); const ps = c(ph[1], ph[2], ph[3]), pe = c(ph[4], ph[5], ph[6]); if (s < ps || e > pe) out.push({ kind: "hours", text: `${getProvider(v.providerId)?.short} is not available at this time (works ${fmtTime(fromMin(ps))} to ${fmtTime(fromMin(pe))}).` }); }
  for (const a of appointments) {
    if (a.id === v.ignoreId || a.date !== v.date || ["cancelled", "no_show"].includes(a.status)) continue;
    const as = toMin(a.time), ae = as + a.duration;
    if (s < ae && as < e) {
      if (a.providerId === v.providerId) out.push({ kind: "provider", text: `${getProvider(a.providerId)?.short} already has ${pname(a.patientId)} at ${fmtTime(a.time)}.` });
      if (v.roomId && a.roomId === v.roomId) out.push({ kind: "room", text: `${getRoom(a.roomId)?.name} is in use by ${pname(a.patientId)} at ${fmtTime(a.time)}.` });
    }
  }
  return out;
}

export function freeSlots(providerId: string, date: string, duration: number) {
  const slots: string[] = [];
  for (let m = 8 * 60 + 30; m + duration <= 17 * 60 + 30; m += 15) {
    const c = checkConflicts({ providerId, roomId: "", date, time: fromMin(m), duration });
    if (c.length === 0) slots.push(fromMin(m));
  }
  return slots;
}

/* ---------- API (simulated network over an in-memory practice database) ---------- */
export const api = {
  refs: () => lag({ providers, services, locations, rooms, users }, 180),
  patients: () => lag(patients),
  appointments: () => lag(appointments),
  visits: () => lag(visits),
  followUps: () => lag(followUps),
  notifications: () => lag(notifications, 120),

  async createPatient(input: PatientInput) {
    const id = `P-${10300 + patients.length}`;
    const p: Patient = { ...input, id, status: "New" };
    patients.unshift(p);
    return lag(p, 500);
  },
  async createAppointment(input: AppointmentInput) {
    const a: Appointment = { ...input, id: `A-${appointments.length + 1}`, status: "scheduled", duration: Number(input.duration) };
    appointments.push(a);
    return lag(a, 500);
  },
  async setStatus(id: string, status: ApptStatus) {
    const a = appointments.find((x) => x.id === id)!;
    a.status = status;
    if (status === "arrived" || status === "waiting") a.arrivedAt = a.arrivedAt ?? nowMin();
    if (status === "cancelled") notifications.unshift({ id: uid("n"), text: `Appointment cancelled: ${pname(a.patientId)}, ${fmtTime(a.time)}`, time: "Just now", read: false, href: "/calendar" });
    if (status === "no_show") notifications.unshift({ id: uid("n"), text: `No-show recorded: ${pname(a.patientId)}`, time: "Just now", read: false, href: "/calendar" });
    return lag(a, 220);
  },
  async reschedule(id: string, date: string, time: string) {
    const a = appointments.find((x) => x.id === id)!;
    a.date = date; a.time = time; a.status = "scheduled"; a.arrivedAt = undefined;
    return lag(a, 350);
  },
  async walkIn(patientId: string, providerId: string, serviceId: string) {
    const s = getService(serviceId)!; const nm = nowMin();
    const room = rooms.find((r) => r.locationId === (getProvider(providerId)?.locationIds[0] ?? "dt"))!;
    const a: Appointment = { id: `A-${appointments.length + 1}`, patientId, providerId, serviceId, date: TODAY, time: fromMin(Math.floor(nm / 5) * 5), duration: s.duration, locationId: room.locationId, roomId: room.id, status: "arrived", arrivedAt: nm, notes: "Walk-in" };
    appointments.push(a);
    return lag(a, 350);
  },
  async startVisit(apptId: string) {
    const a = appointments.find((x) => x.id === apptId)!;
    if (a.visitId) { a.status = "in_progress"; return lag(visits.find((v) => v.id === a.visitId)!, 250); }
    const v = V(uid("V"), a.patientId, a.providerId, getService(a.serviceId)!.name, TODAY, a.notes ?? "", { apptId, status: "In progress", forms: [], notes: { subjective: "", objective: "", assessment: "", plan: "" } });
    visits.unshift(v);
    a.visitId = v.id; a.status = "in_progress";
    return lag(v, 350);
  },
  async newVisit(patientId: string, providerId: string, serviceId = "consult") {
    const v = V(uid("V"), patientId, providerId, getService(serviceId)?.name ?? "Consultation", TODAY, "", { serviceId, status: "In progress", forms: [], notes: { subjective: "", objective: "", assessment: "", plan: "" } });
    visits.unshift(v);
    return lag(v, 350);
  },
  async updateVisit(id: string, patch: Partial<Visit>) {
    const v = visits.find((x) => x.id === id)!;
    Object.assign(v, patch);
    return lag(v, 120);
  },
  async completeVisit(id: string) {
    const v = visits.find((x) => x.id === id)!;
    v.status = "Completed";
    const a = appointments.find((x) => x.visitId === id);
    if (a) a.status = "completed";
    if (v.followUpRecommended && !followUps.some((f) => f.visitId === id)) {
      followUps.unshift({ id: uid("F"), patientId: v.patientId, visitId: id, type: "Post-treatment", due: addDays(TODAY, 14), assignee: getProvider(v.providerId)?.short ?? "Front desk", status: "Open" });
    }
    return lag(v, 400);
  },
  async completeFollowUp(id: string) {
    const f = followUps.find((x) => x.id === id)!; f.status = "Completed"; return lag(f, 250);
  },
  async createFollowUp(input: { patientId: string; type: FollowUp["type"]; due: string; assignee: string; visitId?: string }) {
    const f: FollowUp = { id: uid("F"), status: "Open", ...input };
    followUps.unshift(f); return lag(f, 350);
  },
  async addConfig(kind: "providers" | "services" | "locations" | "rooms" | "users", item: Record<string, string | number>) {
    const id = uid(kind.slice(0, 2));
    const base = { id, ...item };
    if (kind === "providers") providers.push({ short: String(item.name), status: "Active", serviceIds: [], locationIds: ["dt"], color: "#26B9CF", hours: "Mon–Fri · 9:00 AM–5:00 PM", ...base } as unknown as Provider);
    if (kind === "services") services.push({ providerIds: [], locationIds: ["dt"], status: "Active", ...base, duration: Number(item.duration) } as unknown as Service);
    if (kind === "locations") locations.push({ status: "Open", ...base } as unknown as Location);
    if (kind === "rooms") rooms.push({ availability: "Mon–Fri · 9:00 AM–5:00 PM", ...base } as unknown as Room);
    if (kind === "users") users.push({ status: "Invited", ...base } as unknown as AppUser);
    return lag(base, 450);
  },
  async updatePatient(id: string, patch: Partial<Patient>) { const p = patients.find((x) => x.id === id)!; Object.assign(p, patch); return lag(p, 300); },
  async addAlert(id: string, a: { type: "Allergy" | "Medical" | "Skin" | "Other"; description: string; severity?: "Low" | "Moderate" | "High" }) {
    const p = patients.find((x) => x.id === id)!; p.alerts = [...(p.alerts ?? []), { id: uid("al"), source: "Staff entry", date: TODAY, author: "Dr. Patel", ...a }]; return lag(p, 250);
  },
  async saveConfig(kind: "providers" | "services" | "locations" | "rooms" | "users", item: { id?: string } & Record<string, unknown>) {
    const list = { providers, services, locations, rooms, users }[kind] as unknown as ({ id: string } & Record<string, unknown>)[];
    const i = item.id ? list.findIndex((x) => x.id === item.id) : -1;
    let saved: { id: string } & Record<string, unknown>;
    if (i >= 0) { list[i] = { ...list[i], ...item }; saved = list[i]; } else { saved = { ...item, id: uid(kind.slice(0, 2)) } as { id: string } & Record<string, unknown>; if (kind === "providers" && !saved.short) saved.short = String(saved.name); list.push(saved); }
    return lag(saved, 350);
  },
  async markNotifications() { notifications.forEach((n) => (n.read = true)); return lag(true, 100); },
};

export function search(q: string) {
  const s = q.trim().toLowerCase();
  const none = { patients: [] as Patient[], appointments: [] as Appointment[], visits: [] as Visit[], providers: [] as Provider[], services: [] as Service[] };
  if (!s) return none;
  const hit = (...xs: string[]) => xs.some((x) => x.toLowerCase().includes(s));
  return {
    patients: patients.filter((p) => hit(`${p.first} ${p.last}`, p.id, p.phone, p.email)).slice(0, 4),
    appointments: appointments.filter((a) => a.date === TODAY && hit(pname(a.patientId), getService(a.serviceId)!.name)).slice(0, 4),
    visits: visits.filter((v) => hit(pname(v.patientId), v.type, v.reason)).slice(0, 4),
    providers: providers.filter((p) => hit(p.name, p.specialty)),
    services: services.filter((x) => hit(x.name, x.category)),
  };
}
