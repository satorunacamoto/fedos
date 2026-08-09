import { describe, it, expect } from "vitest";
import {
  NobleSignatureVerifier,
  isValidHex,
} from "../src/os/messenger/adapters/nostr/protocol/noble_signature.js";
import { ingestRawEvents } from "../src/os/_legacy_prototype/ingest/ingest.js";
import type { NostrEvent } from "../src/os/messenger/adapters/nostr/protocol/types.js";

/**
 * A known-good, deterministically-generated NIP-01 event.
 *
 * Generated once with @noble/curves Schnorr over the private key 0x00..01 and
 * hardcoded here so the test is deterministic. The library does NOT contain any
 * signing code — this vector was produced by a throwaway script.
 */
const VALID_EVENT: NostrEvent = {
  id: "54e612edddef0b67e2e46b6cbe0c70368f4cc55a7a4efd774c08066bc74b7f0b",
  pubkey: "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
  created_at: 1700000000,
  kind: 1,
  tags: [],
  content: "hello nostr — Stage 8 vector",
  sig: "9fafd52912c74d10ea33a981cc4e3d43789add77daaf31ed62b02c2760caa96d9b6393a007ad885810e75239cc87cbc859574fbfbc64d2ea795f1c097bfced59",
};

const CTX = { relayUrl: "wss://relay.test", now: 1700000001000 };

describe("isValidHex", () => {
  it("accepts exact-length lowercase hex", () => {
    expect(isValidHex("a".repeat(64), 32)).toBe(true);
    expect(isValidHex("ff".repeat(64), 64)).toBe(true);
  });
  it("rejects wrong length, uppercase, and non-hex", () => {
    expect(isValidHex("a".repeat(63), 32)).toBe(false);
    expect(isValidHex("A".repeat(64), 32)).toBe(false);
    expect(isValidHex("g".repeat(64), 32)).toBe(false);
  });
});

describe("NobleSignatureVerifier", () => {
  it("1. verifies a valid known event", async () => {
    expect(await NobleSignatureVerifier.verify(VALID_EVENT)).toBe(true);
  });

  it("2. rejects tampered content", async () => {
    const tampered: NostrEvent = { ...VALID_EVENT, content: "tampered" };
    expect(await NobleSignatureVerifier.verify(tampered)).toBe(false);
  });

  it("3. rejects a tampered signature", async () => {
    // Flip the last hex nibble of the signature.
    const sig = VALID_EVENT.sig.slice(0, -1) + (VALID_EVENT.sig.endsWith("9") ? "8" : "9");
    expect(await NobleSignatureVerifier.verify({ ...VALID_EVENT, sig })).toBe(false);
  });

  it("4. rejects a different (but valid-shaped) pubkey", async () => {
    const pubkey = "02".repeat(32); // valid hex, wrong key
    expect(await NobleSignatureVerifier.verify({ ...VALID_EVENT, pubkey })).toBe(false);
  });

  it("5. rejects a tampered id (id no longer matches the body)", async () => {
    const id = "00".repeat(32);
    expect(await NobleSignatureVerifier.verify({ ...VALID_EVENT, id })).toBe(false);
  });

  it("6. rejects a malformed signature (wrong length)", async () => {
    expect(await NobleSignatureVerifier.verify({ ...VALID_EVENT, sig: "abc" })).toBe(false);
  });

  it("7. rejects a malformed pubkey", async () => {
    expect(await NobleSignatureVerifier.verify({ ...VALID_EVENT, pubkey: "xyz" })).toBe(false);
  });

  it("8. rejects a malformed id", async () => {
    expect(await NobleSignatureVerifier.verify({ ...VALID_EVENT, id: "nope" })).toBe(false);
  });

  it("9. never throws, even on garbage hex of the right length", async () => {
    // 'z' passes neither hex check; ensure we still get a boolean, no throw.
    const bad: NostrEvent = {
      ...VALID_EVENT,
      sig: "z".repeat(128),
      pubkey: "z".repeat(64),
      id: "z".repeat(64),
    };
    await expect(NobleSignatureVerifier.verify(bad)).resolves.toBe(false);
  });
});

describe("ingestRawEvents with NobleSignatureVerifier", () => {
  it("accepts a validly-signed event", async () => {
    const result = await ingestRawEvents([VALID_EVENT], CTX, NobleSignatureVerifier);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
  });

  it("10. rejects an event with an invalid signature", async () => {
    const forged: NostrEvent = { ...VALID_EVENT, content: "forged" };
    const result = await ingestRawEvents([forged], CTX, NobleSignatureVerifier);
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.issues[0]?.field).toBe("sig");
  });
});
