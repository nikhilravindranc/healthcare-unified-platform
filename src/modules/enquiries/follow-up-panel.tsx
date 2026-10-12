"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, EmptyState, Panel, PanelHeader, SkeletonRows } from "@/components/ui";
import { fmtDate, TODAY } from "@/lib/db";
import { useRefs, useRole } from "@/lib/hooks";
import { useEnquiries } from "./hooks";
import { isOpen } from "./status";

/** Today-page panel: new enquiries and enquiry follow-ups that are due or overdue. Hidden without the `enquiries` permission. */
export function EnquiryFollowUpPanel() {
  const { can } = useRole();
  const { data, isLoading } = useEnquiries();
  const { data: refs } = useRefs();
  const router = useRouter();
  if (!can("enquiries")) return null;
  const items = (data ?? []).filter((e) => isOpen(e.status)).map((e) => {
    const t = e.tasks.filter((x) => !x.done).sort((a, b) => a.due.localeCompare(b.due))[0];
    return { e, t, overdue: !!t && t.due < TODAY, due: !!t && t.due <= TODAY };
  }).filter((x) => x.e.status === "New" || x.due).sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.e.received.localeCompare(b.e.received));
  const shown = items.slice(0, 5);
  return (
    <Panel>
      <PanelHeader title={`Enquiries to follow up (${items.length})`} action={<Link href="/enquiries" className="text-[13px] font-medium text-primary hover:underline">View all</Link>} />
      {isLoading ? <SkeletonRows rows={3} /> : shown.length === 0 ? <EmptyState title="No enquiries waiting" text="New and overdue enquiries appear here." /> : (
        <ul className="divide-y divide-line">{shown.map(({ e, t, overdue }) => (
          <li key={e.id}>
            <button onClick={() => router.push(`/enquiries?open=${e.id}`)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-cloud/50">
              <div className="min-w-0 flex-1"><p className="truncate text-[13.5px] font-medium">{e.name}</p>
                <p className="truncate text-xs text-muted">{refs?.services.find((s) => s.id === e.serviceId)?.name ?? "General enquiry"} · {e.source} · {fmtDate(e.received)}</p></div>
              {e.status === "New" && <Badge tone="lavender">New</Badge>}
              {overdue ? <Badge tone="red">Overdue</Badge> : t?.due === TODAY ? <Badge tone="peach">Due today</Badge> : null}
            </button>
          </li>))}
        </ul>)}
    </Panel>
  );
}
