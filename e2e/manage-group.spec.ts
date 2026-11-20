import { expect, test, type Page } from "@playwright/test";

/** A visible form field by label (hidden cached pages can share labels). */
function field(page: Page, label: string) {
  return page.getByLabel(label, { exact: true }).filter({ visible: true });
}

const members = (page: Page) => page.getByRole("region", { name: "Members" });

/** Opens Group settings from the Group page. */
async function openSettings(page: Page) {
  await page.getByRole("link", { name: "Group settings" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Group settings" })).toBeVisible();
}

/** Returns from Group settings to the Group page. */
async function backToGroup(page: Page, name: string) {
  await page.getByRole("link", { name: `Back to ${name}` }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

async function createGuestGroup(page: Page, name: string) {
  await page.goto("/guest/groups/new");
  await field(page, "Name").fill(name);
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

test("the Group page links to Group settings and no longer manages the Group itself", async ({ page }) => {
  await page.goto("/guest/groups/grp_birthday");
  await expect(page.getByRole("heading", { level: 1, name: "Sarah's Birthday Present" })).toBeVisible();
  for (const name of ["Categories", "Members", "Delete Group"]) {
    await expect(page.getByRole("region", { name })).toHaveCount(0);
  }
  await expect(page.getByRole("button", { name: "Edit Group" })).toHaveCount(0);

  await openSettings(page);
  for (const name of ["Details", "Categories", "Members", "Export", "Delete Group"]) {
    await expect(page.getByRole("region", { name })).toBeVisible();
  }
  await backToGroup(page, "Sarah's Birthday Present");
});

test("S1: Guest edits a Group's details; the Group Currency is locked once anything is recorded", async ({
  page,
}) => {
  await page.goto("/guest/groups/grp_birthday");
  await openSettings(page);

  await expect(field(page, "Group Currency")).toBeDisabled();
  await expect(page.getByRole("region", { name: "Details" })).toContainText(
    "The Group Currency can't change once the Group has Expenses or Settlements.",
  );

  await field(page, "Name").fill("Sarah's 30th");
  await field(page, "Description (optional)").fill("Gift and dinner");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Group details saved.")).toBeVisible();

  // Guest changes last the session.
  await page.reload();
  await expect(field(page, "Name")).toHaveValue("Sarah's 30th");
  await expect(field(page, "Description (optional)")).toHaveValue("Gift and dinner");
  await backToGroup(page, "Sarah's 30th");
});

test("S1: Guest changes the Group Currency of a Group with nothing recorded", async ({ page }) => {
  await createGuestGroup(page, "Picnic");
  await openSettings(page);
  await field(page, "Group Currency").selectOption("EUR");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Group details saved.")).toBeVisible();

  await backToGroup(page, "Picnic");
  await page.getByRole("button", { name: "Add the first Expense" }).click();
  await expect(field(page, "Amount (EUR)")).toBeVisible();
});

test("S1: Guest adds a Name-only Member and removes a settled-up one, who stays on past Expenses", async ({
  page,
}) => {
  await page.goto("/guest/groups/grp_birthday");
  await openSettings(page);

  // A Member who owes money can't be removed, and says why.
  await expect(page.getByTestId("member-mem_ben")).toContainText(
    "Ben Gutierrez can't be removed until their Balance is zero.",
  );
  await expect(page.getByRole("button", { name: "Remove Ben Gutierrez" })).toHaveCount(0);

  await field(page, "Add a Member by name").fill("Dev Shah");
  await page.getByRole("button", { name: "Add Member" }).click();
  await expect(page.getByText("Added Dev Shah.")).toBeVisible();
  await expect(members(page).getByText("Dev Shah", { exact: true })).toBeVisible();
  await expect(members(page).getByText("DS", { exact: true })).toBeVisible();

  await field(page, "Add a Member by name").fill("dev shah");
  await page.getByRole("button", { name: "Add Member" }).click();
  await expect(page.getByText("Dev Shah is already a Member of this Group.")).toBeVisible();

  const remove = page.getByRole("button", { name: "Remove Olivia Hayes" });
  await remove.click();
  const confirm = page.getByRole("alertdialog", { name: "Remove Olivia Hayes from the Group?" });
  await expect(confirm).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(remove).toBeFocused();

  await remove.click();
  await confirm.getByRole("button", { name: "Remove Member" }).click();
  await expect(page.getByText("Removed Olivia Hayes.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Members", exact: true })).toBeFocused();
  await expect(members(page).getByRole("heading", { name: "Former Members" })).toBeVisible();

  // Still on the past Expense she paid for...
  await backToGroup(page, "Sarah's Birthday Present");
  const airpods = page.locator("article").filter({ hasText: "AirPods gift" });
  await expect(airpods).toContainText("Olivia Hayes paid");

  // ...but not offered for new Expenses, where the new Member is.
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Olivia Hayes" })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: "Dev Shah" })).toBeChecked();
  await expect(page.getByText("4 of 4 members selected")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).filter({ visible: true }).click();

  // Editing her past Expense still shows her.
  await airpods.getByRole("button", { name: "AirPods gift", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Olivia Hayes" })).toBeChecked();
});

test("S1: only a Settled Up Group can be deleted, after confirmation", async ({ page }) => {
  await page.goto("/guest/groups/grp_birthday");
  await openSettings(page);
  await expect(page.getByRole("button", { name: "Delete Group" })).toBeDisabled();
  await expect(page.getByRole("region", { name: "Delete Group" })).toContainText(
    "Everyone must be Settled Up before this Group can be deleted.",
  );

  await createGuestGroup(page, "Throwaway");
  await openSettings(page);
  const del = page.getByRole("button", { name: "Delete Group" });
  await del.click();
  const confirm = page.getByRole("alertdialog", { name: "Delete “Throwaway”?" });
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(del).toBeFocused();

  await del.click();
  await confirm.getByRole("button", { name: "Delete Group" }).click();
  await expect(page).toHaveURL(/\/guest$/);
  await expect(page.getByRole("link", { name: /Throwaway/ })).toHaveCount(0);
});

test("a signed-in User manages their Group's details and Members, then deletes it", async ({
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
  await field(page, "Name").fill("Book club");
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Book club" })).toBeVisible();

  await openSettings(page);
  await field(page, "Group Currency").selectOption("GBP");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Group details saved.")).toBeVisible();
  await backToGroup(page, "Book club");
  await openSettings(page);
  await expect(field(page, "Group Currency")).toHaveValue("GBP");

  await field(page, "Add a Member by name").fill("Sam Rivera");
  await page.getByRole("button", { name: "Add Member" }).click();
  await expect(members(page).getByText("Sam Rivera", { exact: true })).toBeVisible();
  await page.reload();
  await expect(members(page).getByText("Sam Rivera", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Remove Sam Rivera" }).click();
  await page.getByRole("button", { name: "Remove Member" }).click();
  await expect(members(page).getByRole("heading", { name: "Former Members" })).toBeVisible();

  await page.getByRole("button", { name: "Delete Group" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete Group" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "No Groups yet" })).toBeVisible();
});
