"use client";
import { toast } from "sonner";
import { useUI } from "@/components/app/ui-state";
import { useSession } from "@/lib/auth";
import { fmtDate, fmtTime, TODAY } from "@/lib/db";
import { useAction, useAppointments, usePatients, useRefs } from "@/lib/hooks";
import { enquiriesApi } from "./api";
import { existingBookingCandidates } from "./booking-state";
import { useEnquiries } from "./hooks";
import type { Enquiry } from "./types";

/**
 * Starts the existing New appointment panel from an enquiry, prefilled with its service and a suitable provider.
 * If the patient already has a matching upcoming appointment, it offers to link that one instead of creating a duplicate.
 * Returns false when the enquiry has no linked patient yet (the caller should ask the user to link or create one).
 */
export function useBookEnquiry() {
  const { data: refs } = useRefs();
  const { data: patients } = usePatients();
  const { data: appointments } = useAppointments();
  const { data: enquiries } = useEnquiries();
  const ui = useUI();
  const session = useSession();
  const mark = useAction(enquiriesApi.appointmentBooked, "Enquiry linked to the appointment");
  const by = session?.name ?? "Staff";

  const openPanel = (e: Enquiry) => {
    const svc = refs?.services.find((s) => s.id === e.serviceId);
    const patient = patients?.find((p) => p.id === e.patientId);
    const provider = refs?.providers.find((p) => svc?.providerIds.includes(p.id) && p.status === "Active") ?? refs?.providers.find((p) => p.id === patient?.providerId);
    const locationId = provider?.locationIds[0];
    ui.newAppt({
      patientId: e.patientId, serviceId: e.serviceId ?? "", providerId: provider?.id ?? "", duration: svc?.duration ?? 30,
      locationId: locationId ?? "", roomId: refs?.rooms.find((r) => r.locationId === locationId)?.id ?? "", notes: `From enquiry ${e.id}`,
    }, { onCreated: (a) => { mark.run(e.id, a.id, by); } });
  };

  return (e: Enquiry, before?: () => void): boolean => {
    if (!e.patientId) return false;
    before?.();
    const found = existingBookingCandidates(e, appointments ?? [], enquiries ?? [], TODAY)[0];
    if (found) {
      toast(`${patients?.find((p) => p.id === e.patientId)?.first ?? "This patient"} already has an appointment on ${fmtDate(found.date)} at ${fmtTime(found.time)}`, {
        description: "Link it to this enquiry, or book a separate one.", duration: 20000,
        action: { label: "Link it", onClick: () => { mark.run(e.id, found.id, by); } },
        cancel: { label: "Book a new one", onClick: () => openPanel(e) },
      });
      return true;
    }
    openPanel(e);
    return true;
  };
}
