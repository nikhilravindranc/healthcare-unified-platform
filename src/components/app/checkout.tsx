"use client";
import { useMemo, useState } from "react";
import { Check, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Alert, Badge, Button, Field, Input, Modal, Select } from "@/components/ui";
import { apiC, docTotal, inventory, invoiceBalance, invoicePaid, invoiceStatus, money, SERVICE_PRICE } from "@/lib/clinical";
import { useAction, useAppointments, useBilling, usePatients, useRefs, useVisits } from "@/lib/hooks";
import { fmtDate, pname, TODAY } from "@/lib/db";
import type { InvoiceLine } from "@/lib/types";

/** Front-desk checkout: review charges, apply a deposit, record a payment and issue a receipt. */
export function CheckoutDialog({ apptId, onClose }: { apptId: string | null; onClose: () => void }) {
  const { data: appts } = useAppointments(); const { data: visits } = useVisits(); const { data: billing } = useBilling(); const { data: refs } = useRefs(); usePatients();
  const create = useAction(apiC.createInvoice); const apply = useAction(apiC.applyDeposit); const pay = useAction(apiC.recordPayment);
  const [method, setMethod] = useState("Card (recorded manually)"); const [ref, setRef] = useState(""); const [amount, setAmount] = useState(""); const [err, setErr] = useState(""); const [receipt, setReceipt] = useState<{ id: string; amount: number; method: string; ref: string } | null>(null);
  const a = appts?.find((x) => x.id === apptId); const v = visits?.find((x) => x.id === a?.visitId);
  const inv = billing?.invoices.find((i) => i.visitId === v?.id && i.status !== "Void");
  const seed = useMemo<InvoiceLine[]>(() => {
    if (!a) return [];
    const out: InvoiceLine[] = [{ id: "c0", desc: refs?.services.find((s) => s.id === a.serviceId)?.name ?? "Visit", qty: 1, unit: SERVICE_PRICE[a.serviceId] ?? 100, discount: 0, taxRate: 0 }];
    const m = new Map<string, number>(); v?.plot.forEach((x) => m.set(x.product, (m.get(x.product) ?? 0) + x.units));
    [...m.entries()].forEach(([prod, qty], i) => { const it = inventory.find((x) => x.name === prod); if (it) out.push({ id: `c${i + 1}`, desc: `${prod} (${it.unit})`, qty: Math.round(qty * 10) / 10, unit: it.price, discount: 0, taxRate: 0 }); });
    return out;
  }, [a, v, refs]);
  const lines = inv?.lines ?? seed; const total = docTotal({ lines }); const bal = inv ? invoiceBalance(inv) : total;
  const deposit = billing?.payments.find((p) => p.patientId === a?.patientId && p.kind === "deposit" && !p.invoiceId && p.status === "Posted");
  const open = !!apptId && !!a;
  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) { setReceipt(null); setAmount(""); setErr(""); onClose(); } }} title="Checkout" width={560} description={a ? `${pname(a.patientId)} · ${fmtDate(a.date)}` : ""}
      footer={receipt ? <Button onClick={() => { setReceipt(null); onClose(); }}>Done</Button> : <Button variant="secondary" onClick={onClose}>Close</Button>}>
      {receipt ? (
        <div className="space-y-3"><div className="flex items-center gap-2 text-[#2A8577]"><Check className="size-5" /><p className="font-semibold">Payment recorded</p></div>
          <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 rounded-lg border border-line p-3 text-[13px]"><dt className="text-muted">Receipt no.</dt><dd>RCT-{receipt.id}</dd><dt className="text-muted">Invoice</dt><dd>{inv?.id}</dd><dt className="text-muted">Amount</dt><dd className="font-semibold">{money(receipt.amount)}</dd><dt className="text-muted">Method</dt><dd>{receipt.method}</dd><dt className="text-muted">Reference</dt><dd>{receipt.ref}</dd><dt className="text-muted">Balance</dt><dd>{money(inv ? invoiceBalance(inv) : 0)}</dd></dl>
          <Button variant="secondary" onClick={() => window.print()}><Receipt className="size-4" />Print receipt</Button></div>
      ) : (
        <div className="space-y-4">
          <table className="w-full text-[13px]"><thead className="border-b border-line text-left text-xs text-muted"><tr><th className="py-1.5 font-medium">Item</th><th className="py-1.5 font-medium">Qty</th><th className="py-1.5 text-right font-medium">Total</th></tr></thead><tbody className="divide-y divide-line">{lines.map((l) => <tr key={l.id}><td className="py-2">{l.desc}</td><td>{l.qty}</td><td className="text-right">{money(l.qty * l.unit)}</td></tr>)}</tbody></table>
          <div className="flex items-center justify-between text-sm"><span className="text-muted">{inv ? <>Invoice {inv.id} <Badge tone={invoiceStatus(inv) === "Paid" ? "mint" : "peach"}>{invoiceStatus(inv)}</Badge></> : "No invoice yet"}</span><span className="font-semibold">{money(total)}</span></div>
          {!inv ? <Button loading={create.pending} onClick={async () => { const i = await create.run({ patientId: a!.patientId, visitId: v?.id, lines: seed, status: "Issued" }); toast.success(`${i.id} issued`); }}>Create and issue invoice</Button> : bal === 0 ? <Alert tone="success" title="Fully paid">No balance remains for this invoice.</Alert> : (
            <div className="space-y-3 rounded-lg border border-line p-3">
              <div className="flex items-center justify-between text-sm"><span className="font-medium">Balance due</span><span className="text-lg font-semibold">{money(bal)}</span></div>
              {deposit && <div className="flex items-center justify-between rounded-md bg-active/60 px-3 py-2 text-[13px]"><span>Deposit on file {money(deposit.amount)}</span><Button size="sm" variant="secondary" loading={apply.pending} onClick={() => apply.run(deposit.id, inv.id)}>Apply deposit</Button></div>}
              <div className="grid grid-cols-3 gap-3"><Field label="Amount" error={err}><Input type="number" min="0" step="0.01" value={amount || String(bal)} onChange={(e) => { setAmount(e.target.value); setErr(""); }} /></Field>
                <Field label="Method"><Select value={method} onChange={(e) => setMethod(e.target.value)}>{["Card (recorded manually)", "Cash", "Bank transfer", "Cheque"].map((m) => <option key={m}>{m}</option>)}</Select></Field><Field label="Reference"><Input value={ref} onChange={(e) => setRef(e.target.value)} /></Field></div>
              <Button loading={pay.pending} onClick={async () => { const amt = Number(amount || bal); if (!(amt > 0) || amt > bal) return setErr(`Enter an amount up to ${money(bal)}`); const reference = ref || `CH-${Math.floor(Math.random() * 9000 + 1000)}`; const p = await pay.run({ patientId: a!.patientId, invoiceId: inv.id, kind: "payment", amount: amt, method, reference }); setReceipt({ id: p.id.slice(4), amount: amt, method, ref: reference }); }}>Record payment and issue receipt</Button>
              <p className="text-xs text-muted">No card is charged here. Record payments taken on your terminal.</p></div>)}
          {inv && invoicePaid(inv.id) > 0 && bal > 0 && <p className="text-xs text-muted">Paid so far: {money(invoicePaid(inv.id))}</p>}
          <p className="text-xs text-muted">Today is {TODAY}.</p>
        </div>)}
    </Modal>
  );
}
