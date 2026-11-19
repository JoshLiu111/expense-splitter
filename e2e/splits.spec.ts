import { expect, test, type Page } from "@playwright/test";

/** A visible form field by label (hidden cached pages can share labels). */
function field(page: Page, label: string) {
  return page.getByLabel(label, { exact: true }).filter({ visible: true });
}

/** Toggles a Member's chip in the Split. */
async function toggleInSplit(page: Page, name: string) {
  await page
    .locator("label")
    .filter({ has: page.getByRole("checkbox", { name, exact: true }) })
    .filter({ visible: true })
    .click();
}

/** Picks a Split Type from the segmented control. */
async function splitBy(page: Page, type: "Equal" | "Exact" | "Percentage" | "Shares") {
  await page
    .locator("label")
    .filter({ has: page.getByRole("radio", { name: type, exact: true }) })
    .filter({ visible: true })
    .click();
}

async function openAddExpense(page: Page) {
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(field(page, "Amount (USD)")).toBeFocused();
}

const preview = (page: Page) => page.getByTestId("split-preview").filter({ visible: true });

test("S1: an Exact Split must add up, shows the difference, and allows $0", async ({ page }) => {
  await page.goto("/guest/groups/grp_birthday");
  await openAddExpense(page);
  await field(page, "Amount (USD)").fill("50");
  await field(page, "Description").fill("Gift wrap");
  await splitBy(page, "Exact");

  await field(page, "Olivia Hayes (USD)").fill("20");
  await field(page, "Ben Gutierrez (USD)").fill("25");
  await expect(preview(page)).toContainText(
    "Shares must add up to $50.00. Currently: $45.00 ($5.00 left to assign).",
  );
  await field(page, "Chloe Yun (USD)").fill("abc");
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();

  const summary = page.getByRole("alert").filter({ hasText: "There is a problem" });
  await expect(summary).toBeFocused();
  await expect(summary).toContainText("Fix the highlighted Shares.");
  // Each error is tied to its field.
  await expect(field(page, "Chloe Yun (USD)")).toHaveAttribute("aria-invalid", "true");
  await expect(field(page, "Chloe Yun (USD)")).toHaveAccessibleDescription(
    "Enter the amount as a number, like 12.50.",
  );

  await field(page, "Chloe Yun (USD)").fill("0");
  await field(page, "Ben Gutierrez (USD)").fill("30");
  await expect(preview(page)).toContainText("Olivia Hayes: $20.00");
  await expect(preview(page)).toContainText("Ben Gutierrez: $30.00");
  await expect(preview(page)).not.toContainText("$0.00");
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();

  await expect(page.getByText("Expense added.")).toBeVisible();
  await expect(page.getByTestId("balance-mem_olivia")).toContainText("gets back $30.00");
  await expect(page.getByTestId("balance-mem_ben")).toContainText("owes $15.63");
  // The $0 Shares (Chloe, and Marcus left blank) aren't shown as owing.
  const row = page.locator("main ol > li").filter({ hasText: "Gift wrap" });
  await expect(row).toContainText("2 members");
  await expect(row).toContainText("Exact amounts");

  // The typed amounts come back on edit.
  await page.getByRole("button", { name: "Gift wrap", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Exact", exact: true })).toBeChecked();
  await expect(field(page, "Olivia Hayes (USD)")).toHaveValue("20.00");
  await expect(field(page, "Ben Gutierrez (USD)")).toHaveValue("30.00");
  await expect(field(page, "Chloe Yun (USD)")).toHaveValue("0.00");
});

test("S1: a Percentage Split names the current total; switching keeps the amount and Members", async ({
  page,
}) => {
  await page.goto("/guest/groups/grp_office_lunch");
  await openAddExpense(page);
  await field(page, "Amount (USD)").fill("100");
  await toggleInSplit(page, "Ethan Nakamura");
  await splitBy(page, "Percentage");
  await field(page, "Mia Torres (%)").fill("50");
  await field(page, "Noah Williams (%)").fill("45");
  await expect(preview(page)).toContainText("Percentages must add up to 100%. Currently: 95%");
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  // The description is blank too, so the summary lists two problems.
  await expect(page.getByRole("alert").filter({ hasText: "There are problems" })).toContainText(
    "Percentages must add up to 100%. Currently: 95%",
  );

  await splitBy(page, "Equal");
  await expect(preview(page)).toContainText("$100.00 split 3 ways = $33.33 to $33.34 each");
  await splitBy(page, "Percentage");
  await expect(field(page, "Amount (USD)")).toHaveValue("100");
  await expect(page.getByText("3 of 4 members selected")).toBeVisible();
  await expect(field(page, "Mia Torres (%)")).toHaveValue("50");

  await field(page, "Priya Sharma (%)").fill("5");
  await expect(preview(page)).toContainText("Mia Torres: $50.00");
  await expect(preview(page)).toContainText("Priya Sharma: $5.00");
});

test("S1: a 2:1 Shares Split gives the first Member two thirds, and reloads on edit", async ({
  page,
}) => {
  await page.goto("/guest/groups/grp_birthday");
  await openAddExpense(page);
  await field(page, "Amount (USD)").fill("10");
  await field(page, "Description").fill("Candles");
  await toggleInSplit(page, "Chloe Yun");
  await toggleInSplit(page, "Marcus Webb");
  await splitBy(page, "Shares");
  await field(page, "Olivia Hayes (shares)").fill("2");
  await expect(field(page, "Ben Gutierrez (shares)")).toHaveValue("1");
  await expect(preview(page)).toContainText("Olivia Hayes: $6.67");
  await expect(preview(page)).toContainText("Ben Gutierrez: $3.33");
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(page.getByText("Expense added.")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Candles", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Shares", exact: true })).toBeChecked();
  await expect(field(page, "Olivia Hayes (shares)")).toHaveValue("2");
  await expect(field(page, "Ben Gutierrez (shares)")).toHaveValue("1");
});

test("a sample Percentage Expense opens with its percentages", async ({ page }) => {
  await page.goto("/guest/groups/grp_office_lunch");
  await page.getByRole("button", { name: "Sushi lunch", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Percentage", exact: true })).toBeChecked();
  await expect(field(page, "Mia Torres (%)")).toHaveValue("30");
  await expect(field(page, "Noah Williams (%)")).toHaveValue("20");
  await expect(preview(page)).toContainText("Mia Torres: $26.76");
});
