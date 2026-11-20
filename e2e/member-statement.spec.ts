import { expect, test, type Page } from "@playwright/test";

/** A visible form field by label (hidden cached pages can share labels). */
function field(page: Page, label: string) {
  return page.getByLabel(label, { exact: true }).filter({ visible: true });
}

const balances = (page: Page) => page.getByRole("region", { name: "Balances" });

test("a Guest opens a Member Statement from Balances with the keyboard, and it totals their Balance", async ({
  page,
}) => {
  await page.goto("/guest/groups/grp_japan_2024");
  const row = balances(page).getByRole("button", { name: "Jordan Park owes $219.49. Member Statement" });
  await row.focus();
  await page.keyboard.press("Enter");

  const statement = page.getByRole("dialog", { name: "Jordan Park" });
  await expect(statement).toBeVisible();
  // A foreign-currency Expense Jordan paid: paid and Share in USD, the yen amounts as secondary text,
  // and the leftover yen of the Equal Split noted.
  const snacks = statement.getByTestId("statement-line-exp_006");
  await expect(snacks).toContainText("Fushimi Inari snacks & drinks");
  await expect(snacks).toContainText("Paid $32.50 · Share $8.13");
  await expect(snacks).toContainText("Paid ¥4,850 · Share ¥1,213 · 1 JPY = 0.0067 USD");
  await expect(snacks).toContainText("Includes the Split's Leftover Cent");
  // A Settlement Jordan made.
  await expect(statement.getByTestId("statement-line-stl_001")).toContainText("Paid Alex Chen");
  await expect(statement.getByTestId("statement-line-stl_001")).toContainText("+$150.00");
  // The total is the Balance shown in Balances.
  await expect(statement.getByTestId("member-statement-balance")).toContainText("Jordan Park owes $219.49");

  // Escape closes it and focus returns to the row.
  await page.keyboard.press("Escape");
  await expect(statement).toBeHidden();
  await expect(row).toBeFocused();
});

test("a Statement lists Settlements received, and a settled-up Member has one too", async ({ page }) => {
  await page.goto("/guest/groups/grp_japan_2024");
  await balances(page).getByRole("button", { name: /^Alex Chen gets back/ }).click();
  const alex = page.getByRole("dialog", { name: "Alex Chen" });
  await expect(alex.getByTestId("statement-line-stl_001")).toContainText("Received from Jordan Park");
  await expect(alex.getByTestId("statement-line-stl_001")).toContainText("−$150.00");
  await expect(alex.getByTestId("member-statement-balance")).toContainText("Alex Chen gets back $216.46");
  await alex.getByRole("button", { name: "Close" }).click();

  // Members at zero are named in one line; each name opens their Statement.
  await page.goto("/guest/groups/grp_birthday");
  await expect(page.getByTestId("balances-settled-up")).toHaveText("Settled up: Olivia Hayes, Marcus Webb");
  await balances(page).getByRole("button", { name: "Marcus Webb, Member Statement" }).click();
  await expect(
    page.getByRole("dialog", { name: "Marcus Webb" }).getByTestId("member-statement-balance"),
  ).toContainText("Marcus Webb is settled up");
});

test("a signed-in User opens their own Member Statement", async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  await page.goto("/sign-up");
  await field(page, "Name").fill("Maya Chen");
  await field(page, "Email").fill(email);
  await field(page, "Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: "New Group" }).click();
  await field(page, "Name").fill("Flat 3B");
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Flat 3B" })).toBeVisible();
  await page.getByRole("link", { name: "Group settings" }).click();
  await field(page, "Add a Member by name").fill("Theo Brown");
  await page.getByRole("button", { name: "Add Member" }).click();
  await expect(page.getByRole("region", { name: "Members" }).getByText("Theo Brown", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to Flat 3B" }).click();

  // Maya pays $10.00 split equally: $5.00 each.
  await page.getByRole("button", { name: "Add the first Expense" }).click();
  await field(page, "Amount (USD)").fill("10");
  await field(page, "Description").fill("Milk");
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(page.getByText("Expense added.")).toBeVisible();

  await balances(page).getByRole("button", { name: "Maya Chen gets back $5.00. Member Statement" }).click();
  const statement = page.getByRole("dialog", { name: "Maya Chen (you)" });
  await expect(statement).toContainText("Paid $10.00 · Share $5.00");
  await expect(statement.getByTestId("member-statement-balance")).toContainText("Maya Chen gets back $5.00");
});
