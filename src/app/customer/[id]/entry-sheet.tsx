"use client";

import { useActionState, useEffect, useState } from "react";
import { BottomSheet } from "@/app/bottom-sheet";
import { useToast } from "@/app/toast";
import {
  type EntryFormState,
  emptyEntryFormState,
  todayISO,
} from "@/lib/entry-form";

type EntryAction = (
  previous: EntryFormState,
  formData: FormData,
) => Promise<EntryFormState>;

/**
 * The add-entry sheet. Mounted only while open, so every opening starts from a
 * blank form and a clean action state.
 */
export function EntrySheet({
  customerId,
  title,
  action,
  submitLabel,
  tone,
  onClose,
}: {
  customerId: string;
  title: string;
  action: EntryAction;
  submitLabel: string;
  tone: "debit" | "credit";
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    emptyEntryFormState,
  );

  // The device's today, read once on mount rather than rendered on the server,
  // where the timezone is Vercel's and not the shop's.
  const [today] = useState(todayISO);

  const toast = useToast();

  useEffect(() => {
    if (!state.saved) return;
    onClose();
    toast(tone === "debit" ? "Goods added" : "Payment recorded");
  }, [state.saved, onClose, toast, tone]);

  return (
    <BottomSheet open onClose={onClose} title={title}>
      <form action={formAction} className="flex flex-col gap-5 px-4 pt-2 pb-6">
        <input type="hidden" name="customerId" value={customerId} />

        <div>
          <label
            htmlFor="amount"
            className="block text-sm font-medium text-ink-soft mb-2"
          >
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-ink-faint">
              ₹
            </span>
            <input
              id="amount"
              name="amount"
              type="text"
              // decimal, not numeric: it brings up the keypad *with* a decimal
              // point, and paise still have to be typeable.
              inputMode="decimal"
              // BottomSheet focuses this after showModal; see the note there.
              data-autofocus
              autoComplete="off"
              placeholder="0"
              className={`w-full tap h-16 rounded-xl border bg-surface pl-10 pr-4 text-3xl
                          font-semibold tnum outline-none focus:ring-2 focus:ring-brand/20 ${
                            state.errors.amount
                              ? "border-due"
                              : "border-line focus:border-brand"
                          }`}
              aria-invalid={state.errors.amount ? true : undefined}
              aria-describedby={state.errors.amount ? "amount-error" : undefined}
            />
          </div>
          {state.errors.amount ? (
            <p
              id="amount-error"
              role="alert"
              className="mt-2 text-due font-medium"
            >
              {state.errors.amount}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="note"
            className="block text-sm font-medium text-ink-soft mb-2"
          >
            Note <span className="font-normal text-ink-faint">(optional)</span>
          </label>
          <input
            id="note"
            name="note"
            type="text"
            autoComplete="off"
            autoCapitalize="sentences"
            placeholder={
              tone === "debit" ? "e.g. Cement 10 bori" : "e.g. Cash, UPI"
            }
            className="w-full tap h-14 rounded-xl border border-line bg-surface px-4 text-lg
                       outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <div>
          <label
            htmlFor="date"
            className="block text-sm font-medium text-ink-soft mb-2"
          >
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={today}
            max={today}
            className={`w-full tap h-14 rounded-xl border bg-surface px-4 text-lg tnum
                        outline-none focus:ring-2 focus:ring-brand/20 ${
                          state.errors.date
                            ? "border-due"
                            : "border-line focus:border-brand"
                        }`}
            aria-invalid={state.errors.date ? true : undefined}
            aria-describedby={state.errors.date ? "date-error" : undefined}
          />
          {state.errors.date ? (
            <p id="date-error" role="alert" className="mt-2 text-due font-medium">
              {state.errors.date}
            </p>
          ) : null}
        </div>

        {state.formError ? (
          <p role="alert" className="text-due font-medium">
            {state.formError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className={`tap h-14 rounded-xl text-white text-lg font-semibold
                      disabled:opacity-60 ${
                        tone === "debit"
                          ? "bg-ink active:bg-ink-soft"
                          : "bg-paid active:brightness-90"
                      }`}
        >
          {isPending ? "Saving…" : submitLabel}
        </button>
      </form>
    </BottomSheet>
  );
}
