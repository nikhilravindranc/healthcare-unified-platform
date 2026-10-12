"use client";
import { useMemo } from "react";
import { TODAY } from "@/lib/db";
import { useAppointments, usePatients, useRole, useVisits } from "@/lib/hooks";
import { useEnquiries } from "../enquiries/hooks";
import { buildContacts, contactAccess, maskContact, type CrmContact } from "./contacts";

/** Contacts for the CRM directory, already masked for the current role. Read-only: nothing here writes data. */
export function useCrmContacts() {
  const patients = usePatients(), appts = useAppointments(), visits = useVisits(), enquiries = useEnquiries();
  const { can } = useRole();
  const { details, patientRecords } = contactAccess(can);
  const loading = patients.isLoading || appts.isLoading || visits.isLoading || enquiries.isLoading;
  const error = patients.isError || appts.isError || visits.isError || enquiries.isError;
  const contacts = useMemo<CrmContact[]>(() => {
    if (!patients.data || !appts.data || !visits.data || !enquiries.data) return [];
    const access = { details, patientRecords };
    return buildContacts({ patients: patients.data, enquiries: enquiries.data, appointments: appts.data, visits: visits.data, today: TODAY }).map((c) => maskContact(c, access));
  }, [patients.data, appts.data, visits.data, enquiries.data, details, patientRecords]);
  return { contacts, loading, error, access: { details, patientRecords }, refetch: () => { patients.refetch(); appts.refetch(); visits.refetch(); enquiries.refetch(); } };
}
