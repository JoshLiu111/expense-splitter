import { expect, test, type Page } from "@playwright/test";
import { SIMPLIFY_TIMING, simplifyDurations } from "../src/components/simplify-timing";

/** A visible form field by label (hidden cached pages can share labels). */
function field(page: Page, label: string) {
  return page.getByLabel(label, { exact: true }).filter({ visible: true });
}

const timeline = (page: Page) => page.locator("main article");
const insights = (page: Page) => page.getByRole("tabpanel", { name: "Insights" });
const tab = (page: Page, name: "Expenses" | "Insights") => page.getByRole("tab", { name });
const categories = (page: Page) => page.getByRole("region", { name: "Categories" });
const settleUp = (page: Page) => page.getByRole("region", { name: "Settle up" });

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

test("S2: Guest adds a Custom Category, files an Expense under it, renames it, and can't delete it while used", async ({
  page,
}) => {
  await page.goto("/guest/groups/grp_apt_4b");
  await page.getByRole("link", { name: "Group settings" }).click();
  await field(page, "Add a Category").fill("Cleaning supplies");
  await categories(page).getByRole("button", { name: "Add Category" }).click();
  await expect(page.getByText("Added the Category Cleaning supplies.")).toBeVisible();
  await page.getByRole("link", { name: "Back to Apartment 4B" }).click();

  // Only this Group offers it.
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await field(page, "Amount (USD)").fill("12");
  await field(page, "Description").fill("Sponges");
  await field(page, "Category").selectOption({ label: "Cleaning supplies" });
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(page.getByText("Expense added.")).toBeVisible();
  await expect(timeline(page).first()).toContainText("paid in Cleaning supplies");

  await page.getByRole("link", { name: "Group settings" }).click();
  await categories(page).getByRole("button", { name: "Rename Cleaning supplies" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Cleaning");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(categories(page)).toContainText("1 Expense uses Cleaning. Move it to another Category first.");
  await expect(categories(page).getByRole("button", { name: "Delete Cleaning" })).toHaveCount(0);
  await page.getByRole("link", { name: "Back to Apartment 4B" }).click();
  await expect(timeline(page).first().getByText(/ paid in Cleaning$/)).toBeVisible();

  await page.goto("/guest/groups/grp_birthday");
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await expect(field(page, "Category").locator("option", { hasText: "Cleaning" })).toHaveCount(0);
});

test("S2: Expenses and Insights are two views over one set of filters", async ({ page }) => {
  await page.goto("/guest/groups/grp_apt_4b");
  await expect(tab(page, "Expenses")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Insights" })).toHaveCount(0);
  // Arrow keys move between the tabs and select them.
  await tab(page, "Expenses").focus();
  await page.keyboard.press("ArrowRight");
  await expect(tab(page, "Insights")).toBeFocused();
  await expect(insights(page)).toContainText("Housing$7,200.0086.0%");
  await page.keyboard.press("Home");
  await expect(tab(page, "Expenses")).toHaveAttribute("aria-selected", "true");

  // The filters are collapsed behind one button.
  const filterButton = page.getByRole("button", { name: /^Filter/ });
  await expect(filterButton).toHaveAttribute("aria-expanded", "false");
  await expect(field(page, "Filter by month")).toHaveCount(0);
  await filterButton.click();

  // The 1 January rent (09:00 UTC) is in January wherever the visitor is.
  await field(page, "Filter by month").selectOption({ label: "January 2024" });
  await expect(field(page, "From date")).toHaveValue("2024-01-01");
  await expect(field(page, "To date")).toHaveValue("2024-01-31");
  await expect(page.getByText("Showing 5 matching Expenses of 10; Settlements are hidden while filtering.")).toBeVisible();
  await expect(timeline(page).last()).toContainText("January rent");

  await field(page, "Filter by Category").selectOption("Utilities");
  await field(page, "Filter by Member (paid or included)").selectOption({ label: "Drew Patel" });
  await expect(filterButton).toHaveText("Filter (3 active)");
  await expect(page.getByText("Showing 2 matching Expenses of 10;")).toBeVisible();
  await expect(timeline(page)).toHaveCount(2);

  // Switching views keeps the filters.
  await tab(page, "Insights").click();
  await expect(insights(page)).toContainText("Utilities$222.36100.0%");
  await expect(page.getByText("Showing 2 matching Expenses of 10.")).toBeVisible();

  // Each chip removes its own filter; a month is one chip.
  const chips = page.getByRole("list", { name: "Active filters" });
  await chips.getByRole("button", { name: "Remove filter: January 2024" }).click();
  await expect(filterButton).toHaveText("Filter (2 active)");
  await expect(field(page, "From date")).toHaveValue("");
  // Focus moves to the chip now in its place.
  await expect(chips.getByRole("button", { name: "Remove filter: Drew Patel" })).toBeFocused();

  await chips.getByRole("button", { name: "Clear all" }).click();
  await expect(chips).toHaveCount(0);
  await expect(filterButton).toBeFocused();
  await expect(filterButton).toHaveText("Filter");
  await tab(page, "Expenses").click();
  await expect(timeline(page)).toHaveCount(12);
});

test("S2: charts load with text alternatives", async ({ page }) => {
  await page.goto("/guest/groups/grp_apt_4b");
  await tab(page, "Insights").click();
  for (const name of ["Category share", "Spending over time", "Balance per Member"]) {
    const figure = insights(page).getByRole("figure", { name: new RegExp(name) });
    await expect(figure).toBeVisible();
    await expect(figure.locator("svg").first()).toBeVisible();
    await expect(figure.getByRole("table")).toBeAttached();
  }
  await expect(insights(page).getByRole("figure", { name: /Spending over time/ })).toContainText(
    "Most was spent in February 2024: $4,223.69.",
  );
});

test("Why these payments? Simplify draws Before, holds it, then draws After, with the graph in view", async ({
  page,
}) => {
  // Japan: 6 debts become 3 Suggested Settlements.
  const { toAfterMs, totalMs } = simplifyDurations(6, 3);
  // Scrolling into view comes first; the slack covers rendering and a busy CI machine.
  const slackMs = SIMPLIFY_TIMING.scrollWaitMs + 1000;
  await page.goto("/guest/groups/grp_japan_2024");
  await settleUp(page).getByRole("button", { name: "Why these payments?" }).click();
  const graph = settleUp(page).getByRole("img", { name: /Before Debt Simplification/ });
  const before = settleUp(page).getByRole("button", { name: "Before", exact: true });
  const after = settleUp(page).getByRole("button", { name: "After", exact: true });
  await expect(before).toHaveAttribute("aria-pressed", "true");

  await settleUp(page).getByRole("button", { name: "Simplify" }).click();
  await expect(before).toHaveAttribute("aria-pressed", "true");
  await expect(after).toHaveAttribute("aria-pressed", "false");
  await expect(after).toHaveAttribute("aria-pressed", "true", { timeout: toAfterMs + slackMs });
  // Every After arrow ends up drawn with its amount showing, and Before is gone.
  const opacities = (side: "before" | "after") =>
    graph
      .locator(`[data-edge][data-side=${side}]`)
      .evaluateAll((edges) =>
        edges.map((edge) => {
          const label = edge.querySelector(":scope > g")!;
          return `${getComputedStyle(edge).opacity}/${getComputedStyle(label).opacity}`;
        }),
      );
  await expect.poll(() => opacities("after"), { timeout: totalMs - toAfterMs + slackMs }).toEqual(Array(3).fill("1/1"));
  await expect.poll(() => opacities("before")).toEqual(Array(6).fill("0/0"));
  // Read out once the run is over.
  await expect(settleUp(page).getByRole("status")).toHaveText("Simplified. Showing After: 3 Suggested Settlements.");
  // Once played through, the button offers to play it again.
  await expect(settleUp(page).getByRole("button", { name: "Replay" })).toBeVisible();
  await expect(settleUp(page).getByRole("button", { name: "Simplify" })).toHaveCount(0);

  // The whole graph is in view, clear of the Add Expense bar.
  await expect(graph).toBeInViewport({ ratio: 1 });
  const graphBox = (await graph.boundingBox())!;
  const barBox = (await page.getByRole("button", { name: "Add Expense", exact: true }).boundingBox())!;
  expect(graphBox.y + graphBox.height <= barBox.y || graphBox.x + graphBox.width <= barBox.x).toBe(true);
});

test("Why these payments? stops a Simplify run when Before is chosen part-way", async ({ page }) => {
  const { totalMs } = simplifyDurations(6, 3);
  await page.goto("/guest/groups/grp_japan_2024");
  await settleUp(page).getByRole("button", { name: "Why these payments?" }).click();
  const before = settleUp(page).getByRole("button", { name: "Before", exact: true });
  await settleUp(page).getByRole("button", { name: "Simplify" }).click();
  await before.click();
  // Long enough for the cancelled run to have switched to After and finished, had it carried on.
  await page.waitForTimeout(totalMs + SIMPLIFY_TIMING.scrollWaitMs);
  await expect(before).toHaveAttribute("aria-pressed", "true");
  await expect(settleUp(page).getByRole("status")).toHaveText("");
  await expect(settleUp(page).getByRole("button", { name: "Simplify" })).toBeVisible();
});

// The rest switch straight to After; the test above covers the animation.
test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("S2: Why these payments? shows before and after", async ({
    page,
  }) => {
    await page.goto("/guest/groups/grp_japan_2024");
    await settleUp(page).getByRole("button", { name: "Why these payments?" }).click();
    const graph = settleUp(page).getByRole("img", { name: /Before Debt Simplification/ });
    await expect(graph).toBeVisible();
    await expect(settleUp(page)).toContainText("Before: 6 debts");
    await expect(settleUp(page)).toContainText("After: 3 Suggested Settlements");
    await expect(settleUp(page)).toContainText("Every Balance is the same either way.");
    // Debts read as who owes whom, not as payments to make.
    await expect(settleUp(page).getByRole("listitem").filter({ hasText: /^\S+ \S+ owes / }).first()).toBeVisible();
    await expect(settleUp(page).getByRole("button", { name: "Before", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("S2: Why these payments? traces each suggestion back to its Expenses", async ({ page }) => {
    await page.goto("/guest/groups/grp_japan_2024");
    await settleUp(page).getByRole("button", { name: "Why these payments?" }).click();
    const toTaylor = settleUp(page)
      .getByRole("list", { name: /^After:/ })
      .getByRole("listitem")
      .filter({ hasText: "Sam Rivera pays Taylor Kim" });
    await toTaylor.getByText(/^From “Kyoto ryokan \(2 nights\)” and 6 other expenses$/).click();
    await expect(toTaylor).toContainText("Taylor Kim paid · Mar 22, 2024$167.50");
    await expect(toTaylor).toContainText("What Sam Rivera owes from these, after what they paid for others$315.09");
  });

  test("S2: Why these payments? says why someone pays a Member they never shared an Expense with", async ({
    page,
  }) => {
    await page.goto("/guest/groups/new");
    await field(page, "Name").fill("Carpool");
    await page.getByRole("button", { name: "Create Group" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Carpool" })).toBeVisible();
    await page.getByRole("link", { name: "Group settings" }).click();
    const members = page.getByRole("region", { name: "Members" });
    for (const name of ["Taylor", "Sam"]) {
      await field(page, "Add a Member by name").fill(name);
      await page.getByRole("button", { name: "Add Member" }).click();
      await expect(members.getByText(name, { exact: true })).toBeVisible();
    }
    await page.getByRole("link", { name: "Back to Carpool" }).click();

    // Taylor pays for You and Taylor; You pay for You and Sam. Sam ends up paying Taylor.
    const chip = (role: "radio" | "checkbox", name: string) =>
      page.locator("label").filter({ has: page.getByRole(role, { name, exact: true }) }).filter({ visible: true });
    async function addExpense(amount: string, description: string, payer: string, without: string) {
      await page.getByRole("button", { name: /^Add (the first )?Expense$/ }).click();
      await field(page, "Amount (USD)").fill(amount);
      await field(page, "Description").fill(description);
      await chip("radio", payer).click();
      await chip("checkbox", without).click();
      await page.getByRole("button", { name: "Add Expense", exact: true }).click();
      await expect(page.getByText("Expense added.")).toBeVisible();
    }
    await addExpense("30", "Fuel", "Taylor", "Sam");
    await addExpense("30", "Tolls", "You", "Taylor");

    await settleUp(page).getByRole("button", { name: "Why these payments?" }).click();
    const samPays = settleUp(page)
      .getByRole("list", { name: /^After:/ })
      .getByRole("listitem")
      .filter({ hasText: "Sam pays Taylor" });
    await expect(samPays).toContainText(
      "Sam and Taylor never shared an Expense; settling directly saves the Group a Settlement.",
    );
  });

  test("Why these payments? simplifies at once when asked", async ({ page }) => {
    await page.goto("/guest/groups/grp_japan_2024");
    await settleUp(page).getByRole("button", { name: "Why these payments?" }).click();
    const before = settleUp(page).getByRole("button", { name: "Before", exact: true });
    await expect(before).toHaveAttribute("aria-pressed", "true");
    await settleUp(page).getByRole("button", { name: "Simplify" }).click();
    // No animation to wait for: After is shown straight away.
    await expect(settleUp(page).getByRole("button", { name: "After", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
      { timeout: 100 },
    );
    await expect(settleUp(page).getByRole("status")).toHaveText("Simplified. Showing After: 3 Suggested Settlements.");
    // The list the graph draws is marked current for assistive tech, not with extra words in its heading.
    const afterList = settleUp(page).locator("[aria-current]");
    await expect(afterList).toHaveCount(1);
    await expect(afterList.getByRole("heading")).toHaveText("After: 3 Suggested Settlements");
    // Replay clears the status before writing the same words, so they are read out again.
    // The empty status lasts one frame, too short to poll for, so record every change.
    const status = settleUp(page).getByRole("status");
    await status.evaluate((el) => {
      const seen: string[] = [];
      (window as unknown as { statusSeen: string[] }).statusSeen = seen;
      new MutationObserver(() => seen.push(el.textContent ?? "")).observe(el, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    });
    await settleUp(page).getByRole("button", { name: "Replay" }).click();
    const seen = () => page.evaluate(() => (window as unknown as { statusSeen: string[] }).statusSeen);
    await expect.poll(seen).toContain("");
    await expect(status).toHaveText("Simplified. Showing After: 3 Suggested Settlements.");
    const changes = await seen();
    expect(changes.indexOf("")).toBeLessThan(changes.lastIndexOf("Simplified. Showing After: 3 Suggested Settlements."));
  });

  test("Why these payments? keeps every amount apart and at 11px or more", async ({ page }) => {
    for (const id of ["grp_japan_2024", "grp_apt_4b", "grp_office_lunch", "grp_birthday", "grp_camping"]) {
      await page.goto(`/guest/groups/${id}`);
      await settleUp(page).getByRole("button", { name: "Why these payments?" }).click();
      for (const phase of ["Before", "After"]) {
        if (phase === "After") await settleUp(page).getByRole("button", { name: "Simplify" }).click();
        await expect(settleUp(page).getByRole("button", { name: phase, exact: true })).toHaveAttribute(
          "aria-pressed",
          "true",
        );
        const labels = await settleUp(page)
          .locator("svg[role=img] [data-edge]")
          .evaluateAll((edges) =>
            edges
              .filter((edge) => (edge as SVGGElement).style.opacity === "1")
              .map((edge) => {
                const text = edge.querySelector("text")!;
                const { left, right, top, bottom } = text.getBoundingClientRect();
                const px = text.getScreenCTM()!.a * Number(text.getAttribute("font-size"));
                return { left, right, top, bottom, px };
              }),
          );
        expect(labels.length, `${id} ${phase}`).toBeGreaterThan(0);
        labels.forEach((a, i) => {
          expect(a.px, `${id} ${phase} font size`).toBeGreaterThanOrEqual(11);
          for (const b of labels.slice(i + 1)) {
            const apart = a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
            expect(apart, `${id} ${phase} labels overlap`).toBe(true);
          }
        });
      }
    }
  });

  test("Why these payments? says when the debts are already as simple as they get", async ({ page }) => {
    await page.goto("/sign-up");
    await field(page, "Name").fill("Maya Chen");
    await field(page, "Email").fill(uniqueEmail());
    await field(page, "Password").fill("correct-horse-battery");
    await page.getByRole("button", { name: "Sign up", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole("link", { name: "New Group" }).click();
    await field(page, "Name").fill("Lunch club");
    await page.getByRole("button", { name: "Create Group" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Lunch club" })).toBeVisible();
    await page.getByRole("link", { name: "Group settings" }).click();
    await field(page, "Add a Member by name").fill("Sam Rivera");
    await page.getByRole("button", { name: "Add Member" }).click();
    await expect(page.getByRole("region", { name: "Members" }).getByText("Sam Rivera", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Back to Lunch club" }).click();

    // One Payer, so the only debt is already the only Suggested Settlement.
    await page.getByRole("button", { name: "Add the first Expense" }).click();
    await field(page, "Amount (USD)").fill("24.50");
    await field(page, "Description").fill("Ramen");
    await expect(page.getByRole("checkbox", { name: "Sam Rivera" })).toBeChecked();
    await page.getByRole("button", { name: "Add Expense", exact: true }).click();
    await expect(page.getByText("Expense added.")).toBeVisible();

    await settleUp(page).getByRole("button", { name: "Why these payments?" }).click();
    await expect(settleUp(page)).toContainText("These are already in their simplest form");
    await expect(settleUp(page)).not.toContainText("fewer than before");
    // One graph and one list, nothing to switch between.
    await expect(settleUp(page).getByRole("img", { name: /Before Debt Simplification/ })).toBeVisible();
    await expect(settleUp(page).getByRole("button", { name: "Simplify" })).toHaveCount(0);
    await expect(settleUp(page).getByRole("button", { name: "Before", exact: true })).toHaveCount(0);
    await expect(settleUp(page).getByRole("heading", { name: "1 Suggested Settlement", exact: true })).toBeVisible();
    await expect(settleUp(page).getByRole("heading", { name: /^(Before|After):/ })).toHaveCount(0);
    await expect(settleUp(page)).toContainText("Sam Rivera pays Maya Chen $12.25");
  });
});

test("a signed-in User's Custom Category is saved to their Group", async ({ page }) => {
  await page.goto("/sign-up");
  await field(page, "Name").fill("Maya Chen");
  await field(page, "Email").fill(uniqueEmail());
  await field(page, "Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("link", { name: "New Group" }).click();
  await field(page, "Name").fill("Flat");
  await page.getByRole("button", { name: "Create Group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Flat" })).toBeVisible();
  await page.getByRole("link", { name: "Group settings" }).click();

  await field(page, "Add a Category").fill("Pets");
  await categories(page).getByRole("button", { name: "Add Category" }).click();
  await expect(page.getByText("Added the Category Pets.")).toBeVisible();
  await page.reload();
  await expect(categories(page).getByText("Pets", { exact: true })).toBeVisible();

  await categories(page).getByRole("button", { name: "Delete Pets" }).click();
  await page.getByRole("button", { name: "Delete Category" }).click();
  await expect(page.getByText("Deleted the Category Pets.")).toBeVisible();
  await expect(categories(page).getByText("Pets", { exact: true })).toHaveCount(0);
});
