import { expect, test, type Page } from "@playwright/test";
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

async function addMember(page: Page, name: string, email = "") {
  await field(page, "Add a Member by name").fill(name);
  await field(page, "Email (optional)").fill(email);
  await page.getByRole("button", { name: "Add Member" }).click();
  await expect(page.getByText(`Added ${name}.`)).toBeVisible();
  // Wait for the refreshed Group, so new Splits include them.
  await expect(members(page).getByText(name, { exact: true })).toBeVisible();
}

test("S2: User A adds User B by email; B signs in and sees and edits the Group", async ({ page }) => {
  const bEmail = uniqueEmail();
  await signUp(page, bEmail, "Theo Brown");
  await verifyEmail(page, bEmail);
  await page.goto("/dashboard");
  await signOut(page);

  await signUp(page, uniqueEmail(), "Maya Chen");
  await createGroup(page, "Flat 3B");
  await addMember(page, "Theo", bEmail);
  await expect(members(page)).toContainText(`${bEmail} · Linked`);
  await signOut(page);

  await signIn(page, bEmail);
  await page.getByRole("link", { name: /Flat 3B/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Flat 3B" })).toBeVisible();

  // Theo edits the Group as an equal: records an Expense he paid.
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Theo (you)" })).toBeChecked();
  await field(page, "Amount (USD)").fill("30");
  await field(page, "Description").fill("Cleaning supplies");
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(page.getByText("Expense added.")).toBeVisible();

  // Only the Group Creator can delete the Group.
  await expect(page.getByRole("button", { name: "Delete Group" })).toBeDisabled();
  await expect(page.getByText("Only the Group Creator, Maya Chen, can delete this Group.")).toBeVisible();
});

test("a Pending Member is claimed when that User verifies their email", async ({ page }) => {
  const cEmail = uniqueEmail();
  await signUp(page, uniqueEmail(), "Maya Chen");
  await createGroup(page, "Ski trip");
  await addMember(page, "Chloe", cEmail);
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
  await addMember(page, "Dev");
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await field(page, "Amount (USD)").fill("20");
  await field(page, "Description").fill("Pizza");
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(page.getByText("Expense added.")).toBeVisible();

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
