import { describe, it, expect } from "vitest";
import {
  isSignedEventLike,
  assertSignerPubkeyMatches,
} from "../src/sign/validate.js";
import type { SignedNostrEvent } from "../src/sign/types.js";

function signed(overrides: Partial<SignedNostrEvent> = {}): SignedNostrEvent {
  return {
    id: "1".repeat(64),
    pubkey: "a".repeat(64),
    created_at: 1700000000,
    kind: 1,
    tags: [],
    content: "hi",
    sig: "b".repeat(128),
    ...overrides,
  };
}

describe("isSignedEventLike", () => {
  it("1. accepts a valid signed event", () => {
    expect(isSignedEventLike(signed())).toBe(true);
  });

  it("2. rejects a missing id", () => {
    const { id, ...rest } = signed();
    void id;
    expect(isSignedEventLike(rest)).toBe(false);
  });

  it("3. rejects a missing sig", () => {
    const { sig, ...rest } = signed();
    void sig;
    expect(isSignedEventLike(rest)).toBe(false);
  });

  it("4. rejects a malformed id", () => {
    expect(isSignedEventLike(signed({ id: "tooshort" }))).toBe(false);
    expect(isSignedEventLike(signed({ id: "A".repeat(64) }))).toBe(false); // uppercase
  });

  it("5. rejects a malformed sig", () => {
    expect(isSignedEventLike(signed({ sig: "zz" }))).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isSignedEventLike(null)).toBe(false);
    expect(isSignedEventLike("event")).toBe(false);
  });
});

describe("assertSignerPubkeyMatches", () => {
  it("6. is true only when the pubkeys match", () => {
    const event = signed({ pubkey: "c".repeat(64) });
    expect(assertSignerPubkeyMatches(event, "c".repeat(64))).toBe(true);
    expect(assertSignerPubkeyMatches(event, "d".repeat(64))).toBe(false);
  });
});
