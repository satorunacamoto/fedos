import { describe, it, expect } from "vitest";
import { FedosTrustSigningKeypair, fixedFedosTrustClock } from "../src/os/trust/envelope/index.js";
import {
  signFedosTrustSubscriptionSigningRequest,
  verifyFedosTrustSubscriptionSigningRequest,
} from "../src/os/trust/entitlement/index.js";
import type { SubscriptionSigningRequest } from "../src/os/trust/entitlement/index.js";

const NOW = 1_800_000_000;

function requestFixture(subjectKeypair: FedosTrustSigningKeypair): SubscriptionSigningRequest {
  return {
    subjectPublicKeyHex: subjectKeypair.publicKeyHex,
    requestedPlan: "pro-monthly",
    requestedScopes: ["credential", "signed-qr"],
    requestNonce: "nonce-abc-123",
    createdAt: NOW,
    formatVersion: 1,
  };
}

describe("trust subscription signing request", () => {
  it("subject self-signs -> verify -> ok", () => {
    const subjectKeypair = FedosTrustSigningKeypair.generate();
    const request = requestFixture(subjectKeypair);
    const envelope = signFedosTrustSubscriptionSigningRequest(request, subjectKeypair, fixedFedosTrustClock(NOW));

    expect(envelope.type).toBe("fedos.subscription-request.v1");
    expect(envelope.issuer).toBe(subjectKeypair.publicKeyHex);
    expect(envelope.keyId).toBe(subjectKeypair.publicKeyHex);

    const result = verifyFedosTrustSubscriptionSigningRequest(envelope);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.requestedPlan).toBe("pro-monthly");
      expect(result.payload.requestedScopes).toEqual(["credential", "signed-qr"]);
    }
  });

  it("rejects constructing a request signed by a keypair that does not match subjectPublicKeyHex", () => {
    const subjectKeypair = FedosTrustSigningKeypair.generate();
    const otherKeypair = FedosTrustSigningKeypair.generate();
    const request = requestFixture(subjectKeypair);

    expect(() =>
      signFedosTrustSubscriptionSigningRequest(request, otherKeypair, fixedFedosTrustClock(NOW)),
    ).toThrow();
  });

  it("tamper detection: modified requestedPlan after signing -> FAIL signature-invalid", () => {
    const subjectKeypair = FedosTrustSigningKeypair.generate();
    const request = requestFixture(subjectKeypair);
    const envelope = signFedosTrustSubscriptionSigningRequest(request, subjectKeypair, fixedFedosTrustClock(NOW));
    const tampered = { ...envelope, payload: { ...envelope.payload, requestedPlan: "pro-yearly" } };

    const result = verifyFedosTrustSubscriptionSigningRequest(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("signature-invalid");
  });

  it("tamper detection: modified requestNonce -> FAIL signature-invalid", () => {
    const subjectKeypair = FedosTrustSigningKeypair.generate();
    const request = requestFixture(subjectKeypair);
    const envelope = signFedosTrustSubscriptionSigningRequest(request, subjectKeypair, fixedFedosTrustClock(NOW));
    const tampered = { ...envelope, payload: { ...envelope.payload, requestNonce: "different-nonce" } };

    const result = verifyFedosTrustSubscriptionSigningRequest(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("signature-invalid");
  });

  it("substituted subjectPublicKeyHex (impersonation attempt) -> FAIL subject-mismatch or signature-invalid", () => {
    const subjectKeypair = FedosTrustSigningKeypair.generate();
    const otherKeypair = FedosTrustSigningKeypair.generate();
    const request = requestFixture(subjectKeypair);
    const envelope = signFedosTrustSubscriptionSigningRequest(request, subjectKeypair, fixedFedosTrustClock(NOW));
    const tampered = {
      ...envelope,
      payload: { ...envelope.payload, subjectPublicKeyHex: otherKeypair.publicKeyHex },
    };

    const result = verifyFedosTrustSubscriptionSigningRequest(tampered);
    expect(result.ok).toBe(false);
  });

  it("wrong domain type -> FAIL wrong-domain-type", () => {
    const subjectKeypair = FedosTrustSigningKeypair.generate();
    const request = requestFixture(subjectKeypair);
    const envelope = signFedosTrustSubscriptionSigningRequest(request, subjectKeypair, fixedFedosTrustClock(NOW));
    const tampered = { ...envelope, type: "fedos.possession.v1" as const };

    const result = verifyFedosTrustSubscriptionSigningRequest(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("wrong-domain-type");
  });

  it("malformed payload (missing requestedScopes) -> FAIL", () => {
    const subjectKeypair = FedosTrustSigningKeypair.generate();
    const request = requestFixture(subjectKeypair);
    const envelope = signFedosTrustSubscriptionSigningRequest(request, subjectKeypair, fixedFedosTrustClock(NOW));
    const { requestedScopes: _omit, ...rest } = envelope.payload;
    const tampered = { ...envelope, payload: rest };

    const result = verifyFedosTrustSubscriptionSigningRequest(tampered);
    expect(result.ok).toBe(false);
  });
});
