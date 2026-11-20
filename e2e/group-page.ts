import type { Page } from "@playwright/test";

/**
 * Opens one of the Group page's collapsed sections. Each page load starts
 * with Expenses and Insights collapsed, so call it again after navigating back.
 */
export async function showSection(page: Page, name: "Expenses" | "Insights") {
  await page.getByRole("button", { name: `Show ${name}`, exact: true }).click();
}
