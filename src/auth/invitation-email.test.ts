import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { invitationEmail } = await import("./email");

describe("invitationEmail", () => {
  const email = invitationEmail(
    { to: "dev@example.com", groupName: "Flat 3B", inviterName: "Ana" },
    "https://app.example/invite/tok_1",
  );

  it("goes to the Pending Member's email and names the Group and who invited them", () => {
    expect(email.to).toBe("dev@example.com");
    expect(email.subject).toBe("Ana invited you to Flat 3B on Expense Splitter");
    expect(email.text).toContain("Ana added you to the Group Flat 3B");
  });

  it("links to the Invitation, with no other link before it, and says it lasts 7 days", () => {
    expect(email.text.match(/https?:\/\/\S+/)?.[0]).toBe("https://app.example/invite/tok_1");
    expect(email.html).toContain('<a href="https://app.example/invite/tok_1">Join Flat 3B</a>');
    expect(email.text).toContain("7 days");
  });

  it("escapes names in the HTML", () => {
    const html = invitationEmail({ to: "d@example.com", groupName: "<b>", inviterName: "A&B" }, "https://x").html;

    expect(html).not.toContain("<b>");
    expect(html).toContain("A&#38;B");
  });
});
