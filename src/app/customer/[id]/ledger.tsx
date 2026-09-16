"use client";

import { useCallback, useState } from "react";
import { formatEntryDate } from "@/lib/entry-form";
import type { LedgerRow } from "@/lib/ledger-rows";
import { formatPaise } from "@/lib/money";
import { addGoods, recordPayment } from "./entry-actions";
import { EntryDetailSheet } from "./entry-detail-sheet";
import { EntrySheet } from "./entry-sheet";
import { PaymentLinkSheet } from "./payment-link-sheet";

type OpenSheet =
  | { kind: "debit" }
  | { kind: "credit" }
  | { kind: "link" }
  | { kind: "row"; row: LedgerRow }
  | null;

export function Ledger({
  customerId,
  customerName,
  outstandingPaise,
  rows,
}: {
  customerId: string;
  customerName: string;
  outstandingPaise: number;
  rows: LedgerRow[];
}) {
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const close = useCallback(() => setSheet(null), []);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 px-4 py-4">
        <button
          type="button"
          onClick={() => setSheet({ kind: "debit" })}
          className="tap h-14 rounded-xl bg-ink text-white font-semibold active:bg-ink-soft"
        >
          Add goods
        </button>
        <button
          type="button"
          onClick={() => setSheet({ kind: "credit" })}
          className="tap h-14 rounded-xl bg-paid text-white font-semibold active:brightness-90"
        >
          Record payment
        </button>
      </div>

      {/* Secondary to the two above: it asks for money rather than recording it. */}
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={() => setSheet({ kind: "link" })}
          className="tap h-12 w-full rounded-xl border border-brand font-semibold
                     text-brand active:bg-brand/5"
        >
          Send payment link
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="px-6 py-14 text-center text-ink-soft whitespace-pre-line">
          {"No entries yet.\nAdd goods or record a payment above."}
        </p>
      ) : (
        <table className="w-full text-[13px] border-t border-line">
          <thead>
            <tr className="text-ink-faint text-[11px] uppercase tracking-wide">
              <th scope="col" className="text-left font-medium px-3 py-2">
                Date
              </th>
              <th scope="col" className="text-left font-medium py-2">
                Details
              </th>
              <th scope="col" className="text-right font-medium py-2 pl-2">
                Debit
              </th>
              <th scope="col" className="text-right font-medium py-2 pl-2">
                Credit
              </th>
              <th scope="col" className="text-right font-medium px-3 py-2">
                Balance
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-surface">
            {rows.map((row) => (
              <LedgerRowView
                key={row.id}
                row={row}
                onOpen={() => setSheet({ kind: "row", row })}
              />
            ))}
          </tbody>
        </table>
      )}

      {sheet?.kind === "debit" ? (
        <EntrySheet
          customerId={customerId}
          title="Add goods"
          action={addGoods}
          submitLabel="Save"
          tone="debit"
          onClose={close}
        />
      ) : null}

      {sheet?.kind === "credit" ? (
        <EntrySheet
          customerId={customerId}
          title="Record payment"
          action={recordPayment}
          submitLabel="Save"
          tone="credit"
          onClose={close}
        />
      ) : null}

      {sheet?.kind === "link" ? (
        <PaymentLinkSheet
          customerId={customerId}
          customerName={customerName}
          outstandingPaise={outstandingPaise}
          onClose={close}
        />
      ) : null}

      {sheet?.kind === "row" ? (
        <EntryDetailSheet
          row={sheet.row}
          customerId={customerId}
          onClose={close}
        />
      ) : null}
    </>
  );
}

function LedgerRowView({
  row,
  onOpen,
}: {
  row: LedgerRow;
  onOpen: () => void;
}) {
  const isDebit = row.type === "DEBIT";

  return (
    <tr
      // The row is the tap target for the entry sheet. A <tr> cannot hold a
      // button without breaking the table, so it carries the role itself and
      // answers to Enter and Space like a button would.
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="cursor-pointer active:bg-paper"
    >
      <td className="px-3 py-3 align-top text-ink-soft tnum whitespace-nowrap">
        {formatEntryDate(row.entryDate)}
      </td>

      <td className="py-3 pr-2 align-top">
        <span className="block truncate max-w-[9rem]">{row.note ?? "—"}</span>
        {row.pending ? (
          <span className="mt-1 inline-block rounded-full bg-pending-bg px-2 py-0.5 text-[11px] font-medium text-pending">
            Pending
          </span>
        ) : null}
      </td>

      <td className="py-3 pl-2 text-right align-top tnum whitespace-nowrap">
        {isDebit ? formatPaise(row.amountPaise) : ""}
      </td>

      <td
        // Greyed, not struck through: a strikethrough reads as cancelled, and
        // this money may still very well arrive. The Pending chip says the
        // rest.
        className={`py-3 pl-2 text-right align-top tnum whitespace-nowrap ${
          row.pending ? "text-ink-faint" : "text-paid"
        }`}
      >
        {isDebit ? "" : formatPaise(row.amountPaise)}
      </td>

      <td className="px-3 py-3 text-right align-top font-semibold tnum whitespace-nowrap">
        {formatPaise(row.runningPaise)}
      </td>
    </tr>
  );
}
