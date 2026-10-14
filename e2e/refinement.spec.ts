import { expect, test } from "@playwright/test";
import { openAs } from "./helpers";

test("Calendar: booked, attending and lost appointments are told apart, and a key explains them", async ({ page }) => {
  await openAs(page, "/calendar");
  await expect(page.getByRole("list", { name: "Appointment status key" }).or(page.getByLabel("Appointment status key"))).toBeVisible();
  await expect(page.getByLabel("Appointment status key")).toContainText("Did not take place");
  await expect(page.getByRole("button", { name: /, Booked: / }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /, Attending: / }).first()).toBeVisible();
  const labels = await page.getByRole("button", { name: /, (Booked|Attending|Completed|Did not take place): / }).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""));
  expect(labels.length).toBeGreaterThan(3);
  // a confirmed or scheduled booking is never described as attending or completed
  labels.filter((l) => /: (Confirmed|Scheduled)$/.test(l)).forEach((l) => expect(l).toMatch(/, Booked: /));
  labels.filter((l) => /: (Cancelled|No-show)$/.test(l)).forEach((l) => expect(l).toMatch(/, Did not take place: /));
  labels.filter((l) => /: (Arrived|Waiting|In visit)$/.test(l)).forEach((l) => expect(l).toMatch(/, Attending: /));
});

test("Calendar keyboard: arrow keys change the day, T returns to today, Enter opens an appointment and focus returns when it closes", async ({ page }) => {
  await openAs(page, "/calendar");
  const region = page.getByRole("region", { name: /^Calendar, day view/ });
  const title = page.locator("p[aria-live=polite]");
  const today = await title.textContent();
  await region.focus();
  await page.keyboard.press("ArrowRight");
  await expect(title).not.toHaveText(today ?? "");
  await page.keyboard.press("t");
  await expect(title).toHaveText(today ?? "");
  const event = page.getByRole("button", { name: /Booked: Confirmed/ }).first();
  await event.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(event).toBeFocused();
});

test("Services: status says what it does, and never says history is removed", async ({ page }) => {
  await openAs(page, "/practice/services");
  await page.getByRole("row").filter({ hasText: "Consultation" }).first().click();
  await page.getByLabel("Status").selectOption("Inactive");
  await expect(page.getByText(/Existing appointments, visits and invoices keep this service/)).toBeVisible();
  await page.getByLabel("Status").selectOption("Active");
  await expect(page.getByText(/does not delete any appointment, visit or invoice/)).toBeVisible();
});

test("Team: provider hours are shown as the booking rules read them, and unreadable text is reported", async ({ page }) => {
  await openAs(page, "/practice/team");
  await expect(page.getByRole("row").filter({ hasText: /Patel/ }).first()).toContainText(/Mon, Tue, Wed, Thu, Fri|Mon/);
  await page.getByRole("row").filter({ hasText: /Patel/ }).first().click();
  await expect(page.getByText("What the booking rules will use")).toBeVisible();
  await page.getByLabel("Working hours").fill("by arrangement");
  await expect(page.getByText(/cannot be read, so no provider hours rule is applied/).last()).toBeVisible();
});

test("Inventory: movements show their type, date and visit reference, and a reorder level can be read and changed", async ({ page }) => {
  await openAs(page, "/practice/inventory");
  await page.getByRole("row").first().waitFor();
  await page.getByRole("row").filter({ hasText: /Botulinum/ }).first().click();
  await expect(page.getByText("Used in a visit").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /^Visit V-/ }).first()).toBeVisible();
  await expect(page.getByText("Received").first()).toBeVisible();
  await expect(page.getByLabel("Reorder level")).toBeVisible();
  await expect(page.getByText(/apply to this demo session only/)).toBeVisible();
});

test("Rooms: the screen says rooms are not linked to services", async ({ page }) => {
  await openAs(page, "/practice/locations");
  await expect(page.getByText(/Room suitability by service is not enforced/)).toBeVisible();
});

test("Forms: a preview is read-only, does not add a response and works by keyboard", async ({ page }) => {
  await openAs(page, "/practice/forms");
  await expect(page.getByRole("button", { name: "Preview Treatment consent" })).toBeVisible();
  const before = await page.getByRole("row").count();
  await page.getByRole("button", { name: "Preview Treatment consent" }).focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: /Preview: Treatment consent/ });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Preview only. This is the form template, not a patient's response");
  await expect(dialog.getByRole("group", { name: "Form preview, read only" }).or(dialog.locator("fieldset[disabled]"))).toHaveCount(1);
  expect(await dialog.locator("fieldset[disabled] input:enabled, fieldset[disabled] select:enabled, fieldset[disabled] textarea:enabled").count()).toBe(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Preview Treatment consent" })).toBeFocused();
  expect(await page.getByRole("row").count()).toBe(before);
  await page.goto("/patients/P-10248?tab=docs");
  await expect(page.getByRole("row").filter({ hasText: "Treatment consent" }).first()).toContainText(/Reviewed|Signed/);
});

test("Forms: a multi-select question shows its options", async ({ page }) => {
  await openAs(page, "/practice/forms");
  await page.getByRole("button", { name: "Preview Medical history" }).click();
  await expect(page.getByRole("dialog").getByLabel("Diabetes")).toBeVisible();
});

test("Agents: every finding can explain why it appeared, with source links", async ({ page }) => {
  await openAs(page, "/agents?agent=followup");
  const first = page.getByRole("dialog").getByText("Why this appeared").first();
  await first.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Rule (fixed, not AI)");
  await expect(dialog).toContainText("What is recorded");
  await expect(dialog.getByRole("link", { name: /^Patient / }).first()).toBeVisible();
  await expect(page.getByText("No AI model is connected")).toBeVisible();
});

for (const width of [375, 768, 1280]) {
  for (const [name, path] of [["Calendar", "/calendar"], ["Services", "/practice/services"], ["Team", "/practice/team"], ["Inventory", "/practice/inventory"], ["Locations", "/practice/locations"], ["Forms", "/practice/forms"], ["Agents", "/agents"]] as const) {
    test(`${name} has no horizontal page scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openAs(page, path);
      await page.waitForLoadState("networkidle");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });
  }
}

test("Marketing role cannot open patient pages", async ({ page }) => {
  await openAs(page, "/patients/P-10248", "Marketing");
  await expect(page.getByText(/You don't have access to/).first()).toBeVisible();
});
