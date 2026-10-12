"use client";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Alert, Badge, Button, EmptyState, Input, PageHeader, Pagination, Panel, Select, SkeletonRows, Td, Th } from "@/components/ui";
import { fmtDate } from "@/lib/db";
import { CONTACT_STAGES, filterContacts, SOURCE_FILTER_OPTIONS, type CrmContact } from "./contacts";
import { ContactDetailSheet } from "./contact-detail";
import { useCrmContacts } from "./hooks";
import { StageBadge } from "./stage-badge";

const PAGE = 10;
const consentText = (c: CrmContact) => (c.consent.status === "granted" ? "Granted" : c.consent.status === "withdrawn" ? "Withdrawn" : "Not recorded");

export function CrmDirectory() {
  const { contacts, loading, error, access, refetch } = useCrmContacts();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const [openKey, setOpenKey] = useState<string | null>(null);
  useEffect(() => setPage(1), [q, stage, source]);

  const rows = useMemo(() => filterContacts(contacts, { q, stage, source }), [contacts, q, stage, source]);
  const slice = rows.slice((page - 1) * PAGE, page * PAGE);
  const open = contacts.find((c) => c.key === openKey);
  const patients = contacts.filter((c) => c.kind === "patient").length;
  const contactCell = (c: CrmContact) => (c.detailsHidden ? <span className="text-muted">Hidden for your role</span> : <><p>{c.phone ?? <span className="text-muted">No phone</span>}</p><p className="text-xs text-muted">{c.email ?? "No email"}</p></>);
  const typeBadge = (c: CrmContact) => <Badge tone={c.kind === "patient" ? "blue" : "lavender"}>{c.kind === "patient" ? "Patient" : "Enquiry only"}</Badge>;

  return (
    <>
      <PageHeader title="CRM" subtitle="Everyone who has enquired or been seen, with how they found you" actions={<Badge tone="peach">Preview</Badge>} />
      <Alert tone="info" title="Built from patients and enquiries">
        {loading ? "Loading..." : `${patients} patients and ${contacts.length - patients} enquiry-only people.`} People are joined only by an explicit enquiry-to-patient link, never by name, phone or email, so one person who enquired twice appears twice. Stage and source are derived, and nothing here changes a record.
      </Alert>
      <Panel className="mt-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-56 flex-1 sm:max-w-xs"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden /><Input aria-label="Search contacts" className="h-9 pl-9" placeholder={access.details ? "Search by name, phone or email" : "Search by name"} value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select sm className="w-48" aria-label="Stage" value={stage} onChange={(e) => setStage(e.target.value)}><option value="">All stages</option>{CONTACT_STAGES.map((s) => <option key={s}>{s}</option>)}</Select>
          <Select sm className="w-48" aria-label="First-touch source" value={source} onChange={(e) => setSource(e.target.value)}><option value="">All sources</option>{SOURCE_FILTER_OPTIONS.map((s) => <option key={s}>{s}</option>)}</Select>
          {(q || stage || source) && <Button size="sm" variant="ghost" onClick={() => { setQ(""); setStage(""); setSource(""); }}>Clear</Button>}
          <span className="ml-auto text-xs text-muted">{!loading && `${rows.length} of ${contacts.length}`}</span>
        </div>
        {loading ? <SkeletonRows rows={8} /> : error ? <EmptyState title="Couldn't load contacts" text="Check your connection and try again." action={<Button variant="secondary" onClick={refetch}>Try again</Button>} />
          : contacts.length === 0 ? <EmptyState title="No contacts yet" text="Patients and enquiries will appear here." />
          : rows.length === 0 ? <EmptyState title="No contacts match" text="Try another search, stage or source." />
          : (
          <>
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[860px]">
              <thead className="border-b border-line bg-cloud/50"><tr><Th>Contact</Th><Th>Stage</Th><Th>First-touch source</Th><Th>Enquiries</Th><Th>Email marketing</Th><Th>Phone and email</Th></tr></thead>
              <tbody className="divide-y divide-line">{slice.map((c) => (
                <tr key={c.key} tabIndex={0} onClick={() => setOpenKey(c.key)} onKeyDown={(e) => e.key === "Enter" && setOpenKey(c.key)} className="cursor-pointer hover:bg-cloud/50 focus-visible:bg-cloud/50">
                  <Td><p className="font-medium">{c.name}</p><div className="mt-0.5">{typeBadge(c)}</div></Td>
                  <Td><StageBadge s={c.stage} /></Td>
                  <Td>{c.firstTouch.source}{c.firstTouch.date && <p className="text-xs text-muted">{fmtDate(c.firstTouch.date)}</p>}</Td>
                  <Td>{c.enquiries.length}</Td>
                  <Td className={c.consent.status === "not-recorded" ? "text-muted" : ""}>{consentText(c)}</Td>
                  <Td>{contactCell(c)}</Td></tr>))}</tbody></table></div>
            <ul className="divide-y divide-line md:hidden">{slice.map((c) => (
              <li key={c.key}><button onClick={() => setOpenKey(c.key)} className="block w-full px-4 py-3 text-left">
                <div className="flex items-start justify-between gap-2"><p className="font-medium">{c.name}</p><StageBadge s={c.stage} /></div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">{typeBadge(c)}<span>{c.firstTouch.source}</span><span aria-hidden>·</span><span>{c.enquiries.length} enquir{c.enquiries.length === 1 ? "y" : "ies"}</span></div>
                <div className="mt-1 text-xs text-muted">{c.detailsHidden ? "Contact details hidden for your role" : [c.phone, c.email].filter(Boolean).join(" · ")}</div></button></li>))}</ul>
            <Pagination page={page} pages={Math.ceil(rows.length / PAGE)} onPage={setPage} total={rows.length} />
          </>)}
      </Panel>
      <ContactDetailSheet contact={open} access={access} onClose={() => setOpenKey(null)} />
    </>
  );
}
