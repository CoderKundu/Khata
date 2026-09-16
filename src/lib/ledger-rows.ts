import { type LedgerEntry, entryDelta, isPendingLink } from "@/lib/ledger";

/**
 * Turning entries into the rows of the ledger table.
 *
 * The running balance is the subtle part. It has to accumulate oldest to
 * newest — that is what "running" means — but the table shows newest first.
 * Accumulating in display order would put a balance next to every row that is
 * the total of everything *after* it, which is nonsense the user would have to
 * catch by mental arithmetic. So: sort forwards, accumulate, then reverse.
 */

export type LedgerRowInput = LedgerEntry & {
  id: string;
  note: string | null;
  entryDate: Date;
  createdAt: Date;
  razorpayLinkUrl: string | null;
};

export type LedgerRow = LedgerRowInput & {
  /** Balance owed after this entry, in paise. */
  runningPaise: number;
  /** A payment link that has been sent but not paid. */
  pending: boolean;
};

/**
 * Two entries dated the same day need a stable order, or the running balance
 * column shuffles between renders. createdAt breaks the tie, and the id breaks
 * that, so the sequence is identical every time.
 */
function chronologically(a: LedgerRowInput, b: LedgerRowInput): number {
  return (
    a.entryDate.getTime() - b.entryDate.getTime() ||
    a.createdAt.getTime() - b.createdAt.getTime() ||
    a.id.localeCompare(b.id)
  );
}

export function buildLedgerRows(
  entries: readonly LedgerRowInput[],
): LedgerRow[] {
  const live = entries.filter((entry) => entry.deletedAt === null);
  const forwards = [...live].sort(chronologically);

  let running = 0;
  const rows = forwards.map((entry) => {
    // A pending link contributes 0, so the running balance holds steady
    // through it — which is exactly what it means for the money not to have
    // arrived yet.
    running += entryDelta(entry);
    return { ...entry, runningPaise: running, pending: isPendingLink(entry) };
  });

  return rows.reverse();
}
