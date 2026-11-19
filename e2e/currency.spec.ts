import { expect, test, type Page } from "@playwright/test";

// Runs against FIXED_EXCHANGE_RATES: 1 USD = ¥150 = €0.925.

/** A visible form field by label (hidden cached pages can share labels). */
function field(page: Page, label: string) {
  return page.getByLabel(label, { exact: true }).filter({ visible: true });
}

const row = (page: Page, description: string) =>
  page.locator("main ol > li").filter({ has: page.getByRole("heading", { name: description, exact: true }) });

test("S2: a Guest records a yen Expense at today's rate, overrides it, and re-locks on a currency change", async ({
  page,
}) => {
  await page.goto("/guest/groups/grp_birthday");
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await field(page, "Currency").selectOption("JPY");
  await field(page, "Amount (JPY)").fill("84000");
  await field(page, "Description").fill("Ryokan");

  // ¥21,000 each at 1/150 = 0.00666667 USD per yen
  await expect(page.getByTestId("split-preview")).toContainText("¥84,000 split 4 ways = ¥21,000 each");
  await expect(page.getByTestId("converted-preview")).toHaveText("¥84,000 ≈ $560.00");
  await expect(page.getByText("1 JPY = 0.00666667 USD.")).toBeVisible();
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();

  await expect(page.getByText("Expense added.")).toBeVisible();
  await expect(row(page, "Ryokan")).toContainText("¥84,000");
  await expect(row(page, "Ryokan")).toContainText("≈ $560.00");
  await expect(page.getByTestId("balance-mem_olivia")).toContainText("gets back $420.00");

  // A manual rate, to match a card statement.
  await page.getByRole("button", { name: "Ryokan", exact: true }).click();
  await field(page, "Exchange rate (USD per 1 JPY)").fill("0.0067");
  await expect(page.getByTestId("converted-preview")).toHaveText("¥84,000 ≈ $562.80");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(row(page, "Ryokan")).toContainText("1 JPY = 0.0067 USD · manual rate");
  await expect(page.getByTestId("balance-mem_olivia")).toContainText("gets back $422.10");

  // Editing the description keeps the Locked Rate.
  await page.getByRole("button", { name: "Ryokan", exact: true }).click();
  await field(page, "Description").fill("Ryokan, 2 nights");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(row(page, "Ryokan, 2 nights")).toContainText("≈ $562.80");

  // Changing the currency re-locks at today's rate, with a notice.
  await page.getByRole("button", { name: "Ryokan, 2 nights", exact: true }).click();
  await field(page, "Currency").selectOption("EUR");
  await expect(page.getByText("Changing the currency re-locks the rate at today's rate.")).toBeVisible();
  await expect(field(page, "Exchange rate (USD per 1 EUR)")).toHaveValue("");
  await field(page, "Amount (EUR)").fill("520");
  // €130 each at 1/0.925 = 1.08108 USD per euro
  await expect(page.getByTestId("converted-preview")).toHaveText("€520.00 ≈ $562.16");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(row(page, "Ryokan, 2 nights")).toContainText("1 EUR = 1.08108 USD");
  await expect(row(page, "Ryokan, 2 nights")).not.toContainText("manual rate");
});

test("S2: editing a seed Expense keeps its Locked Rate, so past Balances never change", async ({ page }) => {
  await page.goto("/guest/groups/grp_japan_2024");
  await expect(page.getByTestId("balance-mem_alex")).toContainText("gets back $216.46");

  // Today's fixed rate (0.00666667) differs from the seed's 0.0067.
  const firstJpy = page
    .locator("main ol > li")
    .filter({ hasText: "1 JPY = 0.0067 USD" })
    .first();
  const description = (await firstJpy.getByRole("heading").textContent())!;
  await firstJpy.getByRole("button", { name: description, exact: true }).click();
  await expect(page.getByText("This Expense keeps its Locked Rate.")).toBeVisible();
  await field(page, "Description").fill(`${description} (edited)`);
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("Expense updated.")).toBeVisible();
  await expect(row(page, `${description} (edited)`)).toContainText("1 JPY = 0.0067 USD");
  await expect(page.getByTestId("balance-mem_alex")).toContainText("gets back $216.46");
});
