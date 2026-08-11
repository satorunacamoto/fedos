import { describe, it, expect } from "vitest";
import {
  encodeFedosDeliveryRetryReason,
  decodeFedosDeliveryRetryReason,
} from "../src/os/messenger/board/observation/fedos_delivery_retry_reason_codec.js";

describe("Secure Runtime Alpha 526 -- Retry Reason Codec Implementation", () => {
  it("round-trips final with no detail", () => {
    const encoded = encodeFedosDeliveryRetryReason(true, null);
    expect(encoded).toBe("final");
    expect(decodeFedosDeliveryRetryReason(encoded)).toEqual({ isFinal: true, detail: null });
  });

  it("round-trips final with a detail string", () => {
    const encoded = encodeFedosDeliveryRetryReason(true, "relay confirmed permanent rejection");
    expect(encoded).toBe("final:relay confirmed permanent rejection");
    expect(decodeFedosDeliveryRetryReason(encoded)).toEqual({
      isFinal: true,
      detail: "relay confirmed permanent rejection",
    });
  });

  it("round-trips retry with no detail", () => {
    const encoded = encodeFedosDeliveryRetryReason(false, null);
    expect(encoded).toBe("retry");
    expect(decodeFedosDeliveryRetryReason(encoded)).toEqual({ isFinal: false, detail: null });
  });

  it("round-trips retry with a detail string", () => {
    const encoded = encodeFedosDeliveryRetryReason(false, "transport timeout");
    expect(encoded).toBe("retry:transport timeout");
    expect(decodeFedosDeliveryRetryReason(encoded)).toEqual({ isFinal: false, detail: "transport timeout" });
  });

  it("decodes undefined (pre-Alpha-521 shape) fail-closed to non-final", () => {
    expect(decodeFedosDeliveryRetryReason(undefined)).toEqual({ isFinal: false, detail: null });
  });

  it("decodes an unrecognized string fail-closed to non-final, preserving the raw text as detail", () => {
    expect(decodeFedosDeliveryRetryReason("some unrelated legacy reason")).toEqual({
      isFinal: false,
      detail: "some unrelated legacy reason",
    });
  });

  it("never throws on any input", () => {
    for (const input of [undefined, "", "final", "retry", "final:", "retry:", "garbage:with:colons"]) {
      expect(() => decodeFedosDeliveryRetryReason(input)).not.toThrow();
    }
  });
});
