/**
 * Ledger skeleton. Same shape as the real screen — header, two buttons, rows —
 * so tapping a customer feels like the page filling in rather than a blank
 * gap followed by a jump.
 */
export default function Loading() {
  return (
    <main className="flex-1 max-w-md w-full mx-auto" aria-busy="true">
      <div className="border-b border-line bg-surface px-4 pt-6 pb-5">
        <Bar className="h-7 w-44" />
        <Bar className="mt-3 h-4 w-28" />
        <Bar className="mt-6 h-3 w-20" />
        <Bar className="mt-2 h-9 w-40" />
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 py-4">
        <Bar className="h-14 w-full rounded-xl" />
        <Bar className="h-14 w-full rounded-xl" />
      </div>
      <div className="px-4 pb-4">
        <Bar className="h-12 w-full rounded-xl" />
      </div>

      <div className="divide-y divide-line border-t border-line bg-surface">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="flex items-center gap-3 px-3 py-4">
            <Bar className="h-3 w-12 shrink-0" />
            <Bar className="h-3 w-full" />
            <Bar className="h-3 w-14 shrink-0" />
          </div>
        ))}
      </div>

      <span className="sr-only">Loading ledger</span>
    </main>
  );
}

function Bar({ className }: { className: string }) {
  return (
    <span className={`block animate-pulse rounded bg-line ${className}`} />
  );
}
