import type { Page } from "@playwright/test";

/**
 * Opens one of the Group page's collapsed sections. Each page load starts
 * with Expenses and Insights collapsed, so call it again after navigating back.
 */
export async function showSection(page: Page, name: "Expenses" | "Insights") {
  await page.getByRole("button", { name: `Show ${name}`, exact: true }).click();
}

export async function hideSection(page: Page, name: "Expenses" | "Insights") {
  await page.getByRole("button", { name: `Hide ${name}`, exact: true }).click();
}

/** The Group page's sections, in order: my position first, then the collapsed ones. */
export const GROUP_PAGE_SECTIONS = ["Settle up", "Balances", "Expenses", "Insights"];
