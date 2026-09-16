import { describe, expect, it } from "vitest";
import { type LedgerRowInput, buildLedgerRows } from "./ledger-rows";

let seq = 0;

function entry(
  type: "DEBIT" | "CREDIT",
  amountPaise: number,
  day: number,
  over: Partial<LedgerRowInput> = {},
): LedgerRowInput {
  seq += 1;
  return {
    id: `e${seq}`,
    type,
    amountPaise,
    note: null,
    entryDate: new Date(Date.UTC(2026, 8, day, 12)),
    createdAt: new Date(Date.UTC(2026, 8, day, 12)),
    paymentStatus: null,
    deletedAt: null,
    razorpayLinkUrl: null,
    ...over,
  };
}

describe("buildLedgerRows", () => {
  it("returns newest first", () => {
    const rows = buildLedgerRows([
      entry("DEBIT", 10000, 1),
      entry("DEBIT", 20000, 5),
      entry("DEBIT", 30000, 3),
    ]);

    expect(rows.map((r) => r.amountPaise)).toEqual([20000, 30000, 10000]);
  });

  /**
   * The bug this guards against: accumulating in display order. Read top-down
   * the balances must descend as you go back in time, and the newest row must
   * carry the customer's actual outstanding.
   */
  it("accumulates oldest-to-newest even though it displays newest-first", () => {
    const rows = buildLedgerRows([
      entry("DEBIT", 50000, 1),
      entry("CREDIT", 20000, 2),
      entry("DEBIT", 30000, 3),
    ]);

    expect(rows.map((r) => r.runningPaise)).toEqual([60000, 30000, 50000]);
    expect(rows[0]?.runningPaise).toBe(60000);
  });

  it("holds the balance steady through an unpaid payment link", () => {
    const rows = buildLedgerRows([
      entry("DEBIT", 50000, 1),
      entry("CREDIT", 50000, 2, { paymentStatus: "CREATED" }),
    ]);

    expect(rows.map((r) => r.runningPaise)).toEqual([50000, 50000]);
    expect(rows[0]?.pending).toBe(true);
  });

  it("moves the balance once the link is paid", () => {
    const rows = buildLedgerRows([
      entry("DEBIT", 50000, 1),
      entry("CREDIT", 50000, 2, { paymentStatus: "PAID" }),
    ]);

    expect(rows.map((r) => r.runningPaise)).toEqual([0, 50000]);
    expect(rows[0]?.pending).toBe(false);
  });

  it("leaves struck-off entries out entirely", () => {
    const rows = buildLedgerRows([
      entry("DEBIT", 50000, 1),
      entry("DEBIT", 99999, 2, { deletedAt: new Date() }),
      entry("DEBIT", 10000, 3),
    ]);

    expect(rows.map((r) => r.amountPaise)).toEqual([10000, 50000]);
    expect(rows.map((r) => r.runningPaise)).toEqual([60000, 50000]);
  });

  it("orders same-day entries by when they were recorded", () => {
    const early = entry("DEBIT", 10000, 4, {
      createdAt: new Date(Date.UTC(2026, 8, 4, 9)),
    });
    const late = entry("CREDIT", 4000, 4, {
      createdAt: new Date(Date.UTC(2026, 8, 4, 17)),
    });

    // Handed in the wrong order on purpose.
    const rows = buildLedgerRows([late, early]);

    expect(rows.map((r) => r.id)).toEqual([late.id, early.id]);
    expect(rows.map((r) => r.runningPaise)).toEqual([6000, 10000]);
  });

  it("is empty for a customer with nothing on the page", () => {
    expect(buildLedgerRows([])).toEqual([]);
  });

  it("does not mutate what it was given", () => {
    const input = [entry("DEBIT", 10000, 5), entry("DEBIT", 20000, 1)];
    const before = input.map((e) => e.id);

    buildLedgerRows(input);

    expect(input.map((e) => e.id)).toEqual(before);
  });
});
