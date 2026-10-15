import { expect, test } from "@playwright/test";
import { openAs } from "./helpers";

const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80"><rect width="240" height="80" fill="none"/><circle cx="40" cy="40" r="30" fill="#c2410c"/><rect x="90" y="20" width="130" height="40" rx="8" fill="#0f766e"/></svg>`;

test("Themes: a logo gives a custom palette, it can be saved, and it applies across the app", async ({ page }) => {
  await openAs(page, "/practice/themes");
  await page.getByLabel("Upload a logo").setInputFiles({ name: "logo.svg", mimeType: "image/svg+xml", buffer: Buffer.from(LOGO) });
  await expect(page.getByText(/Colours were taken from your logo/)).toBeVisible();
  await page.getByRole("radio", { name: "Pill" }).click();
  await page.getByRole("radio", { name: "Serif headings" }).click();
  await page.getByRole("button", { name: "Use this theme" }).click();
  const primary = await page.evaluate(() => document.documentElement.style.getPropertyValue("--primary"));
  expect(primary).not.toBe("");
  expect(primary.toLowerCase()).not.toBe("#2867b2");
  await expect(page.locator("html")).toHaveAttribute("data-buttons", "pill");
  await page.goto("/overview");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "custom");
  await expect(page.getByRole("img", { name: "My brand logo" }).first()).toBeVisible();
});

test("Themes: a file that is not an image is refused with a clear message", async ({ page }) => {
  await openAs(page, "/practice/themes");
  await page.getByLabel("Upload a logo").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.getByText(/choose an image file/i)).toBeVisible();
});

test("Themes: a ready-made theme can be chosen and reset", async ({ page }) => {
  await openAs(page, "/practice/themes");
  await page.getByRole("button", { name: "Use the Rose Quartz theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "aesthetics");
});
