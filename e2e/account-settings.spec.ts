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
  // An Expense, so Maya also shows beside her name in the ledger and Activity.
  await page.getByRole("button", { name: "Add the first Expense" }).click();
  await field(page, "Amount (USD)").fill("24.50");
  await field(page, "Description").fill("Ramen");
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(page.getByText("Expense added.")).toBeVisible();
  // Where her name isn't beside it, as in the Group's and Settle up's avatar stacks,
  // Maya's avatar is named for her; beside her name, as in the ledger, it is decorative.
  const mayasAvatar = page.getByRole("img", { name: "Maya Chen", exact: true }).filter({ visible: true });
  const mayasImage = mayasAvatar.locator("img");
  await expect(mayasAvatar).toHaveCount(2);
  await expect(mayasAvatar).toHaveText(["MC", "MC"]);
  await expect(mayasImage).toHaveCount(0);

  await userMenu(page).getByRole("link", { name: "Account Settings" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Account Settings" })).toBeVisible();
  // The preview stands alone too, so it is named for her.
  await expect(mayasAvatar).toHaveCount(1);

  // A file that isn't an image is refused, with the error on the field.
  await field(page, "Avatar image").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });
  await page.getByRole("button", { name: "Upload avatar" }).click();
  await expect(page.getByRole("alert", { name: "There is a problem" })).toContainText(
    "Choose a JPEG, PNG or WebP image.",
  );
  await expect(field(page, "Avatar image")).toHaveAccessibleDescription(/^Choose a JPEG, PNG or WebP image\./);

  await field(page, "Avatar image").setInputFiles({ name: "maya.png", mimeType: "image/png", buffer: PIXEL_PNG });
  await page.getByRole("button", { name: "Upload avatar" }).click();
  await expect(page.getByRole("status")).toHaveText("Avatar saved.");
  await expect(mayasImage).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Replace avatar" })).toBeVisible();

  await page.goto(groupUrl);
  // Still two avatars named for her: the image adds no name of its own.
  await expect(mayasAvatar).toHaveCount(2);
  // Cropped and downsized in the browser, and shown over the initials once loaded.
  await expect(mayasImage.first()).toHaveJSProperty("naturalWidth", 256);
  await expect(mayasImage.first()).toHaveCSS("opacity", "1");

  // Activity shows it beside her name, as the actor of each change.
  await page.getByRole("link", { name: "Activity" }).click();
  const entry = page.getByRole("main").getByRole("listitem", { name: /^Maya Chen added the Expense Ramen/ });
  await expect(entry.locator("img")).toHaveJSProperty("naturalWidth", 256);
  await expect(mayasAvatar).toHaveCount(0);

  await page.goto("/account");
  await page.getByRole("button", { name: "Remove avatar" }).click();
  await expect(page.getByRole("status")).toHaveText("Avatar removed.");
  await expect(page.getByRole("button", { name: "Upload avatar" })).toBeVisible();

  await page.goto(groupUrl);
  await expect(page.getByRole("heading", { level: 1, name: "Flat 3B" })).toBeVisible();
  await expect(mayasAvatar).toHaveText(["MC", "MC"]);
  await expect(mayasImage).toHaveCount(0);
});

test("a Guest is offered no Account Settings, and the page sends them to sign in", async ({ page }) => {
  await page.goto("/guest");
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Account Settings" })).toHaveCount(0);

  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in\?/);
});
