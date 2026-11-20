import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";

/** An email the app sends: verification and password-reset links, and Group notifications. */
export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Sends an email. With `EMAIL_OUTBOX_DIR` set (end-to-end tests) each email
 * is written there as JSON instead; otherwise Resend sends it when
 * `RESEND_API_KEY` is set. In development without either, the email is
 * logged so its link can still be followed.
 */
export async function sendEmail(email: Email): Promise<void> {
  const outbox = process.env.EMAIL_OUTBOX_DIR;
  if (outbox) {
    await mkdir(outbox, { recursive: true });
    const file = `${Date.now()}-${crypto.randomUUID()}.json`;
    await writeFile(path.join(outbox, file), JSON.stringify(email));
    return;
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const { error } = await new Resend(apiKey).emails.send({
      from: process.env.EMAIL_FROM ?? "Expense Splitter <onboarding@resend.dev>",
      ...email,
    });
    if (error) throw new Error(`Resend couldn't send "${email.subject}": ${error.message}`);
    return;
  }
  if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not set");
  console.info(`[email] To: ${email.to}\nSubject: ${email.subject}\n\n${email.text}`);
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A short email with one call-to-action link. */
function linkEmail(to: string, subject: string, lines: string[], action: string, url: string): Email {
  const text = [...lines, "", `${action}: ${url}`].join("\n");
  const html = [
    ...lines.map((line) => `<p>${escapeHtml(line)}</p>`),
    `<p><a href="${escapeHtml(url)}">${escapeHtml(action)}</a></p>`,
  ].join("\n");
  return { to, subject, text, html };
}

export function verificationEmail(user: { name: string; email: string }, url: string): Email {
  return linkEmail(
    user.email,
    "Verify your email for Expense Splitter",
    [
      `Hi ${user.name},`,
      "Verify your email address so any Groups people have added you to by email show up in Your Groups.",
      "If you didn't sign up for Expense Splitter, you can ignore this email.",
    ],
    "Verify my email",
    url,
  );
}

export function resetPasswordEmail(user: { name: string; email: string }, url: string): Email {
  return linkEmail(
    user.email,
    "Reset your Expense Splitter password",
    [
      `Hi ${user.name},`,
      "Someone asked to reset the password for your Expense Splitter account. The link works for one hour.",
      "If it wasn't you, you can ignore this email; your password won't change.",
    ],
    "Choose a new password",
    url,
  );
}

/** Tells an existing User they were linked as a Member of a Group, with a link to it. */
export function addedToGroupEmail(
  added: { to: string; groupName: string; inviterName: string },
  url: string,
): Email {
  return linkEmail(
    added.to,
    `${added.inviterName} added you to ${added.groupName} on Expense Splitter`,
    [
      "Hi,",
      `${added.inviterName} added you to the Group ${added.groupName}. It's already in Your Groups, so you can start sharing Expenses there straight away.`,
    ],
    `Open ${added.groupName}`,
    url,
  );
}
