"use client";
import { createContext, useContext } from "react";
import type { AppointmentInput } from "@/lib/schemas";

export interface EviOpen { prompt?: string; prep?: { patientId: string; apptId?: string } }
export interface UIState {
  openAppt: (id: string) => void;
  newAppt: (prefill?: Partial<AppointmentInput>) => void;
  newPatient: () => void;
  newFollowUp: (prefill?: { patientId?: string; visitId?: string }) => void;
  newVisit: (prefill?: { patientId?: string }) => void;
  evi: (o?: EviOpen) => void;
  openSearch: () => void;
  guide: () => void;
  openAgents: () => void;
  checkout: (apptId: string) => void;
}
export const UICtx = createContext<UIState | null>(null);
export const useUI = () => {
  const c = useContext(UICtx);
  if (!c) throw new Error("useUI outside provider");
  return c;
};
