"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { getCustomer } from "@/lib/customers";
import { parseRupeesToPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { RazorpayError, createPaymentLink } from "@/lib/razorpay";
import { buildPaymentMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import type { PaymentLinkState } from "@/lib/payment-link-state";

const SHOP_NAME = process.env.NEXT_PUBLIC_SHOP_NAME ?? "Khata";

/**
 * Create a Razorpay payment link and hand it to WhatsApp.
 *
 * Order matters here. Razorpay wants reference_id to be our Entry id, so the
 * entry has to exist before the link is requested:
 *
 *   1. write a CREDIT entry with paymentStatus CREATED
 *   2. ask Razorpay for a link carrying that entry's id
 *   3. store the link id and url on the entry
 *
 * Step 1 cannot move the balance, and it does not: a CREATED credit is
 * excluded from every calculation until a webhook says PAID. The money has not
 * arrived; it has only been asked for.
 */
export async function sendPaymentLink(
  _previous: PaymentLinkState,
  formData: FormData,
): Promise<PaymentLinkState> {
  await requireSession();

  const customerId = formData.get("customerId");
  if (typeof customerId !== "string" || customerId === "") {
    return { errors: {}, formError: "Customer not found", sent: null };
  }

  const rawAmount = formData.get("amount");
  const amount = parseRupeesToPaise(
    typeof rawAmount === "string" ? rawAmount : "",
  );
  if (!amount.ok) {
    return { errors: { amount: amount.error }, formError: null, sent: null };
  }

  const customer = await getCustomer(customerId);
  if (!customer) {
    return { errors: {}, formError: "Customer not found", sent: null };
  }

  const entry = await prisma.entry.create({
    data: {
      customerId,
      type: "CREDIT",
      amountPaise: amount.paise,
      note: "Payment link",
      paymentStatus: "CREATED",
    },
  });

  let link: { id: string; shortUrl: string };
  try {
    link = await createPaymentLink({
      amountPaise: amount.paise,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerId: customer.id,
      entryId: entry.id,
      shopName: SHOP_NAME,
    });
  } catch (error) {
    /*
     * The link was not created, so the entry describes nothing. Strike it off
     * rather than leave a Pending row for a link that does not exist.
     *
     * It is struck off rather than removed on purpose. If this was a timeout
     * and Razorpay did create the link after all, a payment could still arrive
     * for it — and the webhook can find this row again by the entry id it
     * carries in reference_id and notes, even though razorpayLinkId was never
     * stored.
     */
    await prisma.entry.update({
      where: { id: entry.id },
      data: { deletedAt: new Date() },
    });

    return {
      errors: {},
      formError:
        error instanceof RazorpayError
          ? error.message
          : "Could not create the payment link.",
      sent: null,
    };
  }

  await prisma.entry.update({
    where: { id: entry.id },
    data: { razorpayLinkId: link.id, razorpayLinkUrl: link.shortUrl },
  });

  revalidatePath("/");
  revalidatePath(`/customer/${customerId}`);

  const message = buildPaymentMessage({
    customerName: customer.name,
    shopName: SHOP_NAME,
    amountPaise: amount.paise,
    link: link.shortUrl,
  });

  return {
    errors: {},
    formError: null,
    sent: {
      whatsappUrl: buildWhatsAppUrl(customer.phone, message),
      link: link.shortUrl,
      message,
    },
  };
}
