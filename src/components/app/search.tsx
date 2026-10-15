"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { Search as SearchIcon, Clock, CalendarPlus, UserPlus, FilePlus2, BellPlus, ArrowRight, type LucideIcon } from "lucide-react";
import { useRole } from "@/lib/hooks";
import { fmtDate, fmtTime, getProvider, getService, pname, search, visits as allVisits } from "@/lib/db";
import { useUI } from "./ui-state";
import { PatientAvatar } from "./photos";

interface Item { key: string; group: string; title: string; sub: string; run: () => void; avatar?: string; icon?: LucideIcon }
const PAGES: { label: string; href: string }[] = [
  { label: "Today", href: "/overview" }, { label: "Calendar", href: "/calendar" }, { label: "Appointments", href: "/appointments" }, { label: "Visits", href: "/visits" },
  { label: "Patients", href: "/patients" }, { label: "Activities", href: "/activities" }, { label: "Follow-ups", href: "/follow-ups" },
];

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const ui = useUI();
  const { can } = useRole();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => { if (open) { setQ(""); setIdx(0); try { setRecent(JSON.parse(localStorage.getItem("pms.recent") ?? "[]")); } catch {} } }, [open]);

  const items = useMemo<Item[]>(() => {
    const r = search(q);
    const go = (href: string) => () => { remember(); onClose(); router.push(href); };
    const remember = () => { const n = [q, ...recent.filter((x) => x !== q)].slice(0, 4); try { localStorage.setItem("pms.recent", JSON.stringify(n)); } catch {} };
    const needle = q.trim().toLowerCase();
    const hit = (t: string) => !needle || t.toLowerCase().includes(needle);
    const act = (title: string, icon: LucideIcon, run: () => void): Item => ({ key: title, group: "Quick actions", title, sub: "Action", icon, run: () => { onClose(); run(); } });
    const actions = can("patients") ? [act("New appointment", CalendarPlus, () => ui.newAppt()), act("New patient", UserPlus, ui.newPatient), act("New visit", FilePlus2, () => ui.newVisit()), act("New follow-up", BellPlus, () => ui.newFollowUp())].filter((a) => hit(a.title)) : [];
    const pages = !needle || !can("patients") ? [] : PAGES.filter((p) => hit(p.label)).map((p): Item => ({ key: p.href, group: "Go to", title: p.label, sub: "Open page", icon: ArrowRight, run: go(p.href) }));
    return [
      ...actions,
      ...pages,
      ...r.patients.map((p): Item => ({ key: p.id, group: "Patients", title: `${p.first} ${p.last}`, sub: `Patient ID: ${p.id}`, avatar: p.id, run: go(`/patients/${p.id}`) })),
      ...r.appointments.map((a): Item => ({ key: a.id, group: "Appointments", title: pname(a.patientId), avatar: a.patientId, sub: `Today · ${fmtTime(a.time)} · ${getService(a.serviceId)?.name} · ${getProvider(a.providerId)?.short}`, run: () => { remember(); onClose(); ui.openAppt(a.id); } })),
      ...r.visits.map((v): Item => ({ key: v.id, group: "Visits", title: pname(v.patientId), avatar: v.patientId, sub: `${fmtDate(v.date)} · ${v.type}`, run: go(`/visits/${v.id}`) })),
      ...(/plot|inject/.test(q.toLowerCase()) ? allVisits.filter((v) => v.plot.length > 0).slice(0, 4).map((v): Item => ({ key: v.id + "plot", group: "Injection plots", title: pname(v.patientId), avatar: v.patientId, sub: `${fmtDate(v.date)} · ${v.plot.length} points`, run: go(`/visits/${v.id}?tab=plotting`) })) : []),
      ...r.providers.map((p): Item => ({ key: p.id, group: "Providers", title: p.name, sub: p.specialty, run: go("/practice/team") })),
      ...r.services.map((s): Item => ({ key: s.id, group: "Services", title: s.name, sub: `${s.category} · ${s.duration} min`, run: go("/practice/services") })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, recent, can]);
  useEffect(() => setIdx(0), [q]);

  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-fade fixed inset-0 z-50 bg-[#26384B]/35" />
        <Dialog.Content className="anim-pop fixed left-1/2 top-[10vh] z-50 w-[calc(100vw-24px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl bg-white shadow-lift focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
            if (e.key === "Enter") items[idx]?.run();
          }}>
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Dialog.Description className="sr-only">Search patients, appointments, visits, providers and services, or run a quick action</Dialog.Description>
          <div className="flex items-center gap-2 border-b border-line px-4">
            <SearchIcon className="size-4 text-muted" aria-hidden />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patients, appointments, visits..." aria-label="Search" className="h-12 flex-1 text-sm outline-none" />
            <kbd className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted">Esc</kbd>
          </div>
          <div className="scroll-thin max-h-[55vh] overflow-y-auto p-2" role="listbox" aria-label="Results">
            {!q && (
              <>
                <p className="px-2.5 py-1.5 text-xs font-medium text-muted">Recent searches</p>
                {recent.length === 0 && <p className="px-2.5 py-2 text-sm text-muted">Try searching for “Sarah”.</p>}
                {recent.map((r) => <button key={r} onClick={() => setQ(r)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-cloud"><Clock className="size-3.5 text-muted" />{r}</button>)}
              </>
            )}
            {q && items.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted">No results for “{q}”.</p>}
            {groups.map((g) => (
              <div key={g} className="mb-1">
                <p className="px-2.5 py-1.5 text-xs font-medium text-muted">{g}</p>
                {items.filter((i) => i.group === g).map((i) => {
                  const n = items.indexOf(i);
                  return (
                    <button key={i.key + g} role="option" aria-selected={n === idx} onMouseEnter={() => setIdx(n)} onClick={i.run}
                      className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left ${n === idx ? "bg-active" : ""}`}>
                      {i.avatar ? <PatientAvatar id={i.avatar} size={32} /> : i.icon ? <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-active text-primary"><i.icon className="size-4" aria-hidden /></span> : null}<span className="min-w-0"><span className="block text-sm font-medium">{i.title}</span><span className="block text-xs text-muted">{i.sub}</span></span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
