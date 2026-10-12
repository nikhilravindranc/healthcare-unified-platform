"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EviSprite } from "./evi-mascot";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button } from "@/components/ui";
import { api, pname } from "@/lib/db";
import { useAction, useRole } from "@/lib/hooks";
import { useUI } from "./ui-state";
import type { Appointment, Patient } from "@/lib/types";

/** Status-driven primary action for an appointment row (front desk / overview). */
export function ApptActions({ a, compact }: { a: Appointment; compact?: boolean }) {
  const router = useRouter();
  const ui = useUI();
  const { can } = useRole();
  const status = useAction(api.setStatus);
  const start = useAction(api.startVisit);
  const name = pname(a.patientId);
  const startVisit = async () => { const v = await start.run(a.id); toast.success("Visit started"); router.push(`/visits/${v.id}`); };
  const sz = "sm" as const;
  switch (a.status) {
    case "scheduled":
    case "confirmed":
      return <Button size={sz} variant="secondary" loading={status.pending} onClick={async () => { await status.run(a.id, "arrived"); toast.success(`${name} checked in`); }}>Check in</Button>;
    case "arrived":
      return <Button size={sz} variant="secondary" loading={status.pending} onClick={async () => { await status.run(a.id, "waiting"); toast.success(`${name} moved to waiting`); }}>Move to waiting</Button>;
    case "waiting":
      return (
        <div className="flex gap-1.5">
          {!compact && <Button size={sz} variant="ghost" onClick={() => toast.success(`Calling ${name}`)}>Call patient</Button>}
          <Button size={sz} loading={start.pending} onClick={startVisit}>Start visit</Button>
        </div>
      );
    case "in_progress":
      return a.visitId ? <Button size={sz} variant="secondary" onClick={() => router.push(`/visits/${a.visitId}`)}>View visit</Button> : null;
    case "completed":
      return (
        <div className="flex gap-1.5">
          {a.visitId && <Button size={sz} variant="secondary" onClick={() => router.push(`/visits/${a.visitId}`)}>View visit</Button>}
          {can("financials") && !compact && <Button size={sz} variant="soft" onClick={() => ui.checkout(a.id)}>Checkout</Button>}
        </div>
      );
    default:
      return <span className="text-xs text-muted">—</span>;
  }
}

/** Contextual agent/EVI hint line used at the top of workspaces. */
export function AgentHint({ text, action, onAction, href, agent }: { agent?: number; text: string; action: string; onAction?: () => void; href?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-white px-3.5 py-2.5 text-[13px]">
      {agent != null ? <EviSprite index={agent} width={44} /> : <Sparkles className="size-4 text-primary" aria-hidden />}
      <span className="flex-1">{text}</span>
      {href ? <Link href={href} className="font-medium text-primary hover:underline">{action}</Link> : <button onClick={onAction} className="font-medium text-primary hover:underline">{action}</button>}
    </div>
  );
}

export const PatientLink = ({ id, children }: { id: string; children?: React.ReactNode }) => (
  <Link href={`/patients/${id}`} className="font-medium text-ink hover:text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{children ?? pname(id)}</Link>
);

export const PStatus = ({ s }: { s: Patient["status"] }) => <Badge tone={s === "Active" ? "mint" : s === "New" ? "lavender" : "neutral"}>{s}</Badge>;
