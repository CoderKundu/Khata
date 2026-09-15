import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getCustomer } from "@/lib/customers";
import { updateCustomer } from "../../actions";
import { CustomerForm } from "../../customer-form";
import { ArchiveButton } from "../archive-button";

export default async function EditCustomerPage({
  params,
  searchParams,
}: PageProps<"/customer/[id]/edit">) {
  await requireSession();

  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  const { error } = await searchParams;
  const blockedByBalance = error === "balance";

  return (
    <main className="flex-1 max-w-md w-full mx-auto pb-10">
      <header className="flex items-center gap-2 px-2 pt-4 pb-2 border-b border-line">
        <Link
          href={`/customer/${customer.id}`}
          className="tap flex items-center justify-center px-2 text-2xl text-ink-soft"
          aria-label="Back"
        >
          ←
        </Link>
        <h1 className="text-lg font-semibold">Badlav</h1>
      </header>

      <CustomerForm
        action={updateCustomer}
        values={customer}
        submitLabel="Save"
      />

      <div className="px-4 pt-2">
        <div className="border-t border-line pt-6">
          {blockedByBalance ? (
            <p role="alert" className="mb-3 text-due font-medium">
              Money is still outstanding, so this customer cannot be removed.
            </p>
          ) : null}
          <ArchiveButton id={customer.id} name={customer.name} />
          <p className="mt-2 text-sm text-ink-faint text-center">
            Past entries are kept.
          </p>
        </div>
      </div>
    </main>
  );
}
