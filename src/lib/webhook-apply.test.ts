import { beforeEach, describe, expect, it } from "vitest";
import { type LedgerEntry, outstandingPaise } from "./ledger";
import { parsePaymentLinkEvent } from "./razorpay-webhook";
import {
  type WebhookEntry,
  type WebhookEntryStore,
  applyPaymentLinkEvent,
} from "./webhook-apply";

/**
 * The entries a customer has, as rows a store can mutate. Balance is computed
 * with the real outstandingPaise, so these tests assert the actual ledger rule
 * rather than a restatement of it.
 */
type Row = WebhookEntry & LedgerEntry;

function debit(amountPaise: number): Row {
  return {
    id: `debit_${amountPaise}`,
    type: "DEBIT",
    amountPaise,
    paymentStatus: null,
    deletedAt: null,
    razorpayLinkId: null,
  };
}

function pendingLink(
  id: string,
  amountPaise: number,
  over: Partial<Row> = {},
): Row {
  return {
    id,
    type: "CREDIT",
    amountPaise,
    paymentStatus: "CREATED",
    deletedAt: null,
    razorpayLinkId: `plink_${id}`,
    ...over,
  };
}

/**
 * Mirrors the Prisma implementation's contract: settle applies only while the
 * entry is still CREATED, and reports how many rows it changed.
 */
function makeStore(rows: Row[]): WebhookEntryStore & { rows: Row[] } {
  return {
    rows,
    findByLinkId: async (linkId) =>
      rows.find((r) => r.razorpayLinkId === linkId) ?? null,
    findById: async (id) => rows.find((r) => r.id === id) ?? null,
    settle: async ({ entryId, status, linkId }) => {
      const row = rows.find(
        (r) => r.id === entryId && r.paymentStatus === "CREATED",
      );
      if (!row) return 0;

      row.paymentStatus = status;
      row.razorpayLinkId = linkId;
      row.deletedAt = null;
      return 1;
    },
  };
}

/** A realistic Razorpay body, so the test exercises parsing as well. */
function paymentLinkBody(
  event: string,
  { linkId, entryId }: { linkId: string; entryId: string },
): string {
  return JSON.stringify({
    entity: "event",
    account_id: "acc_test",
    event,
    contains: ["payment_link", "payment"],
    payload: {
      payment_link: {
        entity: {
          id: linkId,
          reference_id: entryId,
          status: event.split(".")[1],
          amount: 1285000,
          amount_paid: event === "payment_link.paid" ? 1285000 : 0,
          notes: { customerId: "cust_1", entryId },
        },
      },
    },
    created_at: 1789000000,
  });
}

describe("applyPaymentLinkEvent", () => {
  let rows: Row[];
  let store: WebhookEntryStore & { rows: Row[] };

  beforeEach(() => {
    rows = [debit(1285000), pendingLink("entry_1", 1285000)];
    store = makeStore(rows);
  });

  /**
   * The case the spec calls out: Razorpay retries, and the same event will
   * arrive more than once. The second delivery must not credit the customer a
   * second time — that would show a contractor as ₹12,850 in credit when he
   * has paid exactly his balance.
   */
  it("credits once when the same paid event arrives twice", async () => {
    const body = paymentLinkBody("payment_link.paid", {
      linkId: "plink_entry_1",
      entryId: "entry_1",
    });
    const event = parsePaymentLinkEvent(body);
    expect(event).not.toBeNull();
    if (!event) return;

    expect(outstandingPaise(rows)).toBe(1285000);

    const first = await applyPaymentLinkEvent(store, event);
    expect(first).toEqual({ applied: true });
    expect(outstandingPaise(rows)).toBe(0);

    // Byte-for-byte the same payload, delivered again.
    const second = await applyPaymentLinkEvent(store, event);
    expect(second).toEqual({ applied: false, reason: "already-settled" });
    expect(outstandingPaise(rows)).toBe(0);
  });

  it("stays settled however many times it is redelivered", async () => {
    const event = parsePaymentLinkEvent(
      paymentLinkBody("payment_link.paid", {
        linkId: "plink_entry_1",
        entryId: "entry_1",
      }),
    );
    if (!event) throw new Error("unparsed");

    for (let i = 0; i < 5; i += 1) {
      await applyPaymentLinkEvent(store, event);
    }

    expect(outstandingPaise(rows)).toBe(0);
    expect(rows.filter((r) => r.paymentStatus === "PAID")).toHaveLength(1);
  });

  /**
   * Razorpay does not promise delivery order. A cancelled or expired event
   * arriving after the money landed must not un-pay it.
   */
  it("refuses to undo a payment with a later cancelled or expired event", async () => {
    const paid = parsePaymentLinkEvent(
      paymentLinkBody("payment_link.paid", {
        linkId: "plink_entry_1",
        entryId: "entry_1",
      }),
    );
    const cancelled = parsePaymentLinkEvent(
      paymentLinkBody("payment_link.cancelled", {
        linkId: "plink_entry_1",
        entryId: "entry_1",
      }),
    );
    if (!paid || !cancelled) throw new Error("unparsed");

    await applyPaymentLinkEvent(store, paid);
    const outcome = await applyPaymentLinkEvent(store, cancelled);

    expect(outcome).toEqual({ applied: false, reason: "already-settled" });
    expect(rows[1]?.paymentStatus).toBe("PAID");
    expect(outstandingPaise(rows)).toBe(0);
  });

  it("marks a cancelled link cancelled, leaving the balance owed", async () => {
    const event = parsePaymentLinkEvent(
      paymentLinkBody("payment_link.cancelled", {
        linkId: "plink_entry_1",
        entryId: "entry_1",
      }),
    );
    if (!event) throw new Error("unparsed");

    await applyPaymentLinkEvent(store, event);

    expect(rows[1]?.paymentStatus).toBe("CANCELLED");
    expect(outstandingPaise(rows)).toBe(1285000);
  });

  it("ignores a link it has never heard of", async () => {
    const event = parsePaymentLinkEvent(
      paymentLinkBody("payment_link.paid", {
        linkId: "plink_somebody_else",
        entryId: "entry_nobody",
      }),
    );
    if (!event) throw new Error("unparsed");

    expect(await applyPaymentLinkEvent(store, event)).toEqual({
      applied: false,
      reason: "unknown-entry",
    });
    expect(outstandingPaise(rows)).toBe(1285000);
  });

  /**
   * The timeout case from payment-link-actions: we struck off the placeholder
   * because we never learned the link id, but Razorpay had created the link
   * and the customer paid it. Without the reference_id fallback this payment
   * would be money received with no record.
   */
  it("recovers a struck-off placeholder that never learned its link id", async () => {
    rows = [
      debit(1285000),
      pendingLink("entry_1", 1285000, {
        razorpayLinkId: null,
        deletedAt: new Date(),
      }),
    ];
    store = makeStore(rows);

    // Struck off, so it is not in the ledger and the full amount is owed.
    expect(outstandingPaise(rows)).toBe(1285000);

    const event = parsePaymentLinkEvent(
      paymentLinkBody("payment_link.paid", {
        linkId: "plink_recovered",
        entryId: "entry_1",
      }),
    );
    if (!event) throw new Error("unparsed");

    expect(await applyPaymentLinkEvent(store, event)).toEqual({ applied: true });
    expect(rows[1]?.deletedAt).toBeNull();
    expect(rows[1]?.razorpayLinkId).toBe("plink_recovered");
    expect(outstandingPaise(rows)).toBe(0);
  });
});
