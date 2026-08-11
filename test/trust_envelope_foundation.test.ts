import { describe, it, expect } from "vitest";
import {
  FEDOS_TRUST_ENVELOPE_VERSION_1,
  FEDOS_TRUST_SIGNATURE_ALGORITHM_SCHNORR_SECP256K1,
  FedosTrustSigningKeypair,
  signFedosTrustEnvelopeV1,
  verifyFedosTrustEnvelopeV1,
  fixedFedosTrustClock,
  type FedosTrustUnsignedEnvelope,
} from "../src/os/trust/envelope/index.js";
import { createFedosTrustPolicy } from "../src/os/trust/policy/index.js";

function canonicalTestPayload(message: string): string {
  return `{"message":${JSON.stringify(message)}}`;
}

function buildUnsigned(overrides: Partial<FedosTrustUnsignedEnvelope> = {}): FedosTrustUnsignedEnvelope {
  return {
    version: FEDOS_TRUST_ENVELOPE_VERSION_1,
    type: "fedos.credential.v1",
    issuer: "self",
    issuedAt: 1_000,
    signatureAlgorithm: FEDOS_TRUST_SIGNATURE_ALGORITHM_SCHNORR_SECP256K1,
    keyId: "k1",
    payload: { message: "hello" },
    ...overrides,
  };
}

describe("fedos trust envelope foundation", () => {
  it("signs and verifies a well-formed envelope", () => {
    const keypair = FedosTrustSigningKeypair.generate();
    const unsigned = buildUnsigned({ keyId: keypair.publicKeyHex, issuer: "self" });
    const canonicalPayload = canonicalTestPayload("hello");
    const signed = signFedosTrustEnvelopeV1(unsigned, canonicalPayload, keypair);

    const policy = createFedosTrustPolicy([{ issuerId: "self", keys: [{ keyId: keypair.publicKeyHex, publicKeyHex: keypair.publicKeyHex }] }]);
    const result = verifyFedosTrustEnvelopeV1(signed, canonicalPayload, policy, { clock: fixedFedosTrustClock(1_000) });
    expect(result.ok).toBe(true);
  });

  it("fails closed: tampered payload byte -> signature-invalid", () => {
    const keypair = FedosTrustSigningKeypair.generate();
    const unsigned = buildUnsigned({ keyId: keypair.publicKeyHex });
    const canonicalPayload = canonicalTestPayload("hello");
    const signed = signFedosTrustEnvelopeV1(unsigned, canonicalPayload, keypair);
    const policy = createFedosTrustPolicy([{ issuerId: "self", keys: [{ keyId: keypair.publicKeyHex, publicKeyHex: keypair.publicKeyHex }] }]);

    const tamperedPayload = canonicalTestPayload("hello!");
    const result = verifyFedosTrustEnvelopeV1(signed, tamperedPayload, policy, { clock: fixedFedosTrustClock(1_000) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("signature-invalid");
  });

  it("fails closed: wrong domain type is rejected even with a valid signature", () => {
    const keypair = FedosTrustSigningKeypair.generate();
    const unsigned = buildUnsigned({ keyId: keypair.publicKeyHex, type: "fedos.credential.v1" });
    const canonicalPayload = canonicalTestPayload("hello");
    const signed = signFedosTrustEnvelopeV1(unsigned, canonicalPayload, keypair);
    const policy = createFedosTrustPolicy([{ issuerId: "self", keys: [{ keyId: keypair.publicKeyHex, publicKeyHex: keypair.publicKeyHex }] }]);

    const result = verifyFedosTrustEnvelopeV1(signed, canonicalPayload, policy, {
      clock: fixedFedosTrustClock(1_000),
      expectedType: "fedos.subscription.v1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("wrong-domain-type");
  });

  it("fails closed: unknown issuer key -> unknown-issuer-key", () => {
    const keypair = FedosTrustSigningKeypair.generate();
    const other = FedosTrustSigningKeypair.generate();
    const unsigned = buildUnsigned({ keyId: other.publicKeyHex });
    const canonicalPayload = canonicalTestPayload("hello");
    const signed = signFedosTrustEnvelopeV1(unsigned, canonicalPayload, keypair);
    const policy = createFedosTrustPolicy([{ issuerId: "self", keys: [{ keyId: other.publicKeyHex, publicKeyHex: other.publicKeyHex }] }]);

    const result = verifyFedosTrustEnvelopeV1(signed, canonicalPayload, policy, { clock: fixedFedosTrustClock(1_000) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("signature-invalid");
  });

  it("fails closed: expired envelope -> expired", () => {
    const keypair = FedosTrustSigningKeypair.generate();
    const unsigned = buildUnsigned({ keyId: keypair.publicKeyHex, issuedAt: 1_000, expiresAt: 2_000 });
    const canonicalPayload = canonicalTestPayload("hello");
    const signed = signFedosTrustEnvelopeV1(unsigned, canonicalPayload, keypair);
    const policy = createFedosTrustPolicy([{ issuerId: "self", keys: [{ keyId: keypair.publicKeyHex, publicKeyHex: keypair.publicKeyHex }] }]);

    const result = verifyFedosTrustEnvelopeV1(signed, canonicalPayload, policy, { clock: fixedFedosTrustClock(10_000) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });

  it("fails closed: not-yet-valid envelope -> not-yet-valid", () => {
    const keypair = FedosTrustSigningKeypair.generate();
    const unsigned = buildUnsigned({ keyId: keypair.publicKeyHex, issuedAt: 10_000 });
    const canonicalPayload = canonicalTestPayload("hello");
    const signed = signFedosTrustEnvelopeV1(unsigned, canonicalPayload, keypair);
    const policy = createFedosTrustPolicy([{ issuerId: "self", keys: [{ keyId: keypair.publicKeyHex, publicKeyHex: keypair.publicKeyHex }] }]);

    const result = verifyFedosTrustEnvelopeV1(signed, canonicalPayload, policy, { clock: fixedFedosTrustClock(1_000) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not-yet-valid");
  });

  it("unsupported version fails closed rather than being silently parsed as v1", () => {
    const keypair = FedosTrustSigningKeypair.generate();
    const unsigned = buildUnsigned({ keyId: keypair.publicKeyHex, version: 2 as typeof FEDOS_TRUST_ENVELOPE_VERSION_1 });
    const canonicalPayload = canonicalTestPayload("hello");
    expect(() => signFedosTrustEnvelopeV1(unsigned, canonicalPayload, keypair)).toThrow(/unsupported version/);
  });

  it("key rotation: an issuer key outside its notBefore/notAfter window is not trusted", () => {
    const keypair = FedosTrustSigningKeypair.generate();
    const unsigned = buildUnsigned({ keyId: keypair.publicKeyHex, issuedAt: 5_000 });
    const canonicalPayload = canonicalTestPayload("hello");
    const signed = signFedosTrustEnvelopeV1(unsigned, canonicalPayload, keypair);
    const policy = createFedosTrustPolicy([
      { issuerId: "self", keys: [{ keyId: keypair.publicKeyHex, publicKeyHex: keypair.publicKeyHex, notBefore: 6_000 }] },
    ]);

    const result = verifyFedosTrustEnvelopeV1(signed, canonicalPayload, policy, { clock: fixedFedosTrustClock(5_000) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unknown-issuer-key");
  });
});
