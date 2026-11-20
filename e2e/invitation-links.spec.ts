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

/** The explanation of a used Invitation (the header has its own Sign in link). */
const usedExplanation = (page: Page) => page.getByRole("region", { name: "This Invitation was already used" });

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

/**
 * Maya signs up, creates the Group and adds Dev by email from Group
 * settings, staying there. Answers the link in Dev's Invitation.
 */
async function mayaInvitesDev(page: Page, group: string, devEmail: string): Promise<string> {
  await signUp(page, uniqueEmail(), "Maya Chen");
  await page.getByRole("link", { name: "New Group" }).click();
  await field(page, "Name").fill(group);
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: group })).toBeVisible();
  await page.getByRole("link", { name: "Group settings" }).click();
  await field(page, "Add a Member by name").fill("Dev");
  await field(page, "Email (optional)").fill(devEmail);
  await page.getByRole("button", { name: "Add Member" }).click();
  await expect(page.getByText("Added Dev.")).toBeVisible();
  return linkInEmail(devEmail, new RegExp(`^Maya Chen invited you to ${group}`));
}

test("resending an Invitation makes only the newest link work", async ({ page }) => {
  const devEmail = uniqueEmail();
  const first = await mayaInvitesDev(page, "Flat 3B", devEmail);
  await expect(members(page)).toContainText(`${devEmail} · Pending`);
  await expect(members(page)).toContainText("Invitation sent");

  await page.getByRole("button", { name: "Resend invitation to Dev" }).click();
  await expect(page.getByText(`Sent Dev a new Invitation at ${devEmail}.`)).toBeVisible();
  const second = await linkInEmail(devEmail, /^Maya Chen invited you to Flat 3B/);
  expect(second).not.toBe(first);
  await signOut(page);

  await page.goto(first);
  await expect(page.getByRole("heading", { level: 1, name: "There's a newer Invitation" })).toBeVisible();
  await page.goto(second);
  await expect(page.getByRole("heading", { level: 1, name: "Join Flat 3B" })).toBeVisible();
});

test("removing a Pending Member makes their link explain it was withdrawn", async ({ page }) => {
  const devEmail = uniqueEmail();
  const link = await mayaInvitesDev(page, "Ski trip", devEmail);

  await page.getByRole("button", { name: "Remove Dev" }).click();
  await page.getByRole("button", { name: "Remove Member" }).click();
  await expect(page.getByText("Removed Dev.", { exact: false })).toBeVisible();
  await signOut(page);

  await page.goto(link);
  await expect(page.getByRole("heading", { level: 1, name: "This Invitation was withdrawn" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign up", exact: true })).toHaveCount(0);
});

test("a used link takes the User who claimed it into the Group and tells anyone else it was used", async ({
  page,
}) => {
  const devEmail = uniqueEmail();
  const link = await mayaInvitesDev(page, "Book club", devEmail);
  await signOut(page);
  await page.goto(link);
  await field(page, "Name").fill("Dev Shah");
  await field(page, "Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  // Signed in once the redirect into the Group lands.
  await expect(page).toHaveURL(/\/groups\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Book club" })).toBeVisible();

  // Dev again, signed in: straight back into the Group.
  await page.goto(link);
  await expect(page.getByRole("heading", { level: 1, name: "Book club" })).toBeVisible();

  // Signed out: told it was used, and offered to sign in, which ends in the Group.
  await signOut(page);
  await page.goto(link);
  await expect(page.getByRole("heading", { level: 1, name: "This Invitation was already used" })).toBeVisible();
  await usedExplanation(page).getByRole("link", { name: "Sign in" }).click();
  await field(page, "Email").fill(devEmail);
  await field(page, "Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/groups\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Book club" })).toBeVisible();
  await signOut(page);

  // Someone else: told it was used, and nothing more.
  await signUp(page, uniqueEmail(), "Eve");
  await page.goto(link);
  await expect(page.getByRole("heading", { level: 1, name: "This Invitation was already used" })).toBeVisible();
  await expect(usedExplanation(page).getByRole("link", { name: "Sign in" })).toHaveCount(0);
});
