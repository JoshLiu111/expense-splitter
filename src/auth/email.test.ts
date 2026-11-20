import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { addedToGroupEmail } = await import("./email");

describe("addedToGroupEmail", () => {
  const email = addedToGroupEmail(
    { to: "theo@example.com", groupName: "Flat 3B", inviterName: "Ana" },
    "https://app.example/groups/grp_1",
  );

  it("goes to the added User and names the Group and who added them", () => {
    expect(email.to).toBe("theo@example.com");
    expect(email.subject).toBe("Ana added you to Flat 3B on Expense Splitter");
    expect(email.text).toContain("Ana added you to the Group Flat 3B");
  });

  it("links to the Group, with no other link before it", () => {
    expect(email.text.match(/https?:\/\/\S+/)?.[0]).toBe("https://app.example/groups/grp_1");
    expect(email.html).toContain('<a href="https://app.example/groups/grp_1">Open Flat 3B</a>');
  });

  it("escapes names in the HTML", () => {
    const html = addedToGroupEmail({ to: "t@example.com", groupName: "<b>", inviterName: "A&B" }, "https://x").html;

    expect(html).not.toContain("<b>");
    expect(html).toContain("A&#38;B");
  });
});
