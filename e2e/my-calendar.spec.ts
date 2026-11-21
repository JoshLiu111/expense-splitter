import { expect, test, type Page } from "@playwright/test";

const calendar = (page: Page) => page.getByRole("region", { name: "My Calendar" });
const day = (page: Page, name: string | RegExp) => calendar(page).getByRole("button", { name });
const ledgerDate = (page: Page, date: string) => page.locator(`main time[datetime="${date}"]`);

test("a Guest's My Calendar opens on the latest month with something, marked by kind and summed", async ({ page }) => {
  await page.goto("/guest/groups/grp_japan_2024");
  // The sample Group has no Member for the Guest, so its first Member stands in.
  await expect(calendar(page)).toContainText("Showing Alex Chen");
  await expect(calendar(page).getByRole("heading", { level: 3 })).toHaveText("March 2024");
  await expect(day(page, "Mar 24, 2024: 1 Expense paid, 1 Settlement received")).toBeVisible();
  await expect(day(page, "Mar 23, 2024: nothing")).toHaveAttribute("aria-disabled", "true");
  const summary = calendar(page).getByRole("definition");
  await expect(summary).toHaveText(["$1,123.04", "$150.00", "$0.00"]);

  await calendar(page).getByRole("button", { name: "Next month" }).click();
  await expect(calendar(page).getByRole("heading", { level: 3 })).toHaveText("April 2024");
  await expect(calendar(page)).toContainText("Nothing paid or received by Alex Chen in April 2024.");
  await calendar(page).getByRole("button", { name: "Previous month" }).click();
  await expect(calendar(page).getByRole("heading", { level: 3 })).toHaveText("March 2024");
});

test("tapping a marked day opens Expenses at that day", async ({ page }) => {
  await page.goto("/guest/groups/grp_japan_2024");
  await expect(page.getByRole("button", { name: "Show Expenses", exact: true })).toBeVisible();
  await day(page, /^Mar 24, 2024:/).click();
  await expect(page.getByRole("button", { name: "Hide Expenses", exact: true })).toHaveAttribute("aria-expanded", "true");
  await expect(ledgerDate(page, "2024-03-24")).toBeFocused();
  await expect(ledgerDate(page, "2024-03-24")).toBeInViewport();
});

test("arrow keys move between days and Enter opens one", async ({ page }) => {
  await page.goto("/guest/groups/grp_japan_2024");
  // One tab stop, on the month's first marked day.
  const first = day(page, /^Mar 15, 2024:/);
  await expect(first).toHaveAttribute("tabindex", "0");
  await first.focus();
  await page.keyboard.press("ArrowDown");
  await expect(day(page, /^Mar 22, 2024:/)).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowDown");
  await expect(day(page, /^Mar 24, 2024:/)).toBeFocused();
  // An unmarked day opens nothing.
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Show Expenses", exact: true })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(ledgerDate(page, "2024-03-24")).toBeFocused();
});
