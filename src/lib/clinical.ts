import { applyOverrides, diffOverrides, migrateSnapshot, type Overrides } from "./role-perms";
import { isOpenStatus } from "@/lib/appointment-rules";
import type {
  PatientDoc, FormResponse, TreatmentPlan, PlanStep,
  AuditEntry, Estimate, FormTemplate, InventoryItem, InventoryMove, Invoice, InvoiceLine, PhotoAsset, Payment, PlotPoint, Visit,
} from "./types";
import { appointments, followUps, getProvider, patients, pname, services, TODAY, visits, addDays, fmtDate } from "./db";

const lag = <T,>(v: T, ms = 220) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), ms));
let seq = 500;
const uid = (p: string) => `${p}-${++seq}`;
const stamp = () => `${TODAY}T10:${String(20 + (seq % 30)).padStart(2, "0")}`;

/* ---------- Demo portraits (licensed stock, illustrative only) ---------- */
/** w,h = image px. fx,fy = face centre (fraction). fs = face+hair width (fraction of image width). */
export const FACES: Record<string, { w: number; h: number; fx: number; fy: number; fs: number }> = {
  w1: { w: 640, h: 959, fx: 0.46, fy: 0.37, fs: 0.34 }, w2: { w: 640, h: 427, fx: 0.6, fy: 0.42, fs: 0.27 },
  w3: { w: 1200, h: 800, fx: 0.54, fy: 0.44, fs: 0.23 }, w4: { w: 640, h: 527, fx: 0.5, fy: 0.42, fs: 0.33 },
  w5: { w: 640, h: 960, fx: 0.48, fy: 0.34, fs: 0.36 }, w6: { w: 640, h: 427, fx: 0.52, fy: 0.26, fs: 0.2 },
  w8: { w: 640, h: 960, fx: 0.53, fy: 0.38, fs: 0.32 },
  m1: { w: 640, h: 427, fx: 0.62, fy: 0.3, fs: 0.3 }, m2: { w: 640, h: 960, fx: 0.855, fy: 0.42, fs: 0.22 },
  m3: { w: 640, h: 960, fx: 0.52, fy: 0.25, fs: 0.27 }, m4: { w: 640, h: 852, fx: 0.52, fy: 0.35, fs: 0.42 },
  m5: { w: 640, h: 960, fx: 0.5, fy: 0.17, fs: 0.36 },
};
export const PATIENT_FACE: Record<string, string> = {
  "P-10248": "w3", "P-10251": "m1", "P-10256": "w1", "P-10260": "m3", "P-10263": "w2", "P-10270": "w8",
  "P-10274": "m4", "P-10281": "w4", "P-10285": "m2", "P-10290": "w5", "P-10294": "m5", "P-10299": "w6",
};

/* ---------- Clinic type configuration ---------- */
export type ClinicType = "Medical aesthetics" | "Dermatology" | "Dental" | "Physiotherapy" | "Wellness" | "General medical" | "Other specialty";
export const CLINIC_TYPES: ClinicType[] = ["Medical aesthetics", "Dermatology", "Dental", "Physiotherapy", "Wellness", "General medical", "Other specialty"];
export interface ClinicConfig {
  emphasis: string; treatmentLabel: string; notesLabel: string;
  tabs: { photos: boolean; plotting: boolean; products: boolean; plan: boolean; exercises: boolean; measurements: boolean };
  photoChecklist: string[]; capabilityHint: string;
}
export const CLINIC_CONFIG: Record<ClinicType, ClinicConfig> = {
  "Medical aesthetics": { emphasis: "Treatment history, patient journey, photos and before/after", treatmentLabel: "Treatment", notesLabel: "Notes", tabs: { photos: true, plotting: true, products: true, plan: true, exercises: false, measurements: false }, photoChecklist: ["Front", "Left profile", "Right profile", "Close-up (eyes)", "Close-up (lips)"], capabilityHint: "Guided photo capture, injection plotting, products, units and lot, consent and aftercare." },
  Dermatology: { emphasis: "Skin history, assessments and clinical photos", treatmentLabel: "Treatment", notesLabel: "Assessment", tabs: { photos: true, plotting: false, products: true, plan: true, exercises: false, measurements: false }, photoChecklist: ["Front", "Left profile", "Right profile"], capabilityHint: "Treatment-specific photo sets. Plotting can be enabled per service." },
  Dental: { emphasis: "Dental visit history, procedures and recall", treatmentLabel: "Procedure", notesLabel: "Visit notes", tabs: { photos: true, plotting: false, products: false, plan: true, exercises: false, measurements: false }, photoChecklist: ["Front"], capabilityHint: "Procedures, treatment plans and recall. A dedicated odontogram is separate scope." },
  Physiotherapy: { emphasis: "Assessment, session notes, progress and exercise plans", treatmentLabel: "Intervention", notesLabel: "Session notes", tabs: { photos: false, plotting: false, products: false, plan: true, exercises: true, measurements: true }, photoChecklist: [], capabilityHint: "Progress measurements and exercise plans. No injectable fields by default." },
  Wellness: { emphasis: "Intake, consultations and care plans", treatmentLabel: "Session", notesLabel: "Consultation notes", tabs: { photos: false, plotting: false, products: false, plan: true, exercises: false, measurements: false }, photoChecklist: [], capabilityHint: "Care plans and session history." },
  "General medical": { emphasis: "Patient history, visit notes, forms and follow-up", treatmentLabel: "Procedure", notesLabel: "Visit notes", tabs: { photos: false, plotting: false, products: false, plan: false, exercises: false, measurements: false }, photoChecklist: [], capabilityHint: "Visit notes, forms and documents. Not a full EHR." },
  "Other specialty": { emphasis: "Configurable patient record, services and visit templates", treatmentLabel: "Treatment", notesLabel: "Notes", tabs: { photos: true, plotting: false, products: false, plan: true, exercises: false, measurements: false }, photoChecklist: ["Front"], capabilityHint: "Enable only the supported capabilities you need." },
};
export const CAPABILITIES = [
  ["areas", "Treatment areas"], ["beforeAfter", "Before/after photos"], ["guided", "Guided capture template"], ["plotting", "Injection plotting"],
  ["clinicalForm", "Clinical form"], ["consent", "Consent"], ["products", "Products and units"], ["plan", "Treatment plan"], ["aftercare", "Aftercare"], ["followUp", "Follow-up"],
] as const;
export type CapKey = (typeof CAPABILITIES)[number][0];
const caps = (...on: CapKey[]) => Object.fromEntries(CAPABILITIES.map(([k]) => [k, on.includes(k)])) as Record<CapKey, boolean>;
/** Per-service capability toggles (editable in Practice → Services). */
export const SERVICE_CAPS: Record<string, Record<CapKey, boolean>> = {
  consult: caps("clinicalForm", "consent", "plan", "followUp"), followup: caps("followUp"), skin: caps("areas", "beforeAfter", "clinicalForm", "followUp"),
  inject: caps("areas", "beforeAfter", "guided", "plotting", "consent", "products", "plan", "aftercare", "followUp"),
  physio: caps("clinicalForm", "plan", "followUp"), dental: caps("clinicalForm", "consent", "plan", "followUp"), review: caps("beforeAfter", "followUp"),
};
export const SERVICE_PRICE: Record<string, number> = { consult: 120, followup: 60, skin: 150, inject: 480, physio: 95, dental: 140, review: 80 };

export function loadClinic(): ClinicType { try { return (localStorage.getItem("pms.clinicType") as ClinicType) || "Medical aesthetics"; } catch { return "Medical aesthetics"; } }
export function saveClinic(t: ClinicType) { try { localStorage.setItem("pms.clinicType", t); window.dispatchEvent(new Event("pms-clinic")); } catch {} }

/* ---------- Roles and permissions ---------- */
export type Role = "Owner" | "Practice manager" | "Provider" | "Front desk" | "Staff" | "Marketing";
export const PERMS = [["patients", "Patient data"], ["notes", "Clinical notes"], ["photos", "Photos"], ["financials", "Financials"], ["refunds", "Refunds"], ["inventory", "Inventory"], ["reports", "Reports"], ["exports", "Exports"], ["settings", "Settings"], ["ai", "AI actions"], ["crm", "CRM"], ["booking", "Manage bookings"], ["booking_view", "View bookings"], ["campaigns", "Manage campaigns"], ["insights", "Marketing insights"], ["enquiries", "Manage enquiries"], ["enquiries_view", "View enquiries (read-only)"], ["config", "Practice configuration"]] as const;
export type PermKey = (typeof PERMS)[number][0];
const BASE: PermKey[] = ["config"];
/** Defaults. A person's changes are kept separately (see role-perms.ts) so these can change without losing them. */
const DEFAULT_ROLE_PERMS: Record<Role, PermKey[]> = {
  Owner: ["patients", "notes", "photos", "financials", "refunds", "inventory", "reports", "exports", "settings", "ai", "crm", "booking", "booking_view", "campaigns", "insights", "enquiries", "enquiries_view", ...BASE],
  "Practice manager": ["patients", "financials", "refunds", "inventory", "reports", "exports", "settings", "ai", "crm", "booking", "booking_view", "campaigns", "insights", "enquiries", "enquiries_view", ...BASE],
  Provider: ["patients", "notes", "photos", "inventory", "reports", "ai", "booking_view", ...BASE],
  "Front desk": ["patients", "financials", "crm", "booking", "booking_view", "enquiries", "enquiries_view", ...BASE],
  Staff: ["patients", "photos", "inventory", ...BASE],
  Marketing: ["crm", "campaigns", "insights", "enquiries_view"],
};
export const ROLE_PERMS: Record<Role, PermKey[]> = structuredClone(DEFAULT_ROLE_PERMS);
const LOCKED = ["Owner"];
const OKEY = "pms.rolePermOverrides";
const PERMS_V1 = ["patients", "notes", "photos", "financials", "refunds", "inventory", "reports", "exports", "settings", "ai"];
const PERMS_V2 = [...PERMS_V1, "crm", "booking", "booking_view", "campaigns", "insights", "enquiries"];
function loadRolePerms() {
  try {
    let o: Overrides | null = JSON.parse(localStorage.getItem(OKEY) ?? "null");
    if (!o) {
      const legacy = JSON.parse(localStorage.getItem("pms.rolePerms") ?? "null");        // older full snapshots, left in place as a backup
      if (legacy) { o = migrateSnapshot(DEFAULT_ROLE_PERMS, legacy, localStorage.getItem("pms.rolePermsV") === "2" ? PERMS_V2 : PERMS_V1, LOCKED); localStorage.setItem(OKEY, JSON.stringify(o)); }
    }
    if (o) Object.assign(ROLE_PERMS, applyOverrides(DEFAULT_ROLE_PERMS, o, LOCKED));
  } catch {}
}
loadRolePerms();
/** Re-derives ROLE_PERMS from the defaults plus saved overrides (used by tests and after resets). */
export function resetRolePermsToStored() { Object.assign(ROLE_PERMS, structuredClone(DEFAULT_ROLE_PERMS)); loadRolePerms(); }
export function saveRolePerms() { try { localStorage.setItem(OKEY, JSON.stringify(diffOverrides(DEFAULT_ROLE_PERMS, ROLE_PERMS, LOCKED))); window.dispatchEvent(new Event("pms-clinic")); } catch {} }
export function loadRole(): Role { try { return (localStorage.getItem("pms.role") as Role) || "Owner"; } catch { return "Owner"; } }
export function saveRole(r: Role) { try { localStorage.setItem("pms.role", r); window.dispatchEvent(new Event("pms-clinic")); } catch {} }

/* ---------- Photos ---------- */
const P = (id: string, patientId: string, visitId: string, date: string, view: PhotoAsset["view"], stage: PhotoAsset["stage"], area: string): PhotoAsset => ({
  id, patientId, visitId, date, author: "Dr. Patel", view, stage, area, source: "demo", consent: "Not recorded", notes: "", key: PATIENT_FACE[patientId],
});
export const photos: PhotoAsset[] = [
  P("ph1", "P-10248", "V-5001", "2026-09-18", "Front", "Before", "Full face"),
  P("ph2", "P-10248", "V-5001", "2026-09-18", "Close-up (eyes)", "Before", "Periorbital"),
  P("ph3", "P-10248", "V-5001", "2026-09-18", "Close-up (lips)", "Before", "Perioral"),
  P("ph4", "P-10248", "V-5001", "2026-10-02", "Front", "After", "Full face"),
  P("ph5", "P-10248", "V-5001", "2026-10-02", "Close-up (eyes)", "After", "Periorbital"),
  P("ph6", "P-10270", "V-5007", "2026-09-10", "Front", "Before", "Full face"),
  P("ph7", "P-10281", "V-5009", "2026-09-02", "Front", "Before", "Full face"),
  P("ph8", "P-10299", "V-5012", "2026-09-23", "Front", "Before", "Full face"),
];

/* ---------- Billing ---------- */
const L = (desc: string, qty: number, unit: number, discount = 0, taxRate = 0, treatment?: string): InvoiceLine => ({ id: uid("l"), desc, qty, unit, discount, taxRate, treatment });
export const invoices: Invoice[] = [
  { id: "INV-1031", patientId: "P-10248", visitId: "V-5003", issued: "2026-08-21", due: "2026-08-28", lines: [L("Follow-up", 1, 120)], status: "Paid", currency: "USD" },
  { id: "INV-1039", patientId: "P-10248", visitId: "V-5002", issued: "2026-09-04", due: "2026-09-11", lines: [L("Consultation", 1, 180)], status: "Paid", currency: "USD" },
  { id: "INV-1044", patientId: "P-10248", visitId: "V-5001", issued: "2026-09-18", due: "2026-09-25", lines: [L("Injectable treatment", 1, 480, 0, 0, "Forehead, glabella, lateral canthal"), L("Botulinum toxin A (units)", 32, 15)], status: "Paid", currency: "USD" },
  { id: "INV-1046", patientId: "P-10248", issued: "2026-09-25", due: "2026-10-09", lines: [L("Skin booster add-on", 1, 240)], status: "Issued", currency: "USD" },
  { id: "INV-1042", patientId: "P-10270", visitId: "V-5007", issued: "2026-09-10", due: "2026-09-17", lines: [L("Injectable treatment", 1, 480), L("Hyaluronic acid filler (ml)", 1, 450, 10)], status: "Paid", currency: "USD" },
  { id: "INV-1035", patientId: "P-10281", visitId: "V-5009", issued: "2026-09-02", due: "2026-09-09", lines: [L("Injectable treatment", 1, 480), L("Botulinum toxin A (units)", 30, 15, 0, 0)], status: "Paid", currency: "USD" },
  { id: "INV-1045", patientId: "P-10299", visitId: "V-5012", issued: "2026-09-23", due: "2026-09-30", lines: [L("Injectable treatment", 1, 320)], status: "Partially paid", currency: "USD" },
  { id: "INV-1047", patientId: "P-10274", visitId: "V-5008", issued: "2026-09-15", due: "2026-09-22", lines: [L("Consultation", 1, 150)], status: "Paid", currency: "USD" },
];
export const estimates: Estimate[] = [
  { id: "EST-210", patientId: "P-10248", date: "2026-10-01", expiry: "2026-10-31", lines: [L("Injectable treatment", 1, 480), L("Hyaluronic acid filler (ml)", 1, 450)], status: "Sent", notes: "Lip and chin refinement" },
];
const Pay = (patientId: string, invoiceId: string | undefined, kind: Payment["kind"], date: string, amount: number, method: string, reference: string, reason?: string): Payment => ({ id: uid("pay"), patientId, invoiceId, kind, date, amount, method, reference, by: "Tom Reyes", status: "Posted", reason });
export const payments: Payment[] = [
  Pay("P-10248", "INV-1031", "payment", "2026-08-21", 120, "Card", "CH-4410"),
  Pay("P-10248", "INV-1039", "payment", "2026-09-04", 180, "Card", "CH-4483"),
  Pay("P-10248", "INV-1044", "payment", "2026-09-18", 960, "Card", "CH-4551"),
  Pay("P-10270", "INV-1042", "payment", "2026-09-10", 885, "Card", "CH-4521"),
  Pay("P-10281", "INV-1035", "payment", "2026-09-02", 930, "Card", "CH-4398"),
  Pay("P-10299", "INV-1045", "payment", "2026-09-23", 200, "Cash", "CASH-088"),
  Pay("P-10274", "INV-1047", "payment", "2026-09-15", 150, "Card", "CH-4531"),
  Pay("P-10281", undefined, "deposit", "2026-10-01", 100, "Card", "CH-4602", "Deposit for Oct 7 treatment"),
  Pay("P-10299", "INV-1045", "credit", "2026-09-30", 40, "Credit", "CR-012", "Goodwill credit"),
];

export const money = (n: number, cur = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(n);
export const lineTotal = (l: InvoiceLine) => Math.round(l.qty * l.unit * (1 - l.discount / 100) * (1 + l.taxRate / 100) * 100) / 100;
export const docTotal = (d: { lines: InvoiceLine[] }) => Math.round(d.lines.reduce((s, l) => s + lineTotal(l), 0) * 100) / 100;
export const invoicePaid = (id: string) => Math.round(payments.filter((p) => p.invoiceId === id && p.status === "Posted").reduce((s, p) => s + (p.kind === "refund" ? -p.amount : p.amount), 0) * 100) / 100;
export const invoiceBalance = (i: Invoice) => (i.status === "Void" || i.status === "Draft" ? 0 : Math.max(0, Math.round((docTotal(i) - invoicePaid(i.id)) * 100) / 100));
export function invoiceStatus(i: Invoice): Invoice["status"] {
  if (i.status === "Void" || i.status === "Draft") return i.status;
  const b = invoiceBalance(i); const paid = invoicePaid(i.id);
  return b === 0 ? "Paid" : paid > 0 ? "Partially paid" : "Issued";
}
export function patientFinancials(pid: string) {
  const inv = invoices.filter((i) => i.patientId === pid);
  const paid = payments.filter((p) => p.patientId === pid && p.status === "Posted" && (p.kind === "payment")).reduce((s, p) => s + p.amount, 0);
  const deposits = payments.filter((p) => p.patientId === pid && p.status === "Posted" && p.kind === "deposit" && !p.invoiceId).reduce((s, p) => s + p.amount, 0);
  const credits = payments.filter((p) => p.patientId === pid && p.status === "Posted" && p.kind === "credit" && !p.invoiceId).reduce((s, p) => s + p.amount, 0);
  const outstanding = inv.reduce((s, i) => s + invoiceBalance(i), 0);
  return { paid, deposits, credits, outstanding, unpaid: inv.filter((i) => invoiceBalance(i) > 0).length, last: [...inv].sort((a, b) => b.issued.localeCompare(a.issued))[0] };
}

/* ---------- Inventory ---------- */
export const inventory: InventoryItem[] = [
  { id: "i1", name: "Botulinum toxin A", sku: "BTX-100", category: "Neuromodulator", supplier: "Meridian Medical Supply", locationId: "dt", qty: 420, unit: "units", reorder: 200, lot: "BTX1234", expiry: "2027-03-31", price: 15, status: "Active" },
  { id: "i2", name: "Hyaluronic acid filler", sku: "HA-1ML", category: "Dermal filler", supplier: "Meridian Medical Supply", locationId: "dt", qty: 6, unit: "ml", reorder: 8, lot: "FILL5678", expiry: "2027-01-15", price: 450, status: "Low" },
  { id: "i3", name: "Biostimulator", sku: "BIO-2", category: "Biostimulator", supplier: "Aurora Aesthetics", locationId: "dt", qty: 12, unit: "vials", reorder: 4, lot: "BIO7781", expiry: "2027-06-30", price: 320, status: "Active" },
  { id: "i4", name: "Sterile saline 10 ml", sku: "SAL-10", category: "Consumables", supplier: "Northgate Clinical", locationId: "dt", qty: 90, unit: "vials", reorder: 30, price: 3, status: "Active" },
  { id: "i5", name: "Resistance bands", sku: "PHY-RB", category: "Physio equipment", supplier: "Northgate Clinical", locationId: "ws", qty: 18, unit: "pcs", reorder: 6, price: 12, status: "Active" },
  { id: "i6", name: "Disposable gloves (M)", sku: "GLV-M", category: "Consumables", supplier: "Northgate Clinical", locationId: "dt", qty: 0, unit: "boxes", reorder: 10, price: 9, status: "Out" },
];
export const moves: InventoryMove[] = [
  { id: "mv1", itemId: "i1", date: "2026-09-18", delta: -32, reason: "Used in treatment (P-10248)", by: "Dr. Patel", visitId: "V-5001" },
  { id: "mv2", itemId: "i2", date: "2026-09-10", delta: -1, reason: "Used in treatment (P-10270)", by: "Dr. Patel", visitId: "V-5007" },
  { id: "mv3", itemId: "i1", date: "2026-09-25", delta: 100, reason: "Stock received", by: "Meera Iyer" },
];
export const invStatus = (i: InventoryItem): InventoryItem["status"] => (i.status === "Archived" ? "Archived" : i.qty <= 0 ? "Out" : i.qty <= i.reorder ? "Low" : "Active");

/* ---------- Forms ---------- */
const F = (id: string, type: FormTemplate["fields"][number]["type"], label: string, required = false, options?: string[], helper?: string) => ({ id, type, label, required, options, helper });
export const templates: FormTemplate[] = [
  { id: "ft1", name: "Treatment consent", type: "Consent", specialty: "Medical aesthetics", description: "Informed consent for injectable treatments.", version: 3, status: "Published", owner: "Meera Iyer", fields: [F("a", "instructions", "I understand the nature of the treatment, expected effects and possible side effects.", false), F("b", "yesno", "I have disclosed relevant medical history and allergies", true), F("c", "checkbox", "I consent to treatment and photography for my clinical record", true), F("d", "short", "Full name (typed signature)", true)] },
  { id: "ft2", name: "Photo release", type: "Consent", specialty: "All", description: "Permission to store treatment photos.", version: 1, status: "Published", owner: "Meera Iyer", fields: [F("a", "checkbox", "I consent to clinical photography", true), F("b", "yesno", "I consent to use of photos for education (optional)", false)] },
  { id: "ft3", name: "Medical history", type: "Intake", specialty: "All", description: "New patient intake.", version: 2, status: "Published", owner: "Dr. Patel", fields: [F("a", "long", "Current medications", false), F("b", "multi", "Conditions", false, ["Diabetes", "Hypertension", "Autoimmune condition", "Skin condition", "None of the above"]), F("c", "long", "Allergies (describe)", false, undefined, "Leave blank if none reported.")] },
  { id: "ft4", name: "Physiotherapy intake", type: "Clinical form", specialty: "Physiotherapy", description: "Assessment before first session.", version: 1, status: "Published", owner: "Dr. Mehta", fields: [F("a", "select", "Primary complaint", true, ["Back", "Neck", "Shoulder", "Knee", "Other"]), F("b", "number", "Pain level (0 to 10)", true), F("c", "date", "Onset date", false)] },
  { id: "ft5", name: "Skin assessment", type: "Clinical form", specialty: "Dermatology", description: "Skin history and concerns.", version: 1, status: "Draft", owner: "Dr. Rao", fields: [F("a", "multi", "Concerns", false, ["Acne", "Pigmentation", "Redness", "Dryness", "Ageing"]), F("b", "file", "Upload photos", false)] },
];

/* ---------- Plans, documents, responses ---------- */
const S = (id: string, title: string, status: PlanStep["status"], date?: string, note?: string): PlanStep => ({ id, title, status, date, note });
export const plans: TreatmentPlan[] = [
  { id: "pl1", patientId: "P-10248", name: "Forehead and eye-area programme", providerId: "pat", created: "2026-09-04", goal: "Soften forehead and lateral canthal lines ahead of the patient's event, with staged reviews.", review: "2026-10-15", status: "Active", notes: "Patient prefers conservative results.",
    steps: [S("s1", "Initial consultation", "Completed", "2026-09-04"), S("s2", "Injectable treatment", "Completed", "2026-09-18"), S("s3", "Two-week review", "Completed", "2026-10-02"), S("s4", "Maintenance treatment", "Scheduled", "2026-10-07"), S("s5", "Treatment review", "Scheduled", "2026-10-15"), S("s6", "Skin booster add-on", "Deferred", undefined, "Patient asked to revisit after the event.")] },
  { id: "pl2", patientId: "P-10270", name: "Lip refinement", providerId: "pat", created: "2026-09-10", goal: "Staged lip treatment with review at four weeks.", review: "2026-10-12", status: "Active", notes: "",
    steps: [S("s1", "Lip treatment", "Completed", "2026-09-10"), S("s2", "Treatment review", "Planned", "2026-10-12")] },
];
export const documents: PatientDoc[] = [
  { id: "d1", patientId: "P-10248", name: "GP referral letter.pdf", kind: "Referral", date: "2026-09-02", by: "Meera Iyer", status: "Filed" },
  { id: "d2", patientId: "P-10248", name: "Treatment consent (signed).pdf", kind: "Consent record", date: "2026-09-18", by: "Dr. Patel", status: "Filed" },
  { id: "d3", patientId: "P-10260", name: "Knee MRI report.pdf", kind: "Lab/Outside record", date: "2026-08-15", by: "Dr. Mehta", status: "Needs review" },
];
export const responses: FormResponse[] = [
  { id: "r1", patientId: "P-10248", visitId: "V-5002", templateId: "ft3", templateName: "Medical history", version: 2, submitted: "2026-09-04", by: "Sarah Johnson", status: "Reviewed", answers: { a: "None reported", b: "None of the above", c: "" } },
  { id: "r2", patientId: "P-10248", visitId: "V-5001", templateId: "ft1", templateName: "Treatment consent", version: 3, submitted: "2026-09-18", by: "Sarah Johnson", status: "Reviewed", answers: { b: "Yes", c: "true", d: "Sarah Johnson" } },
];

/* ---------- Audit ---------- */
export const audit: AuditEntry[] = [
  { id: "au1", at: "2026-10-05T16:40", who: "Meera Iyer", action: "Changed role", target: "Tom Reyes → Front desk" },
  { id: "au2", at: "2026-10-06T09:12", who: "Dr. Patel", action: "Edited clinical note", target: "Visit V-5006" },
  { id: "au3", at: "2026-10-06T14:03", who: "Meera Iyer", action: "Issued credit", target: "CR-012 · INV-1045" },
];
const log = (who: string, action: string, target: string) => audit.unshift({ id: uid("au"), at: stamp(), who, action, target });

export interface AiActivity { id: string; agent: string; by: string; context: string; proposed: string; status: "Awaiting review" | "Approved" | "Dismissed"; at: string }
export const aiActivity: AiActivity[] = [
  { id: "ai1", agent: "Follow-up Agent", by: "Meera Iyer", context: "Overdue follow-ups", proposed: "Review 2 overdue follow-ups", status: "Approved", at: "2026-10-06T08:05" },
  { id: "ai2", agent: "Visit Preparation Agent", by: "Dr. Patel", context: "Sarah Johnson, Oct 7 appointment", proposed: "Summarize documented history", status: "Approved", at: "2026-10-06T17:40" },
  { id: "ai3", agent: "Practice Insights Agent", by: "Meera Iyer", context: "Last 7 days", proposed: "Summarize appointments and no-shows", status: "Dismissed", at: "2026-10-05T09:12" },
];
export const logAudit = (who: string, action: string, target: string) => audit.unshift({ id: `au-${Date.now()}`, at: `${TODAY}T10:30`, who, action, target });
/* ---------- API ---------- */
export const apiC = {
  photos: () => lag(photos),
  invoices: () => lag({ invoices, estimates, payments }),
  inventory: () => lag({ inventory, moves }),
  templates: () => lag(templates),
  ai: () => lag(aiActivity, 120),
  async runAgent(agent: string, by: string, context: string, proposed: string) {
    const a: AiActivity = { id: uid("ai"), agent, by, context, proposed, status: "Awaiting review", at: `${TODAY}T10:${String(20 + (seq % 30)).padStart(2, "0")}` };
    aiActivity.unshift(a); logAudit(by, "Ran agent", `${agent}: ${proposed}`); return lag(a, 500);
  },
  async reviewActivity(id: string, status: "Approved" | "Dismissed", by: string) {
    const a = aiActivity.find((x) => x.id === id)!; a.status = status; logAudit(by, `${status} agent result`, `${a.agent}: ${a.proposed}`); return lag(a, 150);
  },
  extras: () => lag({ plans, documents, responses }),
  async setPlanStep(planId: string, stepId: string, status: PlanStep["status"]) {
    const st = plans.find((x) => x.id === planId)!.steps.find((x) => x.id === stepId)!; st.status = status; log("Dr. Patel", "Updated treatment plan step", `${planId} · ${st.title} → ${status}`); return lag(st, 150);
  },
  async addPlan(input: { patientId: string; name: string; goal: string; providerId: string; review: string }) {
    const pl: TreatmentPlan = { id: uid("pl"), created: TODAY, status: "Active", notes: "", steps: [], ...input }; plans.unshift(pl); log("Dr. Patel", "Created treatment plan", pl.name); return lag(pl, 250);
  },
  async addPlanStep(planId: string, title: string, date?: string) {
    plans.find((x) => x.id === planId)!.steps.push({ id: uid("s"), title, status: date ? "Scheduled" : "Planned", date }); return lag(true, 150);
  },
  async addDocument(d: Omit<PatientDoc, "id">) { const x = { ...d, id: uid("d") }; documents.unshift(x); log(d.by, "Added document", `${x.name}`); return lag(x, 350); },
  async deleteDocument(id: string) { const i = documents.findIndex((x) => x.id === id); const [d] = documents.splice(i, 1); log("Meera Iyer", "Deleted document", d.name); return lag(true, 200); },
  async submitForm(r: Omit<FormResponse, "id">) {
    const x = { ...r, id: uid("r") }; responses.unshift(x);
    const v = r.visitId ? visits.find((y) => y.id === r.visitId) : undefined;
    const tpl = templates.find((t) => t.id === r.templateId);
    if (v && tpl) { const ex = v.forms.find((f) => f.name === tpl.name); if (ex) ex.signed = true; else v.forms.push({ id: uid("f"), name: tpl.name, kind: tpl.type === "Consent" ? "Consent" : "Clinical form", signed: true }); }
    log(r.by, "Submitted form", `${r.templateName} v${r.version}`); return lag(x, 350);
  },
  audit: () => lag(audit),

  async addPhoto(p: Omit<PhotoAsset, "id" | "author"> & { author?: string }) {
    const a: PhotoAsset = { ...p, id: uid("ph"), author: p.author ?? "Dr. Patel" }; photos.unshift(a);
    log(a.author, "Added photo", `${pname(a.patientId)} · ${a.view} (${a.stage})`);
    return lag(a, 350);
  },
  async savePlot(visitId: string, points: PlotPoint[], extra?: Partial<Visit>) {
    const v = visits.find((x) => x.id === visitId)!;
    v.plotVersions = [...(v.plotVersions ?? []), { version: (v.plotVersions?.length ?? 0) + 1, author: getProvider(v.providerId)?.short ?? "Provider", at: stamp(), points: structuredClone(points) }].slice(-20);
    v.plot = points; Object.assign(v, extra);
    return lag(v, 100);
  },
  async createInvoice(input: { patientId: string; visitId?: string; lines: InvoiceLine[]; status?: Invoice["status"] }) {
    const id = `INV-${1048 + invoices.filter((i) => Number(i.id.slice(4)) >= 1048).length}`;
    const inv: Invoice = { id, patientId: input.patientId, visitId: input.visitId, issued: TODAY, due: addDays(TODAY, 14), lines: input.lines, status: input.status ?? "Issued", currency: "USD" };
    invoices.unshift(inv); log("Tom Reyes", input.status === "Draft" ? "Drafted invoice" : "Issued invoice", `${id} · ${pname(input.patientId)}`);
    return lag(inv, 350);
  },
  async voidInvoice(id: string) { const i = invoices.find((x) => x.id === id)!; i.status = "Void"; log("Meera Iyer", "Voided invoice", id); return lag(i, 250); },
  async recordPayment(input: { patientId: string; invoiceId?: string; kind: Payment["kind"]; amount: number; method: string; reference: string; reason?: string }) {
    const p: Payment = { id: uid("pay"), date: TODAY, by: "Tom Reyes", status: "Posted", ...input };
    payments.unshift(p);
    if (input.invoiceId) { const i = invoices.find((x) => x.id === input.invoiceId)!; i.status = invoiceStatus(i); }
    log("Tom Reyes", `Recorded ${input.kind}`, `${money(input.amount)} · ${pname(input.patientId)}${input.invoiceId ? " · " + input.invoiceId : ""}`);
    return lag(p, 350);
  },
  async applyDeposit(depositId: string, invoiceId: string) {
    const d = payments.find((x) => x.id === depositId)!; const inv = invoices.find((x) => x.id === invoiceId)!;
    const use = Math.min(d.amount, invoiceBalance(inv));
    if (use <= 0) return lag(inv, 100);
    if (use < d.amount) { d.amount = Math.round((d.amount - use) * 100) / 100; payments.unshift({ ...d, id: uid("pay"), amount: use, invoiceId, date: TODAY }); } else { d.invoiceId = invoiceId; }
    inv.status = invoiceStatus(inv); log("Tom Reyes", "Applied deposit", `${money(use)} → ${invoiceId}`); return lag(inv, 300);
  },
  async issueInvoice(id: string) { const i = invoices.find((x) => x.id === id)!; i.status = "Issued"; i.issued = TODAY; log("Tom Reyes", "Issued invoice", id); return lag(i, 250); },
  async reversePayment(id: string) {
    const p = payments.find((x) => x.id === id)!; p.status = "Reversed";
    if (p.invoiceId) { const i = invoices.find((x) => x.id === p.invoiceId)!; i.status = invoiceStatus(i); }
    log("Meera Iyer", "Reversed payment", `${p.id} · ${money(p.amount)}`);
    return lag(p, 250);
  },
  async acceptEstimate(id: string) {
    const e = estimates.find((x) => x.id === id)!; e.status = "Accepted";
    const inv: Invoice = { id: `INV-${1048 + invoices.filter((i) => Number(i.id.slice(4)) >= 1048).length}`, patientId: e.patientId, issued: TODAY, due: addDays(TODAY, 14), lines: e.lines.map((l) => ({ ...l, id: uid("l") })), status: "Draft", currency: "USD" };
    invoices.unshift(inv); log("Tom Reyes", "Accepted estimate", `${id} → ${inv.id}`);
    return lag(inv, 300);
  },
  async adjustStock(itemId: string, delta: number, reason: string) {
    const it = inventory.find((x) => x.id === itemId)!; it.qty = Math.max(0, it.qty + delta); it.status = invStatus(it);
    moves.unshift({ id: uid("mv"), itemId, date: TODAY, delta, reason, by: "Meera Iyer" });
    return lag(it, 250);
  },
  async addItem(item: Omit<InventoryItem, "id" | "status">) {
    const it: InventoryItem = { ...item, id: uid("i"), status: "Active" }; it.status = invStatus(it); inventory.unshift(it);
    moves.unshift({ id: uid("mv"), itemId: it.id, date: TODAY, delta: it.qty, reason: "Opening stock", by: "Meera Iyer" });
    return lag(it, 300);
  },
  async saveTemplate(t: FormTemplate) {
    const i = templates.findIndex((x) => x.id === t.id);
    if (i >= 0) templates[i] = t; else templates.unshift(t);
    log("Meera Iyer", t.status === "Published" ? "Published form" : "Saved form draft", `${t.name} v${t.version}`);
    return lag(t, 300);
  },
  /** Completing a visit deducts documented product units from stock (linked movement). */
  async consumeStock(visitId: string) {
    const v = visits.find((x) => x.id === visitId)!;
    const byProduct = new Map<string, number>();
    v.plot.forEach((p) => byProduct.set(p.product, (byProduct.get(p.product) ?? 0) + p.units));
    byProduct.forEach((units, product) => {
      const it = inventory.find((x) => x.name === product);
      if (it && units > 0 && !moves.some((m) => m.visitId === visitId && m.itemId === it.id)) {
        it.qty = Math.max(0, it.qty - units); it.status = invStatus(it);
        moves.unshift({ id: uid("mv"), itemId: it.id, date: TODAY, delta: -units, reason: `Used in treatment (${v.patientId})`, by: getProvider(v.providerId)?.short ?? "Provider", visitId });
      }
    });
    log(getProvider(v.providerId)?.short ?? "Provider", "Completed visit", `${v.id} · ${pname(v.patientId)}`);
    return lag(true, 50);
  },
};

/* ---------- Journey ---------- */
export interface JourneyEvent {
  id: string; date: string; kind: "visit" | "treatment" | "photo" | "form" | "payment" | "followup" | "appointment"; title: string; sub: string; owner: string; status: string;
  href?: string; photoIds?: string[]; invoiceId?: string; upcoming?: boolean; plot?: number; visitId?: string;
}
export function journeyFor(pid: string): JourneyEvent[] {
  const ev: JourneyEvent[] = [];
  visits.filter((v) => v.patientId === pid).forEach((v) => {
    const prov = getProvider(v.providerId)?.short ?? "";
    ev.push({ id: v.id, date: v.date, kind: "visit", title: v.type, sub: v.reason || "Visit", owner: prov, status: v.status, href: `/visits/${v.id}` });
    if (v.treatments.length || v.plot.length) ev.push({ id: v.id + "t", date: v.date, kind: "treatment", title: v.areas || v.treatments[0]?.area || "Treatment", sub: v.treatments.map((t) => `${t.product} · ${t.units} units`).join(", ") || `${v.plot.length} injection points`, owner: prov, status: v.status, href: `/visits/${v.id}`, photoIds: photos.filter((p) => p.visitId === v.id).map((p) => p.id), plot: v.plot.length, visitId: v.id });
    v.forms.forEach((f) => ev.push({ id: f.id + v.id, date: v.date, kind: "form", title: f.name, sub: `${f.kind} · ${f.signed ? "signed" : "awaiting signature"}`, owner: prov, status: f.signed ? "Signed" : "Pending", href: `/visits/${v.id}` }));
  });
  appointments.filter((a) => a.patientId === pid && a.date >= TODAY && isOpenStatus(a.status)).forEach((a) => ev.push({ id: a.id, date: a.date, kind: "appointment", title: services.find((s) => s.id === a.serviceId)?.name ?? "Appointment", sub: `${fmtDate(a.date)} · ${a.time}`, owner: getProvider(a.providerId)?.short ?? "", status: "Upcoming", upcoming: true }));
  followUps.filter((f) => f.patientId === pid).forEach((f) => ev.push({ id: f.id, date: f.due, kind: "followup", title: f.type, sub: `Due ${fmtDate(f.due)}`, owner: f.assignee, status: f.status === "Completed" ? "Completed" : f.due < TODAY ? "Overdue" : "Open", href: "/follow-ups", upcoming: f.status === "Open" && f.due >= TODAY }));
  invoices.filter((i) => i.patientId === pid).forEach((i) => ev.push({ id: i.id, date: i.issued, kind: "payment", title: `${i.id} · ${money(docTotal(i))}`, sub: i.lines.map((l) => l.desc).slice(0, 2).join(", "), owner: "Front desk", status: invoiceStatus(i), invoiceId: i.id }));
  photos.filter((p) => p.patientId === pid).forEach((p) => ev.push({ id: p.id, date: p.date, kind: "photo", title: `${p.stage} · ${p.view}`, sub: p.area, owner: p.author, status: p.consent === "Granted" ? "Photo consent granted" : p.consent === "Not recorded" ? "Photo consent not recorded" : `Photo consent ${p.consent.toLowerCase()}`, photoIds: [p.id] }));
  return ev.sort((a, b) => b.date.localeCompare(a.date));
}
export { patients };
