"use client";
import { Lock } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui";
import { Denied } from "@/components/patient/shared";
import type { PermKey } from "@/lib/clinical";
import { useRole } from "@/lib/hooks";
import { useSettings } from "@/lib/settings";
import { moduleEnabled, type ModuleDef } from "./modules";

/**
 * Direct-URL check for a page. Menu visibility alone is not enough.
 * Frontend demo only: real enforcement belongs on the server.
 */
export function RouteGuard({ title, perms, module, children }: { title: string; perms?: PermKey[]; module?: ModuleDef["id"]; children: React.ReactNode }) {
  const { can } = useRole();
  const st = useSettings();
  if (module && !moduleEnabled(module, st.modules)) return (
    <>
      <PageHeader title={title} />
      <Panel className="px-6 py-12 text-center" role="status"><Lock className="mx-auto mb-2 size-5 text-muted" aria-hidden /><p className="text-sm font-medium">{title} is switched off</p><p className="mt-1 text-sm text-muted">An owner or practice manager can turn it on in Practice &gt; Integrations.</p></Panel>
    </>
  );
  if (perms && !perms.some(can)) return <><PageHeader title={title} /><Denied what={title.toLowerCase()} /></>;
  return <>{children}</>;
}
