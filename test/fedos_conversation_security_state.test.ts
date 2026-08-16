import { describe, it, expect } from "vitest";
import {
  deriveConversationSecurityState,
  type FedosConversationSecurityStateFacts,
} from "../src/os/messenger/desktop/presentation/security_state/fedos_conversation_security_state.js";

/**
 * Verified Secure Session UI mega-arc (Coordinator/Agent R design,
 * Coordinator implementation) — the false-green negative matrix (mandate
 * §27, 15 required scenarios) plus wrong-binding tests (§28), against the
 * real, frozen evaluator contract (`06_IMPLEMENTATION_PLAN.md`).
 */

const NOW = 1_700_000_000_000;

function baseFacts(overrides: Partial<FedosConversationSecurityStateFacts> = {}): FedosConversationSecurityStateFacts {
  return {
    conversationId: "conv-alice",
    now: NOW,
    identityContinuity: { hasRecord: false, acceptanceState: null, silentlyAutoAcceptedWithoutAsking: false, recordedAt: null, hasEverExchangedMessages: false },
    encryption: { ratchetStatus: null, asOf: null },
    forwardSecrecy: { forwardSecrecy: null, reason: null, asOf: null },
    deviceKnowledge: { observedPeerDeviceTrustStates: [], observedPeerDeviceKnowledgeStates: [], asOf: null },
    evidenceIntegrity: { lastRejectionReasonCode: null, asOf: NOW },
    metadataExposure: { connectedRelayCount: null },
    ...overrides,
  };
}

const FORBIDDEN_CLAIM_STRINGS = ["fully secure", "end-to-end verified", "identity verified", "all devices verified", "forward secrecy active", "no one can intercept", "anonymous", "safe"];

/** No axis's reasonCode may ever literally BE (or contain) a forbidden overclaim string -- reasonCodes are the raw material renderer copy is built from. */
function assertNoForbiddenClaim(state: ReturnType<typeof deriveConversationSecurityState>): void {
  for (const axis of [state.identityContinuity, state.encryption, state.forwardSecrecy, state.deviceKnowledge, state.evidenceIntegrity, state.metadataExposure]) {
    const lower = axis.reasonCode.toLowerCase();
    for (const forbidden of FORBIDDEN_CLAIM_STRINGS) {
      expect(lower, `reasonCode "${axis.reasonCode}" must not contain forbidden claim "${forbidden}"`).not.toContain(forbidden);
    }
  }
}

describe("deriveConversationSecurityState -- false-green negative matrix (mandate section 27)", () => {
  it("1. new/unknown peer -- never GOOD, TOFU never presented as verified", () => {
    const state = deriveConversationSecurityState(baseFacts());
    expect(state.identityContinuity.state).toBe("unknown");
    expect(state.deviceKnowledge.state).toBe("unknown");
    expect(state.encryption.state).not.toBe("good");
    assertNoForbiddenClaim(state);
  });

  it("2. established continuity -- GOOD across identity/encryption/device, but reasonCodes never claim cryptographic verification", () => {
    const state = deriveConversationSecurityState(
      baseFacts({
        identityContinuity: { hasRecord: false, acceptanceState: null, silentlyAutoAcceptedWithoutAsking: false, recordedAt: null, hasEverExchangedMessages: true },
        encryption: { ratchetStatus: "active", asOf: NOW },
        forwardSecrecy: { forwardSecrecy: true, reason: null, asOf: NOW },
        deviceKnowledge: { observedPeerDeviceTrustStates: ["trusted"], observedPeerDeviceKnowledgeStates: ["first-seen"], asOf: NOW },
      }),
    );
    expect(state.identityContinuity.state).toBe("good");
    expect(state.encryption.state).toBe("good");
    expect(state.forwardSecrecy.state).toBe("good");
    expect(state.deviceKnowledge.state).toBe("good");
    assertNoForbiddenClaim(state);
  });

  it("3. old-key condition (silently auto-accepted) -- ATTENTION, never GOOD merely because acceptanceState === accepted", () => {
    const state = deriveConversationSecurityState(
      baseFacts({
        identityContinuity: { hasRecord: true, acceptanceState: "accepted", silentlyAutoAcceptedWithoutAsking: true, recordedAt: NOW, hasEverExchangedMessages: true },
      }),
    );
    expect(state.identityContinuity.state).toBe("attention");
    expect(state.identityContinuity.reasonCode).toBe("identity-replacement-auto-accepted-without-asking");
  });

  it("4. identity key changed, no continuity evidence -- ATTENTION, never collapses to UNKNOWN (an actionable pending record must not look like 'never seen this peer')", () => {
    const state = deriveConversationSecurityState(
      baseFacts({
        identityContinuity: { hasRecord: true, acceptanceState: "manual-review-required", silentlyAutoAcceptedWithoutAsking: false, recordedAt: NOW, hasEverExchangedMessages: true },
      }),
    );
    expect(state.identityContinuity.state).toBe("attention");
    expect(state.identityContinuity.state).not.toBe("unknown");
  });

  it("5. unresolved transition -- ATTENTION, same shape as scenario 4 (both are genuinely-pending, actionable records)", () => {
    const state = deriveConversationSecurityState(
      baseFacts({
        identityContinuity: { hasRecord: true, acceptanceState: "manual-review-required", silentlyAutoAcceptedWithoutAsking: false, recordedAt: NOW, hasEverExchangedMessages: true },
      }),
    );
    expect(state.identityContinuity.state).toBe("attention");
    expect(state.identityContinuity.reasonCode).toBe("identity-change-unresolved");
  });

  it("6. resolved transition (explicit accept, not silent) -- GOOD, but reasonCode never says 'verified'", () => {
    const state = deriveConversationSecurityState(
      baseFacts({
        identityContinuity: { hasRecord: true, acceptanceState: "accepted", silentlyAutoAcceptedWithoutAsking: false, recordedAt: NOW, hasEverExchangedMessages: true },
      }),
    );
    expect(state.identityContinuity.state).toBe("good");
    expect(state.identityContinuity.reasonCode.toLowerCase()).not.toContain("verified");
  });

  it("7. encryption unavailable -- UNAVAILABLE, never a GOOD/ACTIVE-shaped false claim", () => {
    const state = deriveConversationSecurityState(baseFacts({ encryption: { ratchetStatus: "unavailable", asOf: NOW } }));
    expect(state.encryption.state).toBe("unavailable");
  });

  it("8. encryption active (session genuinely active) -- GOOD, but forward secrecy is evaluated INDEPENDENTLY and must not inherit GOOD merely because a session is active (ratchetConfigured false, the ordinary packaged default)", () => {
    const state = deriveConversationSecurityState(
      baseFacts({
        encryption: { ratchetStatus: "active", asOf: NOW },
        forwardSecrecy: { forwardSecrecy: false, reason: "ratchet-not-configured", asOf: NOW },
      }),
    );
    expect(state.encryption.state).toBe("good");
    expect(state.forwardSecrecy.state, "THE critical anti-overclaim case: an active session must never imply forward secrecy on its own").toBe("attention");
    expect(state.forwardSecrecy.reasonCode).toContain("no-forward-secrecy");
  });

  it("9. ratchet unavailable -- UNAVAILABLE, never conflated with NOT_APPLICABLE (a real outage must not look like 'not expected here')", () => {
    const state = deriveConversationSecurityState(baseFacts({ encryption: { ratchetStatus: "unavailable", asOf: NOW } }));
    expect(state.encryption.state).toBe("unavailable");
    expect(state.encryption.state).not.toBe("not-applicable");
  });

  it("10. missing peer device knowledge -- UNKNOWN, distinct from ATTENTION (nothing known vs something known-but-degraded)", () => {
    const state = deriveConversationSecurityState(baseFacts({ deviceKnowledge: { observedPeerDeviceTrustStates: [], observedPeerDeviceKnowledgeStates: [], asOf: null } }));
    expect(state.deviceKnowledge.state).toBe("unknown");
  });

  it("11. revoked device knowledge -- ATTENTION, never rendered identically to a fresh GOOD/trusted device (FedOS Peer Device Discovery Arc -- observedPeerDeviceTrustStates is now a LIVE Device Registry trust-state lookup, so a genuinely-degraded case is 'revoked'/'unavailable', not the retired 'stale' capability-only concept)", () => {
    const trusted = deriveConversationSecurityState(baseFacts({ deviceKnowledge: { observedPeerDeviceTrustStates: ["trusted"], observedPeerDeviceKnowledgeStates: ["first-seen"], asOf: NOW } }));
    const revoked = deriveConversationSecurityState(baseFacts({ deviceKnowledge: { observedPeerDeviceTrustStates: ["revoked"], observedPeerDeviceKnowledgeStates: ["unknown"], asOf: NOW } }));
    expect(trusted.deviceKnowledge.state).toBe("good");
    expect(revoked.deviceKnowledge.state).toBe("attention");
    expect(revoked.deviceKnowledge).not.toEqual(trusted.deviceKnowledge);
  });

  it("12. restart -- identityContinuity reads source 'cached', never 'live', for facts the adapter marks as not-just-reconfirmed; deviceKnowledge is a LIVE Registry read every call (a genuinely more honest 'live' reading, not a stale cache), so a 'pending' trust state reads UNKNOWN rather than a false GOOD", () => {
    const state = deriveConversationSecurityState(
      baseFacts({
        identityContinuity: { hasRecord: true, acceptanceState: "accepted", silentlyAutoAcceptedWithoutAsking: false, recordedAt: NOW - 1000, hasEverExchangedMessages: true },
        deviceKnowledge: { observedPeerDeviceTrustStates: ["pending"], observedPeerDeviceKnowledgeStates: ["unknown"], asOf: NOW - 1000 },
      }),
    );
    expect(state.identityContinuity.source).toBe("cached");
    // A restart never fabricates a "live" claim for data the adapter marked cached.
    expect(state.identityContinuity.source).not.toBe("live");
    expect(state.deviceKnowledge.state).toBe("unknown");
  });

  it("13. offline -- identityContinuity stays honestly 'cached', never silently claims current-ness while genuinely disconnected; an unresolved ('unknown') device trust state never silently reads GOOD", () => {
    const state = deriveConversationSecurityState(
      baseFacts({
        identityContinuity: { hasRecord: true, acceptanceState: "accepted", silentlyAutoAcceptedWithoutAsking: false, recordedAt: NOW - 5000, hasEverExchangedMessages: true },
        deviceKnowledge: { observedPeerDeviceTrustStates: ["unknown"], observedPeerDeviceKnowledgeStates: ["unknown"], asOf: NOW - 5000 },
      }),
    );
    expect(state.identityContinuity.source).toBe("cached");
    expect(state.deviceKnowledge.state).toBe("unknown");
  });

  it("14. replayed old security event (rejected) -- EVIDENCE_INTEGRITY surfaces the rejection; a rejected event has zero side effect on other axes", () => {
    const before = deriveConversationSecurityState(
      baseFacts({
        identityContinuity: { hasRecord: true, acceptanceState: "accepted", silentlyAutoAcceptedWithoutAsking: false, recordedAt: NOW, hasEverExchangedMessages: true },
      }),
    );
    const afterReplay = deriveConversationSecurityState(
      baseFacts({
        identityContinuity: { hasRecord: true, acceptanceState: "accepted", silentlyAutoAcceptedWithoutAsking: false, recordedAt: NOW, hasEverExchangedMessages: true },
        evidenceIntegrity: { lastRejectionReasonCode: "rejected-replayed", asOf: NOW },
      }),
    );
    expect(afterReplay.evidenceIntegrity.state).toBe("attention");
    expect(afterReplay.evidenceIntegrity.reasonCode).toBe("evidence-rejected-rejected-replayed");
    // Every OTHER axis is byte-for-byte identical before vs. after the replay attempt.
    expect(afterReplay.identityContinuity).toEqual(before.identityContinuity);
    expect(afterReplay.encryption).toEqual(before.encryption);
    expect(afterReplay.deviceKnowledge).toEqual(before.deviceKnowledge);
  });

  it("15. malformed/unverifiable security evidence -- ATTENTION, distinct from both GOOD (silently ignored) and UNKNOWN (as if nothing arrived)", () => {
    const nothingArrived = deriveConversationSecurityState(baseFacts());
    const malformed = deriveConversationSecurityState(baseFacts({ evidenceIntegrity: { lastRejectionReasonCode: "structurally-invalid", asOf: NOW } }));
    expect(nothingArrived.evidenceIntegrity.state).toBe("good");
    expect(malformed.evidenceIntegrity.state).toBe("attention");
    expect(malformed.evidenceIntegrity.state).not.toBe(nothingArrived.evidenceIntegrity.state);
  });
});

describe("deriveConversationSecurityState -- wrong-binding (mandate section 28)", () => {
  it("T -- conversationId in facts is echoed exactly, never substituted; two different conversations with different facts never produce identical, cross-contaminated axis results", () => {
    const convA = deriveConversationSecurityState(
      baseFacts({
        conversationId: "conv-A",
        identityContinuity: { hasRecord: true, acceptanceState: "accepted", silentlyAutoAcceptedWithoutAsking: true, recordedAt: NOW, hasEverExchangedMessages: true },
      }),
    );
    const convB = deriveConversationSecurityState(
      baseFacts({
        conversationId: "conv-B",
        identityContinuity: { hasRecord: false, acceptanceState: null, silentlyAutoAcceptedWithoutAsking: false, recordedAt: null, hasEverExchangedMessages: true },
      }),
    );
    expect(convA.conversationId).toBe("conv-A");
    expect(convB.conversationId).toBe("conv-B");
    expect(convA.identityContinuity.state).toBe("attention");
    expect(convB.identityContinuity.state).toBe("good");
    expect(convA.identityContinuity).not.toEqual(convB.identityContinuity);
  });
});

describe("deriveConversationSecurityState -- no global Verified boolean", () => {
  it("the output type has no top-level 'verified' field of any kind", () => {
    const state = deriveConversationSecurityState(baseFacts());
    expect(Object.keys(state)).not.toContain("verified");
    expect(Object.keys(state).sort()).toEqual(["conversationId", "deviceKnowledge", "encryption", "evidenceIntegrity", "forwardSecrecy", "identityContinuity", "metadataExposure"].sort());
  });
});

describe("deriveConversationSecurityState -- Direct Ratchet P1 arc: TOFU knowledge-state reasonCode, never a global Verified boolean", () => {
  it("a first-seen-only trusted device reads GOOD (a valid binding IS a valid binding) but the reasonCode names it 'first-seen-only', never the same reasonCode as a continuity-confirmed device", () => {
    const firstSeen = deriveConversationSecurityState(baseFacts({ deviceKnowledge: { observedPeerDeviceTrustStates: ["trusted"], observedPeerDeviceKnowledgeStates: ["first-seen"], asOf: NOW } }));
    const continuity = deriveConversationSecurityState(baseFacts({ deviceKnowledge: { observedPeerDeviceTrustStates: ["trusted"], observedPeerDeviceKnowledgeStates: ["continuity-established"], asOf: NOW } }));
    expect(firstSeen.deviceKnowledge.state).toBe("good");
    expect(continuity.deviceKnowledge.state).toBe("good");
    expect(firstSeen.deviceKnowledge.reasonCode).toBe("observed-devices-trusted-first-seen-only");
    expect(continuity.deviceKnowledge.reasonCode).toBe("observed-devices-trusted");
    expect(firstSeen.deviceKnowledge.reasonCode).not.toBe(continuity.deviceKnowledge.reasonCode);
    assertNoForbiddenClaim(firstSeen);
    assertNoForbiddenClaim(continuity);
  });

  it("a rejected conflicting re-key attempt surfaces as ATTENTION even though the prior accepted binding is still 'trusted' -- never silently invisible", () => {
    const state = deriveConversationSecurityState(
      baseFacts({ deviceKnowledge: { observedPeerDeviceTrustStates: ["trusted"], observedPeerDeviceKnowledgeStates: ["conflicting-rejected"], asOf: NOW } }),
    );
    expect(state.deviceKnowledge.state).toBe("attention");
    expect(state.deviceKnowledge.reasonCode).toBe("observed-device-conflicting-rekey-rejected");
    assertNoForbiddenClaim(state);
  });
});

describe("deriveConversationSecurityState -- output never contains secret material", () => {
  it("no field name or string value in the output ever resembles a key/secret (spot check against a maximally-populated facts object)", () => {
    const state = deriveConversationSecurityState(
      baseFacts({
        identityContinuity: { hasRecord: true, acceptanceState: "accepted", silentlyAutoAcceptedWithoutAsking: false, recordedAt: NOW, hasEverExchangedMessages: true },
        encryption: { ratchetStatus: "active", asOf: NOW },
        forwardSecrecy: { forwardSecrecy: true, reason: null, asOf: NOW },
        deviceKnowledge: { observedPeerDeviceTrustStates: ["trusted"], observedPeerDeviceKnowledgeStates: ["first-seen"], asOf: NOW },
        evidenceIntegrity: { lastRejectionReasonCode: null, asOf: NOW },
        metadataExposure: { connectedRelayCount: 1 },
      }),
    );
    const serialized = JSON.stringify(state);
    expect(serialized).not.toMatch(/[0-9a-f]{64}/); // no raw 32-byte-hex key/pubkey-shaped value
    expect(serialized.toLowerCase()).not.toContain("privatekey");
    expect(serialized.toLowerCase()).not.toContain("masterseed");
    expect(serialized.toLowerCase()).not.toContain("recoverybundle");
  });
});
