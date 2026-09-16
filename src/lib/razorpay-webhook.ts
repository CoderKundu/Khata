import crypto from "node:crypto";
import type { PaymentStatus } from "@/generated/prisma/enums";

/**
 * Parsing and authenticating Razorpay webhooks.
 *
 * The order of operations is the whole security model: verify the raw bytes,
 * then parse. Anything that parses first and re-serialises to check the
 * signature is checking a different string than the one Razorpay signed — key
 * order and whitespace do not survive a JSON round trip — and would either
 * reject everything or, worse, be "fixed" by dropping the check.
 */

export type PaymentLinkEvent = {
  /** e.g. "payment_link.paid" */
  name: string;
  /** What the entry should become. */
  status: PaymentStatus;
  /** Razorpay's payment link id, matched against Entry.razorpayLinkId. */
  linkId: string;
  /**
   * Our Entry id, which we set as reference_id and in notes. The fallback when
   * razorpayLinkId was never stored — see the timeout case in
   * payment-link-actions.
   */
  entryId: string | null;
};

const EVENT_STATUS: Record<string, PaymentStatus> = {
  "payment_link.paid": "PAID",
  "payment_link.cancelled": "CANCELLED",
  "payment_link.expired": "EXPIRED",
};

/**
 * Constant-time HMAC-SHA256 check over the raw request body.
 *
 * timingSafeEqual throws on a length mismatch, so lengths are compared first —
 * and both sides are hex digests of the same algorithm, so equal length is the
 * normal case and an unequal one is already a reject.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string,
): boolean {
  if (!signature || !secret) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest();

  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "hex");
  } catch {
    return false;
  }

  if (provided.length !== expected.length) return false;

  return crypto.timingSafeEqual(provided, expected);
}

type Unknown = Record<string, unknown>;

function asObject(value: unknown): Unknown | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Unknown)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * Pull the parts we act on out of a webhook body. Returns null for anything
 * malformed or for an event we are not subscribed to — both of which are a
 * 200 with no action, not an error: Razorpay retries on 5xx, and retrying an
 * event we will never handle is a loop with no exit.
 */
export function parsePaymentLinkEvent(rawBody: string): PaymentLinkEvent | null {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }

  const root = asObject(body);
  if (!root) return null;

  const name = asString(root.event);
  if (!name) return null;

  const status = EVENT_STATUS[name];
  if (!status) return null;

  const entity = asObject(
    asObject(asObject(asObject(root.payload)?.payment_link)?.entity),
  );
  if (!entity) return null;

  const linkId = asString(entity.id);
  if (!linkId) return null;

  const notes = asObject(entity.notes);
  const entryId =
    asString(entity.reference_id) ?? asString(notes?.entryId) ?? null;

  return { name, status, linkId, entryId };
}
