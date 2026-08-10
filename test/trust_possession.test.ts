import { describe, it, expect } from "vitest";
import { FedosTrustSigningKeypair, fixedFedosTrustClock } from "../src/os/trust/envelope/index.js";
import { createSingleIssuerFedosTrustPolicy } from "../src/os/trust/policy/index.js";
import {
  createFedosTrustPossessionChallenge,
  createFedosTrustPossessionResponseV1,
  verifyFedosTrustPossessionResponseV1,
  createInMemoryFedosTrustUsedNonceTracker,
} from "../src/os/trust/possession/index.js";

const NOW = 1_800_000_000;

function subjectFixture(audience: string) {
  const keypair = FedosTrustSigningKeypair.generate();
  const trustPolicy = createSingleIssuerFedosTrustPolicy({
    issuerId: keypair.publicKeyHex,
    keys: [{ keyId: "device-1", publicKeyHex: keypair.publicKeyHex }],
  });
  const challenge = createFedosTrustPossessionChallenge(audience, fixedFedosTrustClock(NOW), 300);
  const response = createFedosTrustPossessionResponseV1({
    challenge,
    keyId: "device-1",
    keypair,
    clock: fixedFedosTrustClock(NOW + 1),
  });
  return { keypair, trustPolicy, challenge, response };
}

describe("trust proof of possession", () => {
  it("valid round-trip: sign -> verify -> ok", () => {
    const { keypair, trustPolicy, challenge, response } = subjectFixture("verifier-session-abc");

    const result = verifyFedosTrustPossessionResponseV1(response, challenge, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 5),
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.resolvedPublicKeyHex).toBe(keypair.publicKeyHex);
  });

  it("tampered payload byte -> FAIL", () => {
    const { trustPolicy, challenge, response } = subjectFixture("verifier-session-abc");
    // payload is always {}, so "tamper a byte" means injecting an unexpected key.
    const tampered = { ...response, payload: { unexpected: "value" } as unknown as Record<string, never> };

    const result = verifyFedosTrustPossessionResponseV1(tampered, challenge, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 5),
    });

    expect(result.ok).toBe(false);
  });

  it("changed envelope type -> FAIL (wrong-domain-type)", () => {
    const { trustPolicy, challenge, response } = subjectFixture("verifier-session-abc");
    const tampered = { ...response, type: "fedos.credential.v1" as const };

    const result = verifyFedosTrustPossessionResponseV1(tampered, challenge, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 5),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("wrong-domain-type");
  });

  it("changed issuer -> FAIL", () => {
    const { trustPolicy, challenge, response } = subjectFixture("verifier-session-abc");
    const tampered = { ...response, issuer: "someone-else" };

    const result = verifyFedosTrustPossessionResponseV1(tampered, challenge, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 5),
    });

    expect(result.ok).toBe(false);
  });

  it("changed subject -> FAIL", () => {
    const { trustPolicy, challenge, response } = subjectFixture("verifier-session-abc");
    const otherKeypair = FedosTrustSigningKeypair.generate();
    const tampered = { ...response, subject: otherKeypair.publicKeyHex };

    const result = verifyFedosTrustPossessionResponseV1(tampered, challenge, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 5),
    });

    expect(result.ok).toBe(false);
  });

  it("changed expiresAt -> FAIL", () => {
    const { trustPolicy, challenge, response } = subjectFixture("verifier-session-abc");
    const tampered = { ...response, expiresAt: (response.expiresAt ?? 0) + 1 };

    const result = verifyFedosTrustPossessionResponseV1(tampered, challenge, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 5),
    });

    expect(result.ok).toBe(false);
  });

  it("replay under the SAME audience with the tracker -> second use FAILS", () => {
    const { trustPolicy, challenge, response } = subjectFixture("verifier-session-abc");
    const tracker = createInMemoryFedosTrustUsedNonceTracker();

    const first = verifyFedosTrustPossessionResponseV1(response, challenge, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 5),
      nonceTracker: tracker,
    });
    expect(first.ok).toBe(true);

    const second = verifyFedosTrustPossessionResponseV1(response, challenge, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 6),
      nonceTracker: tracker,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("nonce-already-used");
  });

  it("reuse PoP under a DIFFERENT audience -> FAILS", () => {
    const { keypair, trustPolicy, challenge, response } = subjectFixture("verifier-session-abc");
    const differentChallenge = createFedosTrustPossessionChallenge(
      "verifier-session-xyz",
      fixedFedosTrustClock(NOW),
      300,
    );

    const result = verifyFedosTrustPossessionResponseV1(response, differentChallenge, trustPolicy, {
      clock: fixedFedosTrustClock(NOW + 5),
    });

    expect(result.ok).toBe(false);
    // The response's own audience ("verifier-session-abc") never matches the
    // different challenge's audience ("verifier-session-xyz").
    if (!result.ok) expect(["nonce-mismatch", "audience-mismatch"]).toContain(result.reason);
    void keypair;
  });
});
