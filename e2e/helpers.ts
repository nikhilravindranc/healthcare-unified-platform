import type { Page } from "@playwright/test";

/** Opens a route as a given demo role. The role is demo state in localStorage, not security. */
export async function openAs(page: Page, path: string, role = "Owner") {
  await page.addInitScript((r) => { try { localStorage.setItem("pms.role", r); localStorage.setItem("pms.session", JSON.stringify({ email: "dr.patel@brightwellclinic.com", name: "Dr. Aarav Patel", first: "Aarav", practice: "Brightwell Clinic" })); localStorage.setItem("pms.welcomed.dr.patel@brightwellclinic.com", "1"); localStorage.setItem("pms.sidebar", "0"); localStorage.setItem("pms.eviGreeted", "1"); } catch {} }, role);
  await page.goto(path);
}

/** Collects console errors so a journey can assert that none appeared. */
export function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Simulated failure|Failed to load resource|hydrat/i.test(m.text())) errors.push(m.text()); });
  return errors;
}
