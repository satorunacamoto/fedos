import { describe, it, expect } from "vitest";
import {
  describeCommerceSyncOutcome,
  isCommerceSyncOutcomeConcerning,
} from "../src/os/commerce/order/cross_process_outcome_text.js";

/**
 * FedOS Commerce "Purchase Completion" mega-arc (Agent U) — proves the
 * honest-copy contract for `nostrSyncOutcome`, including the specific
 * threat this module exists to close: `sendPrivateOrderSyncNonFatal()`
 * (`fedos_electron_beta_main.cts`) can return an ARBITRARY transport-
 * supplied `result.message` string as this same field — this file proves
 * that string is never echoed verbatim into user-facing text.
 */

describe("describeCommerceSyncOutcome — closed vocabulary with a safe fallback", () => {
  it("every known outcome gets specific, honest, non-empty text", () => {
    for (const outcome of ["published", "duplicate", "rejected", "transport-error", "network-disabled"]) {
      const text = describeCommerceSyncOutcome(outcome);
      expect(text).toBeDefined();
      expect(text!.length).toBeGreaterThan(0);
    }
  });

  it("'undefined' input (no sync attempt happened) produces 'undefined' output -- never a fabricated claim either way", () => {
    expect(describeCommerceSyncOutcome(undefined)).toBeUndefined();
  });

  it("an UNKNOWN outcome string falls back to the generic safe sentence, never echoed verbatim", () => {
    const arbitraryTransportMessage = "peer refused: rate-limited by relay wss://evil.example/<script>alert(1)</script>";
    const text = describeCommerceSyncOutcome(arbitraryTransportMessage);
    expect(text).toBeDefined();
    expect(text).not.toContain(arbitraryTransportMessage);
    expect(text).not.toMatch(/<script>/);
    expect(text).not.toMatch(/evil\.example/);
    // Same fallback text for every unrecognized string -- proves it is a
    // constant safe sentence, not a sanitized echo of the input.
    expect(text).toBe(describeCommerceSyncOutcome("some other unrecognized string"));
  });

  it("prototype-pollution-shaped inputs ('__proto__', 'constructor', 'toString') never throw and never return a function/object", () => {
    for (const outcome of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
      expect(() => describeCommerceSyncOutcome(outcome)).not.toThrow();
      const text = describeCommerceSyncOutcome(outcome);
      expect(typeof text).toBe("string");
    }
  });

  it("empty string is treated as an unrecognized outcome (safe fallback), not as 'no attempt'", () => {
    expect(describeCommerceSyncOutcome("")).toBe(describeCommerceSyncOutcome("totally-unknown"));
  });

  it("'published' and 'duplicate' read as genuine successes; 'rejected'/'transport-error'/'network-disabled' never claim success", () => {
    expect(describeCommerceSyncOutcome("published")!.toLowerCase()).toMatch(/synced/);
    expect(describeCommerceSyncOutcome("duplicate")!.toLowerCase()).toMatch(/synced/);
    for (const failureOutcome of ["rejected", "transport-error", "network-disabled"]) {
      expect(describeCommerceSyncOutcome(failureOutcome)!.toLowerCase()).not.toMatch(/^synced/);
    }
  });
});

describe("isCommerceSyncOutcomeConcerning", () => {
  it("'published'/'duplicate' are NOT concerning; every other known or unknown outcome IS", () => {
    expect(isCommerceSyncOutcomeConcerning("published")).toBe(false);
    expect(isCommerceSyncOutcomeConcerning("duplicate")).toBe(false);
    expect(isCommerceSyncOutcomeConcerning("rejected")).toBe(true);
    expect(isCommerceSyncOutcomeConcerning("transport-error")).toBe(true);
    expect(isCommerceSyncOutcomeConcerning("network-disabled")).toBe(true);
    expect(isCommerceSyncOutcomeConcerning("some-future-payment-transport-outcome")).toBe(true);
  });

  it("'undefined' (no attempt happened) is NEVER concerning", () => {
    expect(isCommerceSyncOutcomeConcerning(undefined)).toBe(false);
  });
});
