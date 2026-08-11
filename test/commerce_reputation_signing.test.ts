import { describe, it, expect } from "vitest";
import {
  PersonaEpochSigningKeypair,
  verifyPersonaEpochSignatureOverBytes,
  PERSONA_EPOCH_KEY_COMPROMISE_NOTE,
} from "../src/os/commerce/reputation/persona_epoch_signing_keypair.js";
import {
  computeTradeRefDigestHex,
  generateTradeRefSaltHex,
  verifyTradeRefDigest,
  isWellFormedTradeRefSaltHex,
} from "../src/os/commerce/reputation/trade_ref_digest.js";
import {
  signTradeCompletionAttestation,
  verifyTradeCompletionAttestationEnvelope,
  signReputationAttestation,
  verifyReputationAttestationEnvelope,
  computeAttestationRef,
  TRADE_COMPLETION_ATTESTATION_ENVELOPE_TYPE,
} from "../src/os/commerce/reputation/attestation_sign_verify.js";
import type { TradeCompletionAttestationPayload, ReputationAttestationPayload } from "../src/os/commerce/reputation/attestation_types.js";
import { bytesToHex } from "@noble/hashes/utils.js";

describe("commerce reputation: PersonaEpochSigningKeypair", () => {
  it("generates a fresh, independent keypair with a well-formed public key", () => {
    const kp1 = PersonaEpochSigningKeypair.generate();
    const kp2 = PersonaEpochSigningKeypair.generate();
    expect(kp1.publicKeyHex).toMatch(/^[0-9a-f]{64}$/);
    expect(kp2.publicKeyHex).toMatch(/^[0-9a-f]{64}$/);
    expect(kp1.publicKeyHex).not.toBe(kp2.publicKeyHex);
  });

  it("signs and verifies bytes round-trip", () => {
    const kp = PersonaEpochSigningKeypair.generate();
    const bytes = new TextEncoder().encode("hello reputation");
    const sig = kp.signBytes(bytes);
    const sigHex = bytesToHex(sig);
    expect(verifyPersonaEpochSignatureOverBytes(kp.publicKeyHex, bytes, sigHex)).toBe(true);
  });

  it("rejects a signature verified against the wrong public key", () => {
    const kp1 = PersonaEpochSigningKeypair.generate();
    const kp2 = PersonaEpochSigningKeypair.generate();
    const bytes = new TextEncoder().encode("hello reputation");
    const sig = kp1.signBytes(bytes);
    const sigHex = bytesToHex(sig);
    expect(verifyPersonaEpochSignatureOverBytes(kp2.publicKeyHex, bytes, sigHex)).toBe(false);
  });

  it("fromSecretKeyBytes rejects a non-32-byte key", () => {
    expect(() => PersonaEpochSigningKeypair.fromSecretKeyBytes(new Uint8Array(31))).toThrow(RangeError);
  });

  it("the key-compromise note is a non-empty, human-readable string", () => {
    expect(typeof PERSONA_EPOCH_KEY_COMPROMISE_NOTE).toBe("string");
    expect(PERSONA_EPOCH_KEY_COMPROMISE_NOTE.toLowerCase()).toContain("compromis");
    expect(PERSONA_EPOCH_KEY_COMPROMISE_NOTE.toLowerCase()).toContain("revocation");
  });
});

describe("commerce reputation: trade ref digest", () => {
  it("computes a deterministic digest for the same (orderId, salt) pair", () => {
    const salt = generateTradeRefSaltHex();
    const d1 = computeTradeRefDigestHex("order-1", salt);
    const d2 = computeTradeRefDigestHex("order-1", salt);
    expect(d1).toBe(d2);
    expect(d1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("different salts produce different digests for the same order", () => {
    const d1 = computeTradeRefDigestHex("order-1", generateTradeRefSaltHex());
    const d2 = computeTradeRefDigestHex("order-1", generateTradeRefSaltHex());
    expect(d1).not.toBe(d2);
  });

  it("is not ambiguous under naive concatenation (netstring pre-image)", () => {
    // orderId="ab" + salt="cd" vs orderId="a" + salt="bcd" must not collide.
    const d1 = computeTradeRefDigestHex("ab", "cd");
    const d2 = computeTradeRefDigestHex("a", "bcd");
    expect(d1).not.toBe(d2);
  });

  it("verifyTradeRefDigest confirms a genuine (orderId, salt, digest) triple", () => {
    const salt = generateTradeRefSaltHex();
    const digest = computeTradeRefDigestHex("order-42", salt);
    expect(verifyTradeRefDigest("order-42", salt, digest)).toBe(true);
  });

  it("verifyTradeRefDigest rejects a tampered orderId, salt, or digest", () => {
    const salt = generateTradeRefSaltHex();
    const digest = computeTradeRefDigestHex("order-42", salt);
    expect(verifyTradeRefDigest("order-999", salt, digest)).toBe(false);
    expect(verifyTradeRefDigest("order-42", generateTradeRefSaltHex(), digest)).toBe(false);
    expect(verifyTradeRefDigest("order-42", salt, "f".repeat(64))).toBe(false);
  });

  it("verifyTradeRefDigest fails closed on malformed input, never throws", () => {
    expect(verifyTradeRefDigest(123, "ab", "c".repeat(64))).toBe(false);
    expect(verifyTradeRefDigest("order", "not-hex!", "c".repeat(64))).toBe(false);
    expect(verifyTradeRefDigest("order", "ab", "too-short")).toBe(false);
  });

  it("isWellFormedTradeRefSaltHex accepts generated salts and rejects garbage", () => {
    expect(isWellFormedTradeRefSaltHex(generateTradeRefSaltHex())).toBe(true);
    expect(isWellFormedTradeRefSaltHex("")).toBe(false);
    expect(isWellFormedTradeRefSaltHex("zz")).toBe(false);
    expect(isWellFormedTradeRefSaltHex(123)).toBe(false);
  });
});

function validTradeCompletionPayload(
  attestorEpochKeyPublicHex: string,
  overrides: Partial<TradeCompletionAttestationPayload> = {},
): TradeCompletionAttestationPayload {
  return {
    attestorEpochKeyPublicHex,
    subjectEpochId: "2".repeat(32),
    tradeRefDigestHex: computeTradeRefDigestHex("order-1", generateTradeRefSaltHex()),
    category: "digital_good",
    outcome: "completed_as_agreed",
    completedAt: 1_000,
    formatVersion: 1,
    ...overrides,
  };
}

describe("commerce reputation: sign/verify TradeCompletionAttestation", () => {
  it("issues a well-typed envelope and verifies it VALID", () => {
    const kp = PersonaEpochSigningKeypair.generate();
    const payload = validTradeCompletionPayload(kp.publicKeyHex);
    const envelope = signTradeCompletionAttestation(payload, kp, { issuer: kp.publicKeyHex, issuedAt: 1_000 });
    expect(envelope.type).toBe(TRADE_COMPLETION_ATTESTATION_ENVELOPE_TYPE);
    const result = verifyTradeCompletionAttestationEnvelope(envelope);
    expect(result.status).toBe("VALID");
  });

  it("rejects a payload whose attestorEpochKeyPublicHex does not match the signing keypair", () => {
    const kp = PersonaEpochSigningKeypair.generate();
    const other = PersonaEpochSigningKeypair.generate();
    const payload = validTradeCompletionPayload(other.publicKeyHex);
    expect(() => signTradeCompletionAttestation(payload, kp, { issuer: kp.publicKeyHex, issuedAt: 1_000 })).toThrow(RangeError);
  });

  it("TAMPERED TRADE REFERENCE: rejects an envelope whose tradeRefDigestHex was altered after signing", () => {
    const kp = PersonaEpochSigningKeypair.generate();
    const payload = validTradeCompletionPayload(kp.publicKeyHex);
    const envelope = signTradeCompletionAttestation(payload, kp, { issuer: kp.publicKeyHex, issuedAt: 1_000 });
    const tampered = { ...envelope, payload: { ...envelope.payload, tradeRefDigestHex: "f".repeat(64) } };
    const result = verifyTradeCompletionAttestationEnvelope(tampered);
    expect(result.status).toBe("SIGNATURE_INVALID");
  });

  it("WRONG SIGNER: rejects an envelope whose signature came from a different keypair than keyId names", () => {
    const kp = PersonaEpochSigningKeypair.generate();
    const attacker = PersonaEpochSigningKeypair.generate();
    const payload = validTradeCompletionPayload(kp.publicKeyHex);
    const envelope = signTradeCompletionAttestation(payload, kp, { issuer: kp.publicKeyHex, issuedAt: 1_000 });
    // Attacker swaps in their own signature over the same bytes, still claiming keyId = kp.publicKeyHex.
    const forgedSignatureBytes = attacker.signBytes(new TextEncoder().encode("unrelated bytes"));
    const forged = { ...envelope, signature: bytesToHex(forgedSignatureBytes) };
    expect(verifyTradeCompletionAttestationEnvelope(forged).status).toBe("SIGNATURE_INVALID");
  });

  it("rejects an envelope whose keyId does not match payload.attestorEpochKeyPublicHex", () => {
    const kp = PersonaEpochSigningKeypair.generate();
    const other = PersonaEpochSigningKeypair.generate();
    const payload = validTradeCompletionPayload(kp.publicKeyHex);
    const envelope = signTradeCompletionAttestation(payload, kp, { issuer: kp.publicKeyHex, issuedAt: 1_000 });
    const swapped = { ...envelope, keyId: other.publicKeyHex };
    expect(verifyTradeCompletionAttestationEnvelope(swapped).status).toBe("KEY_ID_MISMATCH");
  });

  it("rejects an envelope with the wrong type literal (domain separation)", () => {
    const kp = PersonaEpochSigningKeypair.generate();
    const payload = validTradeCompletionPayload(kp.publicKeyHex);
    const envelope = signTradeCompletionAttestation(payload, kp, { issuer: kp.publicKeyHex, issuedAt: 1_000 });
    const retyped = { ...envelope, type: "fedos.commerce.reputation-summary.v1" };
    expect(verifyTradeCompletionAttestationEnvelope(retyped).status).toBe("WRONG_TYPE");
  });

  it("rejects a malformed envelope shape without throwing", () => {
    expect(verifyTradeCompletionAttestationEnvelope(null).status).toBe("MALFORMED_ENVELOPE");
    expect(verifyTradeCompletionAttestationEnvelope({}).status).toBe("MALFORMED_ENVELOPE");
    expect(verifyTradeCompletionAttestationEnvelope("not an envelope").status).toBe("MALFORMED_ENVELOPE");
  });

  it("computeAttestationRef is stable for the same envelope and differs for a different one", () => {
    const kp = PersonaEpochSigningKeypair.generate();
    const p1 = validTradeCompletionPayload(kp.publicKeyHex);
    const p2 = validTradeCompletionPayload(kp.publicKeyHex, { completedAt: 2_000 });
    const e1 = signTradeCompletionAttestation(p1, kp, { issuer: kp.publicKeyHex, issuedAt: 1_000 });
    const e2 = signTradeCompletionAttestation(p2, kp, { issuer: kp.publicKeyHex, issuedAt: 2_000 });
    expect(computeAttestationRef(e1)).toBe(computeAttestationRef(e1));
    expect(computeAttestationRef(e1)).not.toBe(computeAttestationRef(e2));
  });
});

function validReputationSummaryPayload(
  subjectEpochKeyPublicHex: string,
  overrides: Partial<ReputationAttestationPayload> = {},
): ReputationAttestationPayload {
  return {
    subjectEpochId: "3".repeat(32),
    subjectEpochKeyPublicHex,
    verifiedTradeCount: 3,
    attestationRefs: ["ref-1", "ref-2"],
    asOf: 5_000,
    formatVersion: 1,
    ...overrides,
  };
}

describe("commerce reputation: sign/verify ReputationAttestation (summary)", () => {
  it("issues and verifies a self-attested summary", () => {
    const kp = PersonaEpochSigningKeypair.generate();
    const payload = validReputationSummaryPayload(kp.publicKeyHex);
    const envelope = signReputationAttestation(payload, kp, { issuer: kp.publicKeyHex, issuedAt: 5_000 });
    expect(verifyReputationAttestationEnvelope(envelope).status).toBe("VALID");
  });

  it("rejects a tampered verifiedTradeCount", () => {
    const kp = PersonaEpochSigningKeypair.generate();
    const payload = validReputationSummaryPayload(kp.publicKeyHex);
    const envelope = signReputationAttestation(payload, kp, { issuer: kp.publicKeyHex, issuedAt: 5_000 });
    const tampered = { ...envelope, payload: { ...envelope.payload, verifiedTradeCount: 999 } };
    expect(verifyReputationAttestationEnvelope(tampered).status).toBe("SIGNATURE_INVALID");
  });
});
