"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Alert, Badge, EmptyState, Input, PageTitle, Pagination, Panel, Select, SkeletonRows, Td, Th } from "@/components/ui";
import { RouteGuard } from "@/platform/route-guard";
import { docTotal, invoiceBalance, invoicePaid, invoiceStatus, money } from "@/lib/clinical";
import { fmtDate, pname } from "@/lib/db";
import { useBilling } from "@/lib/hooks";

const PAGE = 12;
export default function BillingPage() { return <RouteGuard title="Billing" perms={["financials"]}><Billing /></RouteGuard>; }

function Billing() {
  const { data, isLoading } = useBilling();
  const [q, setQ] = useState(""); const [status, setStatus] = useState(""); const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [q, status]);
  const rows = useMemo(() => (data?.invoices ?? []).filter((i) => (!status || invoiceStatus(i) === status) && (!q.trim() || `${i.id} ${pname(i.patientId)} ${i.patientId}`.toLowerCase().includes(q.trim().toLowerCase()))).sort((a, b) => b.issued.localeCompare(a.issued)), [data, q, status]);
  const slice = rows.slice((page - 1) * PAGE, page * PAGE);
  const live = (data?.invoices ?? []).filter((i) => i.status !== "Void" && i.status !== "Draft");
  const owing = live.filter((i) => invoiceBalance(i) > 0);
  return (
    <>
      <PageTitle title="Billing" description="Invoices and balances across patients. Open a patient's financials to act on a record." />
      <div className="mb-4"><Alert tone="info" title="EVOQ Billing is not connected in this demo">These are the invoices and payments held in this app. Billing owns financial records; nothing here processes a payment.</Alert></div>
      <dl className="mb-5 flex flex-wrap gap-x-10 gap-y-3 text-[13px]">
        <div><dt className="text-muted">Invoices</dt><dd className="text-[22px] font-semibold tabular-nums">{isLoading ? "–" : live.length}</dd></div>
        <div><dt className="text-muted">Outstanding</dt><dd className="text-[22px] font-semibold tabular-nums">{isLoading ? "–" : money(owing.reduce((s, i) => s + invoiceBalance(i), 0))}</dd><dd className="text-xs text-muted">{owing.length} invoices with a balance</dd></div>
      </dl>
      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-52 flex-1 sm:max-w-xs"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden /><Input aria-label="Search invoices" className="h-9 pl-9" placeholder="Invoice, patient or patient ID" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select sm className="w-40" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option>{["Draft", "Issued", "Partially paid", "Paid", "Void"].map((s) => <option key={s}>{s}</option>)}</Select>
        </div>
        {isLoading ? <SkeletonRows rows={6} /> : rows.length === 0 ? <EmptyState title="No invoices match" text="Change the search or status." /> : (
          <>
            <div className="overflow-x-auto"><table className="w-full min-w-[620px]"><thead className="border-b border-line"><tr><Th>Invoice</Th><Th>Patient</Th><Th>Issued</Th><Th>Total</Th><Th>Balance</Th><Th>Status</Th></tr></thead>
              <tbody className="divide-y divide-line">{slice.map((i) => <tr key={i.id} className="hover:bg-cloud/40"><Td className="font-medium">{i.id}</Td><Td><Link className="text-primary hover:underline" href={`/patients/${i.patientId}?tab=financials`}>{pname(i.patientId)}</Link><span className="block text-xs text-muted">{i.patientId}{i.visitId ? ` · visit ${i.visitId}` : ""}</span></Td><Td>{fmtDate(i.issued, true)}</Td><Td>{money(docTotal(i))}<span className="block text-xs text-muted">{money(invoicePaid(i.id))} paid</span></Td><Td>{invoiceBalance(i) > 0 ? money(invoiceBalance(i)) : "—"}</Td><Td><Badge tone={invoiceStatus(i) === "Paid" ? "mint" : invoiceStatus(i) === "Void" ? "neutral" : "peach"}>{invoiceStatus(i)}</Badge></Td></tr>)}</tbody></table></div>
            <Pagination page={page} pages={Math.ceil(rows.length / PAGE)} onPage={setPage} total={rows.length} />
          </>)}
      </Panel>
    </>
  );
}
