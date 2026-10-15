"use client";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarCheck, CalendarClock, CalendarX, ExternalLink } from "lucide-react";
import { Alert, Badge, Button, Checkbox, EmptyState, Field, Input, PageHeader, Panel, PanelHeader, StatGrid, StatTile, StatusBadge, Td, Th } from "@/components/ui";
import { useUI } from "@/components/app/ui-state";
import { fmtDate, fmtTime, TODAY } from "@/lib/db";
import { useAppointments, usePatients, useRefs, useRole } from "@/lib/hooks";
import { saveSettings, useSettings } from "@/lib/settings";
import { providersForService } from "./availability";

const EMBED = `<iframe id="evoq-booking" src="https://your-site.example/book?embed=1" title="Book an appointment" style="width:100%;min-height:640px;border:0" loading="lazy"></iframe>
<script>
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "evoq-booking-height") document.getElementById("evoq-booking").style.height = e.data.height + "px";
  });
</script>`;

/** Practice-side view of online booking: what is offered, and the bookings people made. Internal appointment work stays in Practice Management. */
export function BookingAdmin() {
  const { data: refs } = useRefs();
  const { data: appts } = useAppointments();
  const { data: patients } = usePatients();
  const st = useSettings();
  const { can } = useRole();
  const ui = useUI();
  const manage = can("booking");
  const seePatients = can("patients");
  const active = refs?.services.filter((s) => s.status === "Active") ?? [];
  const offered = (id: string) => st.booking.serviceIds === null || st.booking.serviceIds.includes(id);
  const setOffered = (id: string, on: boolean) => {
    const current = st.booking.serviceIds ?? active.map((s) => s.id);
    const next = on ? [...new Set([...current, id])] : current.filter((x) => x !== id);
    saveSettings({ booking: { ...st.booking, serviceIds: next.length === active.length ? null : next } });
  };
  const online = (appts ?? []).filter((a) => a.origin === "online").sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const name = (pid: string) => { const p = patients?.find((x) => x.id === pid); return p ? `${p.first} ${p.last}` : "Patient"; };

  return (
    <>
      <PageHeader title="Online Bookings" subtitle="Let people book themselves, and see what they booked" actions={<><Badge tone="peach">Demo mode</Badge><Link href="/book"><Button variant="secondary"><ExternalLink className="size-4" />Open the booking page</Button></Link></>} />
      <Alert tone="info" title="A demo of the public booking journey">The page offers times from the same rules as the appointment form, applied to demo data, and sends no confirmations. A booking made there is an ordinary appointment, so it also appears in Calendar and Patients. Open it in this tab so this demo session keeps its data.</Alert>
      <div className="mt-5"><StatGrid cols={3}>
        <StatTile label="Online bookings" value={online.length} hint="Made on the public page" icon={CalendarCheck} tone="blue" />
        <StatTile label="Coming up" value={online.filter((a) => a.date >= TODAY && a.status !== "cancelled" && a.status !== "no_show").length} hint="Still to happen" icon={CalendarClock} tone="mint" />
        <StatTile label="Cancelled" value={online.filter((a) => a.status === "cancelled").length} hint="By the patient or practice" icon={CalendarX} tone="peach" />
      </StatGrid></div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Panel>
            <PanelHeader title="Online bookings" sub="Appointments booked on the public page" />
            {online.length === 0 ? <EmptyState title="No online bookings yet" text="Bookings made on the public page appear here." action={<Link href="/book"><Button>Try the booking page</Button></Link>} /> : (
              <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
                <thead className="border-b border-line bg-cloud/50"><tr><Th>Reference</Th><Th>Patient</Th><Th>Service</Th><Th>When</Th><Th>Status</Th><Th /></tr></thead>
                <tbody className="divide-y divide-line">{online.map((a) => (
                  <tr key={a.id}><Td className="font-medium">{a.id}</Td><Td>{seePatients ? name(a.patientId) : <span className="text-muted">Hidden for your role</span>}</Td>
                    <Td>{refs?.services.find((s) => s.id === a.serviceId)?.name}<span className="block text-xs text-muted">{refs?.providers.find((p) => p.id === a.providerId)?.short}</span></Td>
                    <Td>{fmtDate(a.date)} · {fmtTime(a.time)}</Td><Td><StatusBadge status={a.status} /></Td>
                    <Td className="text-right">{seePatients && <Button size="sm" variant="secondary" onClick={() => ui.openAppt(a.id)}>Open</Button>}</Td></tr>))}</tbody></table></div>)}
          </Panel>
        </div>
        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Booking page settings" sub={manage ? undefined : "View only"} />
            <div className="space-y-4 p-4">
              <Checkbox checked={st.booking.enabled} onChange={(v) => manage && saveSettings({ booking: { ...st.booking, enabled: v } })} label="Accept online bookings" />
              <fieldset className="space-y-2"><legend className="text-[13px] font-medium">Services people can book</legend>
                {active.map((s) => { const n = refs ? providersForService(refs.providers, s).length : 0; return (
                  <div key={s.id} className="flex items-start justify-between gap-2"><Checkbox checked={offered(s.id)} onChange={(v) => manage && setOffered(s.id, v)} label={s.name} /><span className="shrink-0 text-xs text-muted">{n} provider{n === 1 ? "" : "s"}</span></div>); })}
              </fieldset>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Notice needed (hours)" hint="0 = none"><Input type="number" min={0} disabled={!manage} value={st.booking.leadHours} onChange={(e) => saveSettings({ booking: { ...st.booking, leadHours: Math.max(0, Number(e.target.value) || 0) } })} /></Field>
                <Field label="Book up to (days ahead)" hint="0 = no limit"><Input type="number" min={0} disabled={!manage} value={st.booking.windowDays} onChange={(e) => saveSettings({ booking: { ...st.booking, windowDays: Math.max(0, Number(e.target.value) || 0) } })} /></Field>
              </div>
              <p className="text-xs text-muted">Offered times follow these rules from Practice: working hours, each provider&apos;s days, hours and time off, the buffer between visits, the practice break and closed dates. Change them in Practice &gt; Team, and in Settings &gt; Appointments. Durations come from Services.</p>
            </div>
          </Panel>
          <Panel className="p-4">
            <h2 className="text-sm font-semibold">Add to your website</h2>
            <p className="mt-1 text-[13px] text-slate-600">Paste this where the booking form should appear. It shows the same demo journey without the page header, and resizes to fit. Replace the address with your own once the page is hosted.</p>
            <pre className="scroll-thin mt-2 overflow-x-auto rounded-lg bg-cloud p-3 text-xs leading-relaxed" aria-label="Embed code"><code>{EMBED}</code></pre>
            <div className="mt-2 flex gap-2"><Button size="sm" variant="secondary" onClick={() => { navigator.clipboard?.writeText(EMBED); toast.success("Embed code copied"); }}>Copy code</Button><Link href="/book?embed=1" target="_blank"><Button size="sm" variant="ghost"><ExternalLink className="size-4" aria-hidden />Preview embedded view</Button></Link></div>
          </Panel>
          <Panel className="p-4">
            <h2 className="text-sm font-semibold">Needs a backend before it is real</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-slate-600">
              <li>Live availability from provider calendars (the rules above are applied to demo data only)</li>
              <li>Verifying who is changing a booking</li>
              <li>Confirmation and reminder messages</li>
              <li>Protection against misuse and double booking at scale</li>
              <li>A public address and hosting for the page</li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
