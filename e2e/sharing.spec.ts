import { expect, test, type Page } from "@playwright/test";
import { GROUP_PAGE_SECTIONS, showSection } from "./group-page";
import { linkInEmail } from "./outbox";

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

const PASSWORD = "correct-horse-battery";

/** A visible form field by label (hidden cached pages can share labels). */
function field(page: Page, label: string) {
  return page.getByLabel(label, { exact: true }).filter({ visible: true });
}

const members = (page: Page) => page.getByRole("region", { name: "Members" });

/** The ledger row of Theo's Settlement to Maya of this amount. */
function settlementRow(page: Page, amount: string) {
  return page
    .getByRole("region", { name: "Expenses and Settlements" })
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Settlement: Theo Brown paid Maya Chen", exact: true }) })
    .filter({ hasText: amount });
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

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await field(page, "Email").fill(email);
  await field(page, "Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Follows the emailed verification link, as the User would. */
async function verifyEmail(page: Page, email: string) {
  await page.goto(await linkInEmail(email, /Verify your email/));
  await expect(page.getByRole("heading", { level: 1, name: "Email verified" })).toBeVisible();
}

async function createGroup(page: Page, name: string) {
  await page.getByRole("link", { name: "New Group" }).click();
  await field(page, "Name").fill(name);
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

/**
 * Adds a Member from Group settings, then returns to the Group. A Member
 * linked to a User is shown, and announced, under that User's name, `shownAs`.
 */
async function addMember(page: Page, group: string, name: string, email = "", shownAs = name) {
  await page.getByRole("link", { name: "Group settings" }).click();
  await field(page, "Add a Member by name").fill(name);
  await field(page, "Email (optional)").fill(email);
  await page.getByRole("button", { name: "Add Member" }).click();
  await expect(page.getByText(`Added ${shownAs}.`)).toBeVisible();
  // Wait for the refreshed Group, so new Splits include them.
  await expect(members(page).getByText(shownAs, { exact: true })).toBeVisible();
  await page.getByRole("link", { name: `Back to ${group}` }).click();
  await expect(page.getByRole("heading", { level: 1, name: group })).toBeVisible();
}

test("S2: User A adds User B by email; B signs in and sees and edits the Group", async ({ page }) => {
  const bEmail = uniqueEmail();
  await signUp(page, bEmail, "Theo Brown");
  await verifyEmail(page, bEmail);
  await page.goto("/dashboard");
  await signOut(page);

  await signUp(page, uniqueEmail(), "Maya Chen");
  await createGroup(page, "Flat 3B");
  await addMember(page, "Flat 3B", "Theo", bEmail, "Theo Brown");
  await page.getByRole("link", { name: "Group settings" }).click();
  await expect(members(page)).toContainText(`${bEmail} · Linked`);
  await signOut(page);

  await signIn(page, bEmail);
  await page.getByRole("link", { name: /Flat 3B/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Flat 3B" })).toBeVisible();

  // Theo edits the Group as an equal: records an Expense he paid.
  await page.getByRole("button", { name: "Add the first Expense" }).click();
  await expect(page.getByRole("radio", { name: "Theo Brown (you)" })).toBeChecked();
  await field(page, "Amount (USD)").fill("30");
  await field(page, "Description").fill("Cleaning supplies");
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(page.getByText("Expense added.")).toBeVisible();

  // Only the Group Creator can delete the Group.
  await page.getByRole("link", { name: "Group settings" }).click();
  await expect(page.getByRole("button", { name: "Delete Group" })).toBeDisabled();
  await expect(page.getByText("Only the Group Creator, Maya Chen, can delete this Group.")).toBeVisible();
});

test("S2: a removed User whose Balance reopens reads the Group until it is settled (ADR 0006)", async ({ page }) => {
  // Two Users, four sign-ins: a long journey.
  test.slow();
  const bEmail = uniqueEmail();
  const aEmail = uniqueEmail();
  await signUp(page, bEmail, "Theo Brown");
  await verifyEmail(page, bEmail);
  await page.goto("/dashboard");
  await signOut(page);

  // Maya pays $30 for both; Theo pays back his $15 in two parts, so he can be removed at zero.
  await signUp(page, aEmail, "Maya Chen");
  await createGroup(page, "Flat 3B");
  await addMember(page, "Flat 3B", "Theo", bEmail, "Theo Brown");
  await page.getByRole("button", { name: "Add the first Expense" }).click();
  await field(page, "Amount (USD)").fill("30");
  await field(page, "Description").fill("Groceries");
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(page.getByText("Expense added.")).toBeVisible();
  await page.getByRole("button", { name: "Record: Theo Brown pays you $15.00" }).click();
  await field(page, "Amount (USD)").fill("10");
  await page.getByRole("button", { name: "Record Settlement" }).click();
  await expect(page.getByText("Settlement recorded.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Record: Theo Brown pays you $5.00" }).click();
  await page.getByRole("button", { name: "Record Settlement" }).click();
  await expect(page.getByRole("region", { name: "Settle up" })).toContainText("Everyone is Settled Up");
  await page.getByRole("link", { name: "Group settings" }).click();
  await page.getByRole("button", { name: "Remove Theo Brown" }).click();
  await page
    .getByRole("alertdialog", { name: "Remove Theo Brown from the Group?" })
    .getByRole("button", { name: "Remove Member" })
    .click();
  await expect(page.getByText("Removed Theo Brown.")).toBeVisible();
  await page.getByRole("link", { name: "Back to Flat 3B" }).click();

  // Deleting his $5 Settlement reopens Theo's Balance.
  await showSection(page, "Expenses");
  await settlementRow(page, "$5.00").getByRole("button").click();
  await page.getByRole("dialog", { name: "Settlement" }).getByRole("button", { name: "Delete Settlement" }).click();
  await page
    .getByRole("alertdialog", { name: "Delete this Settlement?" })
    .getByRole("button", { name: "Delete Settlement" })
    .click();
  await expect(page.getByTestId(/^balance-/).filter({ hasText: "Theo Brown (Former Member)" })).toContainText("$5.00");
  await signOut(page);

  // Theo sees the Group again, marked read-only.
  await signIn(page, bEmail);
  const listed = page.getByRole("link", { name: /Flat 3B/ });
  await expect(listed).toContainText("Read-only");
  await expect(listed).toContainText("$5.00");
  await listed.click();
  await expect(page.getByRole("heading", { level: 1, name: "Flat 3B" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("You were removed from this Group");
  await expect(page.getByRole("region", { name: "Settle up" })).toContainText("You pay Maya Chen");
  await expect(page.getByRole("region", { name: "Settle up" })).toContainText("$5.00");
  await expect(page.getByRole("button", { name: /^Record/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add Expense" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Group settings" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Activity" })).toBeVisible();
  // The same order, collapsed, read-only.
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(GROUP_PAGE_SECTIONS);
  // Rows still state each Expense and Settlement, but change nothing.
  await showSection(page, "Expenses");
  await expect(page.getByRole("button", { name: /Groceries/ })).toHaveCount(0);
  await settlementRow(page, "$10.00").getByRole("button").click();
  await expect(page.getByRole("dialog", { name: "Settlement" })).toContainText("Theo Brown paid Maya Chen $10.00");
  await expect(page.getByRole("button", { name: "Delete Settlement" })).toHaveCount(0);
  await page.getByRole("dialog", { name: "Settlement" }).getByRole("button", { name: "Close" }).click();
  // His Member Statement itemises the reopened Balance.
  await page.getByTestId(/^balance-/).filter({ hasText: "Theo Brown (Former Member)" }).getByRole("button").click();
  await expect(page.getByRole("dialog", { name: /Theo Brown/ }).getByTestId("member-statement-balance")).toContainText("$5.00");
  await page.getByRole("dialog", { name: /Theo Brown/ }).getByRole("button", { name: "Close" }).click();
  // Group settings send him back to the Group.
  const groupUrl = page.url();
  await page.goto(`${groupUrl}/settings`);
  await expect(page).toHaveURL(groupUrl);
  await signOut(page);

  // Maya records the Settlement; the Group leaves Theo's list.
  await signIn(page, aEmail);
  await page.getByRole("link", { name: /Flat 3B/ }).click();
  await page.getByRole("button", { name: "Record: Theo Brown pays you $5.00" }).click();
  await page.getByRole("button", { name: "Record Settlement" }).click();
  await expect(page.getByRole("region", { name: "Settle up" })).toContainText("Everyone is Settled Up");
  await signOut(page);
  await signIn(page, bEmail);
  await expect(page.getByRole("heading", { name: "No Groups yet" })).toBeVisible();
});

test("a Pending Member is claimed when that User verifies their email", async ({ page }) => {
  const cEmail = uniqueEmail();
  await signUp(page, uniqueEmail(), "Maya Chen");
  await createGroup(page, "Ski trip");
  await addMember(page, "Ski trip", "Chloe", cEmail);
  await page.getByRole("link", { name: "Group settings" }).click();
  await expect(members(page)).toContainText(`${cEmail} · Pending`);
  await signOut(page);

  // Chloe can use the app before verifying, but isn't linked yet.
  await signUp(page, cEmail, "Chloe Park");
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Ski trip/ })).toHaveCount(0);

  await verifyEmail(page, cEmail);
  await page.getByRole("link", { name: "Go to Your Groups" }).click();
  await expect(page.getByRole("link", { name: /Ski trip/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verify your email" })).toHaveCount(0);
});

test("a Name-only Member given an email keeps their history and is linked", async ({ page }) => {
  const dEmail = uniqueEmail();
  await signUp(page, dEmail, "Dev Shah");
  await verifyEmail(page, dEmail);
  await page.goto("/dashboard");
  await signOut(page);

  await signUp(page, uniqueEmail(), "Maya Chen");
  await createGroup(page, "Lunch club");
  await addMember(page, "Lunch club", "Dev");
  await page.getByRole("button", { name: "Add the first Expense" }).click();
  await field(page, "Amount (USD)").fill("20");
  await field(page, "Description").fill("Pizza");
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(page.getByText("Expense added.")).toBeVisible();

  await page.getByRole("link", { name: "Group settings" }).click();
  await page.getByRole("button", { name: "Add email for Dev" }).click();
  await field(page, "Email").fill(dEmail);
  await page.getByRole("button", { name: "Save email" }).click();
  await expect(members(page)).toContainText(`${dEmail} · Linked`);
  await signOut(page);

  await signIn(page, dEmail);
  const group = page.getByRole("link", { name: /Lunch club/ });
  await expect(group).toContainText("1 expense");
  // Dev's history came with him: he owes half the Pizza.
  await expect(group).toContainText("owes");
  await expect(group).toContainText("$10.00");
});

test("a User resets a forgotten password from the emailed link", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email, "Maya Chen");
  await signOut(page);

  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Reset your password" })).toBeVisible();
  await field(page, "Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status").filter({ hasText: "we've sent it a link" })).toBeVisible();

  await page.goto(await linkInEmail(email, /Reset your/));
  await expect(page.getByRole("heading", { level: 1, name: "Choose a new password" })).toBeVisible();
  await field(page, "New password").fill("a-brand-new-password");
  await page.getByRole("button", { name: "Save new password" }).click();

  await expect(page.getByText("Your password has been changed.")).toBeVisible();
  await signIn(page, email, "a-brand-new-password");

  // The link works only once.
  await page.goto(await linkInEmail(email, /Reset your/));
  await expect(page.getByText("This reset link has expired or was already used.")).toBeVisible();
});
