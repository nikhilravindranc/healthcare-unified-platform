"use client";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, ConfirmDialog, EmptyState, Field, Input, Modal, Panel, PanelHeader, Select, SkeletonRows, Td, Th } from "@/components/ui";
import { apiC, docTotal, inventory, invoiceBalance, invoicePaid, invoiceStatus, lineTotal, money, patientFinancials, SERVICE_PRICE } from "@/lib/clinical";
import { useAction, useBilling, useRefs, useRole } from "@/lib/hooks";
import { fmtDate, TODAY } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import type { Invoice, InvoiceLine, Patient, Payment } from "@/lib/types";

const METHODS = ["Card (recorded manually)", "Cash", "Bank transfer", "Cheque"];
const tone = (s: string) => (s === "Paid" || s === "Posted" || s === "Accepted" ? "mint" : s === "Issued" || s === "Sent" ? "blue" : s === "Partially paid" ? "peach" : s === "Void" || s === "Reversed" ? "red" : "neutral") as "mint" | "blue" | "peach" | "red" | "neutral";

function PaymentDialog({ p, open, onClose, kind, invoice }: { p: Patient; open: boolean; onClose: () => void; kind: Payment["kind"]; invoice?: Invoice }) {
  const { data } = useBilling();
  const rec = useAction(apiC.recordPayment, "Recorded");
  const [v, setV] = useState({ amount: "", method: METHODS[0], reference: "", invoiceId: "", reason: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  useEffect(() => { if (open) { setV({ amount: invoice && kind === "payment" ? String(invoiceBalance(invoice)) : "", method: METHODS[0], reference: "", invoiceId: invoice?.id ?? "", reason: "" }); setErr({}); } }, [open, invoice, kind]);
  const mine = (data?.invoices ?? []).filter((i) => i.patientId === p.id && i.status !== "Void" && i.status !== "Draft");
  const target = mine.find((i) => i.id === v.invoiceId);
  const title = { payment: "Record payment", deposit: "Take deposit", refund: "Issue refund", credit: "Issue credit" }[kind];
  const submit = async () => {
    const e: Record<string, string> = {}; const amt = Number(v.amount);
    if (!(amt > 0)) e.amount = "Enter an amount greater than zero";
    if (kind === "payment" && !target) e.invoiceId = "Select an invoice";
    if (kind === "payment" && target && amt > invoiceBalance(target)) e.amount = `Exceeds the balance of ${money(invoiceBalance(target))}`;
    if (kind === "refund" && (!target || amt > invoicePaid(target.id))) e.amount = target ? `Cannot exceed the ${money(invoicePaid(target.id))} paid` : "Select the original invoice";
    if ((kind === "refund" || kind === "credit") && !v.reason.trim()) e.reason = "A reason is required for the audit trail";
    setErr(e); if (Object.keys(e).length) return;
    await rec.run({ patientId: p.id, invoiceId: v.invoiceId || undefined, kind, amount: amt, method: kind === "credit" ? "Credit" : v.method, reference: v.reference || `${kind.slice(0, 3).toUpperCase()}-${Math.floor(Math.random() * 9000 + 1000)}`, reason: v.reason || undefined });
    onClose();
  };
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={title} description={kind === "refund" || kind === "credit" ? "Posted transactions are never edited. A refund or credit is recorded as a new entry." : "This records a payment taken outside the app. No card is charged here."}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={rec.pending} onClick={submit}>{title}</Button></>}>
      <div className="space-y-4">
        {kind !== "deposit" && <Field label={kind === "refund" ? "Original invoice" : "Invoice"} required error={err.invoiceId}><Select value={v.invoiceId} onChange={(e) => setV({ ...v, invoiceId: e.target.value, amount: kind === "payment" ? String(invoiceBalance(mine.find((i) => i.id === e.target.value)!)) : v.amount })}><option value="">Select invoice</option>{mine.filter((i) => (kind === "payment" ? invoiceBalance(i) > 0 : true)).map((i) => <option key={i.id} value={i.id}>{i.id} · {money(docTotal(i))} · balance {money(invoiceBalance(i))}</option>)}</Select></Field>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount" required error={err.amount}><Input type="number" min="0" step="0.01" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} /></Field>
          {kind !== "credit" && <Field label="Method"><Select value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })}>{METHODS.map((m) => <option key={m}>{m}</option>)}</Select></Field>}
        </div>
        {kind !== "credit" && <Field label="Reference" hint="Receipt, terminal or transfer reference"><Input value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} /></Field>}
        {(kind === "refund" || kind === "credit" || kind === "deposit") && <Field label="Reason" required={kind !== "deposit"} error={err.reason}><Input value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} /></Field>}
      </div>
    </Modal>
  );
}

export function NewInvoiceDialog({ p, open, onClose, visitId, seed }: { p: Patient; open: boolean; onClose: () => void; visitId?: string; seed?: InvoiceLine[] }) {
  const { data: refs } = useRefs();
  const create = useAction(apiC.createInvoice);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => { if (open) { setLines(seed?.length ? seed : []); setErr(""); } }, [open, seed]);
  const add = (desc: string, unit: number) => setLines((l) => [...l, { id: `n${Date.now()}${l.length}`, desc, qty: 1, unit, discount: 0, taxRate: getSettings().taxRate }]);
  const set = (id: string, patch: Partial<InvoiceLine>) => setLines((l) => l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const total = docTotal({ lines });
  const save = async (status: "Draft" | "Issued") => {
    if (!lines.length) return setErr("Add at least one line item");
    if (lines.some((l) => !l.desc.trim() || l.qty <= 0 || l.unit < 0)) return setErr("Each line needs a description, quantity and price");
    const inv = await create.run({ patientId: p.id, visitId, lines, status }); toast.success(`${inv.id} ${status === "Draft" ? "saved as draft" : "issued"}`); onClose();
  };
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="New invoice" width={720} description={`${p.first} ${p.last} · ${p.id}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="secondary" loading={create.pending} onClick={() => save("Draft")}>Save draft</Button><Button loading={create.pending} onClick={() => save("Issued")}>Issue invoice · {money(total)}</Button></>}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Select sm className="w-52" aria-label="Add service" value="" onChange={(e) => { const s = refs?.services.find((x) => x.id === e.target.value); if (s) add(s.name, SERVICE_PRICE[s.id] ?? 100); }}><option value="">Add service…</option>{refs?.services.map((s) => <option key={s.id} value={s.id}>{s.name} · {money(SERVICE_PRICE[s.id] ?? 100)}</option>)}</Select>
          <Select sm className="w-56" aria-label="Add product" value="" onChange={(e) => { const it = inventory.find((x) => x.id === e.target.value); if (it) add(`${it.name} (${it.unit})`, it.price); }}><option value="">Add product…</option>{inventory.filter((i) => i.price > 20 || i.category !== "Consumables").map((i) => <option key={i.id} value={i.id}>{i.name} · {money(i.price)}/{i.unit.replace(/s$/, "")}</option>)}</Select>
          <Button size="sm" variant="ghost" onClick={() => add("", 0)}><Plus className="size-4" />Custom line</Button>
        </div>
        {lines.length === 0 ? <p className="rounded-lg border border-dashed border-line p-6 text-center text-[13px] text-muted">No line items yet. Add a configured service or product.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-[13px]"><thead className="text-left text-xs text-muted"><tr><th className="pb-1 font-medium">Description</th><th className="w-16 pb-1 font-medium">Qty</th><th className="w-24 pb-1 font-medium">Unit price</th><th className="w-20 pb-1 font-medium">Disc. %</th><th className="w-20 pb-1 font-medium">Tax %</th><th className="w-24 pb-1 text-right font-medium">Total</th><th className="w-8" /></tr></thead>
            <tbody>{lines.map((l) => (
              <tr key={l.id}><td className="pr-2 pb-1.5"><Input aria-label="Description" className="h-8" value={l.desc} onChange={(e) => set(l.id, { desc: e.target.value })} /></td>
                <td className="pr-2 pb-1.5"><Input aria-label="Quantity" type="number" min="0" className="h-8" value={l.qty} onChange={(e) => set(l.id, { qty: Number(e.target.value) })} /></td>
                <td className="pr-2 pb-1.5"><Input aria-label="Unit price" type="number" min="0" className="h-8" value={l.unit} onChange={(e) => set(l.id, { unit: Number(e.target.value) })} /></td>
                <td className="pr-2 pb-1.5"><Input aria-label="Discount percent" type="number" min="0" max="100" className="h-8" value={l.discount} onChange={(e) => set(l.id, { discount: Number(e.target.value) })} /></td>
                <td className="pr-2 pb-1.5"><Input aria-label="Tax percent" type="number" min="0" className="h-8" value={l.taxRate} onChange={(e) => set(l.id, { taxRate: Number(e.target.value) })} /></td>
                <td className="pb-1.5 text-right tabular-nums">{money(lineTotal(l))}</td><td className="pb-1.5 text-right"><button aria-label="Remove line" className="rounded p-1 text-muted hover:text-danger" onClick={() => setLines(lines.filter((x) => x.id !== l.id))}><Trash2 className="size-4" /></button></td></tr>))}</tbody></table></div>)}
        {err && <p role="alert" className="text-xs text-danger">{err}</p>}
        <p className="text-right text-sm">Total <span className="ml-2 text-base font-semibold">{money(total)}</span></p>
      </div>
    </Modal>
  );
}

function InvoiceDialog({ p, inv, onClose, onPay, onRefund }: { p: Patient; inv: Invoice | null; onClose: () => void; onPay: (i: Invoice) => void; onRefund: (i: Invoice) => void }) {
  const { data } = useBilling();
  const { can } = useRole();
  const voidIt = useAction(apiC.voidInvoice, "Invoice voided");
  const issue = useAction(apiC.issueInvoice, "Invoice issued");
  const apply = useAction(apiC.applyDeposit, "Deposit applied");
  const [confirm, setConfirm] = useState(false);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const live = inv && data?.invoices.find((x) => x.id === inv.id);
  if (!live) return null;
  const pays = (data?.payments ?? []).filter((x) => x.invoiceId === live.id);
  const sub = live.lines.reduce((s, l) => s + l.qty * l.unit, 0), disc = live.lines.reduce((s, l) => s + l.qty * l.unit * (l.discount / 100), 0);
  const tax = docTotal(live) - (sub - disc);
  const bal = invoiceBalance(live); const deposit = (data?.payments ?? []).find((x) => x.patientId === p.id && x.kind === "deposit" && !x.invoiceId && x.status === "Posted");
  return (
    <>
      <Modal open={!!inv} onOpenChange={(o) => !o && onClose()} title={`${live.id}`} width={680} description={<span>{p.first} {p.last} · Issued {fmtDate(live.issued, true)} · Due {fmtDate(live.due, true)} <Badge tone={tone(invoiceStatus(live))} className="ml-1">{invoiceStatus(live)}</Badge></span>}
        footer={<>
          {live.status !== "Void" && can("refunds") && live.status !== "Draft" && <Button variant="ghost" className="mr-auto text-danger" onClick={() => setConfirm(true)}>Void invoice</Button>}
          {live.status === "Draft" && <Button variant="secondary" loading={issue.pending} onClick={() => issue.run(live.id)}>Issue invoice</Button>}
          {invoicePaid(live.id) > 0 && can("refunds") && <Button variant="secondary" onClick={() => onRefund(live)}>Issue refund</Button>}
          {bal > 0 && deposit && <Button variant="secondary" loading={apply.pending} onClick={() => apply.run(deposit.id, live.id)}>Apply deposit ({money(deposit.amount)})</Button>}
          {bal > 0 && <Button onClick={() => onPay(live)}>Record payment</Button>}
          {bal === 0 && live.status !== "Draft" && live.status !== "Void" && <Button variant="secondary" onClick={() => setReceipt(pays.find((x) => x.kind === "payment" && x.status === "Posted") ?? null)}><Receipt className="size-4" />Receipt</Button>}
        </>}>
        <table className="w-full text-[13px]"><thead className="border-b border-line text-left text-xs text-muted"><tr><th className="py-1.5 font-medium">Item</th><th className="py-1.5 font-medium">Qty</th><th className="py-1.5 font-medium">Unit</th><th className="py-1.5 font-medium">Disc.</th><th className="py-1.5 text-right font-medium">Total</th></tr></thead>
          <tbody className="divide-y divide-line">{live.lines.map((l) => <tr key={l.id}><td className="py-2">{l.desc}{l.treatment && <span className="block text-xs text-muted">{l.treatment}</span>}</td><td>{l.qty}</td><td>{money(l.unit)}</td><td>{l.discount ? `${l.discount}%` : "—"}</td><td className="text-right tabular-nums">{money(lineTotal(l))}</td></tr>)}</tbody></table>
        <dl className="mt-3 ml-auto w-60 space-y-1 text-[13px]">
          <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{money(sub)}</dd></div><div className="flex justify-between"><dt className="text-muted">Discounts</dt><dd>-{money(disc)}</dd></div><div className="flex justify-between"><dt className="text-muted">Tax</dt><dd>{money(tax)}</dd></div>
          <div className="flex justify-between border-t border-line pt-1 font-semibold"><dt>Total</dt><dd>{money(docTotal(live))}</dd></div><div className="flex justify-between"><dt className="text-muted">Paid</dt><dd>{money(invoicePaid(live.id))}</dd></div><div className="flex justify-between font-semibold"><dt>Balance</dt><dd>{money(bal)}</dd></div>
        </dl>
        {pays.length > 0 && <div className="mt-4"><h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Payments</h3><ul className="divide-y divide-line text-[13px]">{pays.map((x) => <li key={x.id} className="flex justify-between py-1.5"><span>{fmtDate(x.date)} · {x.kind} · {x.method} · {x.reference}</span><span className={x.status === "Reversed" ? "text-muted line-through" : ""}>{x.kind === "refund" ? "-" : ""}{money(x.amount)}</span></li>)}</ul></div>}
      </Modal>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} danger title="Void this invoice?" description={`${live.id} will be marked void. It stays in the record for audit, and any payments must be refunded separately.`} cancelLabel="Keep invoice" confirmLabel="Void invoice" loading={voidIt.pending} onConfirm={async () => { await voidIt.run(live.id); setConfirm(false); }} />
      <Modal open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)} title="Receipt" width={420} footer={<><Button variant="secondary" onClick={() => setReceipt(null)}>Close</Button><Button onClick={() => window.print()}>Print</Button></>}>
        {receipt && <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-[13px]"><dt className="text-muted">Receipt no.</dt><dd>RCT-{receipt.id.slice(4)}</dd><dt className="text-muted">Patient</dt><dd>{p.first} {p.last}</dd><dt className="text-muted">Date</dt><dd>{fmtDate(receipt.date, true)}</dd><dt className="text-muted">Amount</dt><dd className="font-semibold">{money(receipt.amount)}</dd><dt className="text-muted">Method</dt><dd>{receipt.method}</dd><dt className="text-muted">Reference</dt><dd>{receipt.reference}</dd><dt className="text-muted">Invoice</dt><dd>{receipt.invoiceId}</dd></dl>}
      </Modal>
    </>
  );
}

export function FinancialsTab({ p, invoiceId }: { p: Patient; invoiceId?: string }) {
  const { data, isLoading } = useBilling();
  const { can } = useRole();
  const accept = useAction(apiC.acceptEstimate, "Estimate accepted. A draft invoice was created.");
  const reverse = useAction(apiC.reversePayment, "Payment reversed");
  const [dlg, setDlg] = useState<{ kind: Payment["kind"]; invoice?: Invoice } | null>(null);
  const [newInv, setNewInv] = useState(false);
  const [open, setOpen] = useState<Invoice | null>(null);
  const [rev, setRev] = useState<Payment | null>(null);
  useEffect(() => { if (invoiceId && data) setOpen(data.invoices.find((i) => i.id === invoiceId) ?? null); }, [invoiceId, data]);
  const fin = patientFinancials(p.id);
  const inv = (data?.invoices ?? []).filter((i) => i.patientId === p.id).sort((a, b) => b.issued.localeCompare(a.issued) || b.id.localeCompare(a.id));
  const est = (data?.estimates ?? []).filter((e) => e.patientId === p.id);
  const pays = (data?.payments ?? []).filter((x) => x.patientId === p.id);
  const lastPay = pays.filter((x) => x.status === "Posted")[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-x-8 gap-y-2 rounded-xl border border-line bg-white px-4 py-3">
          <div><p className="text-xs text-muted">Outstanding balance</p><p className={cn("text-[24px] font-semibold leading-tight tabular-nums", fin.outstanding > 0 ? "text-[#7A4B00]" : "text-ink")}>{money(fin.outstanding)}</p><p className="text-xs text-muted">{fin.unpaid === 0 ? "No unpaid invoices" : `${fin.unpaid} unpaid invoice${fin.unpaid === 1 ? "" : "s"}`}</p></div>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-[13px]">
            <dt className="text-muted">Total paid</dt><dd className="font-medium tabular-nums">{money(fin.paid)}</dd>
            <dt className="text-muted">Deposits and credits</dt><dd className="font-medium tabular-nums">{money(fin.deposits + fin.credits)}</dd>
            <dt className="text-muted">Last payment</dt><dd className="font-medium">{lastPay ? `${money(lastPay.amount)} · ${fmtDate(lastPay.date)}` : "None"}</dd>
          </dl>
        </div>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setNewInv(true)}><Plus className="size-4" />New invoice</Button><Button variant="secondary" onClick={() => setDlg({ kind: "deposit" })}>Take deposit</Button><Button onClick={() => setDlg({ kind: "payment" })}>Record payment</Button></div>
      </div>
      <Panel>
        <PanelHeader title="Invoices" />
        {isLoading ? <SkeletonRows rows={4} /> : inv.length === 0 ? <EmptyState title="No invoices" text="Charges from a visit appear here after checkout." /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>Invoice</Th><Th>Issued</Th><Th>Due</Th><Th>Total</Th><Th>Paid</Th><Th>Balance</Th><Th>Status</Th></tr></thead>
            <tbody className="divide-y divide-line">{inv.map((i) => (
              <tr key={i.id} tabIndex={0} className="cursor-pointer hover:bg-cloud/40" onClick={() => setOpen(i)} onKeyDown={(e) => e.key === "Enter" && setOpen(i)}>
                <Td className="font-medium text-primary">{i.id}</Td><Td>{fmtDate(i.issued)}</Td><Td className={i.due < TODAY && invoiceBalance(i) > 0 ? "font-medium text-[#8F2D2D]" : ""}>{fmtDate(i.due)}</Td><Td>{money(docTotal(i))}</Td><Td>{money(invoicePaid(i.id))}</Td><Td className="font-medium">{money(invoiceBalance(i))}</Td><Td><Badge tone={tone(invoiceStatus(i))}>{invoiceStatus(i)}</Badge></Td></tr>))}</tbody></table></div>)}
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel><PanelHeader title="Estimates" />
          {est.length === 0 ? <EmptyState title="No estimates" /> : <ul className="divide-y divide-line">{est.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-3 text-[13px]"><div className="flex-1"><p className="font-medium">{e.id} · {money(docTotal(e))}</p><p className="text-xs text-muted">{e.notes} · Expires {fmtDate(e.expiry)}</p></div><Badge tone={tone(e.status)}>{e.status}</Badge>
              {e.status === "Sent" && <Button size="sm" variant="secondary" loading={accept.pending} onClick={() => accept.run(e.id)}>Accept</Button>}</li>))}</ul>}</Panel>
        <Panel><PanelHeader title="Credits and refunds" action={can("refunds") ? <Button size="sm" variant="secondary" onClick={() => setDlg({ kind: "credit" })}>Issue credit</Button> : undefined} />
          {pays.filter((x) => x.kind === "credit" || x.kind === "refund").length === 0 ? <EmptyState title="None recorded" text="Credits and refunds are separate, auditable entries." /> : <ul className="divide-y divide-line">{pays.filter((x) => x.kind === "credit" || x.kind === "refund").map((x) => <li key={x.id} className="px-4 py-2.5 text-[13px]"><span className="font-medium capitalize">{x.kind}</span> · {money(x.amount)} · {fmtDate(x.date)}<span className="block text-xs text-muted">{x.reason} · {x.invoiceId ?? "no invoice"}</span></li>)}</ul>}</Panel>
      </div>
      <Panel><PanelHeader title="Payment history" />
        {pays.length === 0 ? <EmptyState title="No payments recorded" /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>Date</Th><Th>Type</Th><Th>Amount</Th><Th>Method</Th><Th>Reference</Th><Th>Invoice</Th><Th>Status</Th><Th /></tr></thead>
            <tbody className="divide-y divide-line">{pays.map((x) => <tr key={x.id}><Td>{fmtDate(x.date)}</Td><Td className="capitalize">{x.kind}</Td><Td className={x.status === "Reversed" ? "text-muted line-through" : "font-medium"}>{x.kind === "refund" ? "-" : ""}{money(x.amount)}</Td><Td>{x.method}</Td><Td>{x.reference}</Td><Td>{x.invoiceId ?? "—"}</Td><Td><Badge tone={tone(x.status)}>{x.status}</Badge></Td>
              <Td className="text-right">{x.status === "Posted" && can("refunds") && <Button size="sm" variant="ghost" onClick={() => setRev(x)}>Reverse</Button>}</Td></tr>)}</tbody></table></div>)}
      </Panel>
      <p className="text-xs text-muted">Payments here are recorded manually. No card processing and no EVOQ Billing connection exist in this demo. When EVOQ Billing is connected it becomes the source of truth for invoices and payments, so these records are not duplicated.</p>

      <PaymentDialog p={p} open={!!dlg} kind={dlg?.kind ?? "payment"} invoice={dlg?.invoice} onClose={() => setDlg(null)} />
      <NewInvoiceDialog p={p} open={newInv} onClose={() => setNewInv(false)} />
      <InvoiceDialog p={p} inv={open} onClose={() => setOpen(null)} onPay={(i) => { setOpen(null); setDlg({ kind: "payment", invoice: i }); }} onRefund={(i) => { setOpen(null); setDlg({ kind: "refund", invoice: i }); }} />
      <ConfirmDialog open={!!rev} onOpenChange={(o) => !o && setRev(null)} danger title="Reverse this payment?" description={rev && `${money(rev.amount)} (${rev.reference}) will be marked reversed and the invoice balance restored. The original entry stays in the audit log.`} cancelLabel="Keep payment" confirmLabel="Reverse payment" loading={reverse.pending} onConfirm={async () => { await reverse.run(rev!.id); setRev(null); }} />
    </div>
  );
}
