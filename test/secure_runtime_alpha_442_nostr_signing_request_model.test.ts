import { describe, it, expect } from "vitest";
import {
  isWellFormedFedosNostrUnsignedEventRequest,
  freezeFedosNostrUnsignedEventRequest,
  type FedosNostrUnsignedEventRequest,
} from "../src/nostr/sign/fedos_nostr_signing_authority.js";

function validRequest(overrides: Partial<FedosNostrUnsignedEventRequest> = {}): FedosNostrUnsignedEventRequest {
  return {
    accountIndex: 0,
    createdAt: 1_700_000_000,
    kind: 1,
    tags: [["p", "abc"]],
    content: "hello",
    ...overrides,
  };
}

describe("Secure Runtime Alpha 442 -- Nostr Signing Request Model", () => {
  it("accepts a well-formed request", () => {
    expect(isWellFormedFedosNostrUnsignedEventRequest(validRequest())).toBe(true);
  });

  it("rejects any kind other than 1", () => {
    for (const kind of [0, 2, 3, 40, 10002]) {
      expect(isWellFormedFedosNostrUnsignedEventRequest(validRequest({ kind }))).toBe(false);
    }
  });

  it("rejects an out-of-range or non-integer accountIndex", () => {
    for (const accountIndex of [-1, 1.5, 4_294_967_296, NaN]) {
      expect(isWellFormedFedosNostrUnsignedEventRequest(validRequest({ accountIndex }))).toBe(false);
    }
    expect(isWellFormedFedosNostrUnsignedEventRequest(validRequest({ accountIndex: 4_294_967_295 }))).toBe(true);
  });

  it("rejects a malformed createdAt", () => {
    for (const createdAt of [-1, 1.5, NaN, Infinity, -Infinity]) {
      expect(isWellFormedFedosNostrUnsignedEventRequest(validRequest({ createdAt }))).toBe(false);
    }
  });

  it("rejects an empty tag and a tag field containing the reserved U+0001 separator", () => {
    expect(isWellFormedFedosNostrUnsignedEventRequest(validRequest({ tags: [[]] }))).toBe(false);
    expect(isWellFormedFedosNostrUnsignedEventRequest(validRequest({ tags: [["p", "ab"]] }))).toBe(false);
  });

  it("rejects an object carrying a caller-supplied pubkey/id/sig or any extra field", () => {
    const withExtra = { ...validRequest(), pubkey: "forged" } as unknown;
    expect(isWellFormedFedosNostrUnsignedEventRequest(withExtra)).toBe(false);
  });

  it("rejects non-object candidates without throwing", () => {
    expect(isWellFormedFedosNostrUnsignedEventRequest(null)).toBe(false);
    expect(isWellFormedFedosNostrUnsignedEventRequest("request")).toBe(false);
    expect(isWellFormedFedosNostrUnsignedEventRequest(42)).toBe(false);
  });

  it("freezeFedosNostrUnsignedEventRequest deep-freezes and severs the shared tags reference", () => {
    const originalTags = [["p", "abc"]];
    const request = validRequest({ tags: originalTags });
    const frozen = freezeFedosNostrUnsignedEventRequest(request);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.tags)).toBe(true);
    expect(Object.isFrozen(frozen.tags[0])).toBe(true);
    expect(frozen.tags).not.toBe(originalTags);
    originalTags[0]![0] = "mutated";
    expect(frozen.tags[0]?.[0]).toBe("p");
  });
});
