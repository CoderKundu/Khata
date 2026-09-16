import { parseRupeesToPaise } from "@/lib/money";

/**
 * Validation for the add-entry sheet, pure so it can be tested directly.
 *
 * Dates are stored at 12:00 UTC on the chosen day rather than at midnight,
 * and formatEntryDate renders them back in UTC. Both halves matter:
 *
 * - Midnight UTC is the previous evening anywhere behind UTC, so an entry
 *   would file itself under yesterday. Midday survives every offset from
 *   UTC-12 to UTC+11 — but not UTC+13, where midday UTC is 1am tomorrow.
 * - So display is pinned to UTC rather than the device's timezone. Then the
 *   day the shopkeeper picked is the day he reads back, on any phone, set to
 *   any timezone, with no offset arithmetic in between.
 */

export type EntryInput = {
  amountPaise: number;
  note: string | null;
  entryDate: Date;
};

export type EntryFieldErrors = {
  amount?: string;
  date?: string;
};

export type EntryParseResult =
  | { ok: true; value: EntryInput }
  | { ok: false; errors: EntryFieldErrors };

export type EntryFormState = {
  errors: EntryFieldErrors;
  formError: string | null;
  /**
   * True only after an entry was actually written. The sheet watches this to
   * know when to close itself — "no errors" alone cannot say that, because the
   * untouched initial state has no errors either.
   */
  saved: boolean;
};

export const emptyEntryFormState: EntryFormState = {
  errors: {},
  formError: null,
  saved: false,
};

/** Same idea as `saved` above: the detail sheet closes itself on `deleted`. */
export type DeleteEntryState = {
  deleted: boolean;
  error: string | null;
};

export const emptyDeleteEntryState: DeleteEntryState = {
  deleted: false,
  error: null,
};

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** "2026-09-16" -> that day at 12:00 UTC. null if it is not a real date. */
export function parseEntryDate(value: string): Date | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;

  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);

  const date = new Date(Date.UTC(year, month - 1, day, 12));

  // Date.UTC rolls 2026-02-31 over into March. Round-tripping catches that.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

/**
 * "16 Sep", or "16 Sep 25" when the entry is from another year — a ledger
 * column is too narrow for a full date, and the year only earns its space when
 * it is not the obvious one. Always rendered in UTC; see the note at the top.
 */
export function formatEntryDate(date: Date, now: Date = new Date()): string {
  const day = date.getUTCDate();
  // A fixed table rather than Intl: "short" months are locale- and
  // ICU-version-dependent (en-IN gives "Sept", four characters wide), and a
  // date column that changes width between rows is worse than a plain one.
  const month = MONTHS[date.getUTCMonth()];

  const year = date.getUTCFullYear();
  if (year === now.getFullYear()) return `${day} ${month}`;

  return `${day} ${month} ${`${year}`.slice(2)}`;
}

/** Today as "YYYY-MM-DD", for prefilling the date input. */
export function todayISO(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseEntryForm(
  formData: FormData,
  now: Date = new Date(),
): EntryParseResult {
  const errors: EntryFieldErrors = {};

  const rawAmount = formData.get("amount");
  const amount = parseRupeesToPaise(
    typeof rawAmount === "string" ? rawAmount : "",
  );
  if (!amount.ok) errors.amount = amount.error;

  const rawDate = formData.get("date");
  const entryDate =
    typeof rawDate === "string" ? parseEntryDate(rawDate) : null;

  if (entryDate === null) {
    errors.date = "Pick a date";
  } else {
    // A khata records what has happened, not what is going to. Allow the whole
    // of today in whatever timezone the phone is in, but nothing past that.
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    if (entryDate.getTime() > endOfToday.getTime()) {
      errors.date = "Date cannot be in the future";
    }
  }

  if (errors.amount || errors.date) return { ok: false, errors };

  const rawNote = formData.get("note");
  const note =
    typeof rawNote === "string" ? rawNote.trim().replace(/\s+/g, " ") : "";

  return {
    ok: true,
    value: {
      // Both are non-null here: an error would have been set otherwise.
      amountPaise: (amount as { ok: true; paise: number }).paise,
      note: note === "" ? null : note,
      entryDate: entryDate as Date,
    },
  };
}
