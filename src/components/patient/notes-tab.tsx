"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Badge, Button, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { noteLabelsFor } from "@/components/visit/tabs";
import { fmtDate, TODAY } from "@/lib/db";
import { useClinic, useRefs, useVisits } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { Patient } from "@/lib/types";

const KEYS = ["subjective", "objective", "assessment", "plan"] as const;
const SHOWN = 3;

/**
 * The patient's written visit notes on the Summary, newest first. The latest is open and older ones fold away. It is read-only:
 * notes are written inside a visit, so there is one place to write them and no second copy to keep in step.
 */
export function PatientNotesPanel({ p }: { p: Patient }) {
  const { data: visits } = useVisits();
  const { data: refs } = useRefs();
  const { type: clinic } = useClinic();
  const router = useRouter();
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const mine = (visits ?? []).filter((v) => v.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const written = mine.filter((v) => KEYS.some((k) => v.notes[k]?.trim()));
  const blank = mine.length - written.length;
  const list = all ? written : written.slice(0, SHOWN);
  const expanded = open ?? written[0]?.id;

  return (
    <Panel>
      <PanelHeader title="Clinical notes" sub={written.length ? `${written.length} written note${written.length === 1 ? "" : "s"}${blank ? `, ${blank} visit${blank === 1 ? "" : "s"} without one` : ""}` : undefined} />
      {written.length === 0 ? <EmptyState title="No visit notes yet" text={mine.length ? `${mine.length} visit${mine.length === 1 ? " has" : "s have"} no written note.` : "Notes written during a visit appear here."} /> : (
        <ul className="divide-y divide-line">
          {list.map((v) => {
            const labels = noteLabelsFor(v.type, clinic);
            const on = expanded === v.id;
            return (
              <li key={v.id}>
                <button type="button" aria-expanded={on} onClick={() => setOpen(on ? "" : v.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-cloud/40">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold">{v.type}<span className="ml-2 font-normal text-muted">{v.date === TODAY ? "Today" : fmtDate(v.date, true)}</span></span>
                    <span className="block truncate text-xs text-muted">{refs?.providers.find((x) => x.id === v.providerId)?.short}{v.reason ? ` · ${v.reason}` : ""}</span>
                  </span>
                  <Badge tone={v.status === "Completed" ? "mint" : "blue"}>{v.status === "Completed" ? "Completed" : "Draft"}</Badge>
                  <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", on && "rotate-180")} aria-hidden />
                </button>
                {on && (
                  <div className="anim-fade border-t border-line bg-cloud/30 px-4 py-3">
                    <dl className="grid gap-3 text-[13px] md:grid-cols-2">
                      {KEYS.map((k, i) => v.notes[k]?.trim() ? <div key={k}><dt className="mb-0.5 text-xs font-medium text-muted">{labels[i]}</dt><dd className="whitespace-pre-wrap">{v.notes[k]}</dd></div> : null)}
                    </dl>
                    <div className="mt-3 flex items-center justify-between gap-2"><p className="text-xs text-muted">{v.noteMeta ? `Saved by ${v.noteMeta.by}` : "Read-only here. Notes are edited inside the visit."}</p><Button size="sm" variant="secondary" onClick={() => router.push(`/visits/${v.id}?tab=notes`)}>Open visit</Button></div>
                  </div>)}
              </li>);
          })}
        </ul>)}
      {written.length > SHOWN && <button type="button" onClick={() => setAll((v) => !v)} className="w-full border-t border-line px-4 py-2.5 text-left text-[13px] font-medium text-primary hover:bg-active/40">{all ? "Show fewer notes" : `Show all ${written.length} notes`}</button>}
    </Panel>
  );
}
