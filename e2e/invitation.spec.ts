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

/** Maya signs up, creates the Group and adds a Member by email from Group settings. */
async function mayaInvites(page: Page, group: string, name: string, email: string) {
  await signUp(page, uniqueEmail(), "Maya Chen");
  await page.getByRole("link", { name: "New Group" }).click();
  await field(page, "Name").fill(group);
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: group })).toBeVisible();
  await page.getByRole("link", { name: "Group settings" }).click();
  await field(page, "Add a Member by name").fill(name);
  await field(page, "Email (optional)").fill(email);
  await page.getByRole("button", { name: "Add Member" }).click();
  await expect(page.getByText(`Added ${name}.`)).toBeVisible();
  await expect(members(page)).toContainText(`${email} · Pending`);
  await signOut(page);
}

test("an Invitation takes a new User through sign-up straight into the Group", async ({ page }) => {
  const devEmail = uniqueEmail();
  await mayaInvites(page, "Flat 3B", "Dev", devEmail);

  await page.goto(await linkInEmail(devEmail, /^Maya Chen invited you to Flat 3B/));
  await expect(page.getByRole("heading", { level: 1, name: "Join Flat 3B" })).toBeVisible();
  await expect(field(page, "Email")).toHaveValue(devEmail);
  await expect(field(page, "Email")).not.toBeEditable();
  await field(page, "Name").fill("Dev Shah");
  await field(page, "Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up", exact: true }).click();

  // In the Group, as a Linked Member, with nothing left to verify.
  await expect(page).toHaveURL(/\/groups\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Flat 3B" })).toBeVisible();
  await page.getByRole("link", { name: "Group settings" }).click();
  await expect(members(page)).toContainText(`${devEmail} · Linked`);
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /Flat 3B/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verify your email" })).toHaveCount(0);
});

test("an Invitation to an email that already has an account goes through sign-in into the Group", async ({
  page,
}) => {
  const devEmail = uniqueEmail();
  // Dev signed up but never verified, so adding them makes a Pending Member.
  await signUp(page, devEmail, "Dev Shah");
  await signOut(page);
  await mayaInvites(page, "Ski trip", "Dev", devEmail);

  await page.goto(await linkInEmail(devEmail, /^Maya Chen invited you to Ski trip/));
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await field(page, "Email").fill(devEmail);
  await field(page, "Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Ski trip" })).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Verify your email" })).toHaveCount(0);
});
