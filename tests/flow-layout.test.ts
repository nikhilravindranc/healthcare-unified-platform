import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFlow } from "../src/modules/enquiries/flow-layout";

const e = (id: string, source: string, status: string) => ({ id, source, status }) as never;
const data = [e("1", "Walk-in", "New"), e("2", "Walk-in", "Contacted"), e("3", "Phone call", "Contacted"), e("4", "Phone call", "Contacted"), e("5", "Campaign", "Closed")];
const dims = [
  { id: "source", label: "Source", key: (x: { source: string }) => x.source, order: [] },
  { id: "stage", label: "Stage", key: (x: { status: string }) => x.status, order: ["New", "Contacted", "Closed"] },
] as never;

test("every enquiry appears once in each column and in exactly one ribbon", () => {
  const f = buildFlow(data, dims, { width: 760, height: 300 });
  assert.equal(f.total, 5);
  for (const col of [0, 1]) assert.equal(f.nodes.filter((n) => n.col === col).reduce((a, n) => a + n.count, 0), 5);
  assert.equal(f.links.reduce((a, l) => a + l.count, 0), 5);
  assert.equal(new Set(f.links.flatMap((l) => l.ids)).size, 5);
});

test("thin ribbons keep a minimum thickness and stay inside the diagram", () => {
  const f = buildFlow(data, dims, { width: 760, height: 300, minLink: 3 });
  for (const l of f.links) { assert.ok(l.t >= 3); assert.ok(l.y0 >= -1.5 && l.y1 >= -1.5); }
});

test("an empty list gives an empty diagram", () => {
  const f = buildFlow([], dims, { width: 760, height: 300 });
  assert.equal(f.nodes.length, 0); assert.equal(f.links.length, 0);
});
