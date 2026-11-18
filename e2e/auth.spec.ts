import { expect, test, type Page } from "@playwright/test";

/** A fresh email per test so runs never collide in the shared database. */
function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

const PASSWORD = "correct-horse-battery";

/**
 * A visible form field by label. Cache Components keeps recently visited
 * pages mounted but hidden, so the same label can exist twice in the DOM.
 */
function field(page: Page, label: string) {
  return page.getByLabel(label, { exact: true }).filter({ visible: true });
}

async function signUp(page: Page, email: string, name = "Maya Chen") {
  await page.goto("/sign-up");
  await expect(page.getByRole("heading", { level: 1, name: "Sign up" })).toBeVisible();
  await field(page, "Name").fill(name);
  await field(page, "Email").fill(email);
  await field(page, "Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function signIn(page: Page, email: string) {
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await field(page, "Email").fill(email);
  await field(page, "Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
}

test("sign up, create a Group, sign out, sign in: the Group is still listed", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await expect(page.getByRole("heading", { name: "No Groups yet" })).toBeVisible();

  await page.getByRole("link", { name: "New Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "New Group" })).toBeVisible();
  await field(page, "Name").fill("Flat 3B");
  await field(page, "Description (optional)").fill("Rent and bills");
  await expect(field(page, "Group Currency")).toHaveValue("USD");
  await field(page, "Group Currency").selectOption("GBP");
  await page.getByRole("button", { name: "Create Group" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Flat 3B" })).toBeVisible();
  await expect(page.getByText("Balances in GBP")).toBeVisible();
  // The creator is the Group's first Member.
  await expect(page.getByRole("region", { name: "Balances" }).getByText("Maya Chen", { exact: true })).toBeVisible();

  await signOut(page);
  await page.getByRole("link", { name: "Sign in" }).click();
  await signIn(page, email);

  await expect(page).toHaveURL(/\/dashboard$/);
  const group = page.getByRole("link", { name: /Flat 3B/ });
  await expect(group).toContainText("0 expenses");
  await expect(group).toContainText("£0.00 spent");
  await expect(group).toContainText("Your Balance:");
  await expect(group).toContainText("settled up");
});

test("a signed-in User's Expense is saved to their Group", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await page.getByRole("link", { name: "New Group" }).click();
  await field(page, "Name").fill("Lunch club");
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Lunch club" })).toBeVisible();

  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await field(page, "Amount (USD)").fill("24.50");
  await field(page, "Description").fill("Ramen");
  // Paid by me by default.
  await expect(page.getByRole("radio", { name: "Maya Chen (you)" })).toBeChecked();
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();

  await expect(page.getByText("Expense added.")).toBeVisible();
  await expect(page.getByText("1 expense ·")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ramen" })).toBeVisible();
  await expect(page.getByText("$24.50 spent")).toBeVisible();
});

test("S2: a signed-in User's yen Expense is locked at the server's rate", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await page.getByRole("link", { name: "New Group" }).click();
  await field(page, "Name").fill("Tokyo");
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Tokyo" })).toBeVisible();

  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await field(page, "Currency").selectOption("JPY");
  await field(page, "Amount (JPY)").fill("4500");
  await field(page, "Description").fill("Sushi");
  // Fixed rates in S2: ¥150 per dollar.
  await expect(page.getByTestId("converted-preview")).toHaveText("¥4,500 ≈ $30.00");
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();

  await expect(page.getByText("Expense added.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("1 JPY = 0.00666667 USD")).toBeVisible();
  await expect(page.getByText("Spent in JPY: ¥4,500 ≈ $30.00")).toBeVisible();
});

test("a signed-in User's Percentage Split reloads on edit", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await page.getByRole("link", { name: "New Group" }).click();
  await field(page, "Name").fill("Solo");
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Solo" })).toBeVisible();

  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await field(page, "Amount (USD)").fill("12");
  await field(page, "Description").fill("Books");
  await page
    .locator("label")
    .filter({ has: page.getByRole("radio", { name: "Percentage", exact: true }) })
    .filter({ visible: true })
    .click();
  await field(page, "Maya Chen (%)").fill("100");
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(page.getByText("Expense added.")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Edit “Books”" }).click();
  await expect(page.getByRole("radio", { name: "Percentage", exact: true })).toBeChecked();
  await expect(field(page, "Maya Chen (%)")).toHaveValue("100");
});

test("the session cookie outlives the browser", async ({ page, context }) => {
  await signUp(page, uniqueEmail());
  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name.endsWith("session_token"));
  expect(session, "session cookie").toBeDefined();
  // A persistent cookie (not a session-only one, which has expires = -1)
  // lasting at least a week.
  expect(session!.expires).toBeGreaterThan(Date.now() / 1000 + 7 * 24 * 60 * 60);
  expect(session!.httpOnly).toBe(true);
});

test("protected routes send signed-out visitors to sign-in and back", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await signOut(page);

  await page.goto("/groups/new");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fgroups%2Fnew$/);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/groups\/new$/);
  await expect(page.getByRole("heading", { level: 1, name: "New Group" })).toBeVisible();

  await signOut(page);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard$/);
});

test("auth forms give specific, announced errors", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();

  const summary = page.getByRole("alert", { name: /problem/ });
  await expect(summary).toBeFocused();
  await expect(summary).toContainText("Enter your name.");
  await expect(summary).toContainText("Enter your email address.");
  await expect(summary).toContainText("Use a password of at least 8 characters.");
  const email = field(page, "Email");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAccessibleDescription("Enter your email address.");

  const existing = uniqueEmail();
  await signUp(page, existing);
  await signOut(page);
  await page.goto("/sign-up");
  await field(page, "Name").fill("Someone Else");
  await field(page, "Email").fill(existing);
  await field(page, "Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(field(page, "Email")).toHaveAccessibleDescription(
    "This email is already registered. Sign in instead.",
  );

  await page.goto("/sign-in");
  await field(page, "Email").fill(existing);
  await field(page, "Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert", { name: /problem/ })).toContainText(
    "That email and password don't match.",
  );
});

test("sign-up works from the keyboard alone", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard journey is desktop-only");
  await page.goto("/sign-up");
  await field(page, "Name").focus();
  await page.keyboard.type("Keyboard User");
  await page.keyboard.press("Tab");
  await page.keyboard.type(uniqueEmail());
  await page.keyboard.press("Tab");
  await page.keyboard.type(PASSWORD);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("a Guest creates a Group that lasts for the session", async ({ page }) => {
  await page.goto("/guest");
  await expect(page.getByRole("list").getByRole("link")).toHaveCount(5);

  await page.getByRole("link", { name: "New Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "New Group" })).toBeVisible();
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(field(page, "Name")).toHaveAccessibleDescription("Enter a name for the Group.");

  await field(page, "Name").fill("Picnic");
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Picnic" })).toBeVisible();
  await expect(page.getByText("Balances in USD")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Picnic" })).toBeVisible();
  await page.getByRole("link", { name: "All Groups" }).click();
  await expect(page.getByRole("list").getByRole("link")).toHaveCount(6);
});

test("a signed-in User sees their own Suggested Settlement and records it", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await page.getByRole("link", { name: "New Group" }).click();
  await field(page, "Name").fill("Flat");
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Flat" })).toBeVisible();
  await field(page, "Add a Member by name").fill("Taylor");
  await page.getByRole("button", { name: "Add Member" }).click();
  await expect(page.getByText("Added Taylor.")).toBeVisible();
  // Wait for the refreshed Group, so the Split includes Taylor.
  await expect(
    page.getByRole("region", { name: "Members" }).getByText("Taylor", { exact: true }),
  ).toBeVisible();

  // Maya pays $90.40, split equally with Taylor.
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await field(page, "Amount (USD)").fill("90.40");
  await field(page, "Description").fill("Groceries");
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(page.getByText("Expense added.")).toBeVisible();

  const settleUp = page.getByRole("region", { name: "Settle up" });
  await expect(settleUp).toContainText("You get back $45.20 → Taylor pays you $45.20");
  await settleUp.getByRole("button", { name: /^Record: Taylor pays you/ }).click();
  await page.getByRole("button", { name: "Record Settlement" }).click();

  await expect(settleUp).toContainText("All settled up!");
  await page.reload();
  await expect(page.getByRole("region", { name: "Settle up" })).toContainText("All settled up!");
  await expect(page.getByRole("heading", { name: "Settlement: Taylor paid Maya Chen" })).toBeVisible();
});
