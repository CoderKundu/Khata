"use client";

import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import type { CustomerSummary } from "@/lib/customers";
import { formatPaise } from "@/lib/money";
import { formatPhone } from "@/lib/phone";

/**
 * Filtering happens here in the browser rather than as a server round trip.
 * A shop has hundreds of customers, not millions, so the whole list is already
 * on the page — and typing that filters instantly beats typing that waits for
 * the network every keystroke, especially on shop wifi.
 *
 * The search box has to sit inside the pinned header next to the total, and it
 * shares state with the list, so the header lives in here too. `children` is
 * the server-rendered top row (shop name and the logout form, which needs a
 * Server Action) handed down into it.
 */
export function CustomerList({
  customers,
  totalPaise,
  children,
}: {
  customers: CustomerSummary[];
  totalPaise: number;
  children: ReactNode;
}) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return customers;

    // Digits typed into the box should match the phone however it is spaced.
    const digits = needle.replace(/\D/g, "");

    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        (digits !== "" && c.phone.includes(digits)),
    );
  }, [customers, query]);

  return (
    <>
      {/*
        Pinned: the total is the one number he wants at a glance, and it must
        not scroll away behind a long list of customers.
      */}
      <header className="sticky top-0 z-10 bg-paper border-b border-line">
        {children}

        <div className="px-4 pb-3">
          <p className="text-sm text-ink-soft">Kul bakaya</p>
          <p
            className={`text-4xl font-bold tnum ${
              totalPaise > 0 ? "text-due" : "text-ink-faint"
            }`}
          >
            ₹{formatPaise(totalPaise)}
          </p>
        </div>

        <div className="px-4 pb-3">
          <input
            type="search"
            inputMode="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Naam ya number dhoondhein"
            aria-label="Grahak dhoondhein"
            className="w-full tap h-12 rounded-xl border border-line bg-surface px-4 text-base
                       outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </header>

      {matches.length === 0 ? (
        <p className="px-6 py-14 text-center text-ink-soft leading-relaxed">
          {customers.length === 0
            ? "Abhi koi grahak nahi.\nNeeche + dabaiye."
            : "Koi grahak nahi mila."}
        </p>
      ) : (
        <ul className="divide-y divide-line border-b border-line bg-surface">
          {matches.map((customer) => (
            <li key={customer.id}>
              <Link
                href={`/customer/${customer.id}`}
                className="flex items-center justify-between gap-3 px-4 py-4 active:bg-paper"
              >
                <span className="min-w-0">
                  <span className="block font-semibold truncate">
                    {customer.name}
                  </span>
                  <span className="block text-sm text-ink-soft tnum">
                    {formatPhone(customer.phone)}
                  </span>
                </span>

                <span
                  className={`shrink-0 text-lg font-semibold tnum ${
                    customer.outstandingPaise > 0 ? "text-due" : "text-ink-faint"
                  }`}
                >
                  ₹{formatPaise(customer.outstandingPaise)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
