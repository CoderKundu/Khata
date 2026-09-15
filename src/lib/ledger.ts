import type { EntryType, PaymentStatus } from "@/generated/prisma/enums";

/**
 * The balance rules, in one place, as pure functions so they can be tested
 * without a database.
 *
 * Outstanding = everything taken on credit, minus every payment that actually
 * landed. A payment link that has been generated but not paid is NOT a payment;
 * it is a hope. It stays out of the balance until Razorpay says PAID.
 */
export type LedgerEntry = {
  type: EntryType;
  amountPaise: number;
  paymentStatus: PaymentStatus | null;
  deletedAt: Date | null;
};

/** A struck-off entry is invisible to every calculation. */
export function isLive(entry: Pick<LedgerEntry, "deletedAt">): boolean {
  return entry.deletedAt === null;
}

/**
 * Does this CREDIT reduce the balance yet?
 *
 * - paymentStatus null  -> cash handed over in the shop. Counts immediately.
 * - paymentStatus PAID  -> Razorpay confirmed it. Counts.
 * - CREATED / CANCELLED / EXPIRED -> money never arrived. Does not count.
 */
export function creditHasLanded(
  entry: Pick<LedgerEntry, "paymentStatus">,
): boolean {
  return entry.paymentStatus === null || entry.paymentStatus === "PAID";
}

/** Signed contribution of one entry to the outstanding balance, in paise. */
export function entryDelta(entry: LedgerEntry): number {
  if (!isLive(entry)) return 0;
  if (entry.type === "DEBIT") return entry.amountPaise;
  return creditHasLanded(entry) ? -entry.amountPaise : 0;
}

/** Outstanding balance in paise. Positive means the customer owes the shop. */
export function outstandingPaise(entries: readonly LedgerEntry[]): number {
  return entries.reduce((sum, entry) => sum + entryDelta(entry), 0);
}

/** True for a payment link that is still waiting to be paid. */
export function isPendingLink(
  entry: Pick<LedgerEntry, "paymentStatus">,
): boolean {
  return entry.paymentStatus === "CREATED";
}
