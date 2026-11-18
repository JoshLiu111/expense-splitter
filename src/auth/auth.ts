import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import { account, session, user, verification } from "@/db/schema";
import { MIN_PASSWORD_LENGTH } from "./password";

export { MIN_PASSWORD_LENGTH };

function createAuth() {
  return betterAuth({
    // Users and sessions live in our own Postgres (ADR 0005).
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      autoSignIn: true,
    },
    // Persistent cookie: the session survives a browser restart.
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    plugins: [nextCookies()],
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

/** The Better Auth server, created on first use so builds don't need secrets. */
export function auth() {
  instance ??= createAuth();
  return instance;
}
