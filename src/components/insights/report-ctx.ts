"use client";
import { docTotal, invoiceBalance, invoicePaid, invoiceStatus } from "@/lib/clinical";
import { TODAY } from "@/lib/db";
import { useAppointments, useBilling, useFollowUps, usePatients, useRefs, useVisits } from "@/lib/hooks";
import type { ReportCtx, ReportDef } from "@/lib/reports";
import { useCampaigns } from "@/modules/campaigns/hooks";
import { useEnquiries } from "@/modules/enquiries/hooks";
import { useRole } from "@/lib/hooks";

/** Everything a report reads, or null while it loads. Enquiries only load for roles that may see them. */
export function useReportCtx(): ReportCtx | null {
  const a = useAppointments().data, v = useVisits().data, f = useFollowUps().data, p = usePatients().data, b = useBilling().data, r = useRefs().data, e = useEnquiries().data, k = useCampaigns().data;
  const { can } = useRole();
  if (!a || !v || !f || !p || !r) return null;
  return {
    today: TODAY, appointments: a, visits: v, followUps: f, patients: p, invoices: can("financials") ? b?.invoices ?? [] : [], payments: can("financials") ? b?.payments ?? [] : [], enquiries: can("enquiries") || can("enquiries_view") ? e ?? [] : [], campaigns: k ?? [],
    providers: r.providers, services: r.services, locations: r.locations, docTotal, invoicePaid, invoiceBalance, invoiceStatus,
  };
}

/** A report is allowed when the role has any one of its permissions and every extra one it needs (patient names and money have their own). Frontend demo behaviour, not security. */
export const reportAllowed = (r: ReportDef, can: (p: never) => boolean) => r.perms.some((p) => can(p as never)) && (r.also ?? []).every((p) => can(p as never));
