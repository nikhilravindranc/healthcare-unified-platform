import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openAs } from "./helpers";

const status = (page: import("@playwright/test").Page) => page.locator("main p[role=status]").filter({ hasText: /record/ });
const count = async (page: import("@playwright/test").Page) => { await expect(status(page)).toHaveText(/^\d+/); return Number((await status(page).innerText()).match(/^(\d+)/)![1]); };

test("Reports catalogue is searchable, filtered by category, and shows record counts", async ({ page }) => {
  await openAs(page, "/reports");
  await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Invoices/ })).toBeVisible();
  await page.getByLabel("Search reports").fill("follow");
  await expect(page.getByRole("main").getByRole("link", { name: /Follow-ups/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Invoices/ })).toHaveCount(0);
  await page.getByLabel("Search reports").fill("zzzz");
  await expect(page.getByText("No report matches")).toBeVisible();
  await page.getByLabel("Search reports").fill("");
  await page.getByRole("button", { name: "Financials" }).click();
  await expect(page.getByRole("link", { name: /Payments and refunds/ })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: /^Appointments/ })).toHaveCount(0);
  await expect(page.getByText(/\d+ records/).first()).toBeVisible();
});

test("every report in the catalogue opens with its records and a way back", async ({ page }) => {
  await openAs(page, "/reports");
  await expect(page.getByRole("link", { name: /Invoices/ })).toBeVisible();
  const hrefs = await page.getByRole("main").getByRole("link", { name: /records/ }).evaluateAll((els) => els.map((e) => e.getAttribute("href")!));
  expect(hrefs.length).toBeGreaterThanOrEqual(9);
  for (const h of hrefs) {
    await page.goto(h);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Reports");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(status(page)).toBeVisible();
  }
});

test("Appointments report: filters live in the address, columns sort, rows link to the records, and CSV matches the table", async ({ page }) => {
  await openAs(page, "/reports/appointments?status=No-show");
  const n = await count(page);
  expect(n).toBeGreaterThan(0);
  await expect(page.getByRole("row").filter({ hasText: "No-show" }).first()).toBeVisible();
  await page.getByLabel("Status").selectOption("");
  await expect(page).not.toHaveURL(/status=/);
  const all = await count(page);
  expect(all).toBeGreaterThan(n);
  const head = page.getByRole("columnheader", { name: "Date" });
  await head.getByRole("button").click();
  await expect(head).toHaveAttribute("aria-sort", "ascending");
  await head.getByRole("button").click();
  await expect(head).toHaveAttribute("aria-sort", "descending");
  await page.getByLabel("Search this report").fill("Sarah");
  const found = await count(page);
  expect(found).toBeGreaterThan(0);
  expect(found).toBeLessThan(all);
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const file = await (await dl).path();
  const lines = readFileSync(file!, "utf8").split("\r\n");
  expect(lines.length - 1).toBe(found);
  expect(lines[0]).toContain('"Appointment"');
  expect(lines[0]).toContain('"Booking"');
  expect(lines[0]).toContain('"Attendance"');
  await page.getByRole("row").nth(1).getByRole("link").first().click();
  await expect(page).toHaveURL(/\/appointments\/A-/);
});

test("Analytics links to the Reports records and the two show the same figure", async ({ page }) => {
  await openAs(page, "/analytics/appointments?range=90");
  const booked = page.getByRole("link", { name: /^Booked/ });
  const figure = Number((await booked.innerText()).match(/\n?\s*(\d+)\s/)![1]);
  await booked.click();
  await expect(page).toHaveURL(/\/reports\/appointments\?/);
  expect(await count(page)).toBe(figure);
  await page.goto("/analytics/appointments?range=90");
  const noShows = page.getByRole("link", { name: /^No-show rate/ });
  await noShows.click();
  await expect(page).toHaveURL(/status=No-show/);
  await expect(page.getByRole("row").filter({ hasText: "No-show" }).first()).toBeVisible();
  await page.getByRole("link", { name: "See the trend in Analytics" }).click();
  await expect(page).toHaveURL(/\/analytics\/appointments/);
});

test("Marketing Insights lives inside Analytics, reached from the Acquisition tab, and its link goes to the enquiry records", async ({ page }) => {
  await openAs(page, "/analytics");
  await page.getByRole("navigation", { name: "Insight categories" }).getByRole("link", { name: "Acquisition" }).click();
  await expect(page).toHaveURL(/\/analytics\/marketing/);
  await expect(page.getByRole("heading", { level: 1, name: "Marketing Insights" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" }).getByText("Marketing", { exact: false })).toHaveCount(0);
  await page.getByRole("main").getByRole("link", { name: /^Enquiries/ }).click();
  await expect(page).toHaveURL(/\/reports\/enquiries\?from=/);
  expect(await count(page)).toBeGreaterThan(0);
});

test("Reports respect permissions: Provider has no financial reports or export, Front desk and Marketing have no Reports", async ({ page }) => {
  await openAs(page, "/reports", "Provider");
  await expect(page.getByRole("main").getByRole("link", { name: /^Appointments/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Invoices/ })).toHaveCount(0);
  await page.goto("/reports/invoices");
  await expect(page.getByText(/You don't have access to/).first()).toBeVisible();
  await page.goto("/reports/appointments");
  await expect(page.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  await openAs(page, "/reports", "Marketing");
  await expect(page.getByText(/You don't have access to/).first()).toBeVisible();
  await openAs(page, "/reports/appointments", "Front desk");
  await expect(page.getByText(/You don't have access to/).first()).toBeVisible();
});

test("an unknown report says so", async ({ page }) => {
  await openAs(page, "/reports/nope");
  await expect(page.getByText("Report not found")).toBeVisible();
});

for (const width of [375, 768, 1280]) {
  for (const [name, path] of [["Reports catalogue", "/reports"], ["Appointments report", "/reports/appointments"], ["Patients report", "/reports/patients"], ["Invoices report", "/reports/invoices"]] as const) {
    test(`${name} has no horizontal page scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openAs(page, path);
      await page.waitForLoadState("networkidle");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });
  }
}
