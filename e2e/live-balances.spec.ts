import { expect, test, type Page } from "@playwright/test";
import { showSection } from "./group-page";

/** A visible form field by label (hidden cached pages can share labels). */
function field(page: Page, label: string) {
  return page.getByLabel(label, { exact: true }).filter({ visible: true });
}

const samBalance = (page: Page) => page.locator('[data-testid^="balance-"]').filter({ hasText: "Sam Rivera" });

const expenseRow = (page: Page, description: string) =>
  page
    .getByRole("region", { name: "Expenses and Settlements" })
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: description, exact: true }) });

/**
 * Milliseconds from a click on the button named `button` to the Balances
 * changing on screen, timed inside the page so Playwright's own latency
 * doesn't count.
 */
async function msToBalances(page: Page, button: string, act: () => Promise<void>): Promise<number> {
  await page.evaluate((name) => {
    const w = window as unknown as { clickedAt?: number; changedAt?: number };
    w.clickedAt = undefined;
    w.changedAt = undefined;
    const text = () => [...document.querySelectorAll('[data-testid^="balance-"]')].map((e) => e.textContent).join("|");
    const before = text();
    const onClick = (event: MouseEvent) => {
      if ((event.target as Element).closest("button")?.textContent?.trim() !== name) return;
      w.clickedAt = performance.now();
      document.removeEventListener("click", onClick, true);
    };
    document.addEventListener("click", onClick, true);
    new MutationObserver((_, observer) => {
      if (w.clickedAt === undefined || text() === before) return;
      w.changedAt = performance.now();
      observer.disconnect();
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  }, button);
  await act();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { changedAt?: number }).changedAt))
    .toBeDefined();
  return page.evaluate(() => {
    const w = window as unknown as { clickedAt: number; changedAt: number };
    return w.changedAt - w.clickedAt;
  });
}

async function signUpWithGroup(page: Page) {
  await page.goto("/sign-up");
  await field(page, "Name").fill("Maya Chen");
  await field(page, "Email").fill(`e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`);
  await field(page, "Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("link", { name: "New Group" }).click();
  await field(page, "Name").fill("Lunch club");
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Lunch club" })).toBeVisible();
  await page.getByRole("link", { name: "Group settings" }).click();
  await field(page, "Add a Member by name").fill("Sam Rivera");
  await page.getByRole("button", { name: "Add Member" }).click();
  await expect(page.getByRole("region", { name: "Members" }).getByText("Sam Rivera", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to Lunch club" }).click();
}

async function addExpense(page: Page, amount: string, description: string) {
  await page.getByRole("button", { name: /^Add (the first )?Expense$/ }).filter({ visible: true }).first().click();
  await expect(field(page, "Amount (USD)")).toBeFocused();
  await field(page, "Amount (USD)").fill(amount);
  await field(page, "Description").fill(description);
  await page.getByRole("button", { name: "Add Expense", exact: true }).filter({ visible: true }).last().click();
}

test("a signed-in User's Balances change within 500ms of each change", async ({ page }) => {
  await signUpWithGroup(page);

  expect(await msToBalances(page, "Add Expense", () => addExpense(page, "30", "Lunch"))).toBeLessThan(500);
  await expect(samBalance(page)).toContainText("owes $15.00");
  await expect(page.getByText("Expense added.")).toBeVisible();

  await showSection(page, "Expenses");
  await expenseRow(page, "Lunch").getByRole("button", { name: "Lunch", exact: true }).click();
  await field(page, "Amount (USD)").fill("50");
  expect(
    await msToBalances(page, "Save changes", () => page.getByRole("button", { name: "Save changes" }).click()),
  ).toBeLessThan(500);
  await expect(samBalance(page)).toContainText("owes $25.00");
  await expect(page.getByText("Expense updated.")).toBeVisible();

  const settleUp = page.getByRole("region", { name: "Settle up" });
  await settleUp.getByRole("button", { name: "Record: Sam Rivera pays you $25.00" }).click();
  await field(page, "Amount (USD)").fill("5");
  expect(
    await msToBalances(page, "Record Settlement", () =>
      page.getByRole("button", { name: "Record Settlement" }).click(),
    ),
  ).toBeLessThan(500);
  await expect(samBalance(page)).toContainText("owes $20.00");
  await expect(page.getByText("Settlement recorded.", { exact: false })).toBeVisible();

  // Until the server confirms it, the new row is marked as saving and can't be deleted.
  const settlementRow = expenseRow(page, "Settlement: Sam Rivera paid Maya Chen");
  await expect(settlementRow).not.toContainText("Saving…");
  await settlementRow.getByRole("button").click();
  await page.getByRole("dialog", { name: "Settlement" }).getByRole("button", { name: "Delete Settlement" }).click();
  expect(
    await msToBalances(page, "Delete Settlement", () =>
      page.getByRole("alertdialog").getByRole("button", { name: "Delete Settlement" }).click(),
    ),
  ).toBeLessThan(500);
  await expect(samBalance(page)).toContainText("owes $25.00");
  await expect(page.getByText("Deleted the Settlement from Sam Rivera to Maya Chen.")).toBeVisible();

  await expenseRow(page, "Lunch").getByRole("button", { name: "Lunch", exact: true }).click();
  await page.getByRole("button", { name: "Delete Expense" }).click();
  expect(
    await msToBalances(page, "Delete Expense", () =>
      page.getByRole("alertdialog").getByRole("button", { name: "Delete Expense" }).click(),
    ),
  ).toBeLessThan(500);
  await expect(page.getByText("Deleted “Lunch”.")).toBeVisible();
  await expect(samBalance(page)).toHaveCount(0);
});

test("Balances go back when the server refuses a change shown early", async ({ page, context }) => {
  await signUpWithGroup(page);
  await addExpense(page, "20", "Dinner");
  await expect(samBalance(page)).toContainText("owes $10.00");
  await expect(page.getByText("Expense added.")).toBeVisible();

  // Another tab deletes Dinner; this tab still shows it.
  const other = await context.newPage();
  await other.goto(page.url());
  await showSection(other, "Expenses");
  await expenseRow(other, "Dinner").getByRole("button", { name: "Dinner", exact: true }).click();
  await other.getByRole("button", { name: "Delete Expense" }).click();
  await other.getByRole("alertdialog").getByRole("button", { name: "Delete Expense" }).click();
  await expect(other.getByText("Deleted “Dinner”.")).toBeVisible();

  await showSection(page, "Expenses");
  await expenseRow(page, "Dinner").getByRole("button", { name: "Dinner", exact: true }).click();
  await field(page, "Amount (USD)").fill("40");
  // The early Balance may last only as long as the round-trip, so record every one shown.
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { samSeen: string[] }).samSeen = seen;
    new MutationObserver(() =>
      seen.push(
        [...document.querySelectorAll('[data-testid^="balance-"]')]
          .map((e) => e.textContent ?? "")
          .filter((text) => text.includes("Sam Rivera"))
          .join("|"),
      ),
    ).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("This Expense no longer exists. It may have been deleted.")).toBeVisible();
  await expect(samBalance(page)).toContainText("owes $10.00");
  const seen = await page.evaluate(() => (window as unknown as { samSeen: string[] }).samSeen);
  expect(seen.some((text) => text.includes("owes $20.00"))).toBe(true);
});
