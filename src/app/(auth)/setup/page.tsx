"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { AuthShell, AuthTitle } from "@/components/auth/shell";
import { Button, Checkbox, Field, Input, Select } from "@/components/ui";
import { CLINIC_CONFIG, CLINIC_TYPES, SERVICE_CAPS, SERVICE_PRICE, saveClinic, money, type ClinicType } from "@/lib/clinical";
import { api } from "@/lib/db";
import { saveSettings } from "@/lib/settings";
import { auth, useSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { z } from "zod";

const STEPS = ["Your account", "Clinic", "Provider", "Services", "You're ready"];
const ZONES = ["America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "America/Toronto", "Europe/London", "Asia/Kolkata", "Australia/Sydney"];
const STARTER: Record<ClinicType, { name: string; category: string; duration: number; price: number }[]> = {
  "Medical aesthetics": [{ name: "Consultation", category: "Consultation", duration: 30, price: 120 }, { name: "Injectable treatment", category: "Aesthetics", duration: 45, price: 480 }, { name: "Treatment review", category: "Review", duration: 20, price: 80 }],
  Dermatology: [{ name: "Skin consultation", category: "Dermatology", duration: 30, price: 150 }, { name: "Follow-up", category: "Review", duration: 20, price: 60 }],
  Dental: [{ name: "Dental consultation", category: "Dental", duration: 30, price: 140 }, { name: "Hygiene visit", category: "Dental", duration: 45, price: 110 }],
  Physiotherapy: [{ name: "Initial assessment", category: "Physiotherapy", duration: 60, price: 120 }, { name: "Physiotherapy session", category: "Physiotherapy", duration: 45, price: 95 }],
  Wellness: [{ name: "Intake consultation", category: "Wellness", duration: 60, price: 130 }, { name: "Wellness session", category: "Wellness", duration: 45, price: 90 }],
  "General medical": [{ name: "Consultation", category: "Consultation", duration: 20, price: 100 }, { name: "Follow-up", category: "Review", duration: 15, price: 60 }],
  "Other specialty": [{ name: "Consultation", category: "Consultation", duration: 30, price: 110 }],
};
const clinicSchema = z.object({ name: z.string().min(2, "Enter the clinic name"), phone: z.string().min(7, "Enter a phone number"), address: z.string().min(3, "Enter an address"), contact: z.string().min(2, "Enter a primary contact") });
const providerSchema = z.object({ name: z.string().min(2, "Enter the provider's name"), specialty: z.string().min(2, "Enter a role or specialty"), email: z.string().email("Enter a valid email address") });

export default function SetupPage() {
  const router = useRouter();
  const session = useSession();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [c, setC] = useState({ name: "", type: "Medical aesthetics" as ClinicType, country: "United States", timezone: "America/Los_Angeles", currency: "USD", phone: "", address: "", locations: "1", contact: session?.name ?? "" });
  const [p, setP] = useState({ name: session?.name ?? "", specialty: "", email: session?.email ?? "", phone: "", hours: "Mon–Fri · 9:00 AM–5:00 PM" });
  const [picked, setPicked] = useState<number[]>([0]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState<string[]>([]);
  const check = <T extends z.ZodTypeAny>(schema: T, v: unknown) => { const r = schema.safeParse(v); if (r.success) { setErrs({}); return true; } setErrs(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]))); return false; };
  const cfg = CLINIC_CONFIG[c.type];
  const starters = STARTER[c.type];

  const finish = async (skip: string[]) => {
    setBusy(true);
    saveClinic(c.type);
    saveSettings({ clinicName: c.name, clinicType: c.type, country: c.country, timezone: c.timezone, currency: c.currency, phone: c.phone, setupPending: skip });
    auth.setPractice(c.name);
    if (!skip.includes("provider")) await api.saveConfig("providers", { name: p.name, short: p.name, specialty: p.specialty, email: p.email, phone: p.phone, hours: p.hours, status: "Active", locationIds: ["dt"], serviceIds: [] });
    if (!skip.includes("services")) for (const i of picked) { const s = starters[i]; const saved = await api.saveConfig("services", { name: s.name, category: s.category, duration: s.duration, status: "Active", providerIds: [], locationIds: ["dt"] }); SERVICE_PRICE[saved.id] = s.price; SERVICE_CAPS[saved.id] = { ...SERVICE_CAPS.consult }; }
    setBusy(false); setSkipped(skip); setStep(4);
  };

  return (
    <AuthShell wide>
      <ol className="mb-8 flex items-center gap-2" aria-label="Setup progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === step ? "step" : undefined}>
            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold", i < step ? "bg-primary text-white" : i === step ? "border-2 border-primary text-primary" : "border border-line text-muted")}>{i < step ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}</span>
            <span className={cn("hidden text-xs font-medium md:block", i === step ? "text-ink" : "text-muted")}>{s}</span>
            {i < STEPS.length - 1 && <span className={cn("h-px flex-1", i < step ? "bg-primary" : "bg-line")} />}
          </li>))}
      </ol>

      {step === 0 && (
        <div className="max-w-[400px]">
          <AuthTitle title="Your account is created" text="Next, tell us about your clinic. You can finish the essentials now and complete the rest later." />
          <div className="mb-5 rounded-lg border border-line bg-cloud/60 px-4 py-3 text-sm"><p className="font-medium">{session?.name ?? "New account"}</p><p className="text-muted">{session?.email}</p></div>
          <Button className="w-full" onClick={() => setStep(1)}>Continue</Button>
        </div>)}

      {step === 1 && (
        <form noValidate className="max-w-[520px] space-y-4" onSubmit={(e) => { e.preventDefault(); if (check(clinicSchema, c)) setStep(2); }}>
          <AuthTitle title="Set up your clinic" text="Your clinic type sets defaults, templates and visit tabs. You can change it later in Settings." />
          <Field label="Clinic name" required error={errs.name}><Input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="e.g. Brightwell Clinic" /></Field>
          <fieldset><legend className="mb-1.5 text-[13px] font-medium">Clinic type</legend>
            <div className="grid grid-cols-2 gap-2">{CLINIC_TYPES.map((t) => <button type="button" key={t} aria-pressed={c.type === t} onClick={() => setC({ ...c, type: t })} className={cn("rounded-lg border px-3 py-2.5 text-left text-sm", c.type === t ? "border-primary bg-active text-primary" : "border-line hover:bg-cloud")}>{t}</button>)}</div>
            <p className="mt-2 rounded-lg bg-cloud/70 p-3 text-[13px] text-muted"><span className="font-medium text-ink">{cfg.emphasis}.</span> {cfg.capabilityHint}</p></fieldset>
          <div className="grid grid-cols-2 gap-3"><Field label="Country / region"><Select value={c.country} onChange={(e) => setC({ ...c, country: e.target.value })}>{["United States", "Canada", "United Kingdom", "India", "Australia", "United Arab Emirates", "Other"].map((x) => <option key={x}>{x}</option>)}</Select></Field><Field label="Time zone"><Select value={c.timezone} onChange={(e) => setC({ ...c, timezone: e.target.value })}>{ZONES.map((x) => <option key={x}>{x}</option>)}</Select></Field>
            <Field label="Currency"><Select value={c.currency} onChange={(e) => setC({ ...c, currency: e.target.value })}>{["USD", "CAD", "GBP", "INR", "AUD", "AED"].map((x) => <option key={x}>{x}</option>)}</Select></Field><Field label="Phone" required error={errs.phone}><Input type="tel" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></Field></div>
          <Field label="Address" required error={errs.address}><Input value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Number of locations"><Select value={c.locations} onChange={(e) => setC({ ...c, locations: e.target.value })}>{["1", "2–3", "4+"].map((x) => <option key={x}>{x}</option>)}</Select></Field><Field label="Primary contact" required error={errs.contact}><Input value={c.contact} onChange={(e) => setC({ ...c, contact: e.target.value })} /></Field></div>
          <p className="text-xs text-muted">Logo upload is not available in this demo. The EVOQ logo is used.</p>
          <div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => setStep(0)}>Back</Button><Button type="submit" className="flex-1">Continue</Button></div>
        </form>)}

      {step === 2 && (
        <form noValidate className="max-w-[460px] space-y-4" onSubmit={(e) => { e.preventDefault(); if (check(providerSchema, p)) setStep(3); }}>
          <AuthTitle title="Add your first provider" text="Providers appear on the calendar. You can add more later." />
          <Field label="Name" required error={errs.name}><Input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
          <Field label="Role or specialty" required error={errs.specialty}><Input value={p.specialty} onChange={(e) => setP({ ...p, specialty: e.target.value })} placeholder={c.type} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Email" required error={errs.email}><Input type="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} /></Field><Field label="Phone (optional)"><Input type="tel" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></Field></div>
          <Field label="Working hours"><Input value={p.hours} onChange={(e) => setP({ ...p, hours: e.target.value })} /></Field>
          <div className="flex gap-2"><Button type="button" variant="secondary" onClick={() => setStep(1)}>Back</Button><Button type="button" variant="ghost" onClick={() => { setErrs({}); setSkipped((s) => [...s, "provider"]); setStep(3); }}>Skip for now</Button><Button type="submit" className="flex-1">Continue</Button></div>
        </form>)}

      {step === 3 && (
        <div className="max-w-[520px] space-y-4">
          <AuthTitle title="Choose starter services" text={`Suggested for ${c.type.toLowerCase()}. Edit durations, prices and capabilities later under Services & treatments.`} />
          <ul className="space-y-2">{starters.map((s, i) => (
            <li key={s.name} className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5"><Checkbox checked={picked.includes(i)} onChange={(on) => setPicked(on ? [...picked, i] : picked.filter((x) => x !== i))} label={<span><span className="font-medium">{s.name}</span><span className="block text-xs text-muted">{s.category}</span></span>} /><span className="text-right text-[13px] text-muted">{s.duration} min<br />{money(s.price, c.currency)}</span></li>))}</ul>
          <div className="flex gap-2"><Button variant="secondary" onClick={() => setStep(2)}>Back</Button><Button variant="ghost" onClick={() => finish([...skipped.filter((x) => x !== "services"), "services"])}>Skip for now</Button><Button className="flex-1" loading={busy} onClick={() => finish(skipped.filter((x) => x !== "services"))}>Finish setup</Button></div>
        </div>)}

      {step === 4 && (
        <div className="max-w-[460px]">
          <AuthTitle title="Your practice is ready" text={`${c.name} is set up as a ${c.type.toLowerCase()} clinic.`} />
          <div className="mb-4 rounded-lg border border-line p-4 text-[13px]"><p className="mb-2 font-medium">Enabled for {c.type}</p><div className="flex flex-wrap gap-1.5">{Object.entries(cfg.tabs).filter(([, on]) => on).map(([k]) => <span key={k} className="rounded-md bg-active px-2 py-0.5 text-xs text-primary">{k}</span>)}<span className="rounded-md bg-cloud px-2 py-0.5 text-xs">calendar</span><span className="rounded-md bg-cloud px-2 py-0.5 text-xs">patients</span><span className="rounded-md bg-cloud px-2 py-0.5 text-xs">follow-ups</span></div></div>
          {skipped.length > 0 && <p className="mb-4 rounded-lg bg-[#FFF8E8] p-3 text-[13px] text-slate-700">Unfinished: {skipped.map((x) => (x === "provider" ? "add a provider" : "add services")).join(" and ")}. These appear in your Getting started checklist.</p>}
          <Button className="w-full" onClick={() => router.push("/welcome")}>Enter Practice</Button>
          <p className="mt-3 text-center text-xs text-muted">You can change any of this later in Settings.</p>
        </div>)}
    </AuthShell>
  );
}
