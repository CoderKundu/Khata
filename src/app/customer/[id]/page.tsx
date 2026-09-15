import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getCustomer } from "@/lib/customers";
import { formatPaise } from "@/lib/money";
import { formatPhone } from "@/lib/phone";

export default async function CustomerPage({
  params,
}: PageProps<"/customer/[id]">) {
  await requireSession();

  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

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
          <h1 className="text-2xl font-bold">{customer.name}</h1>
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

      {/* Step 4 puts the two action buttons and the entries table here. */}
      <p className="px-6 py-14 text-center text-ink-soft">
        Entries will appear here.
      </p>
    </main>
  );
}
