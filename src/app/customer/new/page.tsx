import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { createCustomer } from "../actions";
import { CustomerForm } from "../customer-form";

export default async function NewCustomerPage() {
  await requireSession();

  return (
    <main className="flex-1 max-w-md w-full mx-auto">
      <header className="flex items-center gap-2 px-2 pt-4 pb-2 border-b border-line">
        <Link
          href="/"
          className="tap flex items-center justify-center px-2 text-2xl text-ink-soft"
          aria-label="Wapas"
        >
          ←
        </Link>
        <h1 className="text-lg font-semibold">Naya grahak</h1>
      </header>

      <CustomerForm action={createCustomer} submitLabel="Jodo" />
    </main>
  );
}
