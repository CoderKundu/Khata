import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { listCustomers, totalOutstanding } from "@/lib/customers";
import { CustomerList } from "./customer-list";
import { logout } from "./login/logout";

const SHOP_NAME = process.env.NEXT_PUBLIC_SHOP_NAME ?? "Khata";

export default async function HomePage() {
  await requireSession();

  const customers = await listCustomers();

  return (
    <main className="flex-1 max-w-md w-full mx-auto pb-28">
      <CustomerList
        customers={customers}
        totalPaise={totalOutstanding(customers)}
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-5 pb-1">
          <h1 className="text-lg font-semibold truncate">{SHOP_NAME}</h1>
          <form action={logout}>
            <button
              type="submit"
              className="tap px-2 text-sm text-ink-soft underline underline-offset-4"
            >
              Log out
            </button>
          </form>
        </div>
      </CustomerList>

      {/*
        Bottom-right and above the home indicator: this is a one-handed,
        thumb-reachable target, not a link buried at the top of the page.
      */}
      <Link
        href="/customer/new"
        className="fixed bottom-6 right-5 z-20 flex items-center gap-2 rounded-full
                   bg-brand px-5 h-14 text-white text-base font-semibold shadow-lg
                   active:bg-brand-dark"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <span aria-hidden="true" className="text-2xl leading-none">
          +
        </span>
        Naya grahak
      </Link>
    </main>
  );
}
