/**
 * Shown while the customer list is being fetched.
 *
 * A skeleton in the shape of the real list rather than a spinner: on a slow
 * connection the page then grows into itself instead of swapping one thing for
 * a different thing, and nothing jumps as the rows arrive.
 */
export default function Loading() {
  return (
    <main className="flex-1 max-w-md w-full mx-auto" aria-busy="true">
      <div className="border-b border-line px-4 pt-5 pb-3">
        <Bar className="h-5 w-40" />
        <Bar className="mt-5 h-3 w-24" />
        <Bar className="mt-2 h-9 w-48" />
        <Bar className="mt-4 h-12 w-full rounded-xl" />
      </div>

      <ul className="divide-y divide-line border-b border-line bg-surface">
        {[0, 1, 2, 3].map((row) => (
          <li
            key={row}
            className="flex items-center justify-between gap-3 px-4 py-4"
          >
            <span className="w-full">
              <Bar className="h-4 w-32" />
              <Bar className="mt-2 h-3 w-24" />
            </span>
            <Bar className="h-5 w-16 shrink-0" />
          </li>
        ))}
      </ul>

      <span className="sr-only">Loading customers</span>
    </main>
  );
}

function Bar({ className }: { className: string }) {
  return (
    <span className={`block animate-pulse rounded bg-line ${className}`} />
  );
}
