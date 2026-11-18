import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { signInPath } from "@/auth/return-to";

/**
 * Optimistic check: sends visitors without a session cookie to sign-in before
 * rendering. Pages still verify the session itself on the server.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  return NextResponse.redirect(new URL(signInPath(pathname + search), request.url));
}

export const config = {
  matcher: ["/dashboard/:path*", "/groups/:path*"],
};
