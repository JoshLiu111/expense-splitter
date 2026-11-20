"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth/auth";
import { displayNameRuleError } from "@/auth/display-name";
import { passwordRuleError } from "@/auth/password";
import { safeReturnTo } from "@/auth/return-to";
import { requireUser } from "@/auth/session";
import { EMAIL_PATTERN } from "@/domain";

export interface AuthFormState {
  errors?: { name?: string; email?: string; password?: string; form?: string };
  /** What the visitor typed (never the password), to refill the form. */
  values?: { name?: string; email?: string };
  /** A confirmation to show once the action has worked. */
  done?: string;
}

/** Where the emailed verification link lands, with `?error=` if it failed. */
const VERIFIED_PATH = "/email-verified";
/** Where the emailed reset link lands, with `?token=` or `?error=`. */
const RESET_PATH = "/reset-password";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function errorCode(error: unknown): string | undefined {
  if (!isAPIError(error)) return undefined;
  const body = error.body as { code?: unknown } | undefined;
  return typeof body?.code === "string" ? body.code : undefined;
}

export async function signUp(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const name = text(formData, "name").trim();
  const email = text(formData, "email").trim();
  const password = text(formData, "password");
  const values = { name, email };
  const errors: NonNullable<AuthFormState["errors"]> = {};

  const nameError = displayNameRuleError(name);
  if (nameError) errors.name = nameError;
  if (!email) errors.email = "Enter your email address.";
  else if (!EMAIL_PATTERN.test(email)) errors.email = "Enter an email address like name@example.com.";
  const passwordError = passwordRuleError(password);
  if (passwordError) errors.password = passwordError;
  if (Object.keys(errors).length > 0) return { errors, values };

  try {
    await auth().api.signUpEmail({
      body: { name, email, password, callbackURL: VERIFIED_PATH },
      headers: await headers(),
    });
  } catch (error) {
    const code = errorCode(error);
    if (code?.startsWith("USER_ALREADY_EXISTS"))
      return {
        errors: { email: "This email is already registered. Sign in instead." },
        values,
      };
    if (code === "INVALID_EMAIL")
      return { errors: { email: "Enter an email address like name@example.com." }, values };
    throw error;
  }
  redirect(safeReturnTo(formData.get("next")));
}

export async function signIn(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = text(formData, "email").trim();
  const password = text(formData, "password");
  const values = { email };
  const errors: NonNullable<AuthFormState["errors"]> = {};

  if (!email) errors.email = "Enter your email address.";
  if (!password) errors.password = "Enter your password.";
  if (Object.keys(errors).length > 0) return { errors, values };

  try {
    await auth().api.signInEmail({
      body: { email, password, rememberMe: true },
      headers: await headers(),
    });
  } catch (error) {
    // An over-long password is a wrong password here: Sign-in doesn't reveal the length rule.
    const code = errorCode(error);
    if (code === "INVALID_EMAIL_OR_PASSWORD" || code === "INVALID_EMAIL" || code === "PASSWORD_TOO_LONG")
      return {
        errors: { form: "That email and password don't match. Check both and try again." },
        values,
      };
    throw error;
  }
  redirect(safeReturnTo(formData.get("next")));
}

export async function signOut(): Promise<void> {
  await auth().api.signOut({ headers: await headers() });
  redirect("/");
}

/** Sends a fresh verification link to the signed-in User. */
export async function resendVerificationEmail(): Promise<AuthFormState> {
  const user = await requireUser("/dashboard");
  if (user.emailVerified) return { done: "Your email is already verified." };
  await auth().api.sendVerificationEmail({
    body: { email: user.email, callbackURL: VERIFIED_PATH },
    headers: await headers(),
  });
  return { done: `We sent a new link to ${user.email}.` };
}

const RESET_SENT =
  "If an account uses that email, we've sent it a link to choose a new password. The link works for one hour.";

/** Emails a reset link. Says the same whether or not the email is registered. */
export async function requestPasswordReset(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = text(formData, "email").trim();
  if (!email) return { errors: { email: "Enter your email address." }, values: { email } };
  if (!EMAIL_PATTERN.test(email))
    return { errors: { email: "Enter an email address like name@example.com." }, values: { email } };
  await auth().api.requestPasswordReset({
    body: { email, redirectTo: RESET_PATH },
    headers: await headers(),
  });
  return { done: RESET_SENT, values: { email } };
}

/** Sets a new password from an emailed reset link, then asks to sign in. */
export async function resetPassword(_: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const token = text(formData, "token");
  const password = text(formData, "password");
  const passwordError = passwordRuleError(password);
  if (passwordError) return { errors: { password: passwordError } };
  try {
    await auth().api.resetPassword({ body: { token, newPassword: password }, headers: await headers() });
  } catch (error) {
    const code = errorCode(error);
    if (code === "INVALID_TOKEN")
      return { errors: { form: "This reset link has expired or was already used. Ask for a new one." } };
    throw error;
  }
  redirect("/sign-in?reset=1");
}
