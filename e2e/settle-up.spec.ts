import { expect, test, type Page } from "@playwright/test";

/** A visible form field by label (hidden cached pages can share labels). */
function field(page: Page, label: string) {
  return page.getByLabel(label, { exact: true }).filter({ visible: true });
}

const settleUp = (page: Page) => page.getByRole("region", { name: "Settle up" });
const recordDialog = (page: Page) => page.getByRole("dialog", { name: "Record a Settlement" });

test("S2: Guest records the suggested Settlement in parts and reaches All settled up!", async ({ page }) => {
  await page.goto("/guest/groups/grp_birthday");
  await expect(settleUp(page)).toContainText("Chloe Yun pays Ben Gutierrez $14.37");

  // A partial Settlement shows what's left.
  await settleUp(page).getByRole("button", { name: /^Record: Chloe Yun pays Ben Gutierrez/ }).click();
  await expect(field(page, "Amount (USD)")).toHaveValue("14.37");
  await field(page, "Amount (USD)").fill("10");
  await expect(recordDialog(page)).toContainText("After this, Chloe Yun will still owe $4.37.");
  await page.getByRole("button", { name: "Record Settlement" }).click();

  await expect(page.getByText("Settlement recorded. Chloe Yun will still owe $4.37.")).toBeVisible();
  await expect(page.getByTestId("balance-mem_chloe")).toContainText("owes−$4.37");
  await expect(page.locator("main ol > li").first()).toContainText("Settlement: Chloe Yun paid Ben Gutierrez");

  // Overpaying is refused with the most that can be paid.
  await settleUp(page).getByRole("button", { name: /^Record: Chloe Yun pays Ben Gutierrez/ }).click();
  await field(page, "Amount (USD)").fill("5");
  await page.getByRole("button", { name: "Record Settlement" }).click();
  await expect(recordDialog(page).getByRole("alert")).toContainText("Chloe Yun can pay at most $4.37.");

  await field(page, "Amount (USD)").fill("4.37");
  await page.getByRole("button", { name: "Record Settlement" }).click();

  await expect(settleUp(page)).toContainText("All settled up!");
  await expect(page.getByRole("heading", { name: "Settle up" })).toBeFocused();
  await expect(page.getByTestId("balance-mem_chloe")).toContainText("settled up$0.00");
});

test("S2: a Settlement can be deleted after confirming, restoring the debt", async ({ page }) => {
  await page.goto("/guest/groups/grp_birthday");
  await page.getByRole("button", { name: "Delete Settlement: Chloe Yun paid Olivia Hayes $18.75" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Delete this Settlement?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Delete Settlement" }).click();

  await expect(page.getByText("Deleted the Settlement from Chloe Yun to Olivia Hayes.")).toBeVisible();
  await expect(page.getByTestId("balance-mem_chloe")).toContainText("owes−$33.12");
});

test("S2: once only Small Change is left, one tap clears it", async ({ page }) => {
  // Camping ends with Omar owing Lily $0.32 once the three suggestions are paid.
  await page.goto("/guest/groups/grp_camping");
  for (let paid = 0; paid < 3; paid++) {
    await settleUp(page).getByRole("button", { name: /^Record:/ }).first().click();
    await page.getByRole("button", { name: "Record Settlement" }).click();
    await expect(recordDialog(page)).toBeHidden();
  }

  await expect(settleUp(page)).toContainText("Only Small Change left");
  await expect(settleUp(page)).toContainText("Omar Hassan pays Lily Tran $0.32");
  await settleUp(page).getByRole("button", { name: "Clear Small Change" }).click();

  await expect(settleUp(page)).toContainText("All settled up!");
});

test("S2: a Member sees their own action first, with others' suggestions collapsed", async ({ page }) => {
  await page.goto("/guest/groups/new");
  await field(page, "Name").fill("Road trip");
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Road trip" })).toBeVisible();

  const members = page.getByRole("region", { name: "Members" });
  for (const name of ["Taylor", "Sam", "Jo"]) {
    await field(page, "Add a Member by name").fill(name);
    await page.getByRole("button", { name: "Add Member" }).click();
    await expect(members.getByText(name, { exact: true })).toBeVisible();
  }

  // Taylor paid $90.40 shared by You and Taylor; Jo paid $20 shared by Jo and Sam.
  // The chips a person clicks: labels around visually hidden inputs.
  const chip = (role: "radio" | "checkbox", name: string) =>
    page.locator("label").filter({ has: page.getByRole(role, { name, exact: true }) }).filter({ visible: true });
  async function addExpense(amount: string, description: string, payer: string, without: string[]) {
    await page.getByRole("button", { name: "Add Expense", exact: true }).click();
    await field(page, "Amount (USD)").fill(amount);
    await field(page, "Description").fill(description);
    await chip("radio", payer).click();
    for (const name of without) await chip("checkbox", name).click();
    await page.getByRole("button", { name: "Add Expense", exact: true }).click();
    await expect(page.getByText("Expense added.")).toBeVisible();
  }
  await addExpense("90.40", "Fuel", "Taylor", ["Sam", "Jo"]);
  await addExpense("20", "Snacks", "Jo", ["You", "Taylor"]);

  await expect(settleUp(page)).toContainText("You owe $45.20 → pay Taylor $45.20");
  // Each suggestion's sources are collapsed too, so pick the outer list.
  const others = settleUp(page).locator("details", { hasText: "Other Suggested Settlements" });
  await expect(others.locator("> summary")).toHaveText("Other Suggested Settlements (1)");
  await expect(others.getByText("Sam pays Jo $10.00")).toBeHidden();
  await others.locator("> summary").click();
  await expect(others.getByText("Sam pays Jo $10.00")).toBeVisible();
});
