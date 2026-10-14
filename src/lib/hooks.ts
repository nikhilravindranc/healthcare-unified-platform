"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, nowMin } from "./db";
import { apiC, loadClinic, loadRole, ROLE_PERMS, CLINIC_CONFIG, type ClinicType, type PermKey, type Role } from "./clinical";

export const useRefs = () => useQuery({ queryKey: ["refs"], queryFn: api.refs, staleTime: Infinity });
export const usePatients = () => useQuery({ queryKey: ["patients"], queryFn: api.patients });
export const useAppointments = () => useQuery({ queryKey: ["appointments"], queryFn: api.appointments });
export const useVisits = () => useQuery({ queryKey: ["visits"], queryFn: api.visits });
export const useFollowUps = () => useQuery({ queryKey: ["followUps"], queryFn: api.followUps });
export const useNotifications = () => useQuery({ queryKey: ["notifications"], queryFn: api.notifications });

/** Mutation that refreshes all practice data and optionally shows a toast. */
export function useAction<A extends unknown[], R>(fn: (...a: A) => Promise<R>, success?: string | ((r: R) => string)) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async (a: A) => {
      // Test seam, development builds only: a browser test sets window.__pmsFailNext to make the next save fail, because the mock API never does.
      if (process.env.NODE_ENV !== "production" && typeof window !== "undefined" && (window as unknown as { __pmsFailNext?: boolean }).__pmsFailNext) { (window as unknown as { __pmsFailNext?: boolean }).__pmsFailNext = false; throw new Error("Simulated failure"); }
      return fn(...a);
    },
    onSuccess: async (r) => {
      await qc.invalidateQueries();
      if (success) toast.success(typeof success === "function" ? success(r) : success);
    },
    onError: () => toast.error("Something went wrong. Please try again."),
  });
  return { run: (...a: A) => m.mutateAsync(a), pending: m.isPending };
}

/** Demo clock in minutes after midnight, refreshed every 20 seconds. */
export function useNow() {
  const [n, setN] = useState(nowMin());
  useEffect(() => {
    const t = setInterval(() => setN(nowMin()), 20000);
    return () => clearInterval(t);
  }, []);
  return n;
}

export const usePhotos = () => useQuery({ queryKey: ["photos"], queryFn: apiC.photos });
export const useBilling = () => useQuery({ queryKey: ["billing"], queryFn: apiC.invoices });
export const useInventory = () => useQuery({ queryKey: ["inventory"], queryFn: apiC.inventory });
export const useTemplates = () => useQuery({ queryKey: ["templates"], queryFn: apiC.templates });
export const useAudit = () => useQuery({ queryKey: ["audit"], queryFn: apiC.audit });

const sub = (cb: () => void) => { window.addEventListener("pms-clinic", cb); return () => window.removeEventListener("pms-clinic", cb); };
export function useClinic() {
  const type = useSyncExternalStore(sub, () => loadClinic(), () => "Medical aesthetics" as ClinicType);
  return { type, config: CLINIC_CONFIG[type] };
}
export function useRole() {
  const role = useSyncExternalStore(sub, () => loadRole(), () => "Owner" as Role);
  return { role, can: (p: PermKey) => ROLE_PERMS[role].includes(p) };
}
export const useExtras = () => useQuery({ queryKey: ["extras"], queryFn: apiC.extras });
export const useAiActivity = () => useQuery({ queryKey: ["ai"], queryFn: apiC.ai });
