"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3, Bell, CalendarDays, ChevronsLeft, ChevronsRight, HelpCircle, LayoutGrid,
  Layers, LogOut, MapPin, MoreHorizontal, Plus, Repeat, Search, Settings, Sparkles, Stethoscope, UserRound, Users,
  Inbox, CalendarPlus, UserPlus, FilePlus2, BellPlus, Bot, Package, FileText, ChevronDown, ShieldCheck, type LucideIcon,
} from "lucide-react";
import { Avatar, Logo, Menu, MenuContent, MenuItem, MenuLabel, MenuSep, MenuTrigger, Skeleton } from "@/components/ui";
import { auth, useSession } from "@/lib/auth";
import { useAction, useNotifications, useRole } from "@/lib/hooks";
import { ROLE_PERMS, saveRole, type PermKey, type Role } from "@/lib/clinical";
import { api } from "@/lib/db";
import type { AppointmentInput } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { UICtx, type EviOpen, type UIState } from "./ui-state";
import { AppointmentPanel, NewAppointmentPanel, NewFollowUpPanel, NewPatientPanel, NewVisitDialog } from "./panels";
import { EviDialog } from "./evi";
import { EviLauncher } from "./evi-launcher";
import { SearchDialog } from "./search";
import { GuidePanel } from "./guide";
import { CheckoutDialog } from "./checkout";
import { toast } from "sonner";
import { Denied } from "@/components/patient/shared";
import { GROWTH_NAV, moduleEnabled, SWITCHER_MODULES } from "@/platform/modules";
import { useSettings } from "@/lib/settings";

const CLINICAL = ["/overview", "/calendar", "/patients", "/visits", "/follow-ups", "/agents", "/front-desk"];
type NavItem = { href: string; label: string; icon: LucideIcon; perm?: PermKey | PermKey[] };
const MAIN: NavItem[] = [
  { href: "/overview", label: "Today", icon: LayoutGrid, perm: "patients" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, perm: "patients" },
  { href: "/patients", label: "Patients", icon: Users, perm: "patients" },
  { href: "/enquiries", label: "Enquiries", icon: Inbox, perm: ["enquiries", "enquiries_view"] },
  { href: "/follow-ups", label: "Follow-ups", icon: Repeat, perm: "patients" },
  { href: "/reports", label: "Reports", icon: BarChart3, perm: "reports" },
];
const PRACTICE: NavItem[] = [
  { href: "/practice/team", label: "Team", icon: UserRound, perm: "config" },
  { href: "/practice/services", label: "Services & treatments", icon: Layers, perm: "config" },
  { href: "/practice/inventory", label: "Inventory", icon: Package, perm: "inventory" },
  { href: "/practice/locations", label: "Locations & rooms", icon: MapPin, perm: "config" },
  { href: "/practice/forms", label: "Forms", icon: FileText, perm: "config" },
];

function NavLink({ item, collapsed, active }: { item: NavItem; collapsed: boolean; active: boolean }) {
  return (
    <Link href={item.href} title={collapsed ? item.label : undefined} aria-current={active ? "page" : undefined}
      className={cn("flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors", active ? "bg-active text-primary" : "text-slate-600 hover:bg-cloud hover:text-ink", collapsed ? "justify-center" : "justify-start")}>
      <item.icon className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden />
      <span className={collapsed ? "sr-only" : ""}>{item.label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [apptId, setApptId] = useState<string | null>(null);
  const [newAppt, setNewAppt] = useState<{ open: boolean; prefill?: Partial<AppointmentInput>; onCreated?: (a: { id: string; patientId: string }) => void }>({ open: false });
  const [newPatient, setNewPatient] = useState(false);
  const [newFu, setNewFu] = useState<{ open: boolean; prefill?: { patientId?: string; visitId?: string } }>({ open: false });
  const [newVisit, setNewVisit] = useState<{ open: boolean; patientId?: string }>({ open: false });
  const [evi, setEvi] = useState<{ open: boolean; init: EviOpen }>({ open: false, init: {} });
  const [searchOpen, setSearchOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const { data: notes } = useNotifications();
  const { role, can } = useRole();
  const st = useSettings();
  const allowed = (i: NavItem) => !i.perm || (Array.isArray(i.perm) ? i.perm.some(can) : can(i.perm));
  const markRead = useAction(api.markNotifications);

  useEffect(() => { if (session === null) router.replace("/sign-in"); }, [session, router]);
  useEffect(() => { if (session && !can("patients") && path === "/overview") router.replace(can("insights") ? "/marketing-insights" : can("enquiries") ? "/enquiries" : "/practice/team"); }, [session, can, path, router]);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("guide")) { setGuideOpen(true); window.history.replaceState(null, "", window.location.pathname); } }, []);
  useEffect(() => { try { const v = localStorage.getItem("pms.sidebar"); setCollapsed(v ? v === "1" : window.innerWidth < 1024); } catch {} }, []);

  const ui = useMemo<UIState>(() => ({
    openAppt: setApptId,
    newAppt: (prefill, opts) => setNewAppt({ open: true, prefill, onCreated: opts?.onCreated }),
    newPatient: () => setNewPatient(true),
    newFollowUp: (prefill) => setNewFu({ open: true, prefill }),
    newVisit: (prefill) => setNewVisit({ open: true, patientId: prefill?.patientId }),
    evi: (o = {}) => setEvi({ open: true, init: o }),
    openSearch: () => setSearchOpen(true),
    guide: () => setGuideOpen(true),
    openAgents: () => router.push("/agents"),
    checkout: setCheckoutId,
  }), [router]);

  const onKey = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(true); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") { e.preventDefault(); setEvi({ open: true, init: {} }); }
  }, []);
  useEffect(() => { window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onKey]);

  if (!session) return (
    <div className="p-8" role="status" aria-label="Loading"><Skeleton className="h-8 w-48" /><Skeleton className="mt-6 h-64 w-full" /></div>
  );

  const modules: NavItem[] = GROWTH_NAV.filter((m) => m.perms.some(can) && (!m.module || moduleEnabled(m.module, st.modules))).map((m) => ({ href: m.href, label: m.label, icon: m.icon }));
  const switcher = SWITCHER_MODULES.filter((m) => m.perms?.some(can) && moduleEnabled(m.id, st.modules));
  /** Patient-facing pages need the "patients" permission, so roles like Marketing never reach patient records via a URL. */
  const clinicalBlocked = !can("patients") && CLINICAL.some((c) => path === c || path.startsWith(c + "/"));
  const unread = notes?.filter((n) => !n.read).length ?? 0;
  const isActive = (href: string) => path === href || path.startsWith(href + "/");
  const toggle = () => setCollapsed((c) => { try { localStorage.setItem("pms.sidebar", c ? "0" : "1"); } catch {} return !c; });

  return (
    <UICtx.Provider value={ui}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      {/* Sidebar */}
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-white md:flex", collapsed ? "w-[68px]" : "w-[232px]")}>
        <div className={cn("flex h-16 items-center border-b border-line px-3", collapsed ? "justify-center" : "justify-start px-4")}>
          <span className={collapsed ? "" : "hidden"}><Logo variant="icon" height={34} /></span>
          <span className={collapsed ? "hidden" : "block"}><Logo height={26} /></span>
        </div>
        <button onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}
          className="absolute -right-3 top-[52px] z-40 grid size-6 place-items-center rounded-full border border-line bg-white text-muted shadow-sm hover:bg-cloud hover:text-primary">
          {collapsed ? <ChevronsRight className="size-3.5" /> : <ChevronsLeft className="size-3.5" />}
        </button>
        <nav aria-label="Primary" className="scroll-thin flex-1 space-y-0.5 overflow-y-auto p-3">
          <p className={cn("px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted", collapsed ? "sr-only" : "")}>Clinic</p>
          {MAIN.filter(allowed).map((i) => <NavLink key={i.href} item={i} collapsed={collapsed} active={isActive(i.href)} />)}
          {PRACTICE.some(allowed) && <><p className={cn("px-2.5 pb-1 pt-5 text-[11px] font-medium uppercase tracking-wider text-muted", collapsed ? "sr-only" : "")}>Practice</p>
          <div className={cn("my-3 h-px bg-line", collapsed ? "" : "hidden")} /></>}
          {PRACTICE.filter(allowed).map((i) => <NavLink key={i.href} item={i} collapsed={collapsed} active={isActive(i.href)} />)}
          {modules.length > 0 && (
            <>
              <p className={cn("px-2.5 pb-1 pt-5 text-[11px] font-medium uppercase tracking-wider text-muted", collapsed ? "sr-only" : "")}>Growth &amp; Engagement</p>
              <div className={cn("my-3 h-px bg-line", collapsed ? "" : "hidden")} />
              {modules.map((i) => <NavLink key={i.href} item={i} collapsed={collapsed} active={isActive(i.href)} />)}
            </>
          )}
        </nav>
        <div className="space-y-0.5 border-t border-line p-3">
          {can("settings") && <NavLink item={{ href: "/practice/settings", label: "Settings", icon: Settings }} collapsed={collapsed} active={isActive("/practice/settings")} />}
          <button onClick={() => setGuideOpen(true)} className={cn("flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium text-slate-600 hover:bg-cloud", collapsed ? "justify-center" : "justify-start")}>
            <HelpCircle className="size-[18px]" strokeWidth={1.8} aria-hidden /><span className={collapsed ? "sr-only" : ""}>Help</span>
          </button>
          <div className={cn("flex items-center gap-2.5 px-1 pt-2", collapsed ? "justify-center" : "justify-start")}>
            <Avatar name={session.name} size={30} />
            <div className={cn("min-w-0 flex-1", collapsed ? "hidden" : "block")}><p className="truncate text-[13px] font-medium">{session.name}</p><p className="truncate text-xs text-muted">{session.practice}</p></div>

          </div>
        </div>
      </aside>

      <div className={cn(collapsed ? "md:pl-[68px]" : "md:pl-[232px]")}>
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur lg:px-8">
          <div className="md:hidden"><Logo variant="icon" height={32} /></div>
          <button onClick={() => setSearchOpen(true)} className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-cloud/60 px-3 text-left text-sm text-muted hover:bg-cloud md:max-w-sm" aria-label="Search">
            <Search className="size-4 shrink-0" aria-hidden /><span className="truncate">Search patients, appointments...</span>
            <kbd className="ml-auto hidden rounded border border-line bg-white px-1.5 text-[11px] lg:block">Ctrl K</kbd>
          </button>
          <button onClick={() => ui.evi()} className="hidden h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium text-primary hover:bg-active xl:flex xl:min-w-64"><Sparkles className="size-4" aria-hidden />Ask EVI about your practice...</button>
          <button onClick={() => ui.evi()} aria-label="Ask EVI" className="grid size-10 place-items-center rounded-lg border border-line text-primary hover:bg-active xl:hidden"><Sparkles className="size-4" /></button>
          <div className="ml-auto flex items-center gap-1.5">
            <Menu>
              <MenuTrigger asChild><button className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-white hover:bg-primary-hover"><Plus className="size-4" aria-hidden /><span className="hidden sm:inline">New</span><span className="sr-only sm:hidden">New</span></button></MenuTrigger>
              <MenuContent>
                <MenuItem onSelect={() => ui.newAppt()}><CalendarPlus className="size-4 text-muted" />New appointment</MenuItem>
                {can("enquiries") && <MenuItem onSelect={() => router.push("/enquiries?new=1")}><Inbox className="size-4 text-muted" />New enquiry</MenuItem>}
                <MenuItem onSelect={() => ui.newPatient()}><UserPlus className="size-4 text-muted" />New patient</MenuItem>
                <MenuItem onSelect={() => ui.newVisit()}><FilePlus2 className="size-4 text-muted" />New visit</MenuItem>
                <MenuItem onSelect={() => ui.newFollowUp()}><BellPlus className="size-4 text-muted" />New follow-up</MenuItem>
                <MenuSep />
                <MenuItem onSelect={() => router.push("/practice/team")}><UserRound className="size-4 text-muted" />New provider</MenuItem>
                <MenuItem onSelect={() => router.push("/practice/services")}><Layers className="size-4 text-muted" />New service</MenuItem>
              </MenuContent>
            </Menu>
            <Menu>
              <MenuTrigger asChild>
                <button aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative grid size-10 place-items-center rounded-lg text-slate-600 hover:bg-cloud">
                  <Bell className="size-[18px]" />{unread > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-cyan ring-2 ring-white" />}
                </button>
              </MenuTrigger>
              <MenuContent className="w-80 p-0">
                <div className="flex items-center justify-between border-b border-line px-3 py-2.5"><span className="text-sm font-semibold">Notifications</span>
                  {unread > 0 && <button onClick={() => markRead.run()} className="text-xs font-medium text-primary">Mark all as read</button>}</div>
                <ul className="max-h-80 overflow-y-auto">
                  {notes?.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">You&apos;re all caught up.</li>}
                  {notes?.map((n) => (
                    <MenuItem key={n.id} onSelect={() => router.push(n.href)} className="items-start rounded-none border-b border-line/60 last:border-0">
                      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-cyan")} />
                      <span><span className="block text-[13px]">{n.text}</span><span className="text-xs text-muted">{n.time}</span></span>
                    </MenuItem>
                  ))}
                </ul>
              </MenuContent>
            </Menu>
            <Menu>
              <MenuTrigger asChild><button aria-label="Account menu" className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-cloud"><Avatar name={session.name} size={34} /><span className="hidden text-left leading-tight lg:block"><span className="block text-[13px] font-medium">{session.name.replace("Aarav ", "")}</span><span className="block text-xs text-muted">Main Clinic</span></span><ChevronDown className="hidden size-4 text-muted lg:block" /></button></MenuTrigger>
              <MenuContent>
                <div className="px-2.5 py-2"><p className="text-sm font-medium">{session.name}</p><p className="text-xs text-muted">{session.email}</p></div>
                {switcher.length > 0 && (<><MenuSep /><MenuLabel>Applications</MenuLabel>{switcher.map((m) => <MenuItem key={m.id} onSelect={() => router.push(m.href)}><m.icon className="size-4 text-muted" />{m.label}</MenuItem>)}</>)}
                <MenuSep />
                <MenuLabel>View as role (demo)</MenuLabel>
                {(Object.keys(ROLE_PERMS) as Role[]).map((r) => <MenuItem key={r} onSelect={() => { saveRole(r); toast.success(`Now viewing as ${r}`); router.push("/overview"); }}><ShieldCheck className={cn("size-4", r === role ? "text-primary" : "text-muted")} />{r}{r === role && <span className="ml-auto text-xs text-primary">Current</span>}</MenuItem>)}
                <MenuSep />
                {can("settings") && <MenuItem onSelect={() => router.push("/practice/settings")}><Settings className="size-4 text-muted" />Practice settings</MenuItem>}
                <MenuItem onSelect={() => { auth.signOut(); router.replace("/sign-in"); }}><LogOut className="size-4 text-muted" />Sign out</MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[1440px] px-4 pb-24 pt-6 md:px-6 md:pb-10 lg:px-8">{clinicalBlocked ? <Denied what="patient and appointment information" /> : children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Mobile" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {(can("patients") ? [{ href: "/overview", label: "Today", icon: LayoutGrid }, { href: "/calendar", label: "Calendar", icon: CalendarDays }, { href: "/patients", label: "Patients", icon: Users }, { href: "/visits", label: "Visits", icon: Stethoscope }] : modules.slice(0, 1)).map((i) => (
          <Link key={i.href} href={i.href} aria-current={isActive(i.href) ? "page" : undefined} className={cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium", isActive(i.href) ? "text-primary" : "text-muted")}>
            <i.icon className="size-5" strokeWidth={1.8} aria-hidden />{i.label}
          </Link>
        ))}
        <Menu>
          <MenuTrigger asChild><button className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted"><MoreHorizontal className="size-5" aria-hidden />More</button></MenuTrigger>
          <MenuContent side="top" align="end">
            {[...(can("patients") ? [{ href: "/follow-ups", label: "Follow-ups", icon: Repeat }, { href: "/agents", label: "EVI agents", icon: Bot }] : []), ...(can("reports") ? [{ href: "/reports", label: "Reports", icon: BarChart3 }] : []), ...(can("enquiries") || can("enquiries_view") ? [{ href: "/enquiries", label: "Enquiries", icon: Inbox }] : []), ...PRACTICE.filter(allowed), ...modules, { href: "/practice/settings", label: "Settings", icon: Settings }].map((i) => (
              <MenuItem key={i.href} onSelect={() => router.push(i.href)}><i.icon className="size-4 text-muted" />{i.label}</MenuItem>
            ))}
          </MenuContent>
        </Menu>
      </nav>

      <AppointmentPanel id={apptId} onClose={() => setApptId(null)} />
      <NewAppointmentPanel open={newAppt.open} prefill={newAppt.prefill} onCreated={newAppt.onCreated} onClose={() => setNewAppt({ open: false })} />
      <NewPatientPanel open={newPatient} onClose={() => setNewPatient(false)} />
      <NewFollowUpPanel open={newFu.open} prefill={newFu.prefill} onClose={() => setNewFu({ open: false })} />
      <NewVisitDialog open={newVisit.open} patientId={newVisit.patientId} onClose={() => setNewVisit({ open: false })} />
      {!evi.open && <EviLauncher onOpen={() => ui.evi()} />}
      <EviDialog open={evi.open} initial={evi.init} onClose={() => setEvi((e) => ({ ...e, open: false }))} />
      <CheckoutDialog apptId={checkoutId} onClose={() => setCheckoutId(null)} />
      <GuidePanel open={guideOpen} onClose={() => setGuideOpen(false)} />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </UICtx.Provider>
  );
}
