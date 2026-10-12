import {
  addDays, appointments, followUps, fmtDate, fmtTime, getPatient, getProvider, getService, nowMin, patients, pname,
  providers, TODAY, toMin, visits, fromMin,
} from "./db";
import { photos, inventory, invStatus, patientFinancials, money, type PermKey } from "./clinical";
import { isOpenStatus, isLiveStatus } from "@/lib/appointment-rules";

/* ---------------- Shared helpers ---------------- */
export const waitingNow = () =>
  appointments.filter((a) => a.date === TODAY && a.status === "waiting").map((a) => ({ a, mins: Math.max(0, nowMin() - (a.arrivedAt ?? nowMin())) })).sort((x, y) => y.mins - x.mins);

export const followUpBuckets = () => {
  const open = followUps.filter((f) => f.status === "Open");
  return { overdue: open.filter((f) => f.due < TODAY), today: open.filter((f) => f.due === TODAY), upcoming: open.filter((f) => f.due > TODAY) };
};

export const patientVisits = (pid: string) => visits.filter((v) => v.patientId === pid).sort((a, b) => b.date.localeCompare(a.date));

/** Visit preparation: summarises DOCUMENTED information only. No clinical recommendations. */
export function prepSummary(patientId: string, apptId?: string) {
  const p = getPatient(patientId);
  const past = patientVisits(patientId).filter((v) => v.status === "Completed" && v.date <= TODAY && v.apptId !== apptId);
  const last = past[0];
  const withPlot = past.find((v) => v.plot.length);
  const fus = followUps.filter((f) => f.patientId === patientId).sort((a, b) => b.due.localeCompare(a.due));
  const appt = appointments.find((a) => a.id === apptId);
  return {
    patientId,
    name: p ? `${p.first} ${p.last}` : "Patient",
    reason: appt ? `${getService(appt.serviceId)?.name} at ${fmtTime(appt.time)} with ${getProvider(appt.providerId)?.short}` : undefined,
    visits: past.slice(0, 4).map((v) => ({ id: v.id, label: `${fmtDate(v.date)} · ${v.type}`, sub: v.reason })),
    treatments: past.flatMap((v) => v.treatments.map((t) => `${fmtDate(v.date)}: ${t.product}, ${t.units} units — ${t.area}`)).slice(0, 4),
    notes: last ? [last.notes.subjective, last.notes.plan].filter(Boolean) : [],
    forms: [...new Set(past.flatMap((v) => v.forms).map((f) => `${f.name} (${f.signed ? "signed" : "unsigned"})`))].slice(0, 3),
    photos: photos.filter((x) => x.patientId === patientId).length,
    plot: withPlot ? { visitId: withPlot.id, date: withPlot.date, points: withPlot.plot.length } : undefined,
    followUps: fus.slice(0, 3).map((f) => `${f.type} · due ${fmtDate(f.due)} · ${f.status}`),
    lastVisitId: last?.id,
  };
}
export type PrepSummary = ReturnType<typeof prepSummary>;

/* ---------------- Agents ---------------- */
export interface Finding { id: string; title: string; detail: string; patientId?: string; apptId?: string; followUpId?: string; action: "schedule" | "open-patient" | "reschedule" | "open-appt" | "review"; providerId?: string; href?: string }
export interface AgentDef { id: string; name: string; description: string; actions: string[]; findings: () => Finding[]; summary: () => string }

export function scheduleGaps(date = TODAY) {
  const gaps: { providerId: string; from: string; to: string; mins: number }[] = [];
  for (const p of providers) {
    const appts = appointments.filter((a) => a.date === date && a.providerId === p.id && isLiveStatus(a.status)).sort((a, b) => a.time.localeCompare(b.time));
    let cursor = Math.max(9 * 60, date === TODAY ? Math.ceil(nowMin() / 15) * 15 : 0);
    for (const a of appts) {
      const s = toMin(a.time);
      if (s - cursor >= 45) gaps.push({ providerId: p.id, from: fromMin(cursor), to: fromMin(s), mins: s - cursor });
      cursor = Math.max(cursor, s + a.duration);
    }
    if (17 * 60 - cursor >= 45) gaps.push({ providerId: p.id, from: fromMin(cursor), to: "17:00", mins: 17 * 60 - cursor });
  }
  return gaps;
}

const noShows = () => appointments.filter((a) => a.status === "no_show");
const withoutNext = () => {
  const upcoming = new Set(appointments.filter((a) => a.date > TODAY || (a.date === TODAY && ["scheduled", "confirmed"].includes(a.status))).map((a) => a.patientId));
  return patients.filter((p) => !upcoming.has(p.id) && visits.some((v) => v.patientId === p.id && v.status === "Completed"));
};

export const agents: AgentDef[] = [
  {
    id: "followup", name: "Follow-up Agent",
    description: "Finds overdue, missed and upcoming follow-ups, and patients with no next visit scheduled.",
    actions: ["Review follow-ups", "Schedule appointment", "Open patient"],
    findings: () => {
      const b = followUpBuckets();
      return [
        ...b.overdue.map((f): Finding => ({ id: f.id, title: `${pname(f.patientId)} · ${f.type}`, detail: `Overdue since ${fmtDate(f.due)}`, patientId: f.patientId, followUpId: f.id, action: "schedule" })),
        ...b.today.map((f): Finding => ({ id: f.id, title: `${pname(f.patientId)} · ${f.type}`, detail: "Due today", patientId: f.patientId, followUpId: f.id, action: "schedule" })),
        ...withoutNext().slice(0, 3).map((p): Finding => ({ id: "n" + p.id, title: pname(p.id), detail: "No next appointment scheduled", patientId: p.id, action: "schedule" })),
      ];
    },
    summary: () => { const b = followUpBuckets(); return `${b.overdue.length + b.today.length + withoutNext().slice(0, 3).length} patients need attention`; },
  },
  {
    id: "appointment", name: "Appointment Agent",
    description: "Watches today's schedule for gaps, conflicts, cancellations, no-shows and waiting patients.",
    actions: ["Review schedule", "Open appointment", "Reschedule"],
    findings: () => [
      ...scheduleGaps().map((g): Finding => ({ id: `g-${g.providerId}-${g.from}`, title: `${getProvider(g.providerId)?.short} · ${g.mins} min open`, detail: `${fmtTime(g.from)} – ${fmtTime(g.to)}`, providerId: g.providerId, action: "review", href: "/calendar" })),
      ...waitingNow().map(({ a, mins }): Finding => ({ id: "w" + a.id, title: `${pname(a.patientId)} waiting ${mins} min`, detail: `${getProvider(a.providerId)?.short} · ${getService(a.serviceId)?.name}`, apptId: a.id, patientId: a.patientId, action: "open-appt" })),
      ...appointments.filter((a) => a.date === TODAY && a.status === "cancelled").map((a): Finding => ({ id: "c" + a.id, title: `Cancelled: ${pname(a.patientId)}`, detail: `${fmtTime(a.time)} with ${getProvider(a.providerId)?.short}`, apptId: a.id, patientId: a.patientId, action: "reschedule" })),
    ],
    summary: () => `${scheduleGaps().length} schedule gaps today`,
  },
  {
    id: "recall", name: "Recall Agent",
    description: "Identifies patients due to return and those who have not returned after treatment. Outreach happens in Campaigns.",
    actions: ["Review patients", "Schedule appointment", "Open patient"],
    findings: () =>
      withoutNext().map((p): Finding => {
        const last = patientVisits(p.id).find((v) => v.status === "Completed");
        return { id: "r" + p.id, title: pname(p.id), detail: `Last visit ${last ? fmtDate(last.date) + " · " + last.type : "—"}, nothing scheduled`, patientId: p.id, action: "schedule" };
      }),
    summary: () => `${withoutNext().length} ${withoutNext().length === 1 ? "patient" : "patients"} due to return`,
  },
  {
    id: "prep", name: "Visit Preparation Agent",
    description: "Summarises documented history before an appointment. It does not diagnose, prescribe or recommend treatment.",
    actions: ["Prepare a visit", "Open patient", "Start visit"],
    findings: () =>
      appointments.filter((a) => a.date === TODAY && ["scheduled", "confirmed", "arrived", "waiting"].includes(a.status)).sort((a, b) => a.time.localeCompare(b.time)).slice(0, 6)
        .map((a): Finding => ({ id: "p" + a.id, title: `${pname(a.patientId)} · ${fmtTime(a.time)}`, detail: `${getService(a.serviceId)?.name} with ${getProvider(a.providerId)?.short}`, apptId: a.id, patientId: a.patientId, action: "review" })),
    summary: () => `${appointments.filter((a) => a.date === TODAY && ["scheduled", "confirmed", "arrived", "waiting"].includes(a.status)).length} upcoming visits to prepare`,
  },
  {
    id: "noshow", name: "No-show Agent",
    description: "Reviews recent and repeat no-shows and appointment patterns.",
    actions: ["Review patient", "Reschedule", "Follow up"],
    findings: () => noShows().map((a): Finding => ({ id: "ns" + a.id, title: `${pname(a.patientId)} · ${fmtTime(a.time)}`, detail: `${getService(a.serviceId)?.name}, ${getProvider(a.providerId)?.short}. ${appointments.some((x) => x.patientId === a.patientId && x.date >= TODAY && x.id !== a.id && x.status === "scheduled") ? "Already rebooked" : "Not rebooked"}`, patientId: a.patientId, apptId: a.id, action: "reschedule" })),
    summary: () => `${noShows().length} no-show today`,
  },
  {
    id: "insights", name: "Practice Insights Agent",
    description: "Explains appointment volume, provider activity, cancellations, no-shows and gaps in plain language.",
    actions: ["Open reports"],
    findings: () => {
      const t = appointments.filter((a) => a.date === TODAY);
      const done = t.filter((a) => a.status === "completed").length;
      const busiest = providers.map((p) => ({ p, n: t.filter((a) => a.providerId === p.id).length })).sort((a, b) => b.n - a.n)[0];
      return [
        { id: "i1", title: "Today's schedule", detail: `${t.length} appointments booked, ${done} completed so far. ${busiest.p.short} has the busiest day (${busiest.n}).`, action: "review", href: "/reports" },
        { id: "i2", title: "Cancellations and no-shows", detail: `${t.filter((a) => a.status === "cancelled").length} cancellation and ${t.filter((a) => a.status === "no_show").length} no-show today. One 3:00 PM slot with Dr. Rao is now open.`, action: "review", href: "/reports" },
        { id: "i3", title: "Schedule gaps", detail: `${scheduleGaps().length} gaps of 45 minutes or more remain today, the largest on ${getProvider(scheduleGaps().sort((a, b) => b.mins - a.mins)[0]?.providerId ?? "pat")?.short}'s schedule.`, action: "review", href: "/calendar" },
        { id: "i4", title: "Follow-ups", detail: `${followUpBuckets().overdue.length} overdue and ${followUpBuckets().today.length} due today.`, action: "review", href: "/follow-ups" },
      ];
    },
    summary: () => "4 observations from today's activity",
  },
];

/* ---------------- EVI ---------------- */
export interface EviRow { title: string; meta?: string; right?: string; href?: string; apptId?: string; patientId?: string }
export interface EviAnswer { source?: string; kind?: "facts" | "summary"; text: string; rows?: EviRow[]; links?: { label: string; href?: string; startAppt?: string; prep?: { patientId: string; apptId?: string } }[]; prep?: PrepSummary }

export const EVI_SUGGESTIONS = ["Who is waiting now?", "What needs attention today?", "Show today's follow-ups", "Prepare my next visit"];

const apptRow = (a: (typeof appointments)[number], right?: string): EviRow => ({ title: pname(a.patientId), meta: `${fmtTime(a.time)} · ${getService(a.serviceId)?.name} · ${getProvider(a.providerId)?.short}`, right, patientId: a.patientId, apptId: a.id });

export interface EviCtx { can?: (p: PermKey) => boolean; patientId?: string }
export function askEvi(q: string, ctx: EviCtx = {}): EviAnswer {
  const s = q.toLowerCase();
  const patient = patients.find((p) => p.id === ctx.patientId && /(he|she|they|this patient|their|his|her)|recent visits|history|summari|prepare/.test(s)) ?? patients.find((p) => s.includes(`${p.first} ${p.last}`.toLowerCase()) || s.includes(p.first.toLowerCase()) || s.includes(p.last.toLowerCase()));
  const provider = providers.find((p) => s.includes(p.short.toLowerCase()) || s.includes(p.short.replace("Dr. ", "dr ").toLowerCase()) || s.includes(p.name.split(" ").pop()!.toLowerCase()));
  const todays = appointments.filter((a) => a.date === TODAY);

  if (/prepare|prep\b|summari[sz]e/.test(s) || (patient && /recent visits|history/.test(s))) {
    let pid = patient?.id; let apptId: string | undefined;
    if (!pid) {
      const next = todays.filter((a) => a.providerId === "pat" && ["waiting", "arrived", "confirmed", "scheduled"].includes(a.status)).sort((a, b) => a.time.localeCompare(b.time))[0];
      pid = next?.patientId; apptId = next?.id;
    } else apptId = todays.find((a) => a.patientId === pid && isOpenStatus(a.status))?.id;
    if (!pid) return { text: "You have no upcoming visits to prepare today." };
    const prep = prepSummary(pid, apptId);
    return { kind: "summary", source: "Visits, notes, forms, photos and plots on file", text: `Here is the documented history for ${prep.name}. This is a summary of existing records only.`, prep, links: [{ label: "Open patient", href: `/patients/${pid}` }, ...(apptId ? [{ label: "Start visit", startAppt: apptId }] : [])] };
  }
  if (/low stock|inventory|running low|reorder|out of stock/.test(s)) {
    if (ctx.can && !ctx.can("inventory")) return { text: "Your role doesn't include inventory access, so I can't show stock levels.", source: "Permissions" };
    const low = inventory.filter((i) => ["Low", "Out"].includes(invStatus(i)));
    return { kind: "facts", source: "Inventory records", text: low.length ? `${low.length} item${low.length > 1 ? "s are" : " is"} at or below the reorder level.` : "No items are below their reorder level.", rows: low.map((i) => ({ title: i.name, meta: `${i.qty} ${i.unit} in stock · reorder at ${i.reorder}`, right: invStatus(i), href: "/practice/inventory" })), links: [{ label: "Open inventory", href: "/practice/inventory" }] };
  }
  if (/balance|owes|outstanding|unpaid|invoice/.test(s)) {
    if (ctx.can && !ctx.can("financials")) return { text: "Your role doesn't include financial information, so I can't answer that.", source: "Permissions" };
    const t = patients.map((p) => ({ p, f: patientFinancials(p.id) })).filter((x) => x.f.outstanding > 0).sort((a, b) => b.f.outstanding - a.f.outstanding);
    if (patient) { const f = patientFinancials(patient.id); return { kind: "facts", source: "Invoices and payments", text: `${patient.first} ${patient.last} has an outstanding balance of ${money(f.outstanding)} across ${f.unpaid} unpaid invoice${f.unpaid === 1 ? "" : "s"}.`, links: [{ label: "Open financials", href: `/patients/${patient.id}?tab=financials` }] }; }
    return { kind: "facts", source: "Invoices and payments", text: `${t.length} patients have an outstanding balance.`, rows: t.map(({ p, f }) => ({ title: `${p.first} ${p.last}`, meta: `${f.unpaid} unpaid invoice${f.unpaid === 1 ? "" : "s"}`, right: money(f.outstanding), patientId: p.id })) };
  }
  if (/wait/.test(s)) {
    const w = waitingNow();
    if (!w.length) return { text: "No patients are waiting right now." };
    return { kind: "facts", source: "Today's appointments", text: `${w.length} patient${w.length > 1 ? "s are" : " is"} currently waiting.`, rows: w.map(({ a, mins }) => apptRow(a, `${mins} min`)), links: [{ label: "View waiting room", href: "/overview?view=flow" }] };
  }
  if (/left today|remaining|rest of (the|my) day|have left/.test(s) || (provider && /today|schedule|left/.test(s))) {
    const pv = provider ?? providers[0];
    const left = todays.filter((a) => a.providerId === pv.id && ["scheduled", "confirmed", "arrived", "waiting", "in_progress"].includes(a.status)).sort((a, b) => a.time.localeCompare(b.time));
    return { text: `${pv.short} has ${left.length} appointment${left.length === 1 ? "" : "s"} left today.`, rows: left.map((a) => apptRow(a)), links: [{ label: "Open calendar", href: "/calendar" }] };
  }
  if (/cancel/.test(s)) {
    const c = todays.filter((a) => a.status === "cancelled");
    return { text: c.length ? `${c.length} appointment${c.length > 1 ? "s were" : " was"} cancelled today.` : "No appointments have been cancelled today.", rows: c.map((a) => apptRow(a)), links: [{ label: "Appointment Agent", href: "/agents?agent=appointment" }] };
  }
  if (/no.?show/.test(s)) {
    const c = noShows();
    return { text: c.length ? `${c.length} no-show${c.length > 1 ? "s" : ""} recorded today.` : "No no-shows recorded today.", rows: c.map((a) => apptRow(a)), links: [{ label: "No-show Agent", href: "/agents?agent=noshow" }] };
  }
  if (/not returned|haven.t returned|recall|due to return/.test(s)) {
    const r = withoutNext();
    return { text: `${r.length} patients have no future appointment after their last visit.`, rows: r.map((p) => ({ title: pname(p.id), meta: `Last visit ${fmtDate(patientVisits(p.id)[0].date)} · ${patientVisits(p.id)[0].type}`, patientId: p.id })), links: [{ label: "Recall Agent", href: "/agents?agent=recall" }] };
  }
  if (/follow.?up/.test(s)) {
    const b = followUpBuckets();
    const rows = [...b.overdue.map((f) => ({ f, r: "Overdue" })), ...b.today.map((f) => ({ f, r: "Due today" }))].map(({ f, r }): EviRow => ({ title: pname(f.patientId), meta: `${f.type} · ${f.assignee}`, right: r, patientId: f.patientId }));
    return { kind: "facts", source: "Follow-up tasks", text: `${b.today.length} follow-ups are due today and ${b.overdue.length} are overdue.`, rows, links: [{ label: "Review follow-ups", href: "/follow-ups" }, { label: "Follow-up Agent", href: "/agents?agent=followup" }] };
  }
  if (/attention|need|priority|today/.test(s)) {
    const w = waitingNow(); const b = followUpBuckets(); const g = scheduleGaps();
    return {
      text: "Here is what needs attention in the practice today.",
      rows: [
        { title: `${w.length} patients waiting`, meta: w.map(({ a, mins }) => `${pname(a.patientId).split(" ")[0]} ${mins}m`).join(" · "), href: "/overview?view=flow" },
        { title: `${b.overdue.length} overdue follow-ups`, meta: `${b.today.length} more due today`, href: "/follow-ups" },
        { title: `${g.length} schedule gaps`, meta: "45 minutes or longer", href: "/calendar" },
        { title: `${noShows().length} no-show, ${todays.filter((a) => a.status === "cancelled").length} cancellation`, meta: "Consider rebooking", href: "/agents?agent=noshow" },
      ],
    };
  }
  if (patient) {
    const v = patientVisits(patient.id)[0];
    return { text: `${patient.first} ${patient.last} (${patient.id}). Last visit ${v ? `${fmtDate(v.date)} · ${v.type}` : "none on record"}. What would you like to know?`, links: [{ label: "Summarize visits", prep: { patientId: patient.id } }, { label: "Open patient", href: `/patients/${patient.id}` }] };
  }
  return { text: "I can answer questions about today's schedule, waiting patients, follow-ups, and patient history. Try one of these.", links: EVI_SUGGESTIONS.map((x) => ({ label: x })) };
}

export { addDays };
