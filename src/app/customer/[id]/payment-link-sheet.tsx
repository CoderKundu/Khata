"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/app/bottom-sheet";
import { formatRupees, paiseToRupeeString } from "@/lib/money";
import { emptyPaymentLinkState } from "@/lib/payment-link-state";
import { sendPaymentLink } from "./payment-link-actions";

export function PaymentLinkSheet({
  customerId,
  customerName,
  outstandingPaise,
  onClose,
}: {
  customerId: string;
  customerName: string;
  outstandingPaise: number;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    sendPaymentLink,
    emptyPaymentLinkState,
  );

  const whatsappRef = useRef<HTMLAnchorElement>(null);
  const [copied, setCopied] = useState(false);

  /*
   * Once the link exists, hand straight off to WhatsApp — that is the whole
   * point of the feature. It goes through a real anchor click rather than
   * assigning to location, because a click on an <a href> is what mobile
   * browsers reliably route into the installed app.
   *
   * The sheet still renders the link and the button behind this, so if the
   * hand-off is blocked or WhatsApp is not installed, the shopkeeper is
   * looking at the link rather than at nothing.
   */
  useEffect(() => {
    if (!state.sent) return;
    const timer = setTimeout(() => whatsappRef.current?.click(), 400);
    return () => clearTimeout(timer);
  }, [state.sent]);

  return (
    <BottomSheet open onClose={onClose} title="Send payment link">
      {state.sent ? (
        <div className="px-4 pt-2 pb-6">
          <p className="text-ink-soft">
            Link ready for <span className="font-semibold">{customerName}</span>.
          </p>

          <p className="mt-3 break-all rounded-xl border border-line bg-paper px-4 py-3 text-sm">
            {state.sent.link}
          </p>

          <a
            ref={whatsappRef}
            href={state.sent.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 tap flex h-14 items-center justify-center rounded-xl bg-paid
                       text-lg font-semibold text-white active:brightness-90"
          >
            Send on WhatsApp
          </a>

          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(state.sent?.link ?? "");
                setCopied(true);
              } catch {
                // Clipboard is blocked on insecure origins and in some
                // in-app browsers. The link is on screen either way.
                setCopied(false);
              }
            }}
            className="mt-3 tap h-12 w-full rounded-xl border border-line font-medium
                       text-ink-soft active:bg-paper"
          >
            {copied ? "Copied" : "Copy link"}
          </button>

          <p className="mt-4 text-sm text-ink-faint">
            The ledger shows this as Pending. It will count as paid only when
            Razorpay confirms the payment.
          </p>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-5 px-4 pt-2 pb-6">
          <input type="hidden" name="customerId" value={customerId} />

          <div>
            <label
              htmlFor="amount"
              className="mb-2 block text-sm font-medium text-ink-soft"
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
                inputMode="decimal"
                data-autofocus
                autoComplete="off"
                defaultValue={
                  outstandingPaise > 0
                    ? paiseToRupeeString(outstandingPaise)
                    : ""
                }
                className={`w-full tap h-16 rounded-xl border bg-surface pl-10 pr-4 text-3xl
                            font-semibold tnum outline-none focus:ring-2 focus:ring-brand/20 ${
                              state.errors.amount
                                ? "border-due"
                                : "border-line focus:border-brand"
                            }`}
                aria-invalid={state.errors.amount ? true : undefined}
                aria-describedby={
                  state.errors.amount ? "amount-error" : "amount-hint"
                }
              />
            </div>
            {state.errors.amount ? (
              <p
                id="amount-error"
                role="alert"
                className="mt-2 font-medium text-due"
              >
                {state.errors.amount}
              </p>
            ) : (
              <p id="amount-hint" className="mt-2 text-sm text-ink-faint">
                Full outstanding is {formatRupees(outstandingPaise)}. Edit to
                collect part of it.
              </p>
            )}
          </div>

          {state.formError ? (
            <p role="alert" className="font-medium text-due">
              {state.formError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="tap h-14 rounded-xl bg-brand text-lg font-semibold text-white
                       active:bg-brand-dark disabled:opacity-60"
          >
            {isPending ? "Creating link…" : "Create link"}
          </button>
        </form>
      )}
    </BottomSheet>
  );
}
