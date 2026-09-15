"use client";

import { archiveCustomer } from "../actions";

/**
 * Archiving is reversible in the database but invisible in the app, so it asks
 * first. The Server Action refuses outright while money is outstanding — this
 * confirm is the courtesy, not the safeguard.
 */
export function ArchiveButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  return (
    <form
      action={archiveCustomer}
      onSubmit={(event) => {
        const ok = window.confirm(
          `Remove ${name} from the list?\n\nPast entries are kept. Only the list hides them.`,
        );
        if (!ok) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="tap w-full h-12 rounded-xl border border-line text-ink-soft font-medium
                   active:bg-paper"
      >
        Remove from list
      </button>
    </form>
  );
}
