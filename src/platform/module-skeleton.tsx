"use client";
import { PageHeader, Panel, Badge } from "@/components/ui";
import { Denied } from "@/components/patient/shared";
import { useRole } from "@/lib/hooks";
import { MODULES, type ModuleDef } from "./modules";

/** Placeholder landing page every new module starts from. Replace per module as it is built. */
export function ModuleSkeleton({ id, planned, children }: { id: ModuleDef["id"]; planned: string[]; children?: React.ReactNode }) {
  const m = MODULES.find((x) => x.id === id)!;
  const { can } = useRole();
  if (m.perms && !m.perms.some(can)) return <><PageHeader title={m.label} /><Denied what={`the ${m.label} module`} /></>;
  return (
    <>
      <PageHeader title={m.label} subtitle={m.blurb} actions={<Badge tone="peach">Skeleton</Badge>} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">{children}</div>
        <Panel className="p-5">
          <h2 className="text-sm font-semibold">Planned</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-slate-600">{planned.map((p) => <li key={p}>{p}</li>)}</ul>
        </Panel>
      </div>
    </>
  );
}
