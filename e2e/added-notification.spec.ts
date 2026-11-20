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

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Signs up a User with a verified email, then signs them out. */
async function existingUser(page: Page, email: string, name: string) {
  await signUp(page, email, name);
  await page.goto(await linkInEmail(email, /Verify your email/));
  await expect(page.getByRole("heading", { level: 1, name: "Email verified" })).toBeVisible();
  await page.goto("/dashboard");
  await signOut(page);
}

async function createGroup(page: Page, name: string) {
  await page.getByRole("link", { name: "New Group" }).click();
  await field(page, "Name").fill(name);
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

test("an existing User added by email is told, and the link takes them through sign-in into the Group", async ({
  page,
}) => {
  const theoEmail = uniqueEmail();
  await existingUser(page, theoEmail, "Theo Brown");

  await signUp(page, uniqueEmail(), "Maya Chen");
  await createGroup(page, "Flat 3B");
  await page.getByRole("link", { name: "Group settings" }).click();
  await field(page, "Add a Member by name").fill("Theo");
  await field(page, "Email (optional)").fill(theoEmail);
  await page.getByRole("button", { name: "Add Member" }).click();
  await expect(page.getByText("Added Theo Brown.")).toBeVisible();
  // Linked at once: no accept step.
  await expect(members(page)).toContainText(`${theoEmail} · Linked`);
  await signOut(page);

  const link = await linkInEmail(theoEmail, /^Maya Chen added you to Flat 3B on Expense Splitter$/);
  await page.goto(link);
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fgroups%2F/);
  await field(page, "Email").fill(theoEmail);
  await field(page, "Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new URL(link).pathname);
  await expect(page.getByRole("heading", { level: 1, name: "Flat 3B" })).toBeVisible();
});

test("an existing User is told when a Name-only Member is given their email", async ({ page }) => {
  const devEmail = uniqueEmail();
  await existingUser(page, devEmail, "Dev Shah");

  await signUp(page, uniqueEmail(), "Maya Chen");
  await createGroup(page, "Lunch club");
  await page.getByRole("link", { name: "Group settings" }).click();
  await field(page, "Add a Member by name").fill("Dev");
  await page.getByRole("button", { name: "Add Member" }).click();
  await expect(page.getByText("Added Dev.")).toBeVisible();
  await page.getByRole("button", { name: "Add email for Dev" }).click();
  await field(page, "Email").fill(devEmail);
  await page.getByRole("button", { name: "Save email" }).click();
  await expect(members(page)).toContainText(`${devEmail} · Linked`);
  const groupPath = new URL(page.url()).pathname.replace(/\/settings$/, "");

  const link = await linkInEmail(devEmail, /^Maya Chen added you to Lunch club on Expense Splitter$/);
  expect(new URL(link).pathname).toBe(groupPath);
});
