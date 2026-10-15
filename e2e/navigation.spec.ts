import { expect, test } from "@playwright/test";
import { openAs } from "./helpers";

const nav = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Primary" });

test("sidebar follows the final structure, with no Front desk or Marketing Insights item", async ({ page }) => {
  await openAs(page, "/overview");
  const n = nav(page);
  await expect(n.getByRole("link", { name: "Today" })).toBeVisible();
  const groups = await n.getByRole("group").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  expect(groups).toEqual(["Clinic", "Patient Acquisition", "Patient Engagement", "Insights", "Practice Management"]);
  const links = async (g: string) => n.getByRole("group", { name: g }).getByRole("link").evaluateAll((els) => els.map((e) => e.textContent?.trim()));
  expect(await links("Clinic")).toEqual(["Today", "Calendar", "Appointments", "Visits", "Patients", "Activities", "Follow-ups"]);
  expect(await links("Patient Acquisition")).toEqual(["Enquiries", "Contacts"]);
  expect(await links("Patient Engagement")).toEqual(["Online booking", "Campaigns"]);
  expect(await links("Insights")).toEqual(["Analytics", "Reports"]);
  expect(await links("Practice Management")).toEqual(["Team & providers", "Services & treatments", "Locations & rooms", "Inventory", "Forms & documents", "Billing"]);
  await expect(n.getByRole("link", { name: "Front desk" })).toHaveCount(0);
  await expect(n.getByRole("link", { name: /Marketing insights/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Help" })).toBeVisible();
  await expect(n.getByText("People & Services")).toBeVisible();
  await expect(n.getByText("Facilities & Resources")).toBeVisible();
  await expect(n.getByText("Administration")).toBeVisible();
});

test("every sidebar destination opens a real page, and the active item is marked", async ({ page }) => {
  await openAs(page, "/overview");
  await expect(nav(page).getByRole("link", { name: "Today" })).toBeVisible();
  const hrefs = await nav(page).getByRole("link").evaluateAll((els) => els.map((e) => e.getAttribute("href")!));
  expect(hrefs.length).toBe(19);
  for (const h of hrefs) {
    await page.goto(h);
    await expect(page.getByRole("main")).not.toContainText("Page not found");
    await expect(page.getByRole("main").getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(nav(page).locator(`a[href="${h}"]`)).toHaveAttribute("aria-current", "page");
  }
});

test("the floating assistant avatar is gone, and Ask EVI stays in the top bar", async ({ page }) => {
  await openAs(page, "/overview");
  await expect(page.getByText("Hi, this is EVI")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Ask EVI/ }).first()).toBeVisible();
});

test("Appointments: the list opens a detail page, the same appointment as in Calendar, with patient and visit links", async ({ page }) => {
  await openAs(page, "/appointments?view=today");
  await expect(page.getByRole("heading", { level: 1, name: "Appointments" })).toBeVisible();
  await expect(page.getByText("Review and manage scheduled visits.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open calendar" })).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: "A-16" });
  await row.getByRole("link").first().click();
  await expect(page).toHaveURL(/\/appointments\/A-16/);
  await expect(page.getByRole("heading", { level: 1, name: "David Wilson" })).toBeVisible();
  await expect(page.getByText("Attendance")).toBeVisible();
  await page.getByRole("link", { name: "Open visit" }).or(page.getByRole("link", { name: "Resume visit" })).first().click();
  await expect(page).toHaveURL(/\/visits\/V-9001/);
  await page.goBack();
  await page.getByRole("link", { name: "Open patient profile" }).click();
  await expect(page).toHaveURL(/\/patients\/P-10260/);
  // the Calendar's panel links to the same record
  await page.goto("/calendar");
  await page.getByRole("button", { name: /David Wilson, .*In visit/ }).click();
  await page.getByRole("button", { name: "Open full page" }).click();
  await expect(page).toHaveURL(/\/appointments\/A-16/);
});

test("Appointments: opening a detail page never creates a visit, and a booking without a visit says so", async ({ page }) => {
  await openAs(page, "/appointments/A-12");          // a booked appointment today with no visit
  await expect(page.getByText("No visit has been started for this appointment. Opening this page does not create one.")).toBeVisible();
  await page.goto("/visits");
  await expect(page.getByRole("row").filter({ hasText: "Marcus Lee" })).toHaveCount(0);
});

test("Appointments: the row menu offers only actions that fit the status, and cancelling asks first", async ({ page }) => {
  await openAs(page, "/appointments?view=all");
  await page.getByRole("button", { name: "Show filters" }).or(page.getByRole("button", { name: /^Filters/ })).click();
  await page.getByLabel("Booking status").selectOption("Cancelled");
  const first = page.getByRole("row").nth(1);
  await first.getByRole("button", { name: /^Actions for/ }).click();
  await expect(page.getByRole("menuitem", { name: "Reschedule" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Confirm booking" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Check in" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Cancel appointment" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByLabel("Booking status").selectOption("Awaiting confirmation");
  await page.getByRole("row").nth(1).getByRole("button", { name: /^Actions for/ }).click();
  await expect(page.getByRole("menuitem", { name: "Confirm booking" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Cancel appointment" }).click();
  await expect(page.getByRole("alertdialog").or(page.getByRole("dialog"))).toContainText("The record is kept and shown as cancelled.");
});

test("Appointments: confirming a booking changes only the booking", async ({ page }) => {
  await openAs(page, "/appointments/A-12");
  await expect(page.getByText("Awaiting confirmation").first()).toBeVisible();
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByText("Booking confirmed", { exact: true })).toBeVisible();
  await expect(page.locator('[aria-label="Status"]')).toContainText("Booking Confirmed");
  await expect(page.locator('[aria-label="Status"]')).toContainText("Attendance Not yet arrived");
});

test("Activities: log a task, see it in the list, complete it, and a linked follow-up stays open", async ({ page }) => {
  await openAs(page, "/activities");
  await expect(page.getByRole("heading", { level: 1, name: "Activities" })).toBeVisible();
  await page.getByRole("button", { name: "Log activity" }).first().click();
  const dlg = page.getByRole("dialog", { name: "Log activity" });
  await dlg.getByLabel("Type").selectOption("task");
  await dlg.getByLabel("Subject").fill("Collect referral letter");
  await dlg.getByLabel("Linked to").selectOption("patient");
  await dlg.getByLabel("Patient", { exact: true }).selectOption("P-10248");
  await dlg.getByLabel("Due").fill("2026-10-09");
  await dlg.getByLabel("Related follow-up (optional)").selectOption({ index: 1 });
  await dlg.getByRole("button", { name: "Save activity" }).click();
  await page.getByLabel("Search activities").fill("Collect referral");
  const row = page.getByRole("row").filter({ hasText: "Collect referral letter" });
  await expect(row).toContainText("Due soon");
  await row.getByRole("button", { name: /Collect referral letter/ }).click();
  const sheet = page.getByRole("dialog", { name: "Collect referral letter" });
  await expect(sheet).toContainText("Completing this activity does not complete the follow-up");
  await sheet.getByRole("button", { name: "Mark complete" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Collect referral letter" })).toContainText("Completed");
  await page.goto("/follow-ups");
  await page.getByRole("tab", { name: /Upcoming/ }).click();
  await expect(page.getByRole("row").filter({ hasText: "Sarah Johnson" }).first()).toBeVisible();
});

test("Activities: a call needs a link, logs once, and shows on the list as completed", async ({ page }) => {
  await openAs(page, "/activities");
  await page.getByRole("button", { name: "Log activity" }).first().click();
  const dlg = page.getByRole("dialog", { name: "Log activity" });
  await dlg.getByRole("button", { name: "Save activity" }).click();
  await expect(dlg.getByText(/Link the call to a patient or an enquiry/)).toBeVisible();
  await dlg.getByLabel("Linked to").selectOption("patient");
  await dlg.getByLabel("Patient", { exact: true }).selectOption("P-10248");
  await dlg.getByLabel("Outcome").fill("Booked a review");
  await dlg.getByRole("button", { name: "Save activity" }).click();
  await expect(dlg).toBeHidden();
  await page.getByLabel("Search activities").fill("Booked a review");
  await expect(page.getByRole("row").filter({ hasText: "Booked a review" })).toHaveCount(1);
  await expect(page.getByRole("row").filter({ hasText: "Booked a review" })).toContainText("Completed");
});

test("Activities: an enquiry task opens its enquiry", async ({ page }) => {
  await openAs(page, "/activities");
  const link = page.getByRole("row").filter({ hasText: /E-\d+/ }).first().getByRole("link").first();
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^\/enquiries\/E-/);
  await link.click();
  await expect(page).toHaveURL(/\/enquiries\/E-/);
});

test("Analytics: landing, category tabs, an insight and its source records", async ({ page }) => {
  await openAs(page, "/analytics");
  await expect(page.getByRole("heading", { level: 1, name: "Analytics" })).toBeVisible();
  await expect(page.getByText("Understand clinic performance, patient activity, and growth.")).toBeVisible();
  const tabs = await page.getByRole("navigation", { name: "Insight categories" }).getByRole("link").evaluateAll((els) => els.map((e) => e.textContent));
  expect(tabs).toEqual(["Overview", "Clinic", "Patients", "Acquisition", "Services", "Capacity", "Financials"]);
  await expect(page.getByText("Not available yet")).toBeVisible();                // Inventory: honest about why
  await page.getByRole("link", { name: /Appointment analytics/ }).click();
  await expect(page).toHaveURL(/\/analytics\/appointments/);
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Analytics");
  await page.getByLabel("Date range").selectOption("90");
  await expect(page).toHaveURL(/range=90/);
  await page.getByRole("link", { name: /^Booked/ }).click();                       // to the records, filtered by the same dates
  await expect(page).toHaveURL(/\/reports\/appointments\?.*from=/);
  await expect(page.getByRole("heading", { level: 1, name: "Appointments" })).toBeVisible();
});

test("Analytics: every available insight opens, defines its numbers, and Marketing sits under Acquisition", async ({ page }) => {
  for (const slug of ["clinic", "appointments", "patients", "marketing", "services", "capacity", "financial", "continuity"]) {
    await page.goto(`/analytics/${slug}`);
    await openAs(page, `/analytics/${slug}`);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
  }
  await openAs(page, "/analytics/marketing");
  await expect(page.getByRole("navigation", { name: "Insight categories" }).getByRole("link", { name: "Acquisition" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Time to contact and time to booking are not shown")).toBeVisible();
  await expect(page.getByText(/return on spend/)).toBeVisible();
});

test("Analytics: capacity shows no percentage where hours cannot be read, and financials follow permission", async ({ page }) => {
  await openAs(page, "/analytics/capacity");
  await expect(page.getByText(/Hours that cannot be read are never guessed/)).toBeVisible();
  await openAs(page, "/analytics/financial", "Staff");
  await expect(page.getByText(/You don't have access to/).first()).toBeVisible();
});

test("Analytics: Marketing role sees only Marketing Insights; other insights are refused", async ({ page }) => {
  await openAs(page, "/analytics", "Marketing");
  await expect(page.getByRole("link", { name: "Marketing Insights" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Appointment analytics" })).toHaveCount(0);
  await page.goto("/analytics/appointments");
  await expect(page.getByText(/You don't have access to/).first()).toBeVisible();
});

test("Billing opens from Administration and links to the patient's financials", async ({ page }) => {
  await openAs(page, "/billing");
  await expect(page.getByRole("heading", { level: 1, name: "Billing" })).toBeVisible();
  await expect(page.getByText("EVOQ Billing is not connected in this demo")).toBeVisible();
  await page.getByRole("row").nth(1).getByRole("link").click();
  await expect(page).toHaveURL(/tab=financials/);
});

for (const width of [375, 768, 1280]) {
  for (const [name, path] of [["Appointments", "/appointments"], ["Appointment detail", "/appointments/A-16"], ["Activities", "/activities"], ["Analytics", "/analytics"], ["Appointment analytics", "/analytics/appointments"], ["Services insights", "/analytics/services"], ["Capacity insights", "/analytics/capacity"], ["Billing", "/billing"]] as const) {
    test(`${name} has no horizontal page scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openAs(page, path);
      await page.waitForLoadState("networkidle");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });
  }
}

test("Appointments listing is usable by keyboard: the row menu opens with Enter and closes with Escape, returning focus", async ({ page }) => {
  await openAs(page, "/appointments?view=today");
  const btn = page.getByRole("button", { name: /^Actions for/ }).first();
  await btn.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Open appointment" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(btn).toBeFocused();
});
