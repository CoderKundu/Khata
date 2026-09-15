import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps ordinary in-app paths", () => {
    expect(safeNext("/customer/abc123")).toBe("/customer/abc123");
    expect(safeNext("/customer/abc?tab=ledger")).toBe(
      "/customer/abc?tab=ledger",
    );
  });

  it("falls back to / for anything not a path", () => {
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(null)).toBe("/");
    expect(safeNext(42)).toBe("/");
    expect(safeNext("")).toBe("/");
    expect(safeNext("customer/abc")).toBe("/");
  });

  it("refuses to send the user to another origin", () => {
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("/\tevil")).toBe("/");
    expect(safeNext("/\nevil")).toBe("/");
    expect(safeNext("javascript:alert(1)")).toBe("/");
  });
});
