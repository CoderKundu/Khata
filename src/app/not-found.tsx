import Link from "next/link";

/**
 * Reached by notFound() when a customer id does not exist — most likely a
 * customer who has been removed from the list, opened from an old link.
 */
export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col justify-center px-6 py-10 max-w-md w-full mx-auto">
      <h1 className="text-2xl font-bold">Not found</h1>
      <p className="mt-2 text-ink-soft">
        This page does not exist. The customer may have been removed from the
        list.
      </p>

      <Link
        href="/"
        className="mt-6 tap flex h-14 items-center justify-center rounded-xl bg-brand
                   text-lg font-semibold text-white active:bg-brand-dark"
      >
        Back to customers
      </Link>
    </main>
  );
}
