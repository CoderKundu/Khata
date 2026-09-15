import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/**
 * Next 16 renamed `middleware` to `proxy`. Same job: run before the route.
 *
 * This is the outer gate — it keeps logged-out visitors from loading any page
 * but /login. It is deliberately not the only check: pages and Server Actions
 * verify the session again themselves, because an action can be POSTed to
 * directly and a proxy that is one day deployed to a CDN edge is the wrong
 * place to hold the last word on access.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  // Already signed in and heading for the login page: send him to the list.
  if (pathname === "/login") {
    if (session) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (session) return NextResponse.next();

  // Remember where he was going so login can bounce him back there.
  const login = new URL("/login", request.url);
  const wanted = `${pathname}${search}`;
  if (wanted !== "/") login.searchParams.set("next", wanted);

  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    /*
     * Everything except Next's own assets, the favicon, and the Razorpay
     * webhook. The webhook is called by Razorpay, which has no session cookie;
     * it authenticates itself with an HMAC signature instead.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)",
  ],
};
