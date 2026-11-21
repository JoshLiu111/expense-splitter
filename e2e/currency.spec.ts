import { expect, test, type Page } from "@playwright/test";
import { showSection } from "./group-page";

// Runs against FIXED_EXCHANGE_RATES: 1 USD = ¥150 = €0.925.

/** A visible form field by label (hidden cached pages can share labels). */
function field(page: Page, label: string) {
  return page.getByLabel(label, { exact: true }).filter({ visible: true });
}

const row = (page: Page, description: string) =>
  page.locator("main article").filter({ has: page.getByRole("heading", { name: description, exact: true }) });

/** The row's amounts: Group Currency first, the Expense Currency beneath it. */
const amounts = (group: string, expense: string) => `${group}, paid as ${expense}`;

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
  await showSection(page, "Expenses");
  await expect(row(page, "Ryokan")).toContainText(amounts("$560.00", "¥84,000"));
  // The Locked Rate lives in the editor, not the row.
  await expect(row(page, "Ryokan")).not.toContainText("1 JPY");
  await expect(page.getByTestId("balance-mem_olivia")).toContainText("gets back $420.00");

  // Insights subtotals each currency; only the yen one is converted.
  await showSection(page, "Insights");
  const spent = page.getByRole("list", { name: "Spent per currency" }).getByRole("listitem");
  await expect(spent).toHaveCount(2);
  await expect(spent.first()).toHaveText(/^Spent in USD: \$[\d,]+\.\d\d$/);
  await expect(spent.last()).toHaveText("Spent in JPY: ¥84,000 ≈ $560.00");

  // A manual rate, to match a card statement.
  await page.getByRole("button", { name: "Ryokan", exact: true }).click();
  await field(page, "Exchange rate (USD per 1 JPY)").fill("0.0067");
  await expect(page.getByTestId("converted-preview")).toHaveText("¥84,000 ≈ $562.80");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(row(page, "Ryokan")).toContainText(amounts("$562.80", "¥84,000"));
  await expect(page.getByTestId("balance-mem_olivia")).toContainText("gets back $422.10");

  // Editing the description keeps the Locked Rate.
  await page.getByRole("button", { name: "Ryokan", exact: true }).click();
  await expect(page.getByText("1 JPY = 0.0067 USD (manual).")).toBeVisible();
  await field(page, "Description").fill("Ryokan, 2 nights");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(row(page, "Ryokan, 2 nights")).toContainText(amounts("$562.80", "¥84,000"));

  // Changing the currency re-locks at today's rate, with a notice.
  await page.getByRole("button", { name: "Ryokan, 2 nights", exact: true }).click();
  await field(page, "Currency").selectOption("EUR");
  await expect(page.getByText("Changing the currency re-locks the rate at today's rate.")).toBeVisible();
  await expect(field(page, "Exchange rate (USD per 1 EUR)")).toHaveValue("");
  await field(page, "Amount (EUR)").fill("520");
  // €130 each at 1/0.925 = 1.08108 USD per euro
  await expect(page.getByTestId("converted-preview")).toHaveText("€520.00 ≈ $562.16");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(row(page, "Ryokan, 2 nights")).toContainText(amounts("$562.16", "€520.00"));
  await page.getByRole("button", { name: "Ryokan, 2 nights", exact: true }).click();
  await expect(page.getByText("1 EUR = 1.08108 USD.")).toBeVisible();
});

test("S2: editing a seed Expense keeps its Locked Rate, so past Balances never change", async ({ page }) => {
  await page.goto("/guest/groups/grp_japan_2024");
  await expect(page.getByTestId("balance-mem_alex")).toContainText("gets back $216.46");

  // Today's fixed rate (0.00666667) differs from the seed's 0.0067.
  const description = "Kyoto ryokan (2 nights)";
  await showSection(page, "Expenses");
  await page.getByRole("button", { name: description, exact: true }).click();
  await expect(page.getByText("1 JPY = 0.0067 USD.")).toBeVisible();
  await expect(page.getByText("This Expense keeps its Locked Rate.")).toBeVisible();
  await field(page, "Description").fill(`${description} (edited)`);
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("Expense updated.")).toBeVisible();
  await expect(row(page, `${description} (edited)`)).toContainText(amounts("$804.00", "¥120,000"));
  await expect(page.getByTestId("balance-mem_alex")).toContainText("gets back $216.46");
});

test("S2: a Guest records a Suggested Settlement in yen, prefilled at today's rate, and sees both amounts", async ({
  page,
}) => {
  await page.goto("/guest/groups/new");
  await field(page, "Name").fill("Tokyo");
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Tokyo" })).toBeVisible();
  await page.getByRole("link", { name: "Group settings" }).click();
  await field(page, "Add a Member by name").fill("Taylor");
  await page.getByRole("button", { name: "Add Member" }).click();
  await expect(page.getByRole("region", { name: "Members" }).getByText("Taylor", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to Tokyo" }).click();

  // Taylor paid $60 shared by You and Taylor: you owe Taylor $30.
  await page.getByRole("button", { name: "Add the first Expense" }).click();
  await field(page, "Amount (USD)").fill("60");
  await field(page, "Description").fill("Sushi");
  await page.locator("label").filter({ has: page.getByRole("radio", { name: "Taylor", exact: true }) }).click();
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(page.getByText("Expense added.")).toBeVisible();

  await page.getByRole("button", { name: "Record: you pay Taylor $30.00" }).click();
  const dialog = page.getByRole("dialog", { name: "Record a Settlement" });
  await expect(field(page, "Amount (USD)")).toHaveValue("30.00");

  // In yen, the amount follows today's rate: ¥4,500 at 0.00666667 is $30.00.
  await field(page, "Currency").selectOption("JPY");
  await expect(field(page, "Amount (JPY)")).toHaveValue("4500");
  await expect(dialog.getByText("1 JPY = 0.00666667 USD.")).toBeVisible();
  await expect(dialog).toContainText("$30.00 at this rate. After this, You will be settled up.");

  // A rate typed by hand re-derives it: ¥4,478 at 0.0067 is $30.00.
  await field(page, "Exchange rate (USD per 1 JPY)").fill("0.0067");
  await expect(field(page, "Amount (JPY)")).toHaveValue("4478");
  await dialog.getByRole("button", { name: "Record Settlement" }).click();

  await expect(page.getByText("Settlement recorded. You will be settled up.")).toBeVisible();
  await expect(settleUpRegion(page)).toContainText("Everyone is Settled Up");
  await showSection(page, "Expenses");
  const settlement = page
    .locator("main article")
    .filter({ has: page.getByRole("heading", { name: "Settlement: You paid Taylor", exact: true }) });
  await expect(settlement).toContainText(amounts("$30.00", "¥4,478"));
  await settlement.getByRole("button").click();
  await expect(page.getByRole("dialog", { name: "Settlement" })).toContainText(
    "You paid Taylor ¥4,478 ≈ $30.00 on",
  );
  await expect(page.getByRole("dialog", { name: "Settlement" })).toContainText("Locked Rate: 1 JPY = 0.0067 USD (manual).");
  await page.keyboard.press("Escape");

  await page.getByRole("link", { name: "Activity" }).click();
  const recorded = page.getByRole("main").getByRole("listitem").first();
  await expect(recorded).toContainText("You recorded a Settlement: You paid Taylor");
  await expect(recorded).toContainText("Amount¥4,478 ≈ $30.00");
  await expect(recorded).toContainText("Locked Rate0.0067 (manual)");
});

const settleUpRegion = (page: Page) => page.getByRole("region", { name: "Settle up" });
