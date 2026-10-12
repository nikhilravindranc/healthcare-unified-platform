"use client";
import { useRouter } from "next/navigation";
import { CalendarCheck, CalendarPlus, CheckCircle2, Link2, MoreHorizontal, Pencil, PhoneCall, RotateCcw, UserRound } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuSep, MenuTrigger } from "@/components/ui";
import { useUI } from "@/components/app/ui-state";
import { useSession } from "@/lib/auth";
import { useAction, useRefs, useRole } from "@/lib/hooks";
import { enquiriesApi } from "./api";
import { ENQUIRY_STATUSES, type Enquiry, type EnquiryStatus } from "./types";
import { useBookEnquiry } from "./use-book";

/** Manage = create, edit, move, book. View-only roles (e.g. Marketing) see enquiries without contact details or changes. Frontend demo only. */
export function useEnquiryAccess() { const { can } = useRole(); const manage = can("enquiries"); return { manage, view: manage || can("enquiries_view"), readOnly: !manage }; }

export type OpenFn = (e: Enquiry, opts?: { needPatient?: boolean }) => void;

/** Shared quick actions for the Board and Flow views (the List view uses the detail panel). */
export function useEnquiryActions(onOpen: OpenFn) {
  const { data: refs } = useRefs();
  const session = useSession();
  const by = session?.name ?? "Staff";
  const setStatus = useAction(enquiriesApi.setStatus, (e) => `Moved to ${e.status.toLowerCase()}`);
  const book = useBookEnquiry();
  const bookNow = (e: Enquiry) => { if (!book(e)) onOpen(e, { needPatient: true }); };
  /** A booking needs a patient and an appointment, so moving to "Appointment booked" starts that flow instead. */
  const move = (e: Enquiry, to: EnquiryStatus) => { if (e.status === to) return; if (to === "Appointment booked") return bookNow(e); setStatus.run(e.id, to, by); };
  return {
    bookNow, move,
    svc: (id?: string) => refs?.services.find((s) => s.id === id)?.name ?? "General enquiry",
    who: (id?: string) => refs?.users.find((u) => u.id === id)?.name,
  };
}
export type EnquiryActions = ReturnType<typeof useEnquiryActions>;

const btn = "inline-flex h-7 min-w-0 items-center gap-1 whitespace-nowrap rounded-md px-2.5 text-xs font-medium";

/** The one next step that makes sense for the enquiry's stage. */
export function StageButton({ e, a, onOpen }: { e: Enquiry; a: EnquiryActions; onOpen: OpenFn }) {
  const { can } = useRole();
  const { readOnly } = useEnquiryAccess();
  const ui = useUI();
  if (readOnly) return null;
  if (e.status === "New") return <button onClick={() => a.move(e, "Contacted")} className={`${btn} bg-active text-primary hover:bg-[#dcebf8]`}><PhoneCall className="size-3.5" aria-hidden />Mark contacted</button>;
  if (e.status === "Contacted") return can("patients") ? <button onClick={() => a.bookNow(e)} className={`${btn} bg-primary text-white hover:bg-primary-hover`}><CalendarPlus className="size-3.5" aria-hidden />Book</button> : null;
  if (e.status === "Appointment booked") return <button onClick={() => (e.appointmentId ? ui.openAppt(e.appointmentId) : onOpen(e))} className={`${btn} bg-[#DDF3EF] text-[#1E6B61] hover:bg-[#cdeee8]`}><CalendarCheck className="size-3.5" aria-hidden />{e.appointmentId ? "View appointment" : "View"}</button>;
  return <button onClick={() => a.move(e, "Contacted")} className={`${btn} border border-line text-slate-600 hover:bg-cloud`}><RotateCcw className="size-3.5" aria-hidden />Reopen</button>;
}

/** Everything the detail panel offers, reachable in two clicks. */
export function ActionMenu({ e, a, onOpen, onEdit }: { e: Enquiry; a: EnquiryActions; onOpen: OpenFn; onEdit: (e: Enquiry) => void }) {
  const router = useRouter();
  const { readOnly } = useEnquiryAccess();
  return (
    <Menu>
      <MenuTrigger asChild><button aria-label={`Actions for ${e.name}`} className="rounded-md p-1 text-muted hover:bg-cloud"><MoreHorizontal className="size-4" /></button></MenuTrigger>
      <MenuContent>
        <MenuItem onSelect={() => onOpen(e)}>Open details</MenuItem>
        {!readOnly && <>
        <MenuItem onSelect={() => onEdit(e)}><Pencil className="size-4 text-muted" />Edit</MenuItem>
        {e.patientId ? <MenuItem onSelect={() => router.push(`/patients/${e.patientId}`)}><UserRound className="size-4 text-muted" />Open patient</MenuItem> : <MenuItem onSelect={() => onOpen(e, { needPatient: true })}><Link2 className="size-4 text-muted" />Link or create patient</MenuItem>}
        <MenuItem onSelect={() => onOpen(e)}><CheckCircle2 className="size-4 text-muted" />Next actions</MenuItem>
        {e.status !== "Appointment booked" && <><MenuSep />{ENQUIRY_STATUSES.filter((s) => s !== e.status).map((s) => <MenuItem key={s} onSelect={() => a.move(e, s)}>Move to {s.toLowerCase()}</MenuItem>)}</>}
        </>}
      </MenuContent>
    </Menu>
  );
}
