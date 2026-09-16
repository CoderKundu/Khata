import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parsePaymentLinkEvent,
  verifyWebhookSignature,
} from "./razorpay-webhook";

const SECRET = "webhook_secret_for_tests";

function sign(body: string, secret = SECRET): string {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

const BODY = JSON.stringify({
  event: "payment_link.paid",
  payload: {
    payment_link: {
      entity: {
        id: "plink_abc",
        reference_id: "entry_1",
        notes: { customerId: "cust_1", entryId: "entry_1" },
      },
    },
  },
});

describe("verifyWebhookSignature", () => {
  it("accepts a signature made with the shared secret", () => {
    expect(verifyWebhookSignature(BODY, sign(BODY), SECRET)).toBe(true);
  });

  it("rejects a signature made with a different secret", () => {
    expect(verifyWebhookSignature(BODY, sign(BODY, "wrong"), SECRET)).toBe(
      false,
    );
  });

  /**
   * The reason the route reads req.text() and verifies before parsing: the
   * signature covers exact bytes. A round trip through JSON.parse and
   * JSON.stringify can reorder keys and drop whitespace, and the result no
   * longer matches even though the data is identical.
   */
  it("rejects a body that has been through a JSON round trip", () => {
    const signature = sign(BODY);
    const reserialised = JSON.stringify(JSON.parse(BODY));
    const spaced = JSON.stringify(JSON.parse(BODY), null, 2);

    expect(verifyWebhookSignature(BODY, signature, SECRET)).toBe(true);
    expect(verifyWebhookSignature(spaced, signature, SECRET)).toBe(false);
    // Same string here, but only by luck of key order — the point is that the
    // check is over bytes, so anything that rewrites them is a new message.
    expect(verifyWebhookSignature(reserialised, signature, SECRET)).toBe(
      reserialised === BODY,
    );
  });

  it("rejects a tampered body", () => {
    const signature = sign(BODY);
    const tampered = BODY.replace("entry_1", "entry_2");
    expect(verifyWebhookSignature(tampered, signature, SECRET)).toBe(false);
  });

  it("rejects a missing, empty or malformed signature", () => {
    expect(verifyWebhookSignature(BODY, null, SECRET)).toBe(false);
    expect(verifyWebhookSignature(BODY, undefined, SECRET)).toBe(false);
    expect(verifyWebhookSignature(BODY, "", SECRET)).toBe(false);
    expect(verifyWebhookSignature(BODY, "not-hex-at-all", SECRET)).toBe(false);
    // Right shape, wrong value — and a length mismatch must not throw.
    expect(verifyWebhookSignature(BODY, "ab", SECRET)).toBe(false);
    expect(verifyWebhookSignature(BODY, `${sign(BODY)}00`, SECRET)).toBe(false);
  });

  it("rejects everything when the secret is not configured", () => {
    expect(verifyWebhookSignature(BODY, sign(BODY), "")).toBe(false);
  });
});

describe("parsePaymentLinkEvent", () => {
  it("pulls out the event, link id and entry id", () => {
    expect(parsePaymentLinkEvent(BODY)).toEqual({
      name: "payment_link.paid",
      status: "PAID",
      linkId: "plink_abc",
      entryId: "entry_1",
    });
  });

  it("maps each subscribed event to its status", () => {
    for (const [name, status] of [
      ["payment_link.paid", "PAID"],
      ["payment_link.cancelled", "CANCELLED"],
      ["payment_link.expired", "EXPIRED"],
    ] as const) {
      const body = BODY.replace("payment_link.paid", name);
      expect(parsePaymentLinkEvent(body)?.status, name).toBe(status);
    }
  });

  it("falls back to notes.entryId when reference_id is absent", () => {
    const body = JSON.stringify({
      event: "payment_link.paid",
      payload: {
        payment_link: {
          entity: { id: "plink_abc", notes: { entryId: "entry_9" } },
        },
      },
    });
    expect(parsePaymentLinkEvent(body)?.entryId).toBe("entry_9");
  });

  it("returns null rather than throwing on anything unusable", () => {
    for (const body of [
      "",
      "not json",
      "[]",
      "null",
      "{}",
      JSON.stringify({ event: "payment.captured" }),
      JSON.stringify({ event: "payment_link.paid" }),
      JSON.stringify({ event: "payment_link.paid", payload: {} }),
      JSON.stringify({
        event: "payment_link.paid",
        payload: { payment_link: { entity: {} } },
      }),
    ]) {
      expect(parsePaymentLinkEvent(body), body).toBeNull();
    }
  });

  it("has no entry id when Razorpay sends neither reference_id nor notes", () => {
    const body = JSON.stringify({
      event: "payment_link.paid",
      payload: { payment_link: { entity: { id: "plink_abc" } } },
    });
    expect(parsePaymentLinkEvent(body)).toEqual({
      name: "payment_link.paid",
      status: "PAID",
      linkId: "plink_abc",
      entryId: null,
    });
  });
});
