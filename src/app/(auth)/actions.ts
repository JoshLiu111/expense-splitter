"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, MIN_PASSWORD_LENGTH } from "@/auth/auth";
import { safeReturnTo } from "@/auth/return-to";

export interface AuthFormState {
  errors?: { name?: string; email?: string; password?: string; form?: string };
  /** What the visitor typed (never the password), to refill the form. */
  values?: { name?: string; email?: string };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  if (!name) errors.name = "Enter your name.";
  if (!email) errors.email = "Enter your email address.";
  else if (!EMAIL.test(email)) errors.email = "Enter an email address like name@example.com.";
  if (password.length < MIN_PASSWORD_LENGTH)
    errors.password = `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (Object.keys(errors).length > 0) return { errors, values };

  try {
    await auth().api.signUpEmail({
      body: { name, email, password },
      headers: await headers(),
    });
  } catch (error) {
    const code = errorCode(error);
    if (code?.startsWith("USER_ALREADY_EXISTS"))
      return {
        errors: { email: "This email is already registered. Sign in instead." },
        values,
      };
    if (code === "PASSWORD_TOO_LONG")
      return { errors: { password: "Use a password of 128 characters or fewer." }, values };
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
    if (errorCode(error) === "INVALID_EMAIL_OR_PASSWORD" || errorCode(error) === "INVALID_EMAIL")
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
