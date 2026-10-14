import { test } from "node:test";
import assert from "node:assert/strict";
import { apiC, inventory, invStatus, moveKind, moves } from "../src/lib/clinical";

test("older movements are typed from what they record, never invented", () => {
  assert.equal(moveKind({ id: "a", itemId: "i", date: "d", delta: -3, reason: "x", by: "y", visitId: "V-1" }), "used");
  assert.equal(moveKind({ id: "a", itemId: "i", date: "d", delta: 5, reason: "Stock received", by: "y" }), "received");
  assert.equal(moveKind({ id: "a", itemId: "i", date: "d", delta: 5, reason: "Opening stock", by: "y" }), "opening");
  assert.equal(moveKind({ id: "a", itemId: "i", date: "d", delta: -2, reason: "Recount", by: "y" }), "correction");
});

test("a correction that would go below zero records only what was applied, so movements add up", async () => {
  const it = inventory[0]; const before = it.qty;
  await apiC.adjustStock(it.id, -(before + 50), "Recount", "correction");
  const m = moves[0];
  assert.equal(it.qty, 0);
  assert.equal(m.delta, -before);
  assert.equal(m.kind, "correction");
  assert.equal(invStatus(it), "Out");
});

test("changing the reorder level changes the status the screens show", async () => {
  const it = inventory[1]; await apiC.adjustStock(it.id, 10, "Stock received", "received");
  await apiC.setReorder(it.id, it.qty + 1); assert.equal(invStatus(it), "Low");
  await apiC.setReorder(it.id, 0); assert.equal(invStatus(it), "Active");
});
