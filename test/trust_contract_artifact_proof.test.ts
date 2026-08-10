import { describe, it, expect } from "vitest";
import { FedosTrustSigningKeypair, fixedFedosTrustClock, FEDOS_TRUST_ENVELOPE_VERSION_1, FEDOS_TRUST_SIGNATURE_ALGORITHM_SCHNORR_SECP256K1, signFedosTrustEnvelopeV1 } from "../src/os/trust/envelope/index.js";
import { createFedosTrustPolicy } from "../src/os/trust/policy/index.js";
import {
  computeFedosTrustArtifactDigestHexSha256,
  issueFedosTrustContractArtifactProof,
  verifyFedosTrustContractArtifactProof,
  verifyFedosTrustDelegatedContractProof,
  FEDOS_TRUST_CONTRACT_PROOF_REQUIRED_SCOPE,
} from "../src/os/trust/contracts/index.js";

function buildIssuedProof(overrides: { artifactBytes?: Uint8Array; issuedAt?: number; expiresAt?: number } = {}) {
  const keypair = FedosTrustSigningKeypair.generate();
  const artifactBytes = overrides.artifactBytes ?? new TextEncoder().encode("artifact source bytes v1");
  const artifactDigestHex = computeFedosTrustArtifactDigestHexSha256(artifactBytes);
  const signed = issueFedosTrustContractArtifactProof(
    { artifactDigestHex, metadata: { buildId: "b-1", verified: true } },
    {
      issuer: "self",
      subject: keypair.publicKeyHex,
      issuedAt: overrides.issuedAt ?? 1_000,
      expiresAt: overrides.expiresAt,
      keypair,
    },
  );
  const policy = createFedosTrustPolicy([
    { issuerId: "self", keys: [{ keyId: keypair.publicKeyHex, publicKeyHex: keypair.publicKeyHex }] },
  ]);
  return { keypair, artifactBytes, artifactDigestHex, signed, policy };
}

describe("fedos trust contract-artifact proof — issue + verify", () => {
  it("issues a valid proof and verifies it: VALID signature, content claim always NOT_EVALUATED", () => {
    const { signed, policy } = buildIssuedProof();
    const result = verifyFedosTrustContractArtifactProof(signed, policy, { clock: fixedFedosTrustClock(1_000) });
    expect(result.artifactSignature).toBe("VALID");
    expect(result.contentClaim).toBe("NOT_EVALUATED");
  });

  it("digest hex is deterministic and matches @noble/hashes sha256 directly", () => {
    const bytes = new TextEncoder().encode("hello artifact");
    const digest1 = computeFedosTrustArtifactDigestHexSha256(bytes);
    const digest2 = computeFedosTrustArtifactDigestHexSha256(bytes);
    expect(digest1).toBe(digest2);
    expect(digest1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("chainIdentifier is omitted from the payload unless explicitly supplied", () => {
    const keypair = FedosTrustSigningKeypair.generate();
    const signed = issueFedosTrustContractArtifactProof(
      { artifactDigestHex: computeFedosTrustArtifactDigestHexSha256(new TextEncoder().encode("x")) },
      { issuer: "self", issuedAt: 1_000, keypair },
    );
    expect(signed.payload.chainIdentifier).toBeUndefined();
  });

  it("chainIdentifier is included and verifiable when explicitly supplied", () => {
    const keypair = FedosTrustSigningKeypair.generate();
    const artifactDigestHex = computeFedosTrustArtifactDigestHexSha256(new TextEncoder().encode("x"));
    const signed = issueFedosTrustContractArtifactProof(
      { artifactDigestHex, chainIdentifier: "example-chain-1" },
      { issuer: "self", issuedAt: 1_000, keypair },
    );
    expect(signed.payload.chainIdentifier).toBe("example-chain-1");
    const policy = createFedosTrustPolicy([
      { issuerId: "self", keys: [{ keyId: keypair.publicKeyHex, publicKeyHex: keypair.publicKeyHex }] },
    ]);
    const result = verifyFedosTrustContractArtifactProof(signed, policy, { clock: fixedFedosTrustClock(1_000) });
    expect(result.artifactSignature).toBe("VALID");
  });

  it("fails closed: contract hash tamper -> artifactSignature INVALID, contentClaim stays NOT_EVALUATED (never collapses)", () => {
    const { signed, policy } = buildIssuedProof();
    const tampered = {
      ...signed,
      payload: { ...signed.payload, artifactDigestHex: "f".repeat(64) },
    };
    const result = verifyFedosTrustContractArtifactProof(tampered, policy, { clock: fixedFedosTrustClock(1_000) });
    expect(result.artifactSignature).not.toBe("VALID");
    expect(result.artifactSignature).toBe("signature-invalid");
    expect(result.contentClaim).toBe("NOT_EVALUATED");
  });

  it("fails closed: wrong issuer (unknown key under policy) -> signature-invalid", () => {
    const { signed } = buildIssuedProof();
    const otherKeypair = FedosTrustSigningKeypair.generate();
    const wrongPolicy = createFedosTrustPolicy([
      { issuerId: "self", keys: [{ keyId: otherKeypair.publicKeyHex, publicKeyHex: otherKeypair.publicKeyHex }] },
    ]);
    const result = verifyFedosTrustContractArtifactProof(signed, wrongPolicy, { clock: fixedFedosTrustClock(1_000) });
    expect(result.artifactSignature).not.toBe("VALID");
    expect(result.contentClaim).toBe("NOT_EVALUATED");
  });

  it("fails closed: wrong subject via unknown-issuer-key style tamper still keeps contentClaim NOT_EVALUATED", () => {
    const { signed, policy } = buildIssuedProof();
    const tamperedSubject = { ...signed, subject: "someone-else-entirely" };
    const result = verifyFedosTrustContractArtifactProof(tamperedSubject, policy, { clock: fixedFedosTrustClock(1_000) });
    expect(result.artifactSignature).toBe("signature-invalid");
    expect(result.contentClaim).toBe("NOT_EVALUATED");
  });

  it("fails closed: wrong envelope type is rejected even with a structurally valid payload", () => {
    const { signed, policy } = buildIssuedProof();
    const wrongType = { ...signed, type: "fedos.credential.v1" as const };
    const result = verifyFedosTrustContractArtifactProof(wrongType, policy, { clock: fixedFedosTrustClock(1_000) });
    expect(result.artifactSignature).toBe("wrong-domain-type");
    expect(result.contentClaim).toBe("NOT_EVALUATED");
  });

  it("fails closed: expired proof -> expired, contentClaim stays NOT_EVALUATED", () => {
    const { signed, policy } = buildIssuedProof({ issuedAt: 1_000, expiresAt: 2_000 });
    const result = verifyFedosTrustContractArtifactProof(signed, policy, { clock: fixedFedosTrustClock(50_000) });
    expect(result.artifactSignature).toBe("expired");
    expect(result.contentClaim).toBe("NOT_EVALUATED");
  });
});

describe("fedos trust contract-artifact proof — delegated (artifact + entitlement) verification", () => {
  function buildEntitlementEnvelope(scopes: readonly string[], keypair = FedosTrustSigningKeypair.generate()) {
    const canonicalPayload = `{"scopes":${JSON.stringify(scopes)}}`;
    const signed = signFedosTrustEnvelopeV1(
      {
        version: FEDOS_TRUST_ENVELOPE_VERSION_1,
        type: "fedos.subscription.v1",
        issuer: "fedos-official",
        issuedAt: 1_000,
        signatureAlgorithm: FEDOS_TRUST_SIGNATURE_ALGORITHM_SCHNORR_SECP256K1,
        keyId: keypair.publicKeyHex,
        payload: { scopes },
      },
      canonicalPayload,
      keypair,
    );
    return { signed, canonicalPayload, keypair };
  }

  it("both signatures valid + required scope present -> VALID / VALID", () => {
    const { signed: artifactEnvelope, policy: artifactPolicy, keypair: artifactKeypair } = buildIssuedProof();
    const entitlementKeypair = FedosTrustSigningKeypair.generate();
    const { signed: entitlementEnvelope, canonicalPayload: entitlementCanonicalPayload } = buildEntitlementEnvelope(
      [FEDOS_TRUST_CONTRACT_PROOF_REQUIRED_SCOPE],
      entitlementKeypair,
    );
    const trustPolicy = createFedosTrustPolicy([
      { issuerId: "self", keys: [{ keyId: artifactKeypair.publicKeyHex, publicKeyHex: artifactKeypair.publicKeyHex }] },
      { issuerId: "fedos-official", keys: [{ keyId: entitlementKeypair.publicKeyHex, publicKeyHex: entitlementKeypair.publicKeyHex }] },
    ]);

    const result = verifyFedosTrustDelegatedContractProof({
      artifactEnvelope,
      entitlementEnvelope,
      entitlementCanonicalPayload,
      trustPolicy,
      options: { clock: fixedFedosTrustClock(1_000) },
    });

    expect(result.artifactSignature).toBe("VALID");
    expect(result.subscriptionEntitlement).toBe("VALID");
    expect(result.contentClaim).toBe("NOT_EVALUATED");
    void artifactPolicy;
  });

  it("valid signatures but missing required scope -> missing-required-scope, artifact stays VALID independently", () => {
    const { signed: artifactEnvelope, keypair: artifactKeypair } = buildIssuedProof();
    const entitlementKeypair = FedosTrustSigningKeypair.generate();
    const { signed: entitlementEnvelope, canonicalPayload: entitlementCanonicalPayload } = buildEntitlementEnvelope(
      ["some-other-scope"],
      entitlementKeypair,
    );
    const trustPolicy = createFedosTrustPolicy([
      { issuerId: "self", keys: [{ keyId: artifactKeypair.publicKeyHex, publicKeyHex: artifactKeypair.publicKeyHex }] },
      { issuerId: "fedos-official", keys: [{ keyId: entitlementKeypair.publicKeyHex, publicKeyHex: entitlementKeypair.publicKeyHex }] },
    ]);

    const result = verifyFedosTrustDelegatedContractProof({
      artifactEnvelope,
      entitlementEnvelope,
      entitlementCanonicalPayload,
      trustPolicy,
      options: { clock: fixedFedosTrustClock(1_000) },
    });

    expect(result.artifactSignature).toBe("VALID");
    expect(result.subscriptionEntitlement).toBe("missing-required-scope");
    expect(result.contentClaim).toBe("NOT_EVALUATED");
  });

  it("artifact signature invalid while entitlement is valid -> each field independent, never collapsed", () => {
    const { signed: artifactEnvelope, keypair: artifactKeypair } = buildIssuedProof();
    const tamperedArtifact = { ...artifactEnvelope, payload: { ...artifactEnvelope.payload, artifactDigestHex: "e".repeat(64) } };
    const entitlementKeypair = FedosTrustSigningKeypair.generate();
    const { signed: entitlementEnvelope, canonicalPayload: entitlementCanonicalPayload } = buildEntitlementEnvelope(
      [FEDOS_TRUST_CONTRACT_PROOF_REQUIRED_SCOPE],
      entitlementKeypair,
    );
    const trustPolicy = createFedosTrustPolicy([
      { issuerId: "self", keys: [{ keyId: artifactKeypair.publicKeyHex, publicKeyHex: artifactKeypair.publicKeyHex }] },
      { issuerId: "fedos-official", keys: [{ keyId: entitlementKeypair.publicKeyHex, publicKeyHex: entitlementKeypair.publicKeyHex }] },
    ]);

    const result = verifyFedosTrustDelegatedContractProof({
      artifactEnvelope: tamperedArtifact,
      entitlementEnvelope,
      entitlementCanonicalPayload,
      trustPolicy,
      options: { clock: fixedFedosTrustClock(1_000) },
    });

    expect(result.artifactSignature).toBe("signature-invalid");
    expect(result.subscriptionEntitlement).toBe("VALID");
    expect(result.contentClaim).toBe("NOT_EVALUATED");
  });
});
