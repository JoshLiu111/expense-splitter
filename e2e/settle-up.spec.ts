import { expect, test, type Page } from "@playwright/test";

/** A visible form field by label (hidden cached pages can share labels). */
function field(page: Page, label: string) {
  return page.getByLabel(label, { exact: true }).filter({ visible: true });
}

const settleUp = (page: Page) => page.getByRole("region", { name: "Settle up" });
const recordDialog = (page: Page) => page.getByRole("dialog", { name: "Record a Settlement" });

/** Opens "Record a payment" and fills in who paid whom, and how much if given. */
async function recordPayment(page: Page, from: string, to: string, amount?: string) {
  await settleUp(page).getByRole("button", { name: "Record a payment" }).click();
  await field(page, "Paid by").selectOption({ label: from });
  await field(page, "Paid to").selectOption({ label: to });
  if (amount !== undefined) await field(page, "Amount (USD)").fill(amount);
}

test("S2: Guest records the suggested Settlement in parts and reaches Everyone is Settled Up", async ({ page }) => {
  await page.goto("/guest/groups/grp_birthday");
  await expect(settleUp(page)).toContainText("Chloe Yun pays Ben Gutierrez $14.37");

  // Other people's payments are rows, not buttons; one action records any of them.
  await expect(settleUp(page).getByRole("button", { name: /^Record:/ })).toHaveCount(0);

  // A partial Settlement shows what's left.
  await recordPayment(page, "Chloe Yun", "Ben Gutierrez", "10");
  await expect(recordDialog(page)).toContainText("After this, Chloe Yun will still owe $4.37.");
  await page.getByRole("button", { name: "Record Settlement" }).click();

  await expect(page.getByText("Settlement recorded. Chloe Yun will still owe $4.37.")).toBeVisible();
  await expect(page.getByTestId("balance-mem_chloe")).toContainText("owes $4.37");
  await expect(page.locator("main article").first()).toContainText("Settlement: Chloe Yun paid Ben Gutierrez");

  // Overpaying is refused with the most that can be paid.
  await recordPayment(page, "Chloe Yun", "Ben Gutierrez", "5");
  await page.getByRole("button", { name: "Record Settlement" }).click();
  await expect(recordDialog(page).getByRole("alert")).toContainText("Chloe Yun can pay at most $4.37.");

  await field(page, "Amount (USD)").fill("4.37");
  await page.getByRole("button", { name: "Record Settlement" }).click();

  await expect(settleUp(page)).toContainText("Everyone is Settled Up");
  await expect(page.getByRole("heading", { name: "Settle up" })).toBeFocused();
  await expect(page.getByTestId("balances-settled-up")).toContainText("Chloe Yun");
});

test("S2: a Settlement can be deleted after confirming, restoring the debt", async ({ page }) => {
  await page.goto("/guest/groups/grp_birthday");
  // The row is one control with no buttons of its own; it opens a dialog stating the Settlement.
  const row = page
    .getByRole("region", { name: "Expenses and Settlements" })
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Settlement: Chloe Yun paid Olivia Hayes", exact: true }) });
  await expect(row.getByRole("button")).toHaveCount(1);
  await row.getByRole("button").focus();
  await page.keyboard.press("Enter");
  const details = page.getByRole("dialog", { name: "Settlement" });
  await expect(details).toContainText("Chloe Yun paid Olivia Hayes $18.75 on Feb 17, 2024");
  // A Settlement can be deleted but never edited.
  await expect(details.getByRole("button", { name: /edit/i })).toHaveCount(0);

  await details.getByRole("button", { name: "Delete Settlement" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Delete this Settlement?" });
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByTestId("balance-mem_chloe")).toContainText("owes $14.37");

  await details.getByRole("button", { name: "Delete Settlement" }).click();
  await confirm.getByRole("button", { name: "Delete Settlement" }).click();

  await expect(page.getByText("Deleted the Settlement from Chloe Yun to Olivia Hayes.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Expenses and Settlements" })).toBeFocused();
  await expect(page.getByTestId("balance-mem_chloe")).toContainText("owes $33.12");
  await expect(page.getByRole("status")).toContainText("Balances updated.");
});

test("S2: once only Small Change is left, one tap clears it", async ({ page }) => {
  // Camping ends with Omar owing Lily $0.32 once the three suggestions are paid.
  await page.goto("/guest/groups/grp_camping");
  for (let paid = 0; paid < 3; paid++) {
    const first = settleUp(page).getByRole("list", { name: "Suggested Settlements" }).locator("li p").first();
    const [, from, to, amount] = (await first.textContent())!.match(/^(.+) pays (.+) \$([\d,.]+)$/)!;
    await recordPayment(page, from, to, amount.replaceAll(",", ""));
    await page.getByRole("button", { name: "Record Settlement" }).click();
    await expect(recordDialog(page)).toBeHidden();
  }

  await expect(settleUp(page)).toContainText("$0.32 of Small Change left; nothing worth a payment.");
  await settleUp(page).getByRole("button", { name: "Clear Small Change" }).click();

  await expect(settleUp(page)).toContainText("Everyone is Settled Up");
});

test("S2: a Member sees their own action first, with others' suggestions below it", async ({ page }) => {
  await page.goto("/guest/groups/new");
  await field(page, "Name").fill("Road trip");
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Road trip" })).toBeVisible();

  await page.getByRole("link", { name: "Group settings" }).click();
  const members = page.getByRole("region", { name: "Members" });
  for (const name of ["Taylor", "Sam", "Jo"]) {
    await field(page, "Add a Member by name").fill(name);
    await page.getByRole("button", { name: "Add Member" }).click();
    await expect(members.getByText(name, { exact: true })).toBeVisible();
  }
  await page.getByRole("link", { name: "Back to Road trip" }).click();

  // Taylor paid $90.40 shared by You and Taylor; Jo paid $20 shared by Jo and Sam.
  // The chips a person clicks: labels around visually hidden inputs.
  const chip = (role: "radio" | "checkbox", name: string) =>
    page.locator("label").filter({ has: page.getByRole(role, { name, exact: true }) }).filter({ visible: true });
  async function addExpense(amount: string, description: string, payer: string, without: string[]) {
    // The hero's "Add the first Expense" opens the editor until there is one; the floating button after.
    await page.getByRole("button", { name: /^Add (the first )?Expense$/ }).click();
    await field(page, "Amount (USD)").fill(amount);
    await field(page, "Description").fill(description);
    await chip("radio", payer).click();
    for (const name of without) await chip("checkbox", name).click();
    await page.getByRole("button", { name: "Add Expense", exact: true }).click();
    await expect(page.getByText("Expense added.")).toBeVisible();
  }
  await addExpense("90.40", "Fuel", "Taylor", ["Sam", "Jo"]);
  await addExpense("20", "Snacks", "Jo", ["You", "Taylor"]);

  // Your own payment leads, as its own Record action; everyone else's follow as rows.
  const yours = settleUp(page).getByRole("button", { name: "Record: you pay Taylor $45.20" });
  await expect(settleUp(page).getByText("You pay Taylor", { exact: true })).toBeVisible();
  await expect(yours).toHaveText("Record this payment");
  const others = settleUp(page).getByRole("list", { name: "Other Suggested Settlements" });
  await expect(others.getByRole("listitem")).toHaveCount(1);
  await expect(others).toContainText("Sam pays Jo $10.00");
  // With a suggestion of your own, its Record is the only one; its form can be changed to any Settlement.
  const order = await settleUp(page)
    .getByRole("button", { name: /^Record/ })
    .evaluateAll((buttons) => buttons.map((b) => b.getAttribute("aria-label") ?? b.textContent));
  expect(order).toEqual(["Record: you pay Taylor $45.20"]);
  await expect(settleUp(page).getByRole("button", { name: "Why these payments?" })).toBeVisible();
});

test("S2: a Member whose own Balance is zero sees they're settled up while others still owe", async ({ page }) => {
  await page.goto("/guest/groups/new");
  await field(page, "Name").fill("Lunch club");
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Lunch club" })).toBeVisible();

  await page.getByRole("link", { name: "Group settings" }).click();
  const members = page.getByRole("region", { name: "Members" });
  for (const name of ["Ana", "Bo"]) {
    await field(page, "Add a Member by name").fill(name);
    await page.getByRole("button", { name: "Add Member" }).click();
    await expect(members.getByText(name, { exact: true })).toBeVisible();
  }
  await page.getByRole("link", { name: "Back to Lunch club" }).click();

  // An empty Group leads to its first Expense from the hero, its only call to action.
  await expect(settleUp(page)).toContainText("No Expenses yet");
  await expect(page.getByRole("button", { name: "Add Expense", exact: true })).toHaveCount(0);
  // Nothing to list or chart yet: no Expenses | Insights tabs.
  await expect(page.getByRole("tablist")).toHaveCount(0);
  await settleUp(page).getByRole("button", { name: "Add the first Expense" }).click();

  // Ana paid $30 shared by Ana and Bo: You aren't in it.
  const chip = (role: "radio" | "checkbox", name: string) =>
    page.locator("label").filter({ has: page.getByRole(role, { name, exact: true }) }).filter({ visible: true });
  await field(page, "Amount (USD)").fill("30");
  await field(page, "Description").fill("Pizza");
  await chip("radio", "Ana").click();
  await chip("checkbox", "You").click();
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(page.getByText("Expense added.")).toBeVisible();

  await expect(settleUp(page)).toContainText("You're settled up");
  await expect(settleUp(page)).toContainText("Bo pays Ana $15.00");
  // With no suggestion of their own, they record from "Record a payment".
  await expect(settleUp(page).getByRole("button", { name: "Record a payment" })).toBeVisible();
  // The floating Add Expense is back once there is an Expense.
  await expect(page.getByRole("button", { name: "Add Expense", exact: true })).toBeVisible();
});

test("S2: a Former Member whose Balance reopens shows in Balances and can be settled", async ({ page }) => {
  await page.goto("/guest/groups/grp_birthday");

  // Olivia is removed at a zero Balance and drops out of Balances.
  await page.getByRole("link", { name: "Group settings" }).click();
  await page.getByRole("button", { name: "Remove Olivia Hayes" }).click();
  await page
    .getByRole("alertdialog", { name: "Remove Olivia Hayes from the Group?" })
    .getByRole("button", { name: "Remove Member" })
    .click();
  await expect(page.getByText("Removed Olivia Hayes.")).toBeVisible();
  await page.getByRole("link", { name: "Back to Sarah's Birthday Present" }).click();
  await expect(page.getByTestId("balance-mem_olivia")).toHaveCount(0);

  // Deleting the Settlement that zeroed her brings her Balance back.
  await page.getByRole("button", { name: "Settlement: Chloe Yun paid Olivia Hayes" }).click();
  await page.getByRole("dialog", { name: "Settlement" }).getByRole("button", { name: "Delete Settlement" }).click();
  await page
    .getByRole("alertdialog", { name: "Delete this Settlement?" })
    .getByRole("button", { name: "Delete Settlement" })
    .click();
  const olivia = page.getByTestId("balance-mem_olivia");
  await expect(olivia).toContainText("Olivia Hayes (Former Member)");
  await expect(olivia).toContainText("$18.75");
  // Her Member Statement itemises the reopened Balance.
  await olivia.getByRole("button").click();
  const statement = page.getByRole("dialog", { name: "Olivia Hayes (Former Member)" });
  await expect(statement.getByTestId("member-statement-balance")).toContainText("Olivia Hayes (Former Member) gets back $18.75");
  await statement.getByRole("button", { name: "Close" }).click();
  // The Balance chart labels her the same way.
  await page.getByRole("tab", { name: "Insights" }).click();
  await expect(page.getByRole("rowheader", { name: "Olivia Hayes (Former Member)" })).toHaveCount(1);

  // ...and she can still be settled with.
  await expect(settleUp(page)).toContainText("Chloe Yun pays Olivia Hayes $18.75");
  await recordPayment(page, "Chloe Yun", "Olivia Hayes (Former Member)", "18.75");
  await page.getByRole("button", { name: "Record Settlement" }).click();
  await expect(page.getByText("Settlement recorded.", { exact: false })).toBeVisible();
  await expect(page.getByTestId("balance-mem_olivia")).toHaveCount(0);
});

test("a long Member name never pushes a figure past the hero panel's edge", async ({ page }) => {
  const long = "Jordan Alexander Park-Featherstonehaugh";
  await page.goto("/guest/groups/new");
  await field(page, "Name").fill("Long names");
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Long names" })).toBeVisible();
  await page.getByRole("link", { name: "Group settings" }).click();
  for (const name of [long, "Taylor Kim"]) {
    await field(page, "Add a Member by name").fill(name);
    await page.getByRole("button", { name: "Add Member" }).click();
    await expect(page.getByRole("region", { name: "Members" }).getByText(name, { exact: true })).toBeVisible();
  }
  await page.getByRole("link", { name: "Back to Long names" }).click();

  // Taylor paid a six-figure sum for everyone, so You and the long name both pay Taylor.
  await page.getByRole("button", { name: "Add the first Expense" }).click();
  await field(page, "Amount (USD)").fill("123456.78");
  await field(page, "Description").fill("Villa");
  await page
    .locator("label")
    .filter({ has: page.getByRole("radio", { name: "Taylor Kim", exact: true }) })
    .filter({ visible: true })
    .click();
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(page.getByText("Expense added.")).toBeVisible();

  for (const name of ["Settle up", "Balances"]) {
    const panel = page.getByRole("region", { name });
    const panelBox = (await panel.boundingBox())!;
    for (const figure of await panel.locator(".amount").filter({ visible: true }).all()) {
      const box = (await figure.boundingBox())!;
      expect(box.x + box.width, `${name}: ${await figure.textContent()}`).toBeLessThanOrEqual(
        panelBox.x + panelBox.width,
      );
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
