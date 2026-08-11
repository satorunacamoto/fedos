import { describe, it, expect } from "vitest";
import { validateInboundNostrEvent } from "../src/os/messenger/desktop/combined_inbound_event_validator.js";
import { verifyNostrEventId } from "../src/os/messenger/desktop/nostr_event_id_verifier.js";
import { verifyNostrEventSignature } from "../src/os/messenger/desktop/nostr_signature_verifier.js";
import type { FedosNostrWireEvent } from "../src/os/messenger/desktop/fedos_nostr_wire_event.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_248_known_answer_tamper_verification.md?raw";

/**
 * Three real, independently @noble/curves-Schnorr-signed NIP-01
 * events, standing in for "account index 0," "account index 1," and a
 * "large index" (u32::MAX-scale) surrogate -- the real Rust-side
 * deterministic account-index derivation pipeline is unreachable from
 * this test suite (Alpha 248 §2: no wasm artifact is ever committed or
 * built by vitest). Each was generated with a throwaway, never-
 * committed script directly exercising `schnorr.getPublicKey`/
 * `schnorr.sign` and this Arc's own NIP-01 canonical serializer, then
 * independently confirmed valid via `schnorr.verify` at generation
 * time, before being hardcoded here -- matching `noble_signature.test.ts`'s
 * own `VALID_EVENT` fixture convention exactly.
 */
const ACCOUNT_INDEX_0: FedosNostrWireEvent = {
  id: "23facf2db5ef552e83382c1dfd98082fe037ce146ad893e838eea156a644132e".slice(0, 64),
  pubkey: "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798".slice(0, 64),
  created_at: 1700000100,
  kind: 1,
  tags: [
    ["e", "a".repeat(64)],
    ["p", "b".repeat(64)],
  ],
  content: "account index 0 surrogate — em dash content",
  sig: "322ae10af45b409654bf304458466a2723d76b925a60d41ce4e9ced30bc296a239fa12fd8ebcee67942b895e0b8a8c14df1d5ca10dc04bd40ca426980aff4dd9",
};

const ACCOUNT_INDEX_1: FedosNostrWireEvent = {
  id: "88cbb591e9a816397d69ff20dee3988739062dba63f3de82984e5aa257420b99".slice(0, 64),
  pubkey: "c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5".slice(0, 64),
  created_at: 1700000200,
  kind: 1,
  tags: [],
  content: "account index 1 surrogate, no tags",
  sig: "db6df63f6a0424eef3a635c18a454850acfdae95464ac00486477a330b2f2a60f95b3bdb781a831132b637acf71c22c233061ceb4da770a967d758484bb08fa4",
};

const ACCOUNT_INDEX_LARGE: FedosNostrWireEvent = {
  id: "31715ebf58e5125b0bdb201e652bec205d1781405896fbe5116e646dfba5fc14".slice(0, 64),
  pubkey: "ba7e7b78e1ff713857bcc6432dcee5f7c6ca7fc8f84af479811bcabec921305e".slice(0, 64),
  created_at: 1700000300,
  kind: 1,
  tags: [["t", "surrogate"]],
  content: "large index (u32::MAX-scale) surrogate",
  sig: "d9bfb63acc8d6cc4cc6f3ca8e80d5c330337d419be572b3761bc75d5f5f9ee4ce929d1c1d59cc92fc46818eb5e716986ac63bb8838c3287ffb8e8e0cb5f056b3",
};

/** Content covers all six NIP-01-escaped characters plus non-ASCII UTF-8. */
const CANONICALIZATION_VECTOR: FedosNostrWireEvent = {
  id: "2a3478b0d3a76d59d9138e4ebcbb27a9d8bb069e5fae97926b42cf0457296c20".slice(0, 64),
  pubkey: "f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9".slice(0, 64),
  created_at: 1700000400,
  kind: 1,
  tags: [["e", "c".repeat(64)]],
  content:
    'quote:" backslash:\\ newline:\n cr:\r tab:\t backspace:\b formfeed:\f nonascii: héllo 世界 🎉',
  sig: "4a10b1651cc861a0d995492804fc2b0250ed5ba0a0b545a6a98892adc34677054349b7f46c7de3c548f41741e2dbdeab6e0109ea43630d7d97a816014867bb2a",
};

/**
 * Secure Runtime Alpha 248 -- "Known-Answer and Tamper Verification":
 * Stage 8 of the Nostr Inbound Event Validation Arc. Test coverage
 * only -- no production code change. Real, cryptographically valid
 * signed events, a full tamper matrix, and NIP-01 canonicalization
 * edge cases, confirming agreement with the outbound Event Foundation.
 */
describe("Secure Runtime Alpha 248 -- Known-Answer and Tamper Verification", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself REVIEW ONLY, adding test coverage only", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/it adds test coverage only/);
  });

  it("3. the design doc explains why the real Rust account-index pipeline is unreachable here", () => {
    expect(designDocSource).toMatch(/It is\s*\ntherefore NOT practical, from this test suite, to invoke the real\s*\naccount-index derivation pipeline/);
  });

  it("4. the design doc cross-references Alpha 247, Alpha 245, Alpha 243, Alpha 241, and Alpha 196", () => {
    for (const ref of [
      "secure_runtime_alpha_247_validation_failure_semantics",
      "secure_runtime_alpha_245_combined_inbound_event_validator",
      "secure_runtime_alpha_243_canonical_event_id_verification",
      "secure_runtime_alpha_241_existing_inbound_validation_inventory",
      "secure_runtime_alpha_196_event_foundation_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  // ---------------------------------------------------------------------
  // Known-answer: three real, valid, independently signed vectors
  // ---------------------------------------------------------------------

  it("5. account index 0 surrogate: valid id and signature, validates end to end", () => {
    expect(verifyNostrEventId(ACCOUNT_INDEX_0)).toBe(true);
    expect(verifyNostrEventSignature(ACCOUNT_INDEX_0)).toBe(true);
    expect(validateInboundNostrEvent(ACCOUNT_INDEX_0)).toEqual(ACCOUNT_INDEX_0);
  });

  it("6. account index 1 surrogate (no tags): valid id and signature, validates end to end", () => {
    expect(verifyNostrEventId(ACCOUNT_INDEX_1)).toBe(true);
    expect(verifyNostrEventSignature(ACCOUNT_INDEX_1)).toBe(true);
    expect(validateInboundNostrEvent(ACCOUNT_INDEX_1)).toEqual(ACCOUNT_INDEX_1);
  });

  it("7. large index (u32::MAX-scale) surrogate: valid id and signature, validates end to end", () => {
    expect(verifyNostrEventId(ACCOUNT_INDEX_LARGE)).toBe(true);
    expect(verifyNostrEventSignature(ACCOUNT_INDEX_LARGE)).toBe(true);
    expect(validateInboundNostrEvent(ACCOUNT_INDEX_LARGE)).toEqual(ACCOUNT_INDEX_LARGE);
  });

  // ---------------------------------------------------------------------
  // Tamper matrix -- each field changed independently, confirmed rejected
  // ---------------------------------------------------------------------

  it("8. content changed after signing -> rejected", () => {
    expect(validateInboundNostrEvent({ ...ACCOUNT_INDEX_0, content: "tampered" })).toBeNull();
  });

  it("9. created_at changed -> rejected", () => {
    expect(validateInboundNostrEvent({ ...ACCOUNT_INDEX_0, created_at: ACCOUNT_INDEX_0.created_at + 1 })).toBeNull();
  });

  it("10. kind changed -> rejected", () => {
    expect(validateInboundNostrEvent({ ...ACCOUNT_INDEX_0, kind: 2 })).toBeNull();
  });

  it("11. tags changed -> rejected", () => {
    expect(validateInboundNostrEvent({ ...ACCOUNT_INDEX_0, tags: [["e", "f".repeat(64)]] })).toBeNull();
  });

  it("12. pubkey changed -> rejected", () => {
    expect(validateInboundNostrEvent({ ...ACCOUNT_INDEX_0, pubkey: ACCOUNT_INDEX_1.pubkey })).toBeNull();
  });

  it("13. id changed -> rejected", () => {
    expect(validateInboundNostrEvent({ ...ACCOUNT_INDEX_0, id: "00".repeat(32) })).toBeNull();
  });

  it("14. signature changed -> rejected", () => {
    expect(validateInboundNostrEvent({ ...ACCOUNT_INDEX_0, sig: ACCOUNT_INDEX_1.sig })).toBeNull();
  });

  it("15. one hex nibble of the signature flipped -> rejected", () => {
    const sig = ACCOUNT_INDEX_0.sig.slice(0, -1) + (ACCOUNT_INDEX_0.sig.endsWith("9") ? "8" : "9");
    expect(validateInboundNostrEvent({ ...ACCOUNT_INDEX_0, sig })).toBeNull();
  });

  it("16. uppercase hex (id/pubkey/sig) -> rejected, never coerced to lowercase", () => {
    expect(validateInboundNostrEvent({ ...ACCOUNT_INDEX_0, id: ACCOUNT_INDEX_0.id.toUpperCase() })).toBeNull();
    expect(validateInboundNostrEvent({ ...ACCOUNT_INDEX_0, pubkey: ACCOUNT_INDEX_0.pubkey.toUpperCase() })).toBeNull();
    expect(validateInboundNostrEvent({ ...ACCOUNT_INDEX_0, sig: ACCOUNT_INDEX_0.sig.toUpperCase() })).toBeNull();
  });

  it("17. malformed hex (non-hex character) -> rejected", () => {
    expect(validateInboundNostrEvent({ ...ACCOUNT_INDEX_0, id: "g" + ACCOUNT_INDEX_0.id.slice(1) })).toBeNull();
    expect(validateInboundNostrEvent({ ...ACCOUNT_INDEX_0, pubkey: "g" + ACCOUNT_INDEX_0.pubkey.slice(1) })).toBeNull();
    expect(validateInboundNostrEvent({ ...ACCOUNT_INDEX_0, sig: "g" + ACCOUNT_INDEX_0.sig.slice(1) })).toBeNull();
  });

  it("18. wrong-length pubkey/id/sig -> rejected", () => {
    expect(validateInboundNostrEvent({ ...ACCOUNT_INDEX_0, pubkey: ACCOUNT_INDEX_0.pubkey.slice(0, -2) })).toBeNull();
    expect(validateInboundNostrEvent({ ...ACCOUNT_INDEX_0, id: ACCOUNT_INDEX_0.id.slice(0, -2) })).toBeNull();
    expect(validateInboundNostrEvent({ ...ACCOUNT_INDEX_0, sig: ACCOUNT_INDEX_0.sig.slice(0, -2) })).toBeNull();
  });

  // ---------------------------------------------------------------------
  // Canonicalization: dedicated vector, never tampered, confirmed valid
  // ---------------------------------------------------------------------

  it("19. canonicalization vector: quote/backslash/newline/CR/tab/backspace/form-feed/non-ASCII UTF-8, all valid end to end", () => {
    expect(CANONICALIZATION_VECTOR.content).toContain('"');
    expect(CANONICALIZATION_VECTOR.content).toContain("\\");
    expect(CANONICALIZATION_VECTOR.content).toContain("\n");
    expect(CANONICALIZATION_VECTOR.content).toContain("\r");
    expect(CANONICALIZATION_VECTOR.content).toContain("\t");
    expect(CANONICALIZATION_VECTOR.content).toContain("\b");
    expect(CANONICALIZATION_VECTOR.content).toContain("\f");
    expect(CANONICALIZATION_VECTOR.content).toMatch(/héllo 世界 🎉/);
    expect(verifyNostrEventId(CANONICALIZATION_VECTOR)).toBe(true);
    expect(verifyNostrEventSignature(CANONICALIZATION_VECTOR)).toBe(true);
    expect(validateInboundNostrEvent(CANONICALIZATION_VECTOR)).toEqual(CANONICALIZATION_VECTOR);
  });

  it("20. canonicalization vector, tampered content: rejected exactly like any other vector", () => {
    expect(validateInboundNostrEvent({ ...CANONICALIZATION_VECTOR, content: CANONICALIZATION_VECTOR.content + "!" })).toBeNull();
  });

  // ---------------------------------------------------------------------
  // No external network calls -- every call is synchronous, local
  // ---------------------------------------------------------------------

  it("21. every verification call is synchronous -- no Promise, no async network access", () => {
    const result = validateInboundNostrEvent(ACCOUNT_INDEX_0);
    expect(result).not.toBeInstanceOf(Promise);
    expect(verifyNostrEventId(ACCOUNT_INDEX_0)).not.toBeInstanceOf(Promise);
    expect(verifyNostrEventSignature(ACCOUNT_INDEX_0)).not.toBeInstanceOf(Promise);
  });
});
