import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RazorpayError,
  buildPaymentLinkBody,
  createPaymentLink,
} from "./razorpay";

const input = {
  amountPaise: 1285000,
  customerName: "Ramesh Yadav",
  customerPhone: "9876543210",
  customerId: "cust_1",
  entryId: "entry_1",
  shopName: "Kundu Hardware",
};

describe("buildPaymentLinkBody", () => {
  const body = buildPaymentLinkBody(input);

  it("sends the amount in paise, as an integer", () => {
    expect(body.amount).toBe(1285000);
    expect(Number.isInteger(body.amount)).toBe(true);
    expect(body.currency).toBe("INR");
  });

  it("sends the contact with the country code", () => {
    expect(body.customer).toEqual({
      name: "Ramesh Yadav",
      contact: "+919876543210",
    });
  });

  /**
   * We send the link ourselves over WhatsApp. If Razorpay also texted or
   * emailed it, the customer would get the same demand two or three times from
   * a number they do not recognise.
   */
  it("tells Razorpay not to notify the customer", () => {
    expect(body.notify).toEqual({ sms: false, email: false });
  });

  it("enables reminders and refuses partial payment", () => {
    expect(body.reminder_enable).toBe(true);
    expect(body.accept_partial).toBe(false);
  });

  /**
   * reference_id and notes are how a webhook arriving later finds its way back
   * to the right row. Without them a payment is just money with no home.
   */
  it("carries the ids needed to match the webhook back to the entry", () => {
    expect(body.reference_id).toBe("entry_1");
    expect(body.notes).toEqual({ customerId: "cust_1", entryId: "entry_1" });
  });
});

describe("createPaymentLink", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_key");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "secret_value");
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function respond(status: number, body: unknown): void {
    fetchMock.mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    });
  }

  it("returns the link id and short url", async () => {
    respond(200, { id: "plink_abc", short_url: "https://rzp.io/i/abc" });

    await expect(createPaymentLink(input)).resolves.toEqual({
      id: "plink_abc",
      shortUrl: "https://rzp.io/i/abc",
    });
  });

  it("authenticates with base64 key:secret and posts JSON", async () => {
    respond(200, { id: "plink_abc", short_url: "https://rzp.io/i/abc" });
    await createPaymentLink(input);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.razorpay.com/v1/payment_links");
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    const encoded = Buffer.from("rzp_test_key:secret_value").toString("base64");
    expect(headers.Authorization).toBe(`Basic ${encoded}`);
    expect(headers["Content-Type"]).toBe("application/json");

    expect(JSON.parse(init.body as string)).toEqual(buildPaymentLinkBody(input));
  });

  it("surfaces Razorpay's own description when it rejects the request", async () => {
    respond(400, {
      error: { description: "The amount must be atleast INR 1.00" },
    });

    await expect(createPaymentLink(input)).rejects.toThrow(
      "The amount must be atleast INR 1.00",
    );
  });

  it("does not leak the key when something goes wrong", async () => {
    respond(401, { error: { description: "Authentication failed" } });

    await expect(createPaymentLink(input)).rejects.toSatisfy((error: Error) => {
      const text = `${error.message}${error.stack ?? ""}`;
      return !text.includes("secret_value") && !text.includes("rzp_test_key");
    });
  });

  /**
   * Asserting the message, not just the type: both this and a network failure
   * are RazorpayError, and an earlier version reported missing keys as
   * "could not reach Razorpay" — which sends you to check the wifi when the
   * real problem is an empty .env.
   */
  it("says the keys are missing, not that the network is down", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "");

    await expect(createPaymentLink(input)).rejects.toThrow(RazorpayError);
    await expect(createPaymentLink(input)).rejects.toThrow(
      "Razorpay keys are not configured",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a network failure rather than hanging", async () => {
    fetchMock.mockRejectedValue(new Error("fetch failed"));

    await expect(createPaymentLink(input)).rejects.toThrow(
      "Could not reach Razorpay",
    );
  });

  it("rejects a 200 that is missing the link", async () => {
    respond(200, { id: "plink_abc" });

    await expect(createPaymentLink(input)).rejects.toThrow(
      "did not return a payment link",
    );
  });
});
