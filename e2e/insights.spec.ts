import { expect, test, type Page } from "@playwright/test";

/** A visible form field by label (hidden cached pages can share labels). */
function field(page: Page, label: string) {
  return page.getByLabel(label, { exact: true }).filter({ visible: true });
}

const timeline = (page: Page) => page.locator("main ol > li");
const insights = (page: Page) => page.getByRole("region", { name: "Insights" });
const categories = (page: Page) => page.getByRole("region", { name: "Categories" });
const settleUp = (page: Page) => page.getByRole("region", { name: "Settle up" });

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

test("S2: Guest adds a Custom Category, files an Expense under it, renames it, and can't delete it while used", async ({
  page,
}) => {
  await page.goto("/guest/groups/grp_apt_4b");
  await field(page, "Add a Category").fill("Cleaning supplies");
  await categories(page).getByRole("button", { name: "Add Category" }).click();
  await expect(page.getByText("Added the Category Cleaning supplies.")).toBeVisible();

  // Only this Group offers it.
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await field(page, "Amount (USD)").fill("12");
  await field(page, "Description").fill("Sponges");
  await field(page, "Category").selectOption({ label: "Cleaning supplies" });
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(page.getByText("Expense added.")).toBeVisible();
  await expect(timeline(page).first()).toContainText("Cleaning supplies");

  await categories(page).getByRole("button", { name: "Rename Cleaning supplies" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Cleaning");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(timeline(page).first()).toContainText("Cleaning ·");
  await expect(categories(page)).toContainText("1 Expense uses Cleaning. Move it to another Category first.");
  await expect(categories(page).getByRole("button", { name: "Delete Cleaning" })).toHaveCount(0);

  await page.goto("/guest/groups/grp_birthday");
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(field(page, "Category").locator("option", { hasText: "Cleaning" })).toHaveCount(0);
});

test("S2: filters combine, use calendar months, and drive the Category breakdown", async ({ page }) => {
  await page.goto("/guest/groups/grp_apt_4b");
  await expect(insights(page)).toContainText("Housing$7,200.0086.0%");

  // The 1 January rent (09:00 UTC) is in January wherever the visitor is.
  await field(page, "Filter by month").selectOption({ label: "January 2024" });
  await expect(field(page, "From date")).toHaveValue("2024-01-01");
  await expect(field(page, "To date")).toHaveValue("2024-01-31");
  await expect(page.getByText("Showing 5 matching Expenses of 10")).toBeVisible();
  await expect(timeline(page).last()).toContainText("January rent");

  await field(page, "Filter by Category").selectOption("Utilities");
  await field(page, "Filter by Member (paid or included)").selectOption({ label: "Drew Patel" });
  await expect(page.getByText("Showing 2 matching Expenses of 10")).toBeVisible();
  await expect(timeline(page)).toHaveCount(2);
  await expect(insights(page)).toContainText("Utilities$222.36100.0%");

  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await expect(timeline(page)).toHaveCount(12);
});

test("S2: charts load with text alternatives", async ({ page }) => {
  await page.goto("/guest/groups/grp_apt_4b");
  for (const name of ["Category share", "Spending over time", "Balance per Member"]) {
    const figure = insights(page).getByRole("figure", { name: new RegExp(name) });
    await expect(figure).toBeVisible();
    await expect(figure.locator("svg").first()).toBeVisible();
    await expect(figure.getByRole("table")).toBeAttached();
  }
  await expect(insights(page).getByRole("figure", { name: /Spending over time/ })).toContainText(
    "Most was spent in February 2024: $4,223.69.",
  );
});

test("S2: each suggestion traces back to its Expenses, and Why these payments? shows before and after", async ({
  page,
}) => {
  await page.goto("/guest/groups/grp_japan_2024");
  const toTaylor = settleUp(page).getByRole("listitem").filter({ hasText: "Sam Rivera pays Taylor Kim" });
  await toTaylor.getByText(/^From “Kyoto ryokan \(2 nights\)” and \d+ other expenses$/).click();
  await expect(toTaylor).toContainText("Taylor Kim paid · Mar 22, 2024$167.50");

  await settleUp(page).getByRole("button", { name: "Why these payments?" }).click();
  const graph = settleUp(page).getByRole("img", { name: /Before Debt Simplification/ });
  await expect(graph).toBeVisible();
  await expect(settleUp(page)).toContainText(/Before: \d payments/);
  await expect(settleUp(page)).toContainText("After: 3 payments");
  // The graph plays from before to after by itself.
  await expect(settleUp(page).getByRole("button", { name: "After", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("Why these payments? waits to be asked before switching", async ({ page }) => {
    await page.goto("/guest/groups/grp_japan_2024");
    await settleUp(page).getByRole("button", { name: "Why these payments?" }).click();
    const before = settleUp(page).getByRole("button", { name: "Before", exact: true });
    await expect(before).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(1200);
    await expect(before).toHaveAttribute("aria-pressed", "true");
    await settleUp(page).getByRole("button", { name: "After", exact: true }).click();
    await expect(settleUp(page).getByRole("button", { name: "After", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

test("a signed-in User's Custom Category is saved to their Group", async ({ page }) => {
  await page.goto("/sign-up");
  await field(page, "Name").fill("Maya Chen");
  await field(page, "Email").fill(uniqueEmail());
  await field(page, "Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("link", { name: "New Group" }).click();
  await field(page, "Name").fill("Flat");
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Flat" })).toBeVisible();

  await field(page, "Add a Category").fill("Pets");
  await categories(page).getByRole("button", { name: "Add Category" }).click();
  await expect(page.getByText("Added the Category Pets.")).toBeVisible();
  await page.reload();
  await expect(categories(page).getByText("Pets", { exact: true })).toBeVisible();

  await categories(page).getByRole("button", { name: "Delete Pets" }).click();
  await page.getByRole("button", { name: "Delete Category" }).click();
  await expect(page.getByText("Deleted the Category Pets.")).toBeVisible();
  await expect(categories(page).getByText("Pets", { exact: true })).toHaveCount(0);
});
