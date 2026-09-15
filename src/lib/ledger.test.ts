import { describe, expect, it } from "vitest";
import {
  type LedgerEntry,
  creditHasLanded,
  entryDelta,
  isPendingLink,
  outstandingPaise,
} from "./ledger";

function debit(amountPaise: number, over: Partial<LedgerEntry> = {}): LedgerEntry {
  return { type: "DEBIT", amountPaise, paymentStatus: null, deletedAt: null, ...over };
}

function credit(amountPaise: number, over: Partial<LedgerEntry> = {}): LedgerEntry {
  return { type: "CREDIT", amountPaise, paymentStatus: null, deletedAt: null, ...over };
}

describe("outstandingPaise", () => {
  it("is goods taken minus payments received", () => {
    expect(outstandingPaise([debit(450000), debit(128000), credit(100000)])).toBe(
      478000,
    );
  });

  it("is zero for a customer with no entries", () => {
    expect(outstandingPaise([])).toBe(0);
  });

  it("ignores an unpaid payment link", () => {
    const entries = [debit(500000), credit(500000, { paymentStatus: "CREATED" })];
    expect(outstandingPaise(entries)).toBe(500000);
  });

  it("counts a link once Razorpay says PAID", () => {
    const entries = [debit(500000), credit(500000, { paymentStatus: "PAID" })];
    expect(outstandingPaise(entries)).toBe(0);
  });

  it("ignores cancelled and expired links", () => {
    for (const status of ["CANCELLED", "EXPIRED"] as const) {
      expect(outstandingPaise([debit(500000), credit(500000, { paymentStatus: status })])).toBe(
        500000,
      );
    }
  });

  it("counts cash payments immediately", () => {
    expect(creditHasLanded({ paymentStatus: null })).toBe(true);
  });

  it("ignores struck-off entries on both sides", () => {
    const deletedAt = new Date();
    expect(outstandingPaise([debit(500000), debit(200000, { deletedAt })])).toBe(500000);
    expect(outstandingPaise([debit(500000), credit(200000, { deletedAt })])).toBe(500000);
  });

  it("can go negative when the customer has overpaid", () => {
    expect(outstandingPaise([debit(100000), credit(150000)])).toBe(-50000);
  });
});

describe("entryDelta", () => {
  it("signs debits positive and landed credits negative", () => {
    expect(entryDelta(debit(1000))).toBe(1000);
    expect(entryDelta(credit(1000))).toBe(-1000);
    expect(entryDelta(credit(1000, { paymentStatus: "CREATED" }))).toBe(0);
  });
});

describe("isPendingLink", () => {
  it("is true only for CREATED", () => {
    expect(isPendingLink({ paymentStatus: "CREATED" })).toBe(true);
    expect(isPendingLink({ paymentStatus: "PAID" })).toBe(false);
    expect(isPendingLink({ paymentStatus: null })).toBe(false);
  });
});
