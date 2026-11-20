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

/** A 1×1 PNG: small, but a real image the browser can decode and crop. */
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

test("a User uploads an avatar that shows on their Group, then removes it for their initials", async ({ page }) => {
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
  // Avatars are decorative beside the names they stand for, so find them by their alt text.
  const mayasAvatar = page.locator('img[alt="Maya Chen"]').filter({ visible: true });
  await expect(page.getByText("MC", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(mayasAvatar).toHaveCount(0);

  await userMenu(page).getByRole("link", { name: "Account Settings" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Account Settings" })).toBeVisible();

  // A file that isn't an image is refused, with the error on the field.
  await field(page, "Photo").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
  await page.getByRole("button", { name: "Upload avatar" }).click();
  await expect(page.getByRole("alert", { name: "There is a problem" })).toContainText(
    "Choose a JPEG, PNG or WebP image.",
  );
  await expect(field(page, "Photo")).toHaveAccessibleDescription(/^Choose a JPEG, PNG or WebP image\./);

  await field(page, "Photo").setInputFiles({ name: "maya.png", mimeType: "image/png", buffer: PIXEL_PNG });
  await page.getByRole("button", { name: "Upload avatar" }).click();
  await expect(page.getByRole("status")).toHaveText("Avatar saved.");
  await expect(mayasAvatar).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Replace avatar" })).toBeVisible();

  await page.goto(groupUrl);
  await expect(mayasAvatar.first()).toBeVisible();
  // Cropped and downsized in the browser, and shown over the initials once loaded.
  await expect(mayasAvatar.first()).toHaveJSProperty("naturalWidth", 256);
  await expect(mayasAvatar.first()).toHaveCSS("opacity", "1");

  await page.goto("/account");
  await page.getByRole("button", { name: "Remove avatar" }).click();
  await expect(page.getByRole("status")).toHaveText("Avatar removed.");
  await expect(page.getByRole("button", { name: "Upload avatar" })).toBeVisible();

  await page.goto(groupUrl);
  await expect(page.getByRole("heading", { level: 1, name: "Flat 3B" })).toBeVisible();
  await expect(page.getByText("MC", { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(mayasAvatar).toHaveCount(0);
});

test("a Guest is offered no Account Settings, and the page sends them to sign in", async ({ page }) => {
  await page.goto("/guest");
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Account Settings" })).toHaveCount(0);

  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in\?/);
});
