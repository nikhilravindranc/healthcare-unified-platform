"use client";
import { Lock } from "lucide-react";
import { Panel } from "@/components/ui";

export const ageOf = (dob: string) => Math.floor((new Date("2026-10-07").getTime() - new Date(dob).getTime()) / (365.25 * 864e5));

export function Denied({ what }: { what: string }) {
  return (
    <Panel className="px-6 py-12 text-center" role="status">
      <Lock className="mx-auto mb-2 size-5 text-muted" aria-hidden />
      <p className="text-sm font-medium">You don&apos;t have access to {what}</p>
      <p className="mt-1 text-sm text-muted">Your role doesn&apos;t include this permission. Ask a practice manager if you need it.</p>
    </Panel>
  );
}
