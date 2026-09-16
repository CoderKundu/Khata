import type { PaymentStatus } from "@/generated/prisma/enums";
import type { PaymentLinkEvent } from "@/lib/razorpay-webhook";

/**
 * What a webhook does to the ledger, separated from how it reaches the
 * database so it can be tested without one.
 */

export type WebhookEntry = {
  id: string;
  amountPaise: number;
  paymentStatus: PaymentStatus | null;
  deletedAt: Date | null;
  razorpayLinkId: string | null;
};

export interface WebhookEntryStore {
  findByLinkId(linkId: string): Promise<WebhookEntry | null>;
  findById(entryId: string): Promise<WebhookEntry | null>;

  /**
   * Move an entry to a terminal status, attach the link id, and lift any
   * strike-off.
   *
   * Implementations MUST apply this only while the entry is still CREATED, as
   * a single atomic operation, and MUST return the number of rows they
   * changed. That condition is the idempotency guarantee: the second delivery
   * of the same event matches nothing and changes nothing. Checking the status
   * first and updating afterwards would leave a window for two concurrent
   * deliveries to both pass the check.
   */
  settle(input: {
    entryId: string;
    status: PaymentStatus;
    linkId: string;
  }): Promise<number>;
}

export type ApplyOutcome =
  | { applied: true }
  | { applied: false; reason: "unknown-entry" | "already-settled" };

export async function applyPaymentLinkEvent(
  store: WebhookEntryStore,
  event: PaymentLinkEvent,
): Promise<ApplyOutcome> {
  let entry = await store.findByLinkId(event.linkId);

  /*
   * Fallback to the entry id Razorpay echoes back in reference_id and notes.
   *
   * This covers the case where creating the link timed out: we struck off the
   * placeholder row because we never learned the link id, but Razorpay had
   * created the link anyway and the customer has now paid it. Without this,
   * that payment would arrive with nowhere to go — money received, no record.
   */
  if (!entry && event.entryId) {
    entry = await store.findById(event.entryId);
  }

  if (!entry) return { applied: false, reason: "unknown-entry" };

  const changed = await store.settle({
    entryId: entry.id,
    status: event.status,
    linkId: event.linkId,
  });

  return changed > 0
    ? { applied: true }
    : { applied: false, reason: "already-settled" };
}
