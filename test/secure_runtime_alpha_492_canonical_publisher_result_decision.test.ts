import { describe, it, expect } from "vitest";
import { isFedosOutboundPublishResult } from "../src/board/publish/fedos_outbound_publish_result.js";
import type { FedosOutboundPublishResult } from "../src/board/publish/fedos_outbound_publish_result.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import doc from "../docs/secure_runtime_alpha_492_canonical_publisher_result_decision.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import source from "../src/board/publish/fedos_outbound_publish_result.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import outboxPublisherSource from "../src/board/outbox/fedos_board_outbox_publisher.ts?raw";

describe("Secure Runtime Alpha 492 -- Canonical Publisher Result Decision", () => {
  it("accepted requires a non-null, non-empty externalReference", () => {
    expect(isFedosOutboundPublishResult({ outcome: "accepted", externalReference: "evt123" })).toBe(true);
    expect(isFedosOutboundPublishResult({ outcome: "accepted", externalReference: "" })).toBe(false);
    expect(isFedosOutboundPublishResult({ outcome: "accepted", externalReference: null })).toBe(false);
  });

  it("rejected/failed allow null or a string externalReference", () => {
    for (const outcome of ["rejected", "failed"] as const) {
      expect(isFedosOutboundPublishResult({ outcome, externalReference: null })).toBe(true);
      expect(isFedosOutboundPublishResult({ outcome, externalReference: "ref" })).toBe(true);
      expect(isFedosOutboundPublishResult({ outcome, externalReference: undefined })).toBe(false);
    }
  });

  it("rejects an unknown outcome and any extra field", () => {
    expect(isFedosOutboundPublishResult({ outcome: "delivered", externalReference: null })).toBe(false);
    expect(
      isFedosOutboundPublishResult({ outcome: "failed", externalReference: null, retryPolicy: "later" }),
    ).toBe(false);
  });

  it("never throws on garbage input", () => {
    for (const garbage of [null, undefined, 1, "x", [], {}]) {
      expect(() => isFedosOutboundPublishResult(garbage)).not.toThrow();
    }
  });

  it("carries no retryPolicy, reason, or error field in code", () => {
    const codeOnly = source
      .split("\n")
      .filter((line: string) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    expect(codeOnly).not.toMatch(/retryPolicy|\breason\b|\berror\b/i);
  });

  it("a value satisfying the type compiles against FedosOutboundPublishResult", () => {
    const accepted: FedosOutboundPublishResult = { outcome: "accepted", externalReference: "e1" };
    const rejected: FedosOutboundPublishResult = { outcome: "rejected", externalReference: null };
    const failed: FedosOutboundPublishResult = { outcome: "failed", externalReference: null };
    expect([accepted, rejected, failed].every(isFedosOutboundPublishResult)).toBe(true);
  });

  it("the existing FedosBoardOutboxPublishResult is untouched by this Stage", () => {
    expect(outboxPublisherSource).toContain(
      "export type FedosBoardOutboxPublishOutcome = \"delivered\" | \"rejected\" | \"failed\";",
    );
  });

  it("the doc names the accepted/transport-send-success conflation risk explicitly", () => {
    expect(doc).toMatch(/do not conflate "accepted" with "transport send success"/);
    expect(doc).toMatch(/never "the relay confirmed receipt\."/);
  });
});
