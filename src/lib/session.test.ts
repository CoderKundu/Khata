import { beforeAll, describe, expect, it } from "vitest";

/**
 * session.ts reads SESSION_SECRET at call time, so it is enough to set it
 * before the tests run.
 */
beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-not-the-real-one";
  process.env.ADMIN_PASSWORD = "correct horse battery staple";
});

const { createSessionToken, passwordMatches, verifySessionToken } = await import(
  "./session"
);

describe("session tokens", () => {
  it("round-trips a freshly minted token", () => {
    const payload = verifySessionToken(createSessionToken());
    expect(payload).not.toBeNull();
    expect(payload?.exp).toBeGreaterThan(payload!.iat);
  });

  it("rejects nothing at all", () => {
    expect(verifySessionToken(undefined)).toBeNull();
    expect(verifySessionToken(null)).toBeNull();
    expect(verifySessionToken("")).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(verifySessionToken("garbage")).toBeNull();
    expect(verifySessionToken("a.b.c")).toBeNull();
    expect(verifySessionToken(".")).toBeNull();
  });

  // The whole point: the payload is readable, so it must not be trustable
  // without the signature.
  it("rejects a token whose payload was edited", () => {
    const token = createSessionToken();
    const [, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ iat: 0, exp: 9_999_999_999 }),
      "utf8",
    ).toString("base64url");

    expect(verifySessionToken(`${forged}.${signature}`)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSessionToken();
    process.env.SESSION_SECRET = "a-different-secret";
    expect(verifySessionToken(token)).toBeNull();
    process.env.SESSION_SECRET = "test-secret-not-the-real-one";
  });

  it("rejects an expired token", () => {
    const issued = Date.parse("2020-01-01T00:00:00Z");
    const token = createSessionToken(issued);
    const wellAfterExpiry = issued + 1000 * 60 * 60 * 24 * 365;

    expect(verifySessionToken(token, issued + 1000)).not.toBeNull();
    expect(verifySessionToken(token, wellAfterExpiry)).toBeNull();
  });
});

describe("passwordMatches", () => {
  it("accepts the configured password and nothing else", () => {
    expect(passwordMatches("correct horse battery staple")).toBe(true);
    expect(passwordMatches("correct horse battery stapl")).toBe(false);
    expect(passwordMatches("")).toBe(false);
    expect(passwordMatches("CORRECT HORSE BATTERY STAPLE")).toBe(false);
  });
});
