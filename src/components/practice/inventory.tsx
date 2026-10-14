"use client";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Alert, Badge, Button, EmptyState, Field, Input, Modal, Panel, PanelHeader, Select, Sheet, SkeletonRows, Td, Th } from "@/components/ui";
import Link from "next/link";
import { apiC, invStatus, MOVE_LABEL, moveKind, money } from "@/lib/clinical";
import { useAction, useInventory, useRefs, useRole } from "@/lib/hooks";
import { fmtDate } from "@/lib/db";
import type { InventoryItem } from "@/lib/types";
import { Denied } from "@/components/patient/shared";

const tone = (s: string) => (s === "Active" ? "mint" : s === "Low" ? "peach" : s === "Out" ? "red" : "neutral") as "mint" | "peach" | "red" | "neutral";

export function InventorySection() {
  const { data, isLoading } = useInventory(); const { data: refs } = useRefs(); const { can } = useRole();
  const adjust = useAction(apiC.adjustStock, "Stock updated"); const add = useAction(apiC.addItem, "Item added");
  const [q, setQ] = useState(""); const [f, setF] = useState({ cat: "", loc: "", status: "" });
  const [open, setOpen] = useState<InventoryItem | null>(null); const [adj, setAdj] = useState<{ item: InventoryItem; kind: "receive" | "use" | "correct" } | null>(null); const [newItem, setNewItem] = useState(false);
  const [a, setA] = useState({ qty: "", reason: "" }); const [aerr, setAerr] = useState("");
  const [n, setN] = useState({ name: "", sku: "", category: "Consumables", supplier: "", locationId: "dt", qty: "", unit: "units", reorder: "", price: "", lot: "", expiry: "" }); const [nerr, setNerr] = useState<Record<string, string>>({});
  const items = useMemo(() => (data?.inventory ?? []).filter((i) => (!q || `${i.name} ${i.sku} ${i.supplier}`.toLowerCase().includes(q.toLowerCase())) && (!f.cat || i.category === f.cat) && (!f.loc || i.locationId === f.loc) && (!f.status || invStatus(i) === f.status)), [data, q, f]);
  const low = (data?.inventory ?? []).filter((i) => ["Low", "Out"].includes(invStatus(i)));
  if (!can("inventory")) return <Denied what="inventory" />;
  const cats = [...new Set((data?.inventory ?? []).map((i) => i.category))];
  const moves = (id: string) => (data?.moves ?? []).filter((m) => m.itemId === id);

  return (
    <div className="space-y-4">
      {low.length > 0 && <Alert tone="warn" title={`${low.length} item${low.length > 1 ? "s" : ""} at or below the reorder level`}>{low.map((i) => `${i.name} (${i.qty} ${i.unit})`).join(" · ")}</Alert>}
      <Panel>
        <PanelHeader title="Inventory" action={<Button size="sm" onClick={() => { setN({ name: "", sku: "", category: "Consumables", supplier: "", locationId: "dt", qty: "", unit: "units", reorder: "", price: "", lot: "", expiry: "" }); setNerr({}); setNewItem(true); }}><Plus className="size-4" />New item</Button>} />
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-52 flex-1 sm:max-w-xs"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden /><Input aria-label="Search inventory" className="h-9 pl-9" placeholder="Search product or SKU" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Select sm aria-label="Category" className="w-40" value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })}><option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</Select>
          <Select sm aria-label="Location" className="w-44" value={f.loc} onChange={(e) => setF({ ...f, loc: e.target.value })}><option value="">All locations</option>{refs?.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select>
          <Select sm aria-label="Status" className="w-32" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">All status</option><option>Active</option><option>Low</option><option>Out</option><option>Archived</option></Select>
        </div>
        {isLoading ? <SkeletonRows rows={5} /> : items.length === 0 ? <EmptyState title="No items match" text="Adjust the filters or add an item." /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[820px]"><thead className="border-b border-line bg-cloud/50"><tr><Th>Product</Th><Th>Category</Th><Th>Location</Th><Th>Quantity</Th><Th>Reorder at</Th><Th>Lot / expiry</Th><Th>Status</Th></tr></thead>
            <tbody className="divide-y divide-line">{items.map((i) => <tr key={i.id} tabIndex={0} className="cursor-pointer hover:bg-cloud/40" onClick={() => setOpen(i)} onKeyDown={(e) => e.key === "Enter" && setOpen(i)}><Td><span className="font-medium">{i.name}</span><span className="block text-xs text-muted">{i.sku} · {i.supplier}</span></Td><Td>{i.category}</Td><Td>{refs?.locations.find((l) => l.id === i.locationId)?.name.replace("Brightwell ", "")}</Td><Td className="font-medium">{i.qty} {i.unit}</Td><Td>{i.reorder}</Td><Td>{i.lot ?? "—"}{i.expiry && <span className="block text-xs text-muted">Exp {fmtDate(i.expiry, true)}</span>}</Td><Td><Badge tone={tone(invStatus(i))}>{invStatus(i)}</Badge></Td></tr>)}</tbody></table></div>)}
      </Panel>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)} title={open?.name ?? ""} description={open ? `${open.sku} · ${money(open.price)} per ${open.unit.replace(/s$/, "")}` : ""} width={440}
        footer={open && <><Button variant="secondary" onClick={() => { setA({ qty: "", reason: "" }); setAerr(""); setAdj({ item: open, kind: "correct" }); }}>Correct count</Button><Button variant="secondary" onClick={() => { setA({ qty: "", reason: "Stock received" }); setAerr(""); setAdj({ item: open, kind: "receive" }); }}>Receive stock</Button></>}>
        {open && (() => { const live = data?.inventory.find((x) => x.id === open.id) ?? open; return (<div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 text-[13px]"><div><dt className="text-xs text-muted">In stock</dt><dd className="text-lg font-semibold">{live.qty} {live.unit}</dd></div><div><dt className="text-xs text-muted">Status</dt><dd><Badge tone={tone(invStatus(live))}>{invStatus(live)}</Badge></dd></div><div><dt className="text-xs text-muted">Lot</dt><dd>{live.lot ?? "Not tracked"}</dd></div><div><dt className="text-xs text-muted">Expiry</dt><dd>{live.expiry ? fmtDate(live.expiry, true) : "—"}</dd></div></dl>
          <ReorderLevel item={live} />
          <div><h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Movements</h3>{moves(live.id).length === 0 ? <p className="text-[13px] text-muted">No movements recorded for this item.</p> : <ul className="divide-y divide-line text-[13px]">{moves(live.id).map((m) => <li key={m.id} className="flex items-start justify-between gap-3 py-2"><span className="min-w-0"><Badge tone={m.delta < 0 ? "peach" : "mint"}>{MOVE_LABEL[moveKind(m)]}</Badge><span className="mt-0.5 block">{fmtDate(m.date, true)}{m.reason ? ` · ${m.reason}` : ""}</span><span className="block text-xs text-muted">{m.by}{m.visitId && <> · <Link href={`/visits/${m.visitId}`} className="text-primary hover:underline">Visit {m.visitId}</Link></>}</span></span><span className={m.delta < 0 ? "shrink-0 font-medium text-[#8F2D2D]" : "shrink-0 font-medium text-[#2A8577]"}>{m.delta > 0 ? "+" : ""}{m.delta} {live.unit}</span></li>)}</ul>}<p className="mt-2 text-xs text-muted">Changes made here apply to this demo session only and are not saved after a reload.</p></div></div>); })()}
      </Sheet>

      <Modal open={!!adj} onOpenChange={(o) => !o && setAdj(null)} title={adj?.kind === "receive" ? "Receive stock" : "Correct stock count"} description={adj?.item.name}
        footer={<><Button variant="secondary" onClick={() => setAdj(null)}>Cancel</Button><Button loading={adjust.pending} onClick={async () => { const q2 = Number(a.qty); if (!(q2 > 0) && adj!.kind === "receive") return setAerr("Enter a quantity greater than zero"); if (adj!.kind === "correct" && (a.qty === "" || q2 < 0)) return setAerr("Enter the counted quantity"); if (!a.reason.trim()) return setAerr("A reason is required"); await adjust.run(adj!.item.id, adj!.kind === "receive" ? q2 : q2 - adj!.item.qty, a.reason, adj!.kind === "receive" ? "received" : "correction"); setAdj(null); }}>Save</Button></>}>
        <div className="space-y-4"><Field label={adj?.kind === "receive" ? `Quantity received (${adj?.item.unit})` : `Counted quantity (${adj?.item.unit})`} required error={aerr}><Input type="number" min="0" step="0.1" value={a.qty} onChange={(e) => { setA({ ...a, qty: e.target.value }); setAerr(""); }} /></Field><Field label="Reason" required><Input value={a.reason} onChange={(e) => setA({ ...a, reason: e.target.value })} placeholder="e.g. Delivery, stock count, wastage" /></Field></div>
      </Modal>

      <Modal open={newItem} onOpenChange={setNewItem} title="New inventory item" width={560}
        footer={<><Button variant="secondary" onClick={() => setNewItem(false)}>Cancel</Button><Button loading={add.pending} onClick={async () => { const e: Record<string, string> = {}; if (!n.name.trim()) e.name = "Name is required"; if (!n.sku.trim()) e.sku = "SKU is required"; if (!(Number(n.qty) >= 0) || n.qty === "") e.qty = "Opening quantity is required"; if (!(Number(n.reorder) >= 0) || n.reorder === "") e.reorder = "Reorder level is required"; setNerr(e); if (Object.keys(e).length) return; await add.run({ name: n.name, sku: n.sku, category: n.category, supplier: n.supplier, locationId: n.locationId, qty: Number(n.qty), unit: n.unit, reorder: Number(n.reorder), price: Number(n.price) || 0, lot: n.lot || undefined, expiry: n.expiry || undefined }); setNewItem(false); }}>Add item</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product name" required error={nerr.name}><Input value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} /></Field><Field label="SKU" required error={nerr.sku}><Input value={n.sku} onChange={(e) => setN({ ...n, sku: e.target.value })} /></Field>
          <Field label="Category"><Select value={n.category} onChange={(e) => setN({ ...n, category: e.target.value })}>{["Neuromodulator", "Dermal filler", "Biostimulator", "Consumables", "Physio equipment"].map((c) => <option key={c}>{c}</option>)}</Select></Field><Field label="Supplier"><Input value={n.supplier} onChange={(e) => setN({ ...n, supplier: e.target.value })} /></Field>
          <Field label="Location"><Select value={n.locationId} onChange={(e) => setN({ ...n, locationId: e.target.value })}>{refs?.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select></Field><Field label="Unit"><Select value={n.unit} onChange={(e) => setN({ ...n, unit: e.target.value })}>{["units", "ml", "vials", "boxes", "pcs"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Opening quantity" required error={nerr.qty}><Input type="number" min="0" value={n.qty} onChange={(e) => setN({ ...n, qty: e.target.value })} /></Field><Field label="Reorder threshold" required error={nerr.reorder}><Input type="number" min="0" value={n.reorder} onChange={(e) => setN({ ...n, reorder: e.target.value })} /></Field>
          <Field label="Price per unit"><Input type="number" min="0" value={n.price} onChange={(e) => setN({ ...n, price: e.target.value })} /></Field><Field label="Lot (optional)"><Input value={n.lot} onChange={(e) => setN({ ...n, lot: e.target.value })} /></Field><Field label="Expiry (optional)"><Input type="date" value={n.expiry} onChange={(e) => setN({ ...n, expiry: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}

/** The level at which stock is flagged. Editing it changes the status shown here, in the list and in Reports. */
function ReorderLevel({ item }: { item: InventoryItem }) {
  const save = useAction(apiC.setReorder, "Reorder level updated");
  const [v, setV] = useState(String(item.reorder)); const [err, setErr] = useState("");
  return (
    <div className="rounded-lg bg-cloud px-3 py-2.5 text-[13px]">
      <Field label="Reorder level" hint={`Stock is flagged Low at or below ${item.reorder} ${item.unit} and Out at zero.`} error={err}><Input type="number" min="0" className="w-28" value={v} onChange={(e) => { setV(e.target.value); setErr(""); }} /></Field>
      <Button size="sm" variant="secondary" className="mt-2" loading={save.pending} disabled={v === String(item.reorder)} onClick={() => { const n = Number(v); if (v === "" || !(n >= 0)) return setErr("Enter zero or more"); save.run(item.id, n); }}>Save level</Button>
    </div>
  );
}
