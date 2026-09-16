import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getCustomer, listLedgerEntries } from "@/lib/customers";
import { buildLedgerRows } from "@/lib/ledger-rows";
import { formatPaise } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { Ledger } from "./ledger";

export default async function CustomerPage({
  params,
}: PageProps<"/customer/[id]">) {
  await requireSession();

  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  const rows = buildLedgerRows(await listLedgerEntries(id));

  return (
    <main className="flex-1 max-w-md w-full mx-auto pb-28">
      <header className="border-b border-line bg-surface">
        <div className="flex items-center justify-between gap-2 px-2 pt-4">
          <Link
            href="/"
            className="tap flex items-center justify-center px-2 text-2xl text-ink-soft"
            aria-label="Back"
          >
            ←
          </Link>
          <Link
            href={`/customer/${customer.id}/edit`}
            className="tap flex items-center px-3 text-sm text-ink-soft underline underline-offset-4"
          >
            Edit
          </Link>
        </div>

        <div className="px-4 pb-5 pt-1">
          <h1 className="text-2xl font-bold break-words">{customer.name}</h1>
          <a
            href={`tel:+91${customer.phone}`}
            className="inline-block tap text-ink-soft tnum underline underline-offset-4"
          >
            {formatPhone(customer.phone)}
          </a>
          {customer.note ? (
            <p className="mt-1 text-sm text-ink-soft">{customer.note}</p>
          ) : null}

          <p className="mt-5 text-sm text-ink-soft">Outstanding</p>
          <p
            className={`text-4xl font-bold tnum ${
              customer.outstandingPaise > 0 ? "text-due" : "text-ink-faint"
            }`}
          >
            ₹{formatPaise(customer.outstandingPaise)}
          </p>
        </div>
      </header>

      <Ledger
        customerId={customer.id}
        customerName={customer.name}
        outstandingPaise={customer.outstandingPaise}
        rows={rows}
      />
    </main>
  );
}
