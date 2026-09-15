/**
 * Money handling for Khata.
 *
 * Everything inside the app is an integer number of paise. Rupees exist only as
 * text the user types or reads. Nothing here goes through parseFloat, because
 * `parseFloat("1234.35") * 100` is 123434.99999999999 and a ledger that loses a
 * paisa per entry is a ledger nobody trusts.
 */

/** Postgres Int is 32-bit: 2147483647 paise is about 2.14 crore rupees. */
export const MAX_AMOUNT_PAISE = 2_147_483_647;

export type ParseResult =
  | { ok: true; paise: number }
  | { ok: false; error: string };

/**
 * Parse what the user typed into paise, by string surgery rather than float math.
 * Accepts "1200", "1200.5", "1,200.50", " 1200 ". Rejects everything else.
 */
export function parseRupeesToPaise(input: string): ParseResult {
  const cleaned = input.trim().replace(/[,\s₹]/g, "");

  if (cleaned === "") return { ok: false, error: "Amount daaliye" };
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return { ok: false, error: "Sirf number, do decimal tak" };
  }

  const [rupeePart, paisePart = ""] = cleaned.split(".");
  const paiseDigits = paisePart.padEnd(2, "0");

  const rupees = Number(rupeePart);
  const paise = Number(paiseDigits);

  if (!Number.isSafeInteger(rupees)) {
    return { ok: false, error: "Amount bahut bada hai" };
  }

  const total = rupees * 100 + paise;

  if (total <= 0) return { ok: false, error: "Amount zero se zyada ho" };
  if (total > MAX_AMOUNT_PAISE) {
    return { ok: false, error: "Amount bahut bada hai" };
  }

  return { ok: true, paise: total };
}

/**
 * Paise -> "12,345" or "12,345.50". Indian digit grouping (1,23,456), no symbol.
 * Whole rupees drop the decimals, because that is how the paper khata reads.
 */
export function formatPaise(paise: number): string {
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.trunc(abs / 100);
  const remainder = abs % 100;

  const grouped = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(rupees);

  const body =
    remainder === 0
      ? grouped
      : `${grouped}.${remainder.toString().padStart(2, "0")}`;

  return negative ? `-${body}` : body;
}

/** Paise -> "₹12,345". For display only. */
export function formatRupees(paise: number): string {
  return `₹${formatPaise(paise)}`;
}

/** Paise -> "1234.56", the plain form Razorpay and form inputs want. */
export function paiseToRupeeString(paise: number): string {
  const rupees = Math.trunc(paise / 100);
  const remainder = paise % 100;
  return remainder === 0
    ? String(rupees)
    : `${rupees}.${remainder.toString().padStart(2, "0")}`;
}
