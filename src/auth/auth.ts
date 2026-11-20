import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import type { Database } from "@/db/client";
import { account, session, user, verification } from "@/db/schema";
import { claimPendingMembers } from "@/groups/postgres-group-repository";
import { resetPasswordEmail, sendEmail, verificationEmail } from "./email";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./password";

/** A Better Auth server keeping its Users and sessions in `database`. */
export function createAuth(database: Database) {
  return betterAuth({
    // Users and sessions live in our own Postgres (ADR 0005).
    database: drizzleAdapter(database, {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      autoSignIn: true,
      // Users can use the app before verifying; verifying links Pending Members.
      requireEmailVerification: false,
      sendResetPassword: ({ user, url }) => sendEmail(resetPasswordEmail(user, url)),
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
    },
    emailVerification: {
      sendOnSignUp: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: ({ user, url }) => sendEmail(verificationEmail(user, url)),
      // Only a verified email may claim a Pending Member (ADR 0005).
      afterEmailVerification: (user) => claimPendingMembers(database, user),
    },
    // Persistent cookie: the session survives a browser restart.
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

/** The Better Auth server, created on first use so builds don't need secrets. */
export function auth() {
  instance ??= createAuth(db());
  return instance;
}
