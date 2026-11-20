import { expect, test, type Page } from "@playwright/test";

/** A fresh email per test so runs never collide in the shared database. */
function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

/**
 * A visible form field by label. Cache Components keeps recently visited
 * pages mounted but hidden, so the same label can exist twice in the DOM.
 */
function field(page: Page, label: string) {
  return page.getByLabel(label, { exact: true }).filter({ visible: true });
}

const userMenu = (page: Page) => page.getByRole("navigation", { name: "User" });

test("a User renames themselves in Account Settings and their Group shows the new name", async ({ page }) => {
  await page.goto("/sign-up");
  await field(page, "Name").fill("Maya Chen");
  await field(page, "Email").fill(uniqueEmail());
  await field(page, "Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: "New Group" }).click();
  await field(page, "Name").fill("Flat 3B");
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Flat 3B" })).toBeVisible();
  const groupUrl = page.url();
  // An Expense, so the Group page names its Payer.
  await page.getByRole("button", { name: "Add the first Expense" }).click();
  await field(page, "Amount (USD)").fill("24.50");
  await field(page, "Description").fill("Ramen");
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(page.getByText("Expense added.")).toBeVisible();

  await userMenu(page).getByRole("link", { name: "Account Settings" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Account Settings" })).toBeVisible();
  await expect(field(page, "Name")).toHaveValue("Maya Chen");

  // A blank name is refused, with the error on the field.
  await field(page, "Name").fill("   ");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("alert", { name: "There is a problem" })).toContainText("Enter your name.");
  await expect(field(page, "Name")).toHaveAccessibleDescription(/^Enter your name\./);

  await field(page, "Name").fill("Maya Rivera");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("status")).toHaveText("Display name saved.");
  await expect(userMenu(page)).toContainText("Maya Rivera");

  await page.goto(groupUrl);
  await expect(page.getByText("Maya Rivera paid in Other")).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("Maya Chen");
});

test("a Guest is offered no Account Settings, and the page sends them to sign in", async ({ page }) => {
  await page.goto("/guest");
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Account Settings" })).toHaveCount(0);

  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in\?/);
});
