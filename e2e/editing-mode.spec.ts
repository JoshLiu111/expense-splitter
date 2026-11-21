import { expect, test, type Page } from "@playwright/test";
import { showSection } from "./group-page";
import { linkInEmail } from "./outbox";

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

const PASSWORD = "correct-horse-battery";

/** A visible form field by label (hidden cached pages can share labels). */
function field(page: Page, label: string) {
  return page.getByLabel(label, { exact: true }).filter({ visible: true });
}

async function signUp(page: Page, email: string, name: string) {
  await page.goto("/sign-up");
  await expect(page.getByRole("heading", { level: 1, name: "Sign up" })).toBeVisible();
  await field(page, "Name").fill(name);
  await field(page, "Email").fill(email);
  await field(page, "Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await field(page, "Email").fill(email);
  await field(page, "Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function addExpense(page: Page, description: string, amount: string) {
  await page.getByRole("button", { name: /^Add (the first )?Expense$/ }).first().click();
  await field(page, "Amount (USD)").fill(amount);
  await field(page, "Description").fill(description);
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(page.getByText("Expense added.")).toBeVisible();
}

/** Opens an Expense from its ledger row. */
async function openExpense(page: Page, description: string) {
  await page
    .getByRole("region", { name: "Expenses and Settlements" })
    .getByRole("button", { name: description, exact: true })
    .click();
}

test("in Own Records Only, a second Member can't edit the first Member's Expense but can edit their own", async ({
  page,
}) => {
  // Two Users, three sign-ins.
  test.slow();
  const theoEmail = uniqueEmail();
  await signUp(page, theoEmail, "Theo Brown");
  await page.goto(await linkInEmail(theoEmail, /Verify your email/));
  await expect(page.getByRole("heading", { level: 1, name: "Email verified" })).toBeVisible();
  await page.goto("/dashboard");
  await signOut(page);

  // Maya creates the Group, adds Theo, records an Expense and restricts editing.
  await signUp(page, uniqueEmail(), "Maya Chen");
  await page.getByRole("link", { name: "New Group" }).click();
  await field(page, "Name").fill("Flat 3B");
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Flat 3B" })).toBeVisible();
  await page.getByRole("link", { name: "Group settings" }).click();
  await field(page, "Add a Member by name").fill("Theo");
  await field(page, "Email (optional)").fill(theoEmail);
  await page.getByRole("button", { name: "Add Member" }).click();
  await expect(page.getByText("Added Theo Brown.")).toBeVisible();
  const editingMode = page.getByRole("region", { name: "Editing Mode" });
  await expect(editingMode.getByRole("radio", { name: "Open" })).toBeChecked();
  await editingMode.getByText("Own Records Only", { exact: true }).click();
  await editingMode.getByRole("button", { name: "Save Editing Mode" }).click();
  await expect(page.getByText("Editing Mode saved.")).toBeVisible();
  await page.getByRole("link", { name: "Back to Flat 3B" }).click();
  await addExpense(page, "Groceries", "40");
  await signOut(page);

  await signIn(page, theoEmail);
  await page.getByRole("link", { name: /Flat 3B/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Flat 3B" })).toBeVisible();
  await addExpense(page, "Cleaning supplies", "30");
  await showSection(page, "Expenses");

  // Maya's Expense opens read-only, saying why.
  await openExpense(page, "Groceries");
  await expect(
    page.getByText(
      "This Group is set to Own Records Only: only the Group Creator, Maya Chen, who recorded this Expense, can edit it.",
    ),
  ).toBeVisible();
  await expect(field(page, "Amount (USD)")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete Expense" })).toHaveCount(0);
  await page.getByRole("button", { name: "Close", exact: true }).filter({ visible: true }).first().click();

  // His own he edits as before.
  await openExpense(page, "Cleaning supplies");
  await field(page, "Amount (USD)").fill("36");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Expense updated.")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Expenses and Settlements" }).getByRole("article").filter({ hasText: "Cleaning supplies" }),
  ).toContainText("$36.00");

  // Every Member sees the Editing Mode; only the Group Creator changes it.
  await page.getByRole("link", { name: "Group settings" }).click();
  const seen = page.getByRole("region", { name: "Editing Mode" });
  await expect(seen.getByRole("radio", { name: "Own Records Only" })).toBeChecked();
  await expect(seen.getByRole("radio", { name: "Open" })).toBeDisabled();
  await expect(seen).toContainText("Only the Group Creator, Maya Chen, can change the Editing Mode.");
});
