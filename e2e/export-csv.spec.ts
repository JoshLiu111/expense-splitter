import { expect, test, type Page } from "@playwright/test";
import { exportCsv } from "./group-page";

/** A visible form field by label (hidden cached pages can share labels). */
function field(page: Page, label: string) {
  return page.getByLabel(label, { exact: true }).filter({ visible: true });
}

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

test("a Guest exports a Group as a UTF-8 CSV named after it", async ({ page }) => {
  await page.goto("/guest/groups/grp_japan_2024");
  // Collapsed, Insights offers nothing to export yet.
  await expect(page.getByRole("button", { name: "Export CSV" })).toHaveCount(0);
  const { name, bytes } = await exportCsv(page);
  expect(name).toBe("Trip to Japan.csv");
  // The BOM tells spreadsheet apps the file is UTF-8.
  expect(bytes.subarray(0, 3)).toEqual(UTF8_BOM);

  const lines = bytes.subarray(3).toString("utf8").split("\r\n");
  expect(lines[0]).toBe(
    "Type,Date,Description,Category,Payer,From,To,Expense Currency,Expense Amount,Locked Rate,Amount (USD),Split Type,Notes," +
      "Share: Alex Chen (USD),Share: Jordan Park (USD),Share: Sam Rivera (USD),Share: Taylor Kim (USD)",
  );
  // An Expense paid in yen: its yen amount and Locked Rate, then each Share in USD, totalling the USD amount.
  expect(lines).toContainEqual(expect.stringMatching(/^Expense,2024-03-23,Fushimi Inari snacks & drinks,.*,Jordan Park,,,JPY,4850,0\.0067,32\.50,Equal,.*,8\.13,8\.13,8\.12,8\.12$/));
  // A Settlement Jordan made to Alex.
  expect(lines).toContainEqual(expect.stringMatching(/^Settlement,\d{4}-\d{2}-\d{2},,,,Jordan Park,Alex Chen,,,,150\.00,,,,,,$/));
});

test("a signed-in User exports their Group, with commas and quotes escaped", async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  await page.goto("/sign-up");
  await field(page, "Name").fill("Maya Chen");
  await field(page, "Email").fill(email);
  await field(page, "Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: "New Group" }).click();
  await field(page, "Name").fill("Flat 3B");
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Flat 3B" })).toBeVisible();
  await page.getByRole("link", { name: "Group settings" }).click();
  await field(page, "Add a Member by name").fill("Brown, Theo");
  await page.getByRole("button", { name: "Add Member" }).click();
  await expect(page.getByRole("region", { name: "Members" }).getByText("Brown, Theo", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to Flat 3B" }).click();

  // Maya pays $10.01 split equally: the Leftover Cent goes to her, the first Member.
  await page.getByRole("button", { name: "Add the first Expense" }).click();
  await field(page, "Amount (USD)").fill("10.01");
  await field(page, "Description").fill('Milk, "oat"');
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(page.getByText("Expense added.")).toBeVisible();

  const { name, bytes } = await exportCsv(page);
  expect(name).toBe("Flat 3B.csv");
  const lines = bytes.subarray(3).toString("utf8").split("\r\n");
  expect(lines[0]).toMatch(/,Share: Maya Chen \(USD\),"Share: Brown, Theo \(USD\)"$/);
  expect(lines[1]).toMatch(/^Expense,\d{4}-\d{2}-\d{2},"Milk, ""oat""",.*,Maya Chen,,,USD,10\.01,1,10\.01,Equal,,5\.01,5\.00$/);
});
