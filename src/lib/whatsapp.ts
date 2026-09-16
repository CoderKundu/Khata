import { formatPaise } from "@/lib/money";

/**
 * The WhatsApp hand-off.
 *
 * Nothing is sent by us and nothing is sent by Razorpay — notify.sms and
 * notify.email are both off. The shopkeeper sends the message himself, from
 * his own number, on the app his customers already answer.
 */

export function buildPaymentMessage({
  customerName,
  shopName,
  amountPaise,
  link,
}: {
  customerName: string;
  shopName: string;
  amountPaise: number;
  link: string;
}): string {
  return `Namaste ${customerName}, aapka ${shopName} ka bakaya ₹${formatPaise(
    amountPaise,
  )} hai. Yahan se pay kar sakte hain: ${link}`;
}

/**
 * wa.me wants the number with country code and no punctuation. The phone is
 * stored as ten digits, so 91 goes in front here rather than in the database.
 */
export function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
}
