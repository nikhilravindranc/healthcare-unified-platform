"use client";
import { useRouter } from "next/navigation";
import { Badge, Button, EmptyState, Panel } from "@/components/ui";
import { noteLabelsFor } from "@/components/visit/tabs";
import { fmtDate, TODAY } from "@/lib/db";
import { useClinic, useRefs, useVisits } from "@/lib/hooks";
import type { Patient } from "@/lib/types";

const KEYS = ["subjective", "objective", "assessment", "plan"] as const;

/**
 * Every written visit note for the patient, newest first, in one place. It is read-only: notes are written inside a visit, so
 * there is one place to write them and no second copy to keep in step.
 */
export function PatientNotesTab({ p }: { p: Patient }) {
  const { data: visits } = useVisits();
  const { data: refs } = useRefs();
  const { type: clinic } = useClinic();
  const router = useRouter();
  const mine = (visits ?? []).filter((v) => v.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const written = mine.filter((v) => KEYS.some((k) => v.notes[k]?.trim()));
  const blank = mine.length - written.length;

  if (written.length === 0) return <Panel><EmptyState title="No visit notes yet" text={mine.length ? `${mine.length} visit${mine.length === 1 ? " has" : "s have"} no written note.` : "Notes written during a visit appear here."} /></Panel>;
  return (
    <div className="space-y-4">
      {written.map((v) => {
        const labels = noteLabelsFor(v.type, clinic);
        return (
          <Panel key={v.id}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold">{v.type}<span className="ml-2 font-normal text-muted">{v.date === TODAY ? "Today" : fmtDate(v.date, true)}</span></h2>
                <p className="text-xs text-muted">{refs?.providers.find((x) => x.id === v.providerId)?.name}{v.reason ? ` · ${v.reason}` : ""}{v.noteMeta ? ` · saved by ${v.noteMeta.by}` : ""}</p>
              </div>
              <div className="flex items-center gap-2"><Badge tone={v.status === "Completed" ? "mint" : "blue"}>{v.status === "Completed" ? "Completed" : "Draft, in progress"}</Badge><Button size="sm" variant="secondary" onClick={() => router.push(`/visits/${v.id}?tab=notes`)}>Open visit</Button></div>
            </div>
            <dl className="grid gap-4 p-4 text-[13px] md:grid-cols-2">
              {KEYS.map((k, i) => v.notes[k]?.trim() ? <div key={k}><dt className="mb-0.5 text-xs font-medium text-muted">{labels[i]}</dt><dd className="whitespace-pre-wrap">{v.notes[k]}</dd></div> : null)}
            </dl>
          </Panel>);
      })}
      {blank > 0 && <p className="text-xs text-muted">{blank} other visit{blank === 1 ? " has" : "s have"} no written note.</p>}
    </div>
  );
}
