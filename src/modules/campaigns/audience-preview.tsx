"use client";
import { useState } from "react";
import { Badge } from "@/components/ui";
import type { AudiencePreview } from "./audience";

/** Who a campaign would reach, and why others are left out. Shared by the editor and the read-only view. */
export function AudiencePreviewCard({ preview, channelLabel }: { preview: AudiencePreview; channelLabel: string }) {
  const [all, setAll] = useState(false);
  const names = preview.eligible.map((c) => c.name);
  const shown = all ? names : names.slice(0, 6);
  const reasons = Object.entries(preview.reasonCounts).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-2.5 rounded-lg border border-line bg-cloud/40 p-3" aria-label="Audience preview">
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[["Match the filters", preview.matched.length, false], ["Eligible", preview.eligible.length, true], ["Left out", preview.excluded.length, false]].map(([l, n, good]) => (
          <div key={String(l)} className="rounded-md bg-white px-2 py-2"><dd className={`text-xl font-semibold ${good && Number(n) > 0 ? "text-[#1E6B61]" : ""}`}>{n as number}</dd><dt className="text-xs text-muted">{l as string}</dt></div>))}
      </dl>
      <p className="text-xs text-muted">Only people with explicit {channelLabel} marketing consent and a way to be reached are eligible. Missing consent is never treated as a yes.</p>
      {reasons.length > 0 && (
        <div><p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Why people are left out</p>
          <ul className="space-y-0.5 text-[13px]">{reasons.map(([r, n]) => <li key={r} className="flex justify-between gap-3"><span>{r}</span><span className="font-medium">{n}</span></li>)}</ul></div>)}
      {names.length > 0 && (
        <div><p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Eligible recipients</p>
          <div className="flex flex-wrap gap-1.5">{shown.map((n, i) => <Badge key={`${n}-${i}`} tone="mint">{n}</Badge>)}</div>
          {names.length > 6 && <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className="mt-1.5 text-xs font-medium text-primary hover:underline">{all ? "Show fewer" : `Show all ${names.length}`}</button>}</div>)}
      {preview.matched.length === 0 && <p className="text-[13px] text-muted">No one matches these filters.</p>}
    </div>
  );
}
