import crypto from "node:crypto";

/**
 * Session handling for the one person who uses this app.
 *
 * There is no user table and no OAuth. A correct password mints a signed
 * cookie; the cookie is the session. The cookie carries no secret — only an
 * issue and expiry time plus an HMAC — so reading it tells an attacker nothing
 * and forging it requires SESSION_SECRET.
 */

export const SESSION_COOKIE = "khata_session";

/** Thirty days. He should not be retyping a password at a counter. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type SessionPayload = {
  /** issued at, epoch seconds */
  iat: number;
  /** expires at, epoch seconds */
  exp: number;
};

function secret(): Buffer {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error(
      "SESSION_SECRET is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return Buffer.from(value, "utf8");
}

function encode(buf: Buffer): string {
  return buf.toString("base64url");
}

function hmac(data: string): Buffer {
  return crypto.createHmac("sha256", secret()).update(data).digest();
}

/** Mint a token for a session starting now. */
export function createSessionToken(now: number = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const payload: SessionPayload = { iat, exp: iat + MAX_AGE_SECONDS };
  const body = encode(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${body}.${encode(hmac(body))}`;
}

/**
 * Verify a token and return its payload, or null if anything is off.
 *
 * Signature is checked with timingSafeEqual so that a wrong guess cannot be
 * narrowed down by how long the comparison took.
 */
export function verifySessionToken(
  token: string | undefined | null,
  now: number = Date.now(),
): SessionPayload | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [body, signature] = parts;
  if (!body || !signature) return null;

  const expected = hmac(body);
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }

  // timingSafeEqual throws on length mismatch, so check that first.
  if (provided.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(provided, expected)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof (payload as SessionPayload).exp !== "number" ||
    typeof (payload as SessionPayload).iat !== "number"
  ) {
    return null;
  }

  const session = payload as SessionPayload;
  if (session.exp * 1000 <= now) return null;

  return session;
}

/**
 * Constant-time password check.
 *
 * Both sides are hashed first so that timingSafeEqual always gets equal-length
 * buffers and the comparison leaks nothing about the real password's length.
 */
export function passwordMatches(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new Error("ADMIN_PASSWORD is not set. Add it to .env.");
  }

  const a = crypto.createHash("sha256").update(input, "utf8").digest();
  const b = crypto.createHash("sha256").update(expected, "utf8").digest();
  return crypto.timingSafeEqual(a, b);
}

/** Cookie options shared by the set and clear paths so they cannot drift. */
export function sessionCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

export { MAX_AGE_SECONDS };
