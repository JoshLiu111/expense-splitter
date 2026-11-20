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

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await field(page, "Email").fill(email);
  await field(page, "Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("a User changes their password: this browser stays signed in, others are signed out", async ({
  page,
  browser,
}) => {
  const email = uniqueEmail();
  await page.goto("/sign-up");
  await field(page, "Name").fill("Maya Chen");
  await field(page, "Email").fill(email);
  await field(page, "Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // The same User, signed in on another device.
  const elsewhere = await (await browser.newContext()).newPage();
  await signIn(elsewhere, email, "correct-horse-battery");
  await expect(elsewhere).toHaveURL(/\/dashboard$/);

  await page.goto("/account");
  const save = page.getByRole("button", { name: "Change password" });

  // A wrong current password is named as such, on its field.
  await field(page, "Current password").fill("not-my-password");
  await field(page, "New password").fill("a-brand-new-one");
  await save.click();
  await expect(field(page, "Current password")).toHaveAccessibleDescription(/^That isn't your current password\./);

  // The new password keeps to the sign-up rules.
  await field(page, "Current password").fill("correct-horse-battery");
  await field(page, "New password").fill("short");
  await save.click();
  await expect(field(page, "New password")).toHaveAccessibleDescription(
    /^Use a password of at least 8 characters\./,
  );

  await field(page, "New password").fill("a-brand-new-one");
  await save.click();
  await expect(page.getByRole("status")).toHaveText("Password changed. Your other sessions are signed out.");
  await expect(field(page, "Current password")).toHaveValue("");

  // This browser is still signed in; the other device is not.
  await page.goto("/account");
  await expect(page.getByRole("heading", { level: 1, name: "Account Settings" })).toBeVisible();
  await elsewhere.goto("/account");
  await expect(elsewhere).toHaveURL(/\/sign-in\?/);

  await signIn(elsewhere, email, "a-brand-new-one");
  await expect(elsewhere).toHaveURL(/\/dashboard$/);
});
