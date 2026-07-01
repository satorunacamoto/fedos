import { describe, it, expect } from "vitest";
import { handleRequest } from "../src/worker.js";
import { NoopPaymentProvider, PlaceholderPaymentProvider } from "../src/payment/noop_payment.js";
import type { PaymentDecision, PaymentProvider, PaymentRequest } from "../src/payment/types.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import workerSource from "../src/worker.ts?raw";

/** A PaymentProvider that records every requestPayment() call. */
class SpyPaymentProvider implements PaymentProvider {
  calls: PaymentRequest[] = [];
  #inner: PaymentProvider;

  constructor(inner: PaymentProvider) {
    this.#inner = inner;
  }

  getStatus() {
    return this.#inner.getStatus();
  }

  getCapabilities() {
    return this.#inner.getCapabilities();
  }

  async requestPayment(request: PaymentRequest): Promise<PaymentDecision> {
    this.calls.push(request);
    return this.#inner.requestPayment(request);
  }
}

describe("Stage 47 — product purchase preview uses runtime provider in preview-only mode", () => {
  it("1. ?product=<active>&paymentPreview=1 calls runtime.paymentProvider.requestPayment", async () => {
    const spy = new SpyPaymentProvider(new PlaceholderPaymentProvider());
    await handleRequest(
      new Request("http://localhost/?product=guide-pdf&paymentPreview=1"),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      spy,
    );
    expect(spy.calls.length).toBe(1);
    expect(spy.calls[0]?.productId).toBe("guide-pdf");
  });

  it("2. ?product=<active> WITHOUT the flag does not call runtime.paymentProvider", async () => {
    const spy = new SpyPaymentProvider(new PlaceholderPaymentProvider());
    const body = await (
      await handleRequest(
        new Request("http://localhost/?product=guide-pdf"),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        spy,
      )
    ).text();
    expect(spy.calls.length).toBe(0);
    // The preview still renders (via its own local PlaceholderPaymentProvider).
    expect(body).toContain('class="purchase-preview"');
  });

  it("3. ?space=<id>&paymentPreview=1 does not call runtime.paymentProvider", async () => {
    const spy = new SpyPaymentProvider(new PlaceholderPaymentProvider());
    await handleRequest(
      new Request("http://localhost/?space=general&paymentPreview=1"),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      spy,
    );
    expect(spy.calls.length).toBe(0);
  });

  it("4. the default board (?paymentPreview=1, no route) does not call runtime.paymentProvider", async () => {
    const spy = new SpyPaymentProvider(new PlaceholderPaymentProvider());
    await handleRequest(
      new Request("http://localhost/?paymentPreview=1"),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      spy,
    );
    expect(spy.calls.length).toBe(0);
  });

  it("5. ?chat=<id>&paymentPreview=1 does not call runtime.paymentProvider", async () => {
    const spy = new SpyPaymentProvider(new PlaceholderPaymentProvider());
    await handleRequest(
      new Request("http://localhost/?chat=lounge-chat&paymentPreview=1"),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      spy,
    );
    expect(spy.calls.length).toBe(0);
  });

  it("6. NoopPaymentProvider under the flag renders an unavailable preview", async () => {
    const body = await (
      await handleRequest(
        new Request("http://localhost/?product=guide-pdf&paymentPreview=1"),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        new NoopPaymentProvider(),
      )
    ).text();
    expect(body).toContain("purchase-preview-unavailable");
    expect(body).not.toContain("Checkout disabled");
  });

  it("7. PlaceholderPaymentProvider under the flag renders an accepted placeholder preview", async () => {
    const body = await (
      await handleRequest(
        new Request("http://localhost/?product=guide-pdf&paymentPreview=1"),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        new PlaceholderPaymentProvider(),
      )
    ).text();
    expect(body).toContain('class="purchase-preview"');
    expect(body).toContain("accepted_placeholder");
    expect(body).toMatch(/<button[^>]*\bdisabled\b[^>]*>Checkout disabled<\/button>/);
  });

  it("8. paymentDecisionToGrant is never called (no PurchaseGrant issued)", () => {
    expect(workerSource).not.toMatch(/paymentDecisionToGrant\s*\(/);
  });

  it("9. no invoice/checkout URL/QR/card/settled/purchased text under the preview flag", async () => {
    const body = await (
      await handleRequest(
        new Request("http://localhost/?product=guide-pdf&paymentPreview=1"),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        new PlaceholderPaymentProvider(),
      )
    ).text();
    const lower = body.toLowerCase();
    expect(lower).not.toContain("invoice");
    expect(lower).not.toContain("checkout url");
    expect(lower).not.toContain("qr");
    expect(lower).not.toContain("card number");
    expect(lower).not.toMatch(/\bpaid\b|\bsettled\b|\bpurchased\b/);
    expect(lower).not.toMatch(/\bgrant issued\b/);
  });

  it("10. escapes a malicious ?actor used as the buyer candidate under the preview flag", async () => {
    const body = await (
      await handleRequest(
        new Request(
          "http://localhost/?product=guide-pdf&paymentPreview=1&actor=" +
            encodeURIComponent("<script>"),
        ),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        new PlaceholderPaymentProvider(),
      )
    ).text();
    expect(body).not.toContain("<script>");
  });

  it("11. issues no fetch/external call for the payment preview path", () => {
    expect(workerSource).not.toMatch(/\bfetch\s*\(\s*['"`]https?:/);
    expect(workerSource).not.toMatch(/Stripe|Lightning|Breez|Greenlight|LNURL/i);
  });

  it("12. does not mutate the request", async () => {
    const url = "http://localhost/?product=guide-pdf&paymentPreview=1&actor=" + "b".repeat(64);
    const req = new Request(url);
    const spy = new SpyPaymentProvider(new PlaceholderPaymentProvider());
    await handleRequest(req, undefined, undefined, undefined, undefined, undefined, spy);
    expect(req.url).toBe(url);
    expect(spy.calls.length).toBe(1);
    const requestSnap = JSON.stringify(spy.calls[0]);
    expect(JSON.stringify(spy.calls[0])).toBe(requestSnap);
  });
});
