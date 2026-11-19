import { expect, test } from "@playwright/test";

test("landing page explains the app and opens /guest in one click", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("main");

  await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(main.getByRole("heading", { level: 3 })).toHaveCount(4);
  await expect(main.getByRole("link", { name: "Sign Up" })).toHaveAttribute("href", "/sign-up");

  await main.getByRole("link", { name: "Try as Guest" }).click();
  await expect(page).toHaveURL(/\/guest$/);
  await expect(page.getByRole("list").getByRole("link")).toHaveCount(5);
});

test("landing page has no horizontal scrolling", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main h1")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test.describe("Guest sign-up prompt", () => {
  const prompt = (page: import("@playwright/test").Page) =>
    page.getByRole("region", { name: "Sign up to save your Groups" });

  test("explains Guest data won't carry over and links to sign-up", async ({ page }) => {
    await page.goto("/guest");
    await expect(prompt(page)).toContainText("won't carry over");
    await prompt(page).getByRole("link", { name: "Sign up" }).click();
    await expect(page).toHaveURL(/\/sign-up$/);
  });

  test("is a slim bar directly under the header with a 44px dismiss control", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/guest");
    const bar = (await prompt(page).boundingBox())!;
    const header = (await page.locator("body > header").boundingBox())!;
    expect(bar.y).toBe(header.y + header.height);
    // One line on desktop: no taller than the 44px dismiss control plus padding.
    if (!isMobile) expect(bar.height).toBeLessThanOrEqual(56);

    const dismiss = (await prompt(page)
      .getByRole("button", { name: "Dismiss sign-up prompt" })
      .boundingBox())!;
    expect(dismiss.width).toBeGreaterThanOrEqual(44);
    expect(dismiss.height).toBeGreaterThanOrEqual(44);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test("is dismissible for the rest of the session without blocking anything", async ({ page }) => {
    await page.goto("/guest");
    await prompt(page).getByRole("button", { name: "Dismiss sign-up prompt" }).click();
    await expect(prompt(page)).toHaveCount(0);

    await page.getByRole("link", { name: /Trip to Japan/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Trip to Japan" })).toBeVisible();
    await expect(prompt(page)).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Trip to Japan" })).toBeVisible();
    await expect(prompt(page)).toHaveCount(0);
  });
});
