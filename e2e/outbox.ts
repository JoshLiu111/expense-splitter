import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect } from "@playwright/test";

/** The app writes emails here instead of sending them; tests read the links. */
export const EMAIL_OUTBOX_DIR = ".e2e-outbox";

interface Email {
  to: string;
  subject: string;
  text: string;
}

async function emailsTo(to: string): Promise<Email[]> {
  let files: string[];
  try {
    files = (await readdir(EMAIL_OUTBOX_DIR)).sort();
  } catch {
    return [];
  }
  const emails = await Promise.all(
    files.map(async (f) => JSON.parse(await readFile(path.join(EMAIL_OUTBOX_DIR, f), "utf8")) as Email),
  );
  return emails.filter((e) => e.to === to);
}

/** The link in the latest email to `to` whose subject matches, once it arrives. */
export async function linkInEmail(to: string, subject: RegExp): Promise<string> {
  let link = "";
  await expect
    .poll(async () => {
      const email = (await emailsTo(to)).filter((e) => subject.test(e.subject)).at(-1);
      link = email?.text.match(/https?:\/\/\S+/)?.[0] ?? "";
      return link;
    }, { message: `an email to ${to} matching ${subject}` })
    .not.toBe("");
  return link;
}
