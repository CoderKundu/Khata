import { describe, expect, it } from "vitest";
import {
  MAX_AMOUNT_PAISE,
  formatPaise,
  formatRupees,
  paiseToRupeeString,
  parseRupeesToPaise,
} from "./money";

describe("parseRupeesToPaise", () => {
  it("parses whole rupees", () => {
    expect(parseRupeesToPaise("1200")).toEqual({ ok: true, paise: 120000 });
  });

  it("parses one and two decimal places", () => {
    expect(parseRupeesToPaise("1200.5")).toEqual({ ok: true, paise: 120050 });
    expect(parseRupeesToPaise("1200.05")).toEqual({ ok: true, paise: 120005 });
  });

  it("tolerates commas, spaces and a rupee sign", () => {
    expect(parseRupeesToPaise(" ₹1,20,000.50 ")).toEqual({
      ok: true,
      paise: 12000050,
    });
  });

  // The whole reason this function exists: parseFloat("1234.35") * 100 is
  // 123434.99999999999, which rounds down to a paisa lost.
  it("does not lose a paisa on values that break float math", () => {
    const cases: ReadonlyArray<readonly [string, number]> = [
      ["1234.35", 123435], // parseFloat("1234.35") * 100 === 123434.99999999999
      ["8.29", 829],
      ["0.07", 7],
      ["1.10", 110],
      ["99999.99", 9999999],
    ];

    for (const [rupees, expected] of cases) {
      const result = parseRupeesToPaise(rupees);
      expect(result).toEqual({ ok: true, paise: expected });
    }
  });

  it("round-trips back to the string form Razorpay wants", () => {
    expect(paiseToRupeeString(123435)).toBe("1234.35");
    expect(paiseToRupeeString(110)).toBe("1.10");
    expect(paiseToRupeeString(120000)).toBe("1200");
  });

  it("rejects junk, negatives, zero and three decimals", () => {
    for (const bad of ["", "abc", "-50", "0", "0.00", "12.345", "1e3", "..", "5.5.5"]) {
      expect(parseRupeesToPaise(bad).ok).toBe(false);
    }
  });

  it("rejects amounts past what a Postgres Int holds", () => {
    expect(parseRupeesToPaise("21474836.47")).toEqual({
      ok: true,
      paise: MAX_AMOUNT_PAISE,
    });
    expect(parseRupeesToPaise("21474836.48").ok).toBe(false);
  });
});

describe("formatPaise", () => {
  it("drops decimals for whole rupees", () => {
    expect(formatPaise(120000)).toBe("1,200");
  });

  it("keeps two decimals otherwise", () => {
    expect(formatPaise(120050)).toBe("1,200.50");
    expect(formatPaise(120005)).toBe("1,200.05");
  });

  it("groups the Indian way", () => {
    expect(formatPaise(1_00_00_000 * 100)).toBe("1,00,00,000");
    expect(formatRupees(12345600)).toBe("₹1,23,456");
  });

  it("handles zero and negatives", () => {
    expect(formatPaise(0)).toBe("0");
    expect(formatPaise(-50000)).toBe("-500");
  });
});
