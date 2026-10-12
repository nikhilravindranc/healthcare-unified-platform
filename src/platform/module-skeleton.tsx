"use client";
import { Alert, Badge, PageHeader, Panel } from "@/components/ui";
import { RouteGuard } from "./route-guard";
import { MODULES, type ModuleDef } from "./modules";

/** Preview landing page every not-yet-built module starts from. Replace per module as it is built. */
export function ModuleSkeleton({ id, planned, notice, children }: { id: ModuleDef["id"]; planned: string[]; notice: string; children?: React.ReactNode }) {
  const m = MODULES.find((x) => x.id === id)!;
  return (
    <RouteGuard title={m.label} perms={m.perms} module={id}>
      <PageHeader title={m.label} subtitle={m.blurb} actions={<Badge tone="peach">Preview</Badge>} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Alert tone="info" title="Preview only">{notice}</Alert>
          {children}
        </div>
        <Panel className="p-5">
          <h2 className="text-sm font-semibold">Planned</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-slate-600">{planned.map((p) => <li key={p}>{p}</li>)}</ul>
        </Panel>
      </div>
    </RouteGuard>
  );
}
