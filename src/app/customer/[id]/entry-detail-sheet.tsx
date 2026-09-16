"use client";

import { useActionState, useEffect } from "react";
import { BottomSheet } from "@/app/bottom-sheet";
import { emptyDeleteEntryState, formatEntryDate } from "@/lib/entry-form";
import type { LedgerRow } from "@/lib/ledger-rows";
import { formatRupees } from "@/lib/money";
import { deleteEntry } from "./entry-actions";

/**
 * Tapping a row opens this. It exists so that striking off an entry takes a
 * deliberate second step: rows are tapped by accident on a phone, and this is
 * financial history. The sheet shows what the entry actually is before it
 * offers to remove it — the sheet *is* the confirmation.
 */
export function EntryDetailSheet({
  row,
  customerId,
  onClose,
}: {
  row: LedgerRow;
  customerId: string;
  onClose: () => void;
}) {
  const isDebit = row.type === "DEBIT";
  const [state, formAction, isPending] = useActionState(
    deleteEntry,
    emptyDeleteEntryState,
  );

  // Once the row is struck off, this sheet is describing something that is no
  // longer in the ledger, so it gets out of the way.
  useEffect(() => {
    if (state.deleted) onClose();
  }, [state.deleted, onClose]);

  return (
    <BottomSheet open onClose={onClose} title="Entry">
      <div className="px-4 pt-2 pb-6">
        <p className="text-sm text-ink-soft">
          {isDebit ? "Goods given" : "Payment received"}
        </p>
        <p
          className={`text-3xl font-bold tnum ${
            isDebit ? "text-ink" : "text-paid"
          }`}
        >
          {formatRupees(row.amountPaise)}
        </p>

        <dl className="mt-5 flex flex-col gap-3 text-base">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Date</dt>
            <dd className="tnum">{formatEntryDate(row.entryDate)}</dd>
          </div>
          {row.note ? (
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft shrink-0">Note</dt>
              <dd className="text-right">{row.note}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Balance after</dt>
            <dd className="tnum">{formatRupees(row.runningPaise)}</dd>
          </div>
        </dl>

        {row.pending ? (
          <p className="mt-5 rounded-xl bg-pending-bg px-4 py-3 text-sm text-pending">
            This payment link has not been paid yet, so it has not reduced the
            balance.
          </p>
        ) : null}

        <form action={formAction} className="mt-6">
          <input type="hidden" name="customerId" value={customerId} />
          <input type="hidden" name="entryId" value={row.id} />
          {state.error ? (
            <p role="alert" className="mb-3 text-due font-medium">
              {state.error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={isPending}
            className="tap w-full h-12 rounded-xl border border-due text-due font-semibold
                       active:bg-due/5 disabled:opacity-60"
          >
            {isPending ? "Deleting…" : "Delete entry"}
          </button>
        </form>
        <p className="mt-2 text-center text-sm text-ink-faint">
          Kept in the database, hidden from the ledger.
        </p>
      </div>
    </BottomSheet>
  );
}
