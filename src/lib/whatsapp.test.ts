import { describe, expect, it } from "vitest";
import { buildPaymentMessage, buildWhatsAppUrl } from "./whatsapp";

describe("buildPaymentMessage", () => {
  it("reads the way the shopkeeper would say it", () => {
    expect(
      buildPaymentMessage({
        customerName: "Ramesh Yadav",
        shopName: "Kundu Hardware",
        amountPaise: 1285000,
        link: "https://rzp.io/i/abc123",
      }),
    ).toBe(
      "Namaste Ramesh Yadav, aapka Kundu Hardware ka bakaya ₹12,850 hai. " +
        "Yahan se pay kar sakte hain: https://rzp.io/i/abc123",
    );
  });

  it("shows paise only when there are any", () => {
    const withPaise = buildPaymentMessage({
      customerName: "A",
      shopName: "S",
      amountPaise: 123435,
      link: "L",
    });
    expect(withPaise).toContain("₹1,234.35");

    const whole = buildPaymentMessage({
      customerName: "A",
      shopName: "S",
      amountPaise: 120000,
      link: "L",
    });
    expect(whole).toContain("₹1,200 hai");
  });
});

describe("buildWhatsAppUrl", () => {
  it("puts 91 in front of the ten stored digits", () => {
    const url = buildWhatsAppUrl("9876543210", "hi");
    expect(url.startsWith("https://wa.me/919876543210?text=")).toBe(true);
  });

  it("encodes the message so it survives the URL", () => {
    const message = buildPaymentMessage({
      customerName: "Ramesh Yadav",
      shopName: "Kundu Hardware",
      amountPaise: 1285000,
      link: "https://rzp.io/i/abc123",
    });
    const url = buildWhatsAppUrl("9876543210", message);

    // The parts that break a URL if left raw: spaces, the rupee sign, the
    // comma in the amount, and the ? and : of the link itself.
    expect(url).not.toContain(" ");
    expect(url).toContain("%E2%82%B9"); // ₹
    expect(url).toContain("%3A%2F%2F"); // ://

    // And it round-trips back to exactly what we meant to send.
    const text = new URL(url).searchParams.get("text");
    expect(text).toBe(message);
  });

  it("keeps a link with query parameters intact", () => {
    const message = "pay: https://rzp.io/i/x?a=1&b=2";
    const url = buildWhatsAppUrl("9876543210", message);
    expect(new URL(url).searchParams.get("text")).toBe(message);
  });
});
