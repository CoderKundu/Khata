import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parsePaymentLinkEvent,
  verifyWebhookSignature,
} from "@/lib/razorpay-webhook";
import {
  type WebhookEntryStore,
  applyPaymentLinkEvent,
} from "@/lib/webhook-apply";

/**
 * Razorpay payment link webhooks: payment_link.paid, .cancelled, .expired.
 *
 * Two rules govern everything here.
 *
 * Verify before parsing. The signature is over the exact bytes Razorpay sent,
 * so the raw text is read first and checked, and only then turned into an
 * object. Parsing first and re-stringifying to verify compares a different
 * string — JSON.stringify does not promise the original key order or spacing.
 *
 * Answer 200 for anything we are not going to act on. Razorpay retries on 5xx,
 * so returning an error for an event we will never handle — an unknown link, a
 * duplicate delivery, a malformed body — buys nothing but a retry loop.
 */

const ENTRY_FIELDS = {
  id: true,
  amountPaise: true,
  paymentStatus: true,
  deletedAt: true,
  razorpayLinkId: true,
} as const;

const store: WebhookEntryStore = {
  findByLinkId: (razorpayLinkId) =>
    prisma.entry.findUnique({
      where: { razorpayLinkId },
      select: ENTRY_FIELDS,
    }),

  findById: (id) =>
    prisma.entry.findUnique({ where: { id }, select: ENTRY_FIELDS }),

  /*
   * One conditional write, not a read followed by a write. The
   * paymentStatus: "CREATED" condition is what makes a repeated delivery a
   * no-op: the second one matches zero rows and reports zero, with no window
   * between checking and writing for a concurrent delivery to slip through.
   *
   * deletedAt: null lifts the strike-off from a placeholder we abandoned when
   * link creation timed out — the payment proves the link was real after all.
   */
  settle: async ({ entryId, status, linkId }) => {
    const { count } = await prisma.entry.updateMany({
      where: { id: entryId, paymentStatus: "CREATED" },
      data: { paymentStatus: status, razorpayLinkId: linkId, deletedAt: null },
    });
    return count;
  },
};

export async function POST(request: Request): Promise<NextResponse> {
  // Raw text, before anything parses it.
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    // Our misconfiguration, not a bad request. 500 so Razorpay retries once it
    // is fixed, and so the problem is loud rather than silently swallowed.
    console.error("razorpay webhook: RAZORPAY_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    // Nothing from the body or the header is logged: an unverified payload is
    // attacker-controlled, and the signature is derived from the secret.
    console.warn("razorpay webhook: signature mismatch");
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const event = parsePaymentLinkEvent(rawBody);
  if (!event) {
    // Verified, but not an event we act on. Accept it and stop.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const outcome = await applyPaymentLinkEvent(store, event);

  if (outcome.applied) {
    console.info(`razorpay webhook: ${event.name} applied to ${event.linkId}`);

    const entry = await prisma.entry.findUnique({
      where: { razorpayLinkId: event.linkId },
      select: { customerId: true },
    });

    revalidatePath("/");
    if (entry) revalidatePath(`/customer/${entry.customerId}`);
  } else {
    console.info(
      `razorpay webhook: ${event.name} ignored for ${event.linkId} (${outcome.reason})`,
    );
  }

  return NextResponse.json({ ok: true });
}
