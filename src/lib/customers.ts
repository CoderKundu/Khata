import { prisma } from "@/lib/prisma";
import { outstandingPaise } from "@/lib/ledger";
import type { LedgerRowInput } from "@/lib/ledger-rows";

/**
 * Reading customers together with what they owe.
 *
 * The balance is computed in JS from the entries rather than summed in SQL.
 * That is deliberate: the rule for which entries count (soft-deleted ones do
 * not, unpaid payment links do not) lives in exactly one tested place,
 * src/lib/ledger.ts. Expressing it a second time as a SQL WHERE clause is how
 * the two quietly drift apart, and a wrong balance here is a wrong number on a
 * contractor's phone.
 *
 * This shop has hundreds of customers, not millions. If it ever grows past
 * what one query can carry, the fix is a materialised balance updated in the
 * same transaction as the entry — not a second copy of the rule.
 */

export type CustomerSummary = {
  id: string;
  name: string;
  phone: string;
  note: string | null;
  outstandingPaise: number;
};

const BALANCE_FIELDS = {
  type: true,
  amountPaise: true,
  paymentStatus: true,
  deletedAt: true,
} as const;

export async function listCustomers(): Promise<CustomerSummary[]> {
  const rows = await prisma.customer.findMany({
    where: { archived: false },
    select: {
      id: true,
      name: true,
      phone: true,
      note: true,
      entries: { select: BALANCE_FIELDS },
    },
  });

  return rows
    .map(({ entries, ...customer }) => ({
      ...customer,
      outstandingPaise: outstandingPaise(entries),
    }))
    .sort(
      (a, b) =>
        // Biggest debt first; that is the list he actually wants to work down.
        b.outstandingPaise - a.outstandingPaise ||
        a.name.localeCompare(b.name, "en-IN"),
    );
}

export function totalOutstanding(customers: readonly CustomerSummary[]): number {
  return customers.reduce((sum, c) => sum + c.outstandingPaise, 0);
}

export async function getCustomer(id: string): Promise<CustomerSummary | null> {
  const row = await prisma.customer.findFirst({
    where: { id, archived: false },
    select: {
      id: true,
      name: true,
      phone: true,
      note: true,
      entries: { select: BALANCE_FIELDS },
    },
  });

  if (!row) return null;

  const { entries, ...customer } = row;
  return { ...customer, outstandingPaise: outstandingPaise(entries) };
}

/** Live entries for one customer, in no particular order. */
export async function listLedgerEntries(
  customerId: string,
): Promise<LedgerRowInput[]> {
  return prisma.entry.findMany({
    where: { customerId, deletedAt: null },
    select: {
      id: true,
      type: true,
      amountPaise: true,
      note: true,
      entryDate: true,
      createdAt: true,
      paymentStatus: true,
      deletedAt: true,
      razorpayLinkUrl: true,
    },
  });
}

/** Does this customer have any entry at all? Archiving is only safe if not. */
export async function hasEntries(id: string): Promise<boolean> {
  const count = await prisma.entry.count({
    where: { customerId: id, deletedAt: null },
  });
  return count > 0;
}
