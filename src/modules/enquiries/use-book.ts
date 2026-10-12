"use client";
import { useUI } from "@/components/app/ui-state";
import { useSession } from "@/lib/auth";
import { usePatients, useRefs, useAction } from "@/lib/hooks";
import { enquiriesApi } from "./api";
import type { Enquiry } from "./types";

/**
 * Starts the existing New appointment panel from an enquiry, prefilled with its service and a suitable provider.
 * Returns false when the enquiry has no linked patient yet (the caller should ask the user to link or create one).
 */
export function useBookEnquiry() {
  const { data: refs } = useRefs();
  const { data: patients } = usePatients();
  const ui = useUI();
  const session = useSession();
  const mark = useAction(enquiriesApi.appointmentBooked, "Enquiry marked as appointment booked");
  const by = session?.name ?? "Staff";
  return (e: Enquiry, before?: () => void): boolean => {
    if (!e.patientId) return false;
    const svc = refs?.services.find((s) => s.id === e.serviceId);
    const patient = patients?.find((p) => p.id === e.patientId);
    const provider = refs?.providers.find((p) => svc?.providerIds.includes(p.id) && p.status === "Active") ?? refs?.providers.find((p) => p.id === patient?.providerId);
    const locationId = provider?.locationIds[0];
    before?.();
    ui.newAppt({
      patientId: e.patientId, serviceId: e.serviceId ?? "", providerId: provider?.id ?? "", duration: svc?.duration ?? 30,
      locationId: locationId ?? "", roomId: refs?.rooms.find((r) => r.locationId === locationId)?.id ?? "", notes: `From enquiry ${e.id}`,
    }, { onCreated: (a) => { mark.run(e.id, a.id, by); } });
    return true;
  };
}
