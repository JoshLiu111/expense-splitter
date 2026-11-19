import { expect, test } from "@playwright/test";

test("Guest opens /guest, opens a Group and sees the expected Balances", async ({ page }) => {
  await page.goto("/guest");

  const groups = page.getByRole("list").getByRole("link");
  await expect(groups).toHaveCount(5);
  await expect(page.getByRole("link", { name: /Trip to Japan.*13 expenses/ })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Sarah's Birthday Present.*4 expenses.*\$357\.49 spent/ }),
  ).toBeVisible();

  await page.getByRole("link", { name: /Trip to Japan/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Trip to Japan" })).toBeVisible();

  await expect(page.getByTestId("balance-mem_alex")).toContainText("gets back $216.46");
  await expect(page.getByTestId("balance-mem_jordan")).toContainText("owes $219.49");
  await expect(page.getByTestId("balance-mem_sam")).toContainText("owes $315.09");
  await expect(page.getByTestId("balance-mem_taylor")).toContainText("gets back $318.12");

  // Original and converted amounts for a yen Expense.
  await expect(page.getByText("¥84,000")).toBeVisible();
  await expect(page.getByText("≈ $562.80")).toBeVisible();
});

test("a Group's Expenses and Settlements are listed newest first", async ({ page }) => {
  await page.goto("/guest/groups/grp_birthday");
  await expect(page.locator("main ol time")).toHaveCount(6);
  const dates = await page.locator("main ol time").evaluateAll((els) =>
    els.map((el) => el.getAttribute("datetime") ?? ""),
  );
  expect(dates.length).toBe(6);
  expect(dates).toEqual([...dates].sort().reverse());
});

test("Guest edits survive a reload but not a new browser session", async ({ page, browser }) => {
  await page.goto("/guest");
  await expect(page.getByRole("list").getByRole("link")).toHaveCount(5);

  // Stand-in for an edit made through the UI: rename a Group in session storage.
  await page.evaluate(() => {
    const key = "expense-splitter:guest:v2";
    const state = JSON.parse(sessionStorage.getItem(key)!);
    state.groups[0].name = "Renamed in this session";
    sessionStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await expect(page.getByRole("link", { name: /Renamed in this session/ })).toBeVisible();

  const freshSession = await browser.newPage();
  await freshSession.goto(page.url());
  await expect(freshSession.getByRole("link", { name: /Trip to Japan/ })).toBeVisible();
  await freshSession.close();
});

test.describe("theme", () => {
  test.use({ colorScheme: "dark" });

  test("follows the system, and a manual choice is remembered without a flash", async ({ page }) => {
    const background = () =>
      page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await page.goto("/guest");
    expect(await background()).toBe("rgb(10, 13, 19)");

    await page.getByRole("button", { name: "Switch to light theme" }).click();
    expect(await background()).toBe("rgb(246, 248, 251)");

    // Check the colour as soon as the document is parsed, before hydration.
    await page.reload({ waitUntil: "commit" });
    await page.waitForFunction(() => document.body !== null);
    expect(await background()).toBe("rgb(246, 248, 251)");
    await expect(page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();
  });
});

test("skip link moves focus to the main content", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard navigation");
  await page.goto("/guest");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

for (const path of ["/guest", "/guest/groups/grp_camping", "/guest/groups/grp_japan_2024"]) {
  test(`no horizontal scrolling on ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
}
