"use client";
import { useQuery } from "@tanstack/react-query";
import { Panel, PanelHeader, SkeletonRows, Td, Th } from "@/components/ui";
import { contactsApi } from "@/platform/contacts";
import { contactName } from "@/platform/contact";
import { ModuleSkeleton } from "@/platform/module-skeleton";

export default function CrmPage() {
  const { data } = useQuery({ queryKey: ["contacts"], queryFn: contactsApi.list });
  return (
    <ModuleSkeleton id="crm" notice="The CRM is a placeholder. Everyday enquiry handling lives in Enquiries. The contacts below are demo data derived from patients." planned={["Lead capture and pipeline stages", "Contact timeline across modules", "Tasks and owners", "Import / dedupe"]}>
      <Panel>
        <PanelHeader title="Contacts" sub="Shared Contact model, currently derived from Practice patients" />
        {!data ? <SkeletonRows rows={4} /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[520px]">
            <thead className="border-b border-line bg-cloud/50"><tr><Th>Name</Th><Th>Email</Th><Th>Source</Th><Th>Email marketing</Th></tr></thead>
            <tbody className="divide-y divide-line">{data.map((c) => (
              <tr key={c.id}><Td className="font-medium">{contactName(c)}</Td><Td>{c.email}</Td><Td>{c.source}</Td><Td>{c.consents.find((x) => x.channel === "email" && x.purpose === "marketing")?.status === "granted" ? "Yes" : "No"}</Td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Panel>
    </ModuleSkeleton>
  );
}
