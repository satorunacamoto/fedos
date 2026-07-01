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

describe("Stage 48 — product grant preview boundary", () => {
  it("1. an active product shows a grant preview (accepted_placeholder, flag not required)", async () => {
    const body = await (
      await handleRequest(new Request("http://localhost/?product=guide-pdf"))
    ).text();
    expect(body).toContain('class="grant-preview"');
    expect(body).toContain("Grant preview");
    expect(body).toContain("preview_only");
    expect(body).toContain("not_granted");
  });

  it("2. a draft product does not show a grant preview", async () => {
    const SAMPLE_PRODUCT_CREATOR = "f".repeat(64);
    const body = await (
      await handleRequest(
        new Request(`http://localhost/?product=draft-kit&actor=${SAMPLE_PRODUCT_CREATOR}`),
      )
    ).text();
    expect(body).not.toContain('class="grant-preview"');
    expect(body).not.toContain("Grant preview");
  });

  it("3. NoopPaymentProvider in paymentPreview mode does not show a grant preview", async () => {
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
    expect(body).not.toContain('class="grant-preview"');
    expect(body).not.toContain("Grant preview");
  });

  it("4. PlaceholderPaymentProvider in paymentPreview mode shows a grant preview", async () => {
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
    expect(body).toContain('class="grant-preview"');
    expect(body).toContain("preview_only");
    expect(body).toContain("not_granted");
  });

  it("5. paymentDecisionToGrant is never called from the Worker", () => {
    expect(workerSource).not.toMatch(/paymentDecisionToGrant\s*\(/);
  });

  it("6. no PurchaseGrant issuance wording anywhere on the grant preview", async () => {
    const body = await (
      await handleRequest(new Request("http://localhost/?product=guide-pdf"))
    ).text();
    const lower = body.toLowerCase();
    expect(lower).not.toMatch(/\bpaid\b|\bsettled\b|\bpurchased\b/);
    expect(lower).not.toContain("grant issued");
    expect(lower).not.toContain("access granted");
    expect(lower).not.toContain("download unlocked");
    expect(lower).not.toContain("entitlement granted");
    // The permitted, explicitly-negated phrasing must be present instead:
    expect(lower).toContain("preview only");
  });

  it("7. board/space/chat routes never show a grant preview", async () => {
    const boardBody = await (await handleRequest(new Request("http://localhost/"))).text();
    const spaceBody = await (
      await handleRequest(new Request("http://localhost/?space=general&paymentPreview=1"))
    ).text();
    const chatBody = await (
      await handleRequest(new Request("http://localhost/?chat=lounge-chat&paymentPreview=1"))
    ).text();
    for (const body of [boardBody, spaceBody, chatBody]) {
      expect(body).not.toContain('class="grant-preview"');
      expect(body).not.toContain("Grant preview");
    }
  });
});
