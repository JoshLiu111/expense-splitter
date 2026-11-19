import { expect, test, type Page } from "@playwright/test";

/** A visible form field by label (hidden cached pages can share labels). */
function field(page: Page, label: string) {
  return page.getByLabel(label, { exact: true }).filter({ visible: true });
}

/** Toggles a Member's chip in the Split. */
async function toggleInSplit(page: Page, name: string) {
  // Click the chip a person sees: the label around the visually hidden checkbox.
  await page
    .locator("label")
    .filter({ has: page.getByRole("checkbox", { name, exact: true }) })
    .filter({ visible: true })
    .click();
}

async function openAddExpense(page: Page) {
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  // Amount comes first and takes focus.
  await expect(field(page, "Amount (USD)")).toBeFocused();
}

test("S2: Guest adds an Equal Expense and sees Balances change", async ({ page }) => {
  await page.goto("/guest/groups/grp_birthday");
  await expect(page.getByTestId("balances-settled-up")).toContainText("Olivia Hayes");
  await expect(page.getByTestId("balance-mem_ben")).toContainText("gets back $14.37");

  await openAddExpense(page);
  await field(page, "Amount (USD)").fill("60");
  await field(page, "Description").fill("Cake");

  // Fast path: everyone is in; the first Member pays.
  await expect(page.getByRole("radio", { name: "Olivia Hayes" })).toBeChecked();
  await expect(page.getByText("4 of 4 members selected")).toBeVisible();
  await expect(page.getByTestId("split-preview")).toHaveText("$60.00 split 4 ways = $15.00 each");

  await toggleInSplit(page, "Marcus Webb");
  await expect(page.getByText("3 of 4 members selected")).toBeVisible();
  await expect(page.getByTestId("split-preview")).toHaveText("$60.00 split 3 ways = $20.00 each");

  await page.getByRole("button", { name: "Add Expense", exact: true }).click();

  await expect(page.getByText("Expense added.")).toBeVisible();
  await expect(page.getByTestId("balance-mem_olivia")).toContainText("gets back $40.00");
  await expect(page.getByTestId("balance-mem_ben")).toContainText("owes $5.63");
  await expect(page.getByTestId("balance-mem_chloe")).toContainText("owes $34.37");
  await expect(page.getByTestId("balances-settled-up")).toHaveText("Settled up: Marcus Webb");
  await expect(page.getByRole("status")).toContainText(
    "Balances updated. Olivia Hayes gets back $40.00. Ben Gutierrez owes $5.63.",
  );
  // Today's Expense is the newest, so it heads the list.
  const newest = page.locator("main article").first();
  await expect(newest).toContainText("Cake");
  await expect(newest).toContainText("Olivia Hayes paid in Other");
  await expect(newest).toContainText("$60.00");

  // Kept for the rest of the browser session.
  await page.reload();
  await expect(page.getByTestId("balance-mem_olivia")).toContainText("gets back $40.00");
});

test("$100 split 3 ways leaves the Leftover Cent with the first Member", async ({ page }) => {
  await page.goto("/guest/groups/grp_office_lunch");
  await openAddExpense(page);
  await field(page, "Amount (USD)").fill("100");
  await toggleInSplit(page, "Ethan Nakamura");
  const preview = page.getByTestId("split-preview");
  await expect(preview).toContainText("$100.00 split 3 ways = $33.33 to $33.34 each");
  await expect(preview).toContainText("Mia Torres: $33.34");
  await expect(preview).toContainText("Noah Williams: $33.33");
  await expect(preview).toContainText("Priya Sharma: $33.33");
});

test("a Guest edits and then deletes an Expense, and Balances recompute", async ({ page }) => {
  await page.goto("/guest/groups/grp_birthday");
  await openAddExpense(page);
  await field(page, "Amount (USD)").fill("40");
  await field(page, "Description").fill("Balloons");
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(page.getByTestId("balance-mem_olivia")).toContainText("gets back $30.00");

  // A new Expense can't be deleted.
  await openAddExpense(page);
  await expect(page.getByRole("button", { name: "Delete Expense" })).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel" }).click();

  // The row carries no buttons of its own; the whole row opens the editor.
  const row = page
    .getByRole("region", { name: "Expenses and Settlements" })
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Balloons", exact: true }) });
  await expect(row.getByRole("button")).toHaveCount(1);
  await row.getByRole("button", { name: "Balloons", exact: true }).click();
  await expect(field(page, "Amount (USD)")).toHaveValue("40.00");
  await field(page, "Amount (USD)").fill("80");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Expense updated.")).toBeVisible();
  await expect(page.getByTestId("balance-mem_olivia")).toContainText("gets back $60.00");

  // Delete lives in the editor and is confirmed first. The row is reachable by keyboard.
  await row.getByRole("button", { name: "Balloons", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Delete Expense" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Delete this Expense?" });
  await expect(confirm).toContainText("$80.00");
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByTestId("balance-mem_olivia")).toContainText("gets back $60.00");

  await page.getByRole("button", { name: "Delete Expense" }).click();
  await confirm.getByRole("button", { name: "Delete Expense" }).click();
  await expect(page.getByText("Deleted “Balloons”.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Expenses and Settlements" })).toBeFocused();
  await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
  await expect(page.getByTestId("balances-settled-up")).toContainText("Olivia Hayes");
  await expect(page.getByRole("status")).toContainText("Balances updated.");
  await expect(page.getByRole("heading", { name: "Balloons", exact: true })).toHaveCount(0);
});

test("the Expense form explains every problem", async ({ page }) => {
  await page.goto("/guest/groups/grp_birthday");
  await openAddExpense(page);
  await field(page, "Amount (USD)").fill("12.345");
  await expect(page.getByText("USD amounts can have at most 2 decimal places.")).toBeVisible();
  await field(page, "Amount (USD)").fill("");
  for (const name of ["Olivia Hayes", "Ben Gutierrez", "Chloe Yun", "Marcus Webb"]) {
    await toggleInSplit(page, name);
  }
  await expect(page.getByText("0 of 4 members selected")).toBeVisible();
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();

  const summary = page.getByRole("alert").filter({ hasText: "There are problems" });
  await expect(summary).toBeFocused();
  await expect(summary).toContainText("Enter an amount.");
  await expect(summary).toContainText("Describe what the Expense was for.");
  await expect(summary).toContainText("Choose at least one member to split with.");
});

test("Expense entry is an inline panel on desktop and a bottom sheet on phones", async ({
  page,
  isMobile,
}) => {
  await page.goto("/guest/groups/grp_birthday");
  await openAddExpense(page);
  if (isMobile) {
    await expect(page.getByRole("dialog", { name: "Add Expense" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add Expense", exact: true })).toBeFocused();
  } else {
    await expect(page.getByRole("region", { name: "Add Expense" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});

test("member chips are at least 44px tall", async ({ page }) => {
  await page.goto("/guest/groups/grp_birthday");
  await openAddExpense(page);
  const chip = page.locator("label").filter({ hasText: "Ben Gutierrez" }).filter({ visible: true }).first();
  const box = await chip.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});
