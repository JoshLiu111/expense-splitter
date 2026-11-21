import { expect, test, type Page } from "@playwright/test";
import { showSection } from "./group-page";

/** A visible form field by label (hidden cached pages can share labels). */
function field(page: Page, label: string) {
  return page.getByLabel(label, { exact: true }).filter({ visible: true });
}

const activityEntries = (page: Page) => page.getByRole("main").getByRole("listitem");

function ledgerRow(page: Page, description: string) {
  return page
    .getByRole("region", { name: "Expenses and Settlements" })
    .getByRole("button", { name: description, exact: true });
}

test("a Guest edits an Expense and finds the change, before → after, from View changes", async ({ page }) => {
  await page.goto("/guest/groups/grp_apt_4b");
  await showSection(page, "Expenses");
  await ledgerRow(page, "Cleaning supplies").click();
  await field(page, "Description").fill("Cleaning supplies and sponges");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Expense updated.")).toBeVisible();

  await ledgerRow(page, "Cleaning supplies and sponges").click();
  await page.getByRole("link", { name: "View changes" }).click();
  await expect(page).toHaveURL(/\/guest\/groups\/grp_apt_4b\/activity\?expense=exp_105$/);
  await expect(page.getByRole("heading", { level: 1, name: "Activity" })).toBeVisible();

  // The Guest's own change, newest first, scrolled to and focused.
  const newest = activityEntries(page).first();
  await expect(newest).toBeFocused();
  await expect(newest).toContainText("You edited the Expense Cleaning supplies and sponges");
  await expect(newest.getByRole("term")).toHaveText("Description");
  await expect(newest.getByRole("definition")).toHaveText("changed from Cleaning supplies→ to Cleaning supplies and sponges");
  // Nothing else about it changed, so nothing else is listed.
  await expect(newest.getByRole("term")).toHaveCount(1);
  await expect(newest.getByRole("link")).toHaveCount(0);

  // The seeded entries follow: an edit by a Member, then a deletion.
  await expect(activityEntries(page).nth(1)).toContainText("Casey Brooks edited the Expense February electricity");
  await expect(activityEntries(page).nth(1)).toContainText("Amountchanged from $158.92→ to $168.92");
  const deletion = activityEntries(page).nth(2);
  await expect(deletion).toContainText("Casey Brooks deleted the Expense Paper towels");
  await expect(deletion).toContainText("Amount$8.99");
  await expect(deletion).toContainText("PayerDrew Patel");
  await expect(deletion).toContainText("DateJan 12, 2024");
  await expect(page.getByText("Activity starts on Jan 13, 2024. Earlier changes aren’t listed here.")).toBeVisible();

  // Activity is read-only: no buttons to edit, delete or restore an entry.
  await expect(page.getByRole("main").getByRole("list").getByRole("button")).toHaveCount(0);
});

test("View changes on an Expense from before Activity started says so", async ({ page }) => {
  await page.goto("/guest/groups/grp_apt_4b");
  await showSection(page, "Expenses");
  await ledgerRow(page, "January rent").click();
  await page.getByRole("link", { name: "View changes" }).click();
  await expect(page.getByText("“January rent” has no changes listed.")).toBeVisible();

  await page.getByRole("link", { name: "Back to Apartment 4B" }).click();
  await page.getByRole("link", { name: "Activity" }).click();
  await expect(page).toHaveURL(/\/guest\/groups\/grp_apt_4b\/activity$/);
});

test("a signed-in User's changes, to Expenses, Members, Categories and the Editing Mode, are recorded under their Member, and a new Group has no launch note", async ({
  page,
}) => {
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
  await page.getByRole("button", { name: "Add the first Expense" }).click();
  await field(page, "Amount (USD)").fill("10");
  await field(page, "Description").fill("Milk");
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(page.getByText("Expense added.")).toBeVisible();

  await showSection(page, "Expenses");
  await ledgerRow(page, "Milk").click();
  await page.getByRole("button", { name: "Delete Expense" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete Expense" }).click();
  await expect(page.getByText("Deleted “Milk”.")).toBeVisible();

  await page.getByRole("link", { name: "Group settings" }).click();
  await field(page, "Add a Member by name").fill("Dev Shah");
  await page.getByRole("button", { name: "Add Member" }).click();
  await expect(page.getByText("Added Dev Shah.")).toBeVisible();

  const categories = page.getByRole("region", { name: "Categories" });
  await field(page, "Add a Category").fill("Cleaning");
  await categories.getByRole("button", { name: "Add Category" }).click();
  await expect(page.getByText("Added the Category Cleaning.")).toBeVisible();
  await categories.getByRole("button", { name: "Rename Cleaning" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Cleaning supplies");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByText("Renamed Cleaning to Cleaning supplies.")).toBeVisible();

  const editingMode = page.getByRole("region", { name: "Editing Mode" });
  await editingMode.getByText("Own Records Only", { exact: true }).click();
  await editingMode.getByRole("button", { name: "Save Editing Mode" }).click();
  await expect(page.getByText("Editing Mode saved.")).toBeVisible();
  await page.getByRole("link", { name: "Back to Flat 3B" }).click();

  await page.getByRole("link", { name: "Activity" }).click();
  await expect(activityEntries(page)).toHaveCount(6);
  await expect(activityEntries(page).first()).toContainText(
    "Maya Chen changed the Editing Mode from Open to Own Records Only",
  );
  await expect(activityEntries(page).nth(1)).toContainText("Maya Chen renamed the Category Cleaning to Cleaning supplies");
  await expect(activityEntries(page).nth(2)).toContainText("Maya Chen added the Category Cleaning");
  await expect(activityEntries(page).nth(3)).toContainText("Maya Chen added Dev Shah to the Group");
  await expect(activityEntries(page).nth(4)).toContainText("Maya Chen deleted the Expense Milk");
  await expect(activityEntries(page).nth(5)).toContainText("Maya Chen added the Expense Milk");
  await expect(page.getByText(/Activity starts on/)).toHaveCount(0);
});
