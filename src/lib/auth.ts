import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  type SessionPayload,
  createSessionToken,
  sessionCookieOptions,
  verifySessionToken,
} from "@/lib/session";

/**
 * Server-side session access.
 *
 * proxy.ts turns unauthenticated visitors away at the door, but that is only
 * the first gate. Server Actions can be POSTed to directly without ever loading
 * a page, so every action and every page calls requireSession() for itself.
 */

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/** Use at the top of any protected page or Server Action. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function startSession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions());
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
