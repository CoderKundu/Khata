/**
 * Razorpay Payment Links, over the REST API with fetch and HTTP Basic auth.
 *
 * No SDK: this is one POST. A dependency that wraps one POST is a dependency
 * that also has to be kept current, audited, and bundled.
 */

const PAYMENT_LINKS_URL = "https://api.razorpay.com/v1/payment_links";

/** Razorpay is a third party over a network; do not wait on it forever. */
const TIMEOUT_MS = 15_000;

export type PaymentLink = {
  id: string;
  shortUrl: string;
};

export type CreatePaymentLinkInput = {
  amountPaise: number;
  customerName: string;
  /** Ten digits, as stored. The +91 is added here. */
  customerPhone: string;
  customerId: string;
  entryId: string;
  shopName: string;
};

/**
 * Carries a message that is safe to show the shopkeeper. Razorpay's own error
 * descriptions are safe — they describe the request, not the credentials — but
 * nothing here ever includes the key or the Authorization header.
 */
export class RazorpayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RazorpayError";
  }
}

function authHeader(): string {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new RazorpayError(
      "Razorpay keys are not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
    );
  }

  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

/** Split out from the request so the payload can be asserted in a test. */
export function buildPaymentLinkBody(
  input: CreatePaymentLinkInput,
): Record<string, unknown> {
  return {
    amount: input.amountPaise,
    currency: "INR",
    // Partial payments would arrive as payment_link.partially_paid, a state
    // this ledger has no entry type for. One link, one payment.
    accept_partial: false,
    description: `${input.shopName} — bakaya`,
    customer: {
      name: input.customerName,
      contact: `+91${input.customerPhone}`,
    },
    // We send the link ourselves over WhatsApp, so Razorpay must not also SMS
    // or email the customer about it.
    notify: { sms: false, email: false },
    reminder_enable: true,
    reference_id: input.entryId,
    notes: {
      customerId: input.customerId,
      entryId: input.entryId,
    },
  };
}

type RazorpayLinkResponse = {
  id?: unknown;
  short_url?: unknown;
  error?: { description?: unknown };
};

export async function createPaymentLink(
  input: CreatePaymentLinkInput,
): Promise<PaymentLink> {
  // Read the credentials before the try, not inside it. Evaluated as an
  // argument to fetch, a missing-keys error would be caught by the catch below
  // and reported as "could not reach Razorpay" — sending someone to check
  // their wifi when the real problem is an empty .env.
  const authorization = authHeader();

  let response: Response;

  try {
    response = await fetch(PAYMENT_LINKS_URL, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildPaymentLinkBody(input)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Timeout or the network being down. The caller must treat this as
    // "unknown", not "failed": the link may well have been created.
    throw new RazorpayError("Could not reach Razorpay. Check the connection.");
  }

  let payload: RazorpayLinkResponse;
  try {
    payload = (await response.json()) as RazorpayLinkResponse;
  } catch {
    throw new RazorpayError(`Razorpay returned an unreadable response (${response.status}).`);
  }

  if (!response.ok) {
    const description =
      typeof payload.error?.description === "string"
        ? payload.error.description
        : `Razorpay rejected the request (${response.status}).`;
    throw new RazorpayError(description);
  }

  if (typeof payload.id !== "string" || typeof payload.short_url !== "string") {
    throw new RazorpayError("Razorpay did not return a payment link.");
  }

  return { id: payload.id, shortUrl: payload.short_url };
}
