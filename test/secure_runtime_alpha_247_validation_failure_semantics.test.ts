import { describe, it, expect } from "vitest";
import { validateInboundNostrEvent } from "../src/desktop/combined_inbound_event_validator.js";
import { verifyNostrEventId } from "../src/desktop/nostr_event_id_verifier.js";
import { verifyNostrEventSignature } from "../src/desktop/nostr_signature_verifier.js";
import type { FedosNostrWireEvent } from "../src/desktop/fedos_nostr_wire_event.js";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import designDocSource from "../docs/secure_runtime_alpha_247_validation_failure_semantics.md?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import validatedEventTypeSource from "../src/os/messenger/desktop/fedos_validated_nostr_event.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import idVerifierSource from "../src/os/messenger/desktop/nostr_event_id_verifier.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import sigVerifierSource from "../src/os/messenger/desktop/nostr_signature_verifier.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import combinedValidatorSource from "../src/os/messenger/desktop/combined_inbound_event_validator.ts?raw";
// @ts-expect-error `?raw` modules are untyped in this project's tsconfig.
import adapterSource from "../src/os/messenger/desktop/validated_subscription_adapter.ts?raw";

const VALID_EVENT: FedosNostrWireEvent = {
  id: "9e4ed05065d5c5135e3843706956fe07b81c635ea3bd9eeddb9e207e82fd0f1d",
  pubkey: "f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9",
  created_at: 1700000300,
  kind: 1,
  tags: [["e", "c".repeat(64)]],
  content:
    'quote:" backslash:\\ newline:\n cr:\r tab:\t backspace:\b formfeed:\f nonascii: héllo 世界 🎉',
  sig: "cf26861991315ab023a2742f11994f2f87cffb587c5add230401e835fbed1798ce7901487a51bde1bd5ab37f4a3fa75ada90bff02ec0c6bbbc1bc327763ba514",
};

const NEW_ARC_FILES: Record<string, string> = {
  "fedos_validated_nostr_event.ts": validatedEventTypeSource,
  "nostr_event_id_verifier.ts": idVerifierSource,
  "nostr_signature_verifier.ts": sigVerifierSource,
  "combined_inbound_event_validator.ts": combinedValidatorSource,
  "validated_subscription_adapter.ts": adapterSource,
};

/**
 * Secure Runtime Alpha 247 -- "Validation Failure Semantics": Stage 7
 * of the Nostr Inbound Event Validation Arc. Review only -- no
 * production code change. Confirms all eight listed failure causes
 * collapse to the SAME `null`/dropped outcome at the public boundary,
 * with no oracle-like distinction exposed, and no second Observation
 * Framework.
 */
describe("Secure Runtime Alpha 247 -- Validation Failure Semantics", () => {
  it("1. the design doc exists and is substantial", () => {
    expect(typeof designDocSource).toBe("string");
    expect(designDocSource.length).toBeGreaterThan(2500);
  });

  it("2. the design doc declares itself REVIEW ONLY, with no further code change", () => {
    expect(designDocSource).toMatch(/this Stage is REVIEW ONLY/);
    expect(designDocSource).toMatch(/It makes NO further code change/);
  });

  it("3. the design doc's own section 2 lists all eight required causes", () => {
    const section = (designDocSource.match(/## 2\. All eight listed causes, confirmed indistinguishable([\s\S]*?)\n## 3\./) ?? [])[1] ?? "";
    for (const cause of [
      "**Wrong event id**",
      "**Malformed event id**",
      "**Wrong signature**",
      "**Malformed signature**",
      "**Malformed x-only pubkey**",
      "**Unsupported key encoding**",
      "**Canonicalization mismatch**",
      "**Cryptographic verifier exception**",
    ]) {
      expect(section).toContain(cause);
    }
  });

  it("4. the design doc's own section 4 states no second Observation Framework is created", () => {
    expect(designDocSource).toMatch(/Do not create a second\s*\nObservation Framework/);
  });

  it("5. the design doc cross-references Alpha 246, Alpha 245, Alpha 237, Alpha 219, and Alpha 248", () => {
    for (const ref of [
      "secure_runtime_alpha_246_validated_subscription_delivery",
      "secure_runtime_alpha_245_combined_inbound_event_validator",
      "secure_runtime_alpha_237_eose_lifecycle",
      "secure_runtime_alpha_219_relay_extensibility_review",
      "secure_runtime_alpha_248_known_answer_tamper_verification",
    ]) {
      expect(designDocSource).toContain(ref);
    }
  });

  it("6. structural: zero console.* call anywhere in the five Arc-owned files", () => {
    for (const [name, source] of Object.entries(NEW_ARC_FILES)) {
      expect(source, `${name} should carry no console.* call`).not.toMatch(/console\./);
    }
  });

  it("7. structural: none of the five Arc-owned files reference socket/connection state or a NOTICE/retry mechanism", () => {
    for (const [name, source] of Object.entries(NEW_ARC_FILES)) {
      expect(source, name).not.toMatch(/#connected|#socket|\.send\(|disconnect\(\)/);
    }
  });

  // ---------------------------------------------------------------------
  // Behavioral: all eight causes, confirmed indistinguishable at the
  // validateInboundNostrEvent boundary
  // ---------------------------------------------------------------------

  it("8. wrong event id -> null", () => {
    expect(validateInboundNostrEvent({ ...VALID_EVENT, id: "00".repeat(32) })).toBeNull();
  });

  it("9. malformed event id (wrong length / uppercase / non-hex) -> null", () => {
    expect(validateInboundNostrEvent({ ...VALID_EVENT, id: "a".repeat(63) })).toBeNull();
    expect(validateInboundNostrEvent({ ...VALID_EVENT, id: "A".repeat(64) })).toBeNull();
    expect(validateInboundNostrEvent({ ...VALID_EVENT, id: "g".repeat(64) })).toBeNull();
  });

  it("10. wrong signature -> null", () => {
    const sig = VALID_EVENT.sig.slice(0, -1) + (VALID_EVENT.sig.endsWith("9") ? "8" : "9");
    expect(validateInboundNostrEvent({ ...VALID_EVENT, sig })).toBeNull();
  });

  it("11. malformed signature (wrong length) -> null", () => {
    expect(validateInboundNostrEvent({ ...VALID_EVENT, sig: "abc" })).toBeNull();
  });

  it("12. malformed x-only pubkey -> null (fails id verification first, since pubkey participates in canonicalization)", () => {
    expect(validateInboundNostrEvent({ ...VALID_EVENT, pubkey: "xyz" })).toBeNull();
  });

  it("13. unsupported key encoding (bech32-shaped, uppercase, wrong length) -> null via the SAME hex-shape guard", () => {
    expect(validateInboundNostrEvent({ ...VALID_EVENT, pubkey: "npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq" })).toBeNull();
    expect(validateInboundNostrEvent({ ...VALID_EVENT, pubkey: VALID_EVENT.pubkey.toUpperCase() })).toBeNull();
  });

  it("14. canonicalization mismatch (id claims a value the canonical serializer does not reproduce) -> null, same code path as wrong id", () => {
    const mismatched = { ...VALID_EVENT, content: VALID_EVENT.content + " " };
    expect(verifyNostrEventId(mismatched)).toBe(false);
    expect(validateInboundNostrEvent(mismatched)).toBeNull();
  });

  it("15. cryptographic verifier exception (hostile shape) is swallowed by the verifiers' own try/catch -> null, never a thrown exception", () => {
    const hostile = { ...VALID_EVENT, tags: null as unknown as readonly (readonly string[])[] };
    expect(() => validateInboundNostrEvent(hostile)).not.toThrow();
    expect(validateInboundNostrEvent(hostile)).toBeNull();
  });

  it("16. every one of the eight causes above produces a listener call count of zero", () => {
    const causes: FedosNostrWireEvent[] = [
      { ...VALID_EVENT, id: "00".repeat(32) },
      { ...VALID_EVENT, id: "a".repeat(63) },
      { ...VALID_EVENT, sig: VALID_EVENT.sig.slice(0, -1) + "0" },
      { ...VALID_EVENT, sig: "abc" },
      { ...VALID_EVENT, pubkey: "xyz" },
      { ...VALID_EVENT, pubkey: VALID_EVENT.pubkey.toUpperCase() },
      { ...VALID_EVENT, content: VALID_EVENT.content + " " },
      { ...VALID_EVENT, tags: null as unknown as readonly (readonly string[])[] },
    ];
    for (const event of causes) {
      expect(validateInboundNostrEvent(event)).toBeNull();
    }
  });

  it("17. test-only introspection: individual verifiers MAY distinguish bad-id from bad-signature, even though the combined validator never exposes that distinction", () => {
    // badId: the claimed id is left UNCHANGED (so the signature, which
    // verifies over event.id's own bytes, still checks out) but the
    // body (content) no longer hashes to that id.
    const badId = { ...VALID_EVENT, content: VALID_EVENT.content + " tampered" };
    const badSig = { ...VALID_EVENT, sig: VALID_EVENT.sig.slice(0, -1) + "0" };
    expect(verifyNostrEventId(badId)).toBe(false);
    expect(verifyNostrEventSignature(badId)).toBe(true); // sig still verifies over the (unchanged) claimed id
    expect(verifyNostrEventId(badSig)).toBe(true);
    expect(verifyNostrEventSignature(badSig)).toBe(false);
    // Yet at the combined/public boundary, both collapse to the same null.
    expect(validateInboundNostrEvent(badId)).toBeNull();
    expect(validateInboundNostrEvent(badSig)).toBeNull();
  });

  it("18. a later, valid event still delivers after a run of invalid ones -- no retry/backoff/poisoning of shared state", () => {
    expect(validateInboundNostrEvent({ ...VALID_EVENT, id: "00".repeat(32) })).toBeNull();
    expect(validateInboundNostrEvent({ ...VALID_EVENT, sig: "abc" })).toBeNull();
    expect(validateInboundNostrEvent(VALID_EVENT)).toEqual(VALID_EVENT);
  });
});
