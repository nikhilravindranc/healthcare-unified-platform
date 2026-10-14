import { test } from "node:test";
import assert from "node:assert/strict";
import { REPORTS, reportBySlug, searchRows, sortRows, toCsv, type ReportCtx } from "../src/lib/reports";
import { appointmentInsight, clinicInsight, continuityInsight, financialInsight, rangeFor } from "../src/lib/insights";
import { appointments, demoEnquiries, followUps, patients, providers, services, locations, TODAY, visits } from "../src/lib/db";
import { docTotal, invoiceBalance, invoicePaid, invoiceStatus, invoices, payments, plans } from "../src/lib/clinical";

const ctx = (): ReportCtx => ({ today: TODAY, appointments, visits, followUps, patients, invoices, payments, enquiries: demoEnquiries as never, campaigns: [], providers, services, locations, docTotal, invoicePaid, invoiceBalance, invoiceStatus });
const run = (slug: string, f = {}) => reportBySlug(slug)!.run(ctx(), f);

test("every report runs on the demo records, with a cell for every column and unique row keys", () => {
  REPORTS.forEach((r) => {
    const out = r.run(ctx(), {});
    assert.ok(out.columns.length > 0, r.slug);
    out.rows.forEach((row) => assert.equal(row.cells.length, out.columns.length, `${r.slug} ${row.key}`));
    assert.equal(new Set(out.rows.map((x) => x.key)).size, out.rows.length, `${r.slug} keys`);
  });
});

test("Reports and Analytics agree: the same range gives the same appointment counts", () => {
  const range = rangeFor("90", TODAY); const a = appointmentInsight(appointments, range, TODAY);
  assert.equal(run("appointments", range).rows.length, a.total);
  assert.equal(run("appointments", { ...range, status: "No-show" }).rows.length, a.noShow);
  assert.equal(run("appointments", { ...range, status: "Cancelled" }).rows.length, a.cancelled);
  assert.equal(run("appointments", { ...range, status: "Cancelled or no-show" }).rows.length, a.cancelled + a.noShow);
  assert.equal(run("appointments", { ...range, provider: "pat" }).rows.length, appointmentInsight(appointments, { ...range, providerId: "pat" }, TODAY).total);
});

test("Reports and Analytics agree on visits, follow-ups and invoices", () => {
  const range = rangeFor("90", TODAY);
  const c = clinicInsight(appointments, visits, followUps, range, TODAY);
  assert.equal(run("visits", { ...range, status: "Completed" }).rows.length, c.visitsCompleted);
  assert.equal(run("visits", range).rows.length, c.visitsStarted);
  assert.equal(run("follow-ups", { status: "Overdue" }).rows.length, c.followUps.overdue);
  assert.equal(continuityInsight(followUps, visits, appointments, plans, range, TODAY).overdue.length, c.followUps.overdue);
  const fin = financialInsight(invoices, payments, range, docTotal, invoiceBalance);
  assert.equal(run("invoices", { ...range }).rows.filter((r) => !["Void", "Draft"].includes(String(r.cells[8]))).length, fin.invoices);
});

test("a report's date range applies to the date it names, and a report with no range ignores it", () => {
  assert.equal(reportBySlug("appointments")!.dateBasis, "appointment date");
  assert.equal(run("appointments", { from: "2999-01-01" }).rows.length, 0);
  assert.equal(reportBySlug("patients")!.dateBasis, null);
  assert.equal(run("patients", { from: "2999-01-01" }).rows.length, patients.length);
});

test("patient names and money are guarded by their own permissions", () => {
  assert.deepEqual(reportBySlug("appointments")!.also, ["patients"]);
  assert.deepEqual(reportBySlug("invoices")!.also, ["reports"]);
  assert.deepEqual(reportBySlug("invoices")!.perms, ["financials"]);
  assert.deepEqual(reportBySlug("enquiries")!.perms, ["enquiries", "enquiries_view"]);
});

test("campaign records carry no invented delivery or response figures", () => {
  const cols = reportBySlug("campaigns")!.run(ctx(), {}).columns.join(" ").toLowerCase();
  assert.ok(!/deliver|open rate|click|response|revenue|roi/.test(cols));
  assert.ok(cols.includes("simulated"));
});

test("CSV quotes every cell, doubles quotes, keeps commas and line breaks, and defuses a leading formula character", () => {
  const csv = toCsv(["A", "B"], [{ key: "1", cells: ['He said "hi", ok', "x\ny"] }, { key: "2", cells: ["=SUM(A1)", 5] }]);
  const lines = csv.split("\r\n");
  assert.equal(lines[0], '"A","B"');
  assert.equal(lines[1], '"He said ""hi"", ok","x\ny"');   // the line break stays inside the quoted cell
  assert.ok(csv.includes('"\'=SUM(A1)","5"'));
});

test("sorting is numeric for numbers and natural for text; search matches any cell", () => {
  const rows = [{ key: "a", cells: ["A-10", 2] }, { key: "b", cells: ["A-9", 10] }, { key: "c", cells: ["B", 1] }];
  assert.deepEqual(sortRows(rows, 1, 1).map((r) => r.key), ["c", "a", "b"]);
  assert.deepEqual(sortRows(rows, 0, 1).map((r) => r.key), ["b", "a", "c"]);
  assert.deepEqual(sortRows(rows, 1, -1).map((r) => r.key), ["b", "a", "c"]);
  assert.deepEqual(searchRows(rows, "b").map((r) => r.key), ["c"]);
  assert.equal(searchRows(rows, "  ").length, 3);
});
