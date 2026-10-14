import { expect, test } from "@playwright/test";
import { openAs, watchConsole } from "./helpers";

const TABS = ["Overview", "Appointments", "Care history", "Photos", "Documents & forms", "Financials"];

test("a patient opens and all six tabs are reachable by mouse and by arrow keys", async ({ page }) => {
  const errors = watchConsole(page);
  await openAs(page, "/patients/P-10248");
  await expect(page.getByRole("heading", { name: "Sarah Johnson" })).toBeVisible();
  for (const name of TABS) { await page.getByRole("tab", { name }).click(); await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true"); }
  await page.getByRole("tab", { name: "Overview" }).click();
  await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Overview" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Appointments" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Appointments" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Financials" })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.getByRole("tab", { name: "Overview" })).toBeFocused();
  expect(errors).toEqual([]);
});

test("an in-progress visit resumes and does not create a second visit", async ({ page }) => {
  await openAs(page, "/visits");
  await expect(page.getByRole("row").filter({ hasText: "In progress" })).toHaveCount(1);
  await page.goto("/patients/P-10260");
  await page.getByRole("button", { name: "Resume visit" }).click();
  await expect(page).toHaveURL(/\/visits\/V-9001/);
  await page.getByRole("link", { name: "Visits", exact: true }).first().click();
  await expect(page.getByRole("row").filter({ hasText: "In progress" })).toHaveCount(1);
});

test("patient to appointment to visit and back, using existing links", async ({ page }) => {
  await openAs(page, "/patients/P-10260?tab=appointments");
  await page.getByRole("button", { name: "Open", exact: true }).first().click();
  await page.getByRole("button", { name: "View visit" }).click();
  await expect(page).toHaveURL(/\/visits\/V-9001/);
  await expect(page.getByRole("button", { name: /^Today, / })).toBeVisible();
  await page.getByRole("button", { name: "Back to patient" }).click();
  await expect(page).toHaveURL(/\/patients\/P-10260/);
});

test("a visit with no booking says so and does not invent one", async ({ page }) => {
  await openAs(page, "/visits");
  const row = page.getByRole("row").filter({ hasText: "Knee rehabilitation, session 4" });
  await expect(row).toContainText("No booking linked");
  await row.click();
  await expect(page.getByText("No booking is linked to this visit.")).toBeVisible();
});

test("a follow-up opens its source visit, and an older follow-up shows its reason as not recorded", async ({ page }) => {
  await openAs(page, "/follow-ups");
  await page.getByRole("tab", { name: /Upcoming/ }).click();
  const link = page.getByRole("link", { name: /Sep 18, 2026, Injectable treatment/ });
  await expect(link).toBeVisible();
  await expect(page.getByText("Reason not recorded").first()).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/visits\/V-5001/);
});

test("a supported form is completed and shows as submitted, awaiting review", async ({ page }) => {
  await openAs(page, "/patients/P-10294?tab=docs");
  await page.getByLabel("Complete a form").selectOption({ label: "Medical history (v2)" });
  await page.getByLabel("Allergies (describe)").fill("None reported");
  await page.getByRole("button", { name: "Submit form" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Medical history" })).toContainText("Submitted, awaiting review");
});

test("role access: Staff has no Financials tab and a direct link is refused", async ({ page }) => {
  await openAs(page, "/patients/P-10248", "Staff");
  await expect(page.getByRole("tab", { name: "Financials" })).toHaveCount(0);
  await page.goto("/patients/P-10248?tab=financials");
  await expect(page.getByText("You don't have access to patient financials")).toBeVisible();
});

test("a failed save shows an error, keeps the dialog and input, and does not claim success", async ({ page }) => {
  await openAs(page, "/follow-ups");
  await page.getByRole("button", { name: "New follow-up" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New follow-up" });
  await dialog.locator("select").first().selectOption({ index: 1 });
  await dialog.getByLabel("Reason").fill("Check healing");
  await page.evaluate(() => { (window as unknown as { __pmsFailNext: boolean }).__pmsFailNext = true; });
  await dialog.getByRole("button", { name: "Add follow-up" }).click();
  await expect(page.getByText("Something went wrong. Please try again.")).toBeVisible();
  await expect(page.getByText("Follow-up added")).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Reason")).toHaveValue("Check healing");
});

test("Reports separate real record counts from illustrative figures", async ({ page }) => {
  await openAs(page, "/reports");
  await expect(page.getByRole("heading", { name: "From the records in this app" })).toBeVisible();
  await expect(page.getByText("The sections below are illustrative demo figures")).toBeVisible();
  for (const title of ["Appointment trend", "No-show trend", "Provider utilization", "Service volume", "Provider activity", "Patient activity"]) {
    await expect(page.locator("section", { has: page.getByRole("heading", { name: title }) }).getByText("Illustrative")).toBeVisible();
  }
});

test("consent is never shown as granted, denied or withdrawn without supporting data", async ({ page }) => {
  await openAs(page, "/crm");
  const body = page.locator("body");
  await expect(body).toContainText("Not granted (earlier record, details unknown)");
  await expect(body).toContainText("Not recorded");
  await expect(body).not.toContainText("Withdrawn");
  await expect(page.getByRole("row").filter({ hasText: "Marcus Lee" })).toContainText("Not recorded");   // a person nobody asked
});

test("keyboard: the More menu opens the edit dialog and focus returns to the menu button when it closes", async ({ page }) => {
  await openAs(page, "/patients/P-10248");
  await page.getByRole("button", { name: "More actions" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Edit patient" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Edit patient" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "More actions" })).toBeFocused();
});

test("photo consent is shown as not recorded when nobody recorded it, never as granted", async ({ page }) => {
  await openAs(page, "/patients/P-10248?tab=history");
  await page.getByRole("radio", { name: "Photos", exact: true }).click();
  await expect(page.getByText("Photo consent not recorded").first()).toBeVisible();
  await expect(page.getByText("Photo consent granted")).toHaveCount(0);
});

for (const width of [375, 768, 1280]) {
  for (const [name, path] of [["patient detail", "/patients/P-10248"], ["patient Appointments tab", "/patients/P-10248?tab=appointments"], ["patient Care history", "/patients/P-10248?tab=history"], ["patient Documents tab", "/patients/P-10248?tab=docs"], ["Visits", "/visits"], ["Follow-ups", "/follow-ups"], ["Reports", "/reports"], ["Patients", "/patients"]] as const) {
    test(`${name} has no horizontal page scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openAs(page, path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}
